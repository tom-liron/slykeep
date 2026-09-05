import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Upstash SDKs are stubbed rather than exercised: what is worth testing here is the policy
 * around the limiter — which key each endpoint counts by, and what happens when the limiter cannot
 * answer — not the sliding-window arithmetic, which is the library's own and already tested there.
 */
type LimiterConfig = { limiter: { tokens: number; window: string }; prefix: string };

// `vi.hoisted` because `vi.mock` factories are lifted above every other statement in the file, so a
// plain `const` declared here would not exist yet when the factory runs.
const { limit, constructed } = vi.hoisted(() => ({
    limit: vi.fn(),
    /** Called once per `new Ratelimit(...)`, which is how the reuse test observes construction. */
    constructed: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
    Redis: class {
        constructor(public config: unknown) {}
    },
}));

vi.mock("@upstash/ratelimit", () => ({
    Ratelimit: class {
        static slidingWindow = (tokens: number, window: string) => ({ tokens, window });
        limit = limit;
        constructor(config: unknown) {
            constructed(config);
        }
    },
}));

const headerValues = new Map<string, string>();

vi.mock("next/headers", () => ({
    headers: async () => ({ get: (name: string) => headerValues.get(name) ?? null }),
}));

/**
 * The module caches its Redis client and its limiters at module scope — which is the point of them,
 * since a per-request limiter would throw away the ephemeral cache. So each test needs a fresh copy
 * rather than a shared one, and the credentials have to be in place before the import.
 */
async function load({ configured = true } = {}) {
    vi.resetModules();

    if (configured) {
        vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
        vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    } else {
        vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
        vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    }

    return import("./rate-limit");
}

/** A permitted answer from the stubbed limiter, in the shape the real SDK returns. */
function permit(overrides: Partial<{ success: boolean; remaining: number; reset: number }> = {}) {
    return { success: true, limit: 5, remaining: 4, reset: Date.now() + 60_000, ...overrides };
}

beforeEach(() => {
    limit.mockReset();
    limit.mockResolvedValue(permit());
    constructed.mockClear();
    headerValues.clear();
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("checkRateLimit", () => {
    it("allows the request without consulting Redis when Upstash is not configured", async () => {
        const { checkRateLimit } = await load({ configured: false });

        const result = await checkRateLimit("signIn", "1.2.3.4", "user@example.com");

        // Not merely "returns success" — the limiter must not have been reached at all, which is
        // what lets development and CI run with no Redis instance.
        expect(limit).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(5);
    });

    it("allows the request when the limiter throws", async () => {
        // The fail-open rule: an Upstash outage must not become a total loss of sign-in.
        const logged = vi.spyOn(console, "error").mockImplementation(() => {});
        const { checkRateLimit } = await load();

        limit.mockRejectedValue(new Error("upstash unreachable"));

        await expect(checkRateLimit("register", "1.2.3.4")).resolves.toMatchObject({
            success: true,
            remaining: 3,
        });
        expect(logged).toHaveBeenCalled();
    });

    it("reports a refusal through unchanged", async () => {
        const { checkRateLimit } = await load();
        const reset = Date.now() + 900_000;

        limit.mockResolvedValue(permit({ success: false, remaining: 0, reset }));

        await expect(checkRateLimit("signIn", "1.2.3.4", "user@example.com")).resolves.toEqual({
            success: false,
            remaining: 0,
            reset,
        });
    });

    it("keys the IP-only limits by IP even when an email is passed", async () => {
        // The property that matters: were the email in this key, a script could buy a fresh budget
        // for every address it invented, which is the abuse these three limits exist to stop.
        const { checkRateLimit } = await load();

        for (const name of ["register", "forgotPassword", "resetPassword"] as const) {
            limit.mockClear();
            await checkRateLimit(name, "1.2.3.4", "user@example.com");

            expect(limit).toHaveBeenCalledWith("1.2.3.4");
        }
    });

    it("keys the per-account limits by IP and email together", async () => {
        const { checkRateLimit } = await load();

        await checkRateLimit("signIn", "1.2.3.4", "user@example.com");
        expect(limit).toHaveBeenCalledWith("1.2.3.4:user@example.com");

        limit.mockClear();
        await checkRateLimit("resendVerification", "1.2.3.4", "user@example.com");
        expect(limit).toHaveBeenCalledWith("1.2.3.4:user@example.com");
    });

    it("folds case in the email so one address cannot buy two budgets", async () => {
        const { checkRateLimit } = await load();

        await checkRateLimit("signIn", "1.2.3.4", "User@Example.COM");

        expect(limit).toHaveBeenCalledWith("1.2.3.4:user@example.com");
    });

    it("reuses one limiter per name rather than building a new one per call", async () => {
        // A limiter rebuilt per request would discard the in-memory cache that spares a Redis round
        // trip once an identifier is known to be over its limit — exactly when it is needed most.
        const { checkRateLimit } = await load();

        await checkRateLimit("signIn", "1.2.3.4", "a@example.com");
        await checkRateLimit("signIn", "5.6.7.8", "b@example.com");

        expect(limit).toHaveBeenCalledTimes(2);
        expect(constructed).toHaveBeenCalledTimes(1);
    });

    it("builds a separate, namespaced limiter for each endpoint", async () => {
        // Shared keys would let one endpoint's traffic spend another's budget.
        const { checkRateLimit } = await load();

        await checkRateLimit("signIn", "1.2.3.4", "a@example.com");
        await checkRateLimit("register", "1.2.3.4");

        const prefixes = constructed.mock.calls.map(([config]) => (config as LimiterConfig).prefix);

        expect(constructed).toHaveBeenCalledTimes(2);
        expect(new Set(prefixes).size).toBe(2);
    });

    it("configures each endpoint with the budget the spec calls for", async () => {
        const { checkRateLimit } = await load();

        const expected = {
            signIn: { tokens: 5, window: "15 m" },
            register: { tokens: 3, window: "1 h" },
            forgotPassword: { tokens: 3, window: "1 h" },
            resetPassword: { tokens: 5, window: "15 m" },
            resendVerification: { tokens: 3, window: "15 m" },
        } as const;

        for (const [name, budget] of Object.entries(expected)) {
            constructed.mockClear();
            await checkRateLimit(name as keyof typeof expected, "1.2.3.4", "a@example.com");

            const [config] = constructed.mock.calls[0] as [LimiterConfig];

            expect(config.limiter).toEqual(budget);
        }
    });
});

describe("clientIp", () => {
    it("takes the first entry of x-forwarded-for", async () => {
        const { clientIp } = await load();

        headerValues.set("x-forwarded-for", "203.0.113.7, 70.41.3.18, 150.172.238.178");

        await expect(clientIp()).resolves.toBe("203.0.113.7");
    });

    it("trims whitespace around a single forwarded address", async () => {
        const { clientIp } = await load();

        headerValues.set("x-forwarded-for", "  203.0.113.7  ");

        await expect(clientIp()).resolves.toBe("203.0.113.7");
    });

    it("falls back to x-real-ip", async () => {
        const { clientIp } = await load();

        headerValues.set("x-real-ip", "203.0.113.9");

        await expect(clientIp()).resolves.toBe("203.0.113.9");
    });

    it("falls back to a shared bucket rather than to no limit when nothing identifies the caller", async () => {
        // Stricter than intended, never looser: unidentified callers share one budget instead of
        // each getting an unlimited one.
        const { clientIp } = await load();

        await expect(clientIp()).resolves.toBe("unknown-ip");
    });
});

describe("minutesUntilReset", () => {
    it("rounds a part-minute wait up", async () => {
        const { minutesUntilReset } = await load();

        expect(minutesUntilReset(Date.now() + 61_000)).toBe(2);
    });

    it("never reports zero minutes for a reset that has already passed", async () => {
        const { minutesUntilReset } = await load();

        expect(minutesUntilReset(Date.now() - 5_000)).toBe(1);
    });
});

describe("tooManyRequests", () => {
    it("answers 429 with a Retry-After header and a message naming the wait", async () => {
        const { tooManyRequests } = await load();

        const response = tooManyRequests({
            success: false,
            remaining: 0,
            reset: Date.now() + 600_000,
        });

        expect(response.status).toBe(429);
        expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
        await expect(response.json()).resolves.toEqual({
            error: "Too many attempts. Please try again in 10 minutes.",
        });
    });

    it("says minute, singular, when only one is left", async () => {
        const { tooManyRequests } = await load();

        const response = tooManyRequests({
            success: false,
            remaining: 0,
            reset: Date.now() + 30_000,
        });

        await expect(response.json()).resolves.toEqual({
            error: "Too many attempts. Please try again in 1 minute.",
        });
    });
});
