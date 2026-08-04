import { createServer, type Server } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The fail-open rule, exercised against the real Upstash client rather than a stub.
 *
 * `rate-limit.test.ts` mocks the SDK, which is right for testing the policy around it — but a mock
 * that rejects on demand proves only that `catch` works. What matters in production is that the two
 * ways a dependency actually fails, refusing and hanging, both end with the request allowed through.
 * Neither is reachable through a mocked transport, so this file deliberately does not mock one.
 *
 * Nothing here leaves the machine: one address refuses connections, the other is a local server that
 * accepts and then says nothing.
 *
 * `checkRateLimit` takes the IP as an argument, so none of this needs a request context — only
 * `clientIp` reads headers, and it is covered in the sibling file.
 */

/** Refuses immediately: nothing is listening, so the connection is reset rather than timing out. */
const REFUSING_URL = "http://127.0.0.1:1";

let hung: Server | undefined;

afterEach(() => {
    hung?.close();
    hung = undefined;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

/** A server that accepts the connection and then never responds. */
async function startHungServer(): Promise<string> {
    hung = createServer(() => {
        // Deliberately empty: the request is received and left unanswered forever.
    });

    await new Promise<void>((resolve) => hung!.listen(0, "127.0.0.1", resolve));

    const address = hung.address();

    if (address === null || typeof address === "string") throw new Error("no port");

    return `http://127.0.0.1:${address.port}`;
}

/** A fresh copy of the module, since it caches its Redis client at module scope. */
async function loadPointedAt(url: string) {
    vi.resetModules();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", url);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "not-a-real-token");

    return import("./rate-limit");
}

describe("fail-open against a real transport", () => {
    it("allows the request when the connection is refused", async () => {
        const logged = vi.spyOn(console, "error").mockImplementation(() => {});
        const { checkRateLimit } = await loadPointedAt(REFUSING_URL);

        await expect(checkRateLimit("signIn", "1.2.3.4", "a@example.com")).resolves.toMatchObject({
            success: true,
            remaining: 5,
        });
        expect(logged).toHaveBeenCalled();
    });

    it("concedes a refused connection promptly rather than retrying for seconds", async () => {
        // The SDK's default is five attempts with exponential backoff, ~4.7s. Stalling every sign-in
        // that long before allowing it through is not meaningfully failing open, which is why the
        // client pins `retry` down. This is the assertion that keeps it pinned.
        //
        // The bound has to sit *below* `CHECK_TIMEOUT_MS`, or it proves nothing: the timeout would
        // cap an unpinned client at a second and the test would pass on the wrong mechanism. A
        // refused connection with one retry settles in roughly a tenth of this.
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { checkRateLimit } = await loadPointedAt(REFUSING_URL);

        const started = Date.now();
        await checkRateLimit("register", "1.2.3.4");

        expect(Date.now() - started).toBeLessThan(600);
    });

    it("allows the request when the connection hangs instead of failing", async () => {
        // The case a `catch` alone cannot cover: a promise that never settles never rejects, so
        // without the timeout this call would hang for as long as the server stayed silent.
        const logged = vi.spyOn(console, "error").mockImplementation(() => {});
        const { checkRateLimit } = await loadPointedAt(await startHungServer());

        const started = Date.now();

        await expect(checkRateLimit("signIn", "1.2.3.4", "a@example.com")).resolves.toMatchObject({
            success: true,
        });
        expect(Date.now() - started).toBeLessThan(3_000);
        expect(logged).toHaveBeenCalled();
    }, 10_000);
});
