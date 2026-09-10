import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Redis-backed request-rate limiting for the endpoints with no other bound on their cost.
 *
 * Two groups of callers. The `api/auth` routes are reachable while signed out, so each is an
 * anonymous caller's free budget of something expensive — bcrypt comparisons on sign-in, account
 * rows on `register`, Resend messages on the two that mail a link. The rest — `POST /api/upload`,
 * the Stripe checkout action, and the four AI actions — are behind the session, so what they bound
 * is spend rather than anonymity: paid storage, Stripe records, OpenAI calls. `checkRateLimit`
 * spends one token per call and reports what is left. The Auth.js credentials provider turns a
 * refusal into its error code; AI and billing Server Actions return their own failure values; JSON
 * routes turn a refusal into {@link tooManyRequests}.
 *
 * Redis rather than process memory because this deploys serverless: instances are discarded per
 * request and never see each other's counters, so an in-process `Map` would reset under the load it
 * exists to stop. Upstash is the connectionless HTTP client that works from that runtime.
 *
 * @remarks
 * `import "server-only"` so the Upstash REST token can never reach a browser bundle; every module
 * in `server/infra/` carries the directive.
 */

/**
 * The budgets, one bucket per protected operation.
 *
 * Windows are the sliding kind — a fixed window lets a caller spend the whole budget in its last
 * second and the whole next budget in the first second after it rolls over, which is twice the
 * intended rate at the boundary. The cost is one extra Redis key per identifier; the benefit is that
 * the limit means what it says at every instant.
 *
 * `keyBy` records what the identifier is built from, which is a security property rather than a
 * detail: the three endpoints keyed by IP alone are the ones where mixing an email into the key
 * would let an attacker sidestep the limit simply by varying the address they submit. Where the
 * email *is* in the key, it is there to make the limit tighter for the case that matters — five
 * guesses against one account, not five guesses total from a shared office NAT.
 */
const LIMITS = {
    signIn: { tokens: 5, window: "15 m", keyBy: "ip+email" },
    register: { tokens: 3, window: "1 h", keyBy: "ip" },
    forgotPassword: { tokens: 3, window: "1 h", keyBy: "ip" },
    resetPassword: { tokens: 5, window: "15 m", keyBy: "ip" },
    resendVerification: { tokens: 3, window: "15 m", keyBy: "ip+email" },
    // The limits below are behind the session, so they bound cost rather than anonymity, and all
    // key on the account: an IP would bill one office NAT for everyone behind it.
    //
    // Upload accepts 10 MB per request, writes to paid storage, and stores the object before the
    // item row exists — a loop that never finishes an item leaves orphaned objects. Set above a
    // person adding files by hand, below what a script spends.
    upload: { tokens: 30, window: "10 m", keyBy: "user" },
    // Every attempt is a Stripe API call, and the first for an account creates a Customer, so a
    // loop leaves records in Stripe that nothing here tidies up. Ten in ten minutes is far more
    // than choosing between monthly and yearly.
    checkout: { tokens: 10, window: "10 m", keyBy: "user" },
    // Each AI action has its own bucket, not a shared AI allowance: one shared budget would let one
    // feature silently spend another's, and the refusal would name a limit the user never went near.
    //
    // Tag and describe are clicked while writing an item — once each, then the item is saved — so
    // twenty an hour is well above hand use.
    aiTag: { tokens: 20, window: "1 h", keyBy: "user" },
    aiDescribe: { tokens: 20, window: "1 h", keyBy: "user" },
    // Explain and optimize are clicked while reading, from a drawer that reopens on every item in a
    // list, and their output is long (≈400 words, or a whole rewritten prompt). Explain is the most
    // expensive request in the product; optimize is meant to be iterated on. Ten an hour each.
    aiExplain: { tokens: 10, window: "1 h", keyBy: "user" },
    aiOptimize: { tokens: 10, window: "1 h", keyBy: "user" },
} as const satisfies Record<
    string,
    { tokens: number; window: `${number} ${"m" | "h"}`; keyBy: "ip" | "ip+email" | "user" }
>;

export type RateLimitName = keyof typeof LIMITS;

/** What a check reports back. `reset` is a Unix timestamp in **milliseconds**, per the SDK. */
export type RateLimitResult = {
    success: boolean;
    remaining: number;
    reset: number;
};

/**
 * The answer when the limiter cannot be consulted at all: the request passes.
 *
 * @remarks
 * Fails open. An Upstash outage that locked everyone out of signing in would be a worse failure than
 * the one this module prevents, and exhausting the free tier's daily quota would be a way to aim
 * for it. `remaining` is reported as the full budget because nothing was counted.
 */
function allowed(name: RateLimitName): RateLimitResult {
    return { success: true, remaining: LIMITS[name].tokens, reset: Date.now() };
}

/**
 * Built once and reused, which the SDK requires rather than merely prefers.
 *
 * `ephemeralCache` defaults to a `Map` owned by the instance: once an identifier is known to be
 * over its limit, further requests in the same process are refused without a Redis round trip. A
 * limiter constructed per request would throw that cache away every time — and a flood is precisely
 * when the saved round trips matter.
 */
const limiters = new Map<RateLimitName, Ratelimit>();

let redis: Redis | null = null;

/**
 * `null` when the credentials are absent, which is the normal state in development, in CI, and
 * during a build — none of which should have to run a Redis instance to type-check a page.
 * `Redis.fromEnv()` throws on a missing variable, so the check has to happen before the call, and it
 * reads the variables directly rather than through a config module because those two names are the
 * SDK's own convention.
 */
function redisClient(): Redis | null {
    if (redis) return redis;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) return null;

    redis = new Redis({
        url,
        token,
        // One retry, ~100ms apart. The SDK's default of five attempts with exponential backoff
        // takes about 4.7 seconds to concede, which would stall every sign-in during an Upstash
        // outage. One retry absorbs a dropped packet; a real outage is conceded quickly, since the
        // decision on conceding it is already "let the request through".
        retry: { retries: 1, backoff: () => 100 },
    });

    return redis;
}

function limiterFor(name: RateLimitName): Ratelimit | null {
    const existing = limiters.get(name);

    if (existing) return existing;

    const client = redisClient();

    if (!client) return null;

    const { tokens, window } = LIMITS[name];

    const limiter = new Ratelimit({
        redis: client,
        limiter: Ratelimit.slidingWindow(tokens, window),
        // Namespaced per limit so the eleven budgets cannot collide on a shared Redis instance, and
        // so one endpoint's keys can be inspected or flushed without touching another's.
        prefix: `slykeep:ratelimit:${name}`,
    });

    limiters.set(name, limiter);

    return limiter;
}

/**
 * The caller's address, as far as it can be known.
 *
 * @remarks
 * `x-forwarded-for` is a list, oldest first, and only the last entry is written by a hop under our
 * control — but Vercel normalises it so the first entry is the real client and the header cannot be
 * spoofed past the edge, so the first entry is correct here. Behind a different proxy this is the
 * line to revisit. The `unknown-ip` fallback buckets every local request together, which is
 * stricter than intended, never looser.
 */
export async function clientIp(): Promise<string> {
    const list = await headers();
    const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();

    return forwarded || list.get("x-real-ip")?.trim() || "unknown-ip";
}

/**
 * How long a check may take before the request is let through unlimited.
 *
 * @remarks
 * A refused connection rejects at once, but a hung one never settles and so never reaches a
 * `catch` — failing open needs this bound as well as the `catch`. One second is far above the round
 * trip and far below what a person sits through.
 */
const CHECK_TIMEOUT_MS = 1_000;

/**
 * Rejects if `check` has not settled in time, so the caller's `catch` can fail open.
 *
 * The timer is cleared on both paths — an open handle would keep a serverless instance alive past
 * the response it was meant to bound.
 */
async function withTimeout<T>(check: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            check,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error(`Timed out after ${CHECK_TIMEOUT_MS}ms`)),
                    CHECK_TIMEOUT_MS,
                );
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Spends one token against `name` for this caller and reports what is left.
 *
 * @param name - which budget in `LIMITS` to spend from.
 * @param caller - whatever the limit is keyed on: the client IP for the signed-out endpoints, the
 * user id for the limits behind the session. `LIMITS[name].keyBy` declares which, so the parameter
 * is not named `ip` — an authenticated endpoint has a better identifier than the address it arrived
 * from.
 * @param email - used only by the limits whose `keyBy` names it, and ignored elsewhere rather than
 * widening the key; passing one to `register` has no effect. Lowercased here so the same address in
 * different case cannot buy a second budget.
 */
export async function checkRateLimit(
    name: RateLimitName,
    caller: string,
    email?: string,
): Promise<RateLimitResult> {
    const limiter = limiterFor(name);

    if (!limiter) return allowed(name);

    const identifier =
        LIMITS[name].keyBy === "ip+email" ? `${caller}:${email?.toLowerCase() ?? ""}` : caller;

    try {
        const { success, remaining, reset } = await withTimeout(limiter.limit(identifier));

        return { success, remaining, reset };
    } catch (error) {
        // Logged, not raised. See `allowed` — a limiter that is down must not take sign-in with it,
        // and the only party who needs to know is us.
        console.error(`Rate limit check failed for "${name}":`, error);

        return allowed(name);
    }
}

/**
 * Whole minutes until `reset`, floored at 1 so the message never says "in 0 minutes".
 *
 * @remarks
 * An optimistic estimate. The SDK's `reset` is the start of the limiter's next window, not the
 * moment this caller regains capacity — under a sliding window the previous window's requests are
 * still counted at full weight as the new one opens and only decay across it, so a caller who waits
 * exactly this long may be refused once more with a fresh estimate. The true wait would mean
 * reimplementing decay against numbers the library does not expose; reporting the whole window
 * would tell someone to wait an hour when the real wait is often seconds. An under-estimate costs a
 * retry that is itself rate limited and returns the corrected message.
 */
export function minutesUntilReset(reset: number): number {
    return Math.max(1, Math.ceil((reset - Date.now()) / 60_000));
}

/**
 * The 429 the JSON routes return.
 *
 * `Retry-After` is in seconds and is the machine-readable half of the fact the message states in
 * prose — a client backs off on the header, a person reads the body. Both inherit the estimate
 * caveat on {@link minutesUntilReset}: a client that retries the instant the header allows may
 * still be refused.
 */
export function tooManyRequests(result: RateLimitResult): NextResponse {
    const minutes = minutesUntilReset(result.reset);

    return NextResponse.json(
        {
            error: `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        },
        {
            status: 429,
            headers: {
                "Retry-After": String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))),
            },
        },
    );
}
