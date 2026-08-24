import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Throttling for the auth endpoints, backed by Upstash Redis.
 *
 * Every route under `api/auth` is reachable while signed out — that is the point of them — so each
 * one is an unauthenticated caller's free budget of something expensive: bcrypt comparisons on the
 * sign-in path, account rows on `register`, and outbound Resend messages on the two that mail a
 * link. Nothing else bounds them. This module is the bound.
 *
 * Redis rather than process memory because this deploys serverless: instances are created and
 * discarded per request and never see each other's counters, so an in-process `Map` would reset
 * itself under exactly the load it exists to stop. Upstash is the connectionless HTTP client that
 * works from that runtime.
 *
 * `import "server-only"` despite living in `lib/`: the spec named this path, but `lib/` is otherwise
 * client-reachable (components import `@/lib/format`, `@/lib/utils`) and the REST token must never
 * reach a bundle the browser can read. The directive turns a mistaken client import into a build
 * error instead of a leak.
 */

/**
 * The budgets, one per protected endpoint.
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
    // The first of the limits that are not about an unauthenticated caller. `POST /api/upload` is behind
    // the session, so nothing anonymous can reach it — what it bounds is cost: it accepts up to
    // 10 MB per request and writes to paid storage, and it stores the object *before* the item row
    // exists, so a loop that never finishes creating an item leaves objects nothing points at.
    //
    // Keyed on the account rather than the IP for the same reason the auth limits are keyed the way
    // they are: the caller is known here, so the account is the thing worth limiting, and an IP
    // would bill one office NAT for everyone behind it. Set well above a person adding a batch of
    // files by hand and well below what a script can spend.
    upload: { tokens: 30, window: "10 m", keyBy: "user" },
    // Follows `upload` rather than the auth limits, for the same reason: the caller is behind the
    // session, so what this bounds is cost, not anonymity. Every attempt is a Stripe API call, and
    // the first one for an account also creates a Customer — so a loop leaves a trail of records in
    // someone else's system that nothing here can tidy up. Ten in ten minutes is far more than a
    // person deciding between monthly and yearly, and far less than a script is worth.
    checkout: { tokens: 10, window: "10 m", keyBy: "user" },
    // Behind the session like the two above, so what this bounds is cost rather than anonymity —
    // every call is a paid request to a third party, made from a button that is one click away and
    // asks for nothing back. Keyed on the account for the same reason `upload` is: the caller is
    // known here, and an IP would bill one office NAT for everyone behind it.
    //
    // Twenty an hour is well above tagging a batch of items by hand — the suggestions are accepted
    // once and then the item is saved — and well below what a loop would spend.
    aiTag: { tokens: 20, window: "1 h", keyBy: "user" },
    // The same shape and the same number as `aiTag`, for the same reason — but its own bucket, not
    // a shared AI allowance. The two buttons sit a few pixels apart in the same form and a person
    // writing a batch of items uses both on each one, so one shared budget would mean tagging a
    // batch silently spends the descriptions for it, and the refusal would name a limit the user
    // never went near.
    aiDescribe: { tokens: 20, window: "1 h", keyBy: "user" },
    // Its own bucket for the reason `aiDescribe` is: one shared AI allowance would let one feature
    // silently spend another's, and the refusal would name a limit the user never went near.
    //
    // **Tighter than the other two**, and the only AI limit that is. Those two are clicked while
    // *writing* an item — once each, then the item is saved — so twenty an hour is far more than a
    // person doing it by hand. This one is clicked while *reading*, from a drawer that reopens on
    // every item in a list, and it asks the model for four hundred words against up to three times
    // the input; it is comfortably the most expensive request in the product, and the one whose
    // button is easiest to press repeatedly without meaning to. Ten an hour is still more
    // explanations than anyone reads in a sitting.
    aiExplain: { tokens: 10, window: "1 h", keyBy: "user" },
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
 * The answer when the limiter cannot be consulted at all.
 *
 * Deliberately a pass. An Upstash outage that locked everyone out of signing in would be a worse
 * failure than the one this module prevents — it would convert a dependency's bad afternoon into a
 * total loss of the product, and it is a denial-of-service an attacker could aim for on purpose by
 * exhausting the free tier's daily quota. The spec calls for failing open and this is where it
 * happens. `remaining` is reported as the full budget because nothing was counted.
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
        // The SDK defaults to five attempts with exponential backoff — about 4.7 seconds before it
        // reports failure. Failing open after that is not failing open in any useful sense: every
        // sign-in during an Upstash outage would stall for five seconds first. One retry absorbs a
        // dropped packet, which is all a retry is good for here; a real outage should be conceded
        // quickly, because the decision on conceding it is already "let the request through".
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
        // Namespaced per limit so the five budgets cannot collide on a shared Redis instance, and so
        // one endpoint's keys can be inspected or flushed without touching another's.
        prefix: `devstash:ratelimit:${name}`,
    });

    limiters.set(name, limiter);

    return limiter;
}

/**
 * The caller's address, as far as it can be known.
 *
 * `x-forwarded-for` is a list, oldest first, and only the *last* entry is written by a hop we
 * control — but on Vercel the platform normalises it so that the first entry is the real client and
 * the header cannot be spoofed past the edge. Taking the first is therefore right on Vercel and is
 * what the spec asks for; behind a different proxy this is the line that would need revisiting.
 *
 * Falls back to a shared constant rather than to no limit at all. Locally there is no forwarding
 * header, so every request buckets together — stricter than intended, never looser, and in that
 * environment the limiter is usually unconfigured anyway.
 */
export async function clientIp(): Promise<string> {
    const list = await headers();
    const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();

    return forwarded || list.get("x-real-ip")?.trim() || "unknown-ip";
}

/**
 * How long a check may take before the request is let through unlimited.
 *
 * A refused connection rejects immediately, but a hung one does not reject at all — and "fail open"
 * cannot be implemented by a `catch` alone, because a promise that never settles never reaches one.
 * Without this bound, an Upstash instance that accepted connections and then stopped answering would
 * hang every sign-in indefinitely: an outage converted into a total failure, which is the precise
 * outcome failing open exists to avoid.
 *
 * A second is far above the round trip in normal operation and far below anything a person would sit
 * through.
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
 * `caller` is whatever this limit is keyed on: the client IP for the endpoints reachable while
 * signed out, and the **user id** for the limits behind the session (`upload`, `checkout`). `LIMITS`
 * declares which, and the parameter is deliberately not named `ip` for that reason — an authenticated
 * endpoint has a better identifier available than the address it happened to arrive from.
 *
 * `email` is used only by the limits whose `keyBy` names it, and is *ignored* everywhere else rather
 * than quietly widening the key — passing one to `register` cannot weaken that limit, it simply has
 * no effect. The signature leaves it optional for every name because the alternative is a pair of
 * overloads to rule out a call that is already harmless.
 *
 * It is lowercased here because the same address in different case must not buy a second budget, and
 * callers reach this holding both the raw string from a form and the normalised one from a schema.
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
 * An estimate, and deliberately the optimistic one. The SDK's `reset` is the start of the limiter's
 * next window, not the moment this caller regains capacity — under a sliding window the previous
 * window's requests are still counted at full weight as the new one opens, and only decay across it.
 * So a caller who waits exactly this long may be refused once more, with a fresh estimate.
 *
 * Observed rather than assumed: with the 1-hour `register` budget spent at 10:51, this reported nine
 * minutes, because the next hourly window began at 11:00 — not because capacity returned then.
 *
 * Left as is because every alternative is worse. Reporting the true wait means reimplementing the
 * decay the library owns, against numbers it does not expose; reporting the whole window instead
 * would tell someone to wait an hour when the real wait is often seconds. An under-estimate costs a
 * wasted retry that is itself rate limited, and the message it gets back is the corrected one.
 */
export function minutesUntilReset(reset: number): number {
    return Math.max(1, Math.ceil((reset - Date.now()) / 60_000));
}

/**
 * The 429 the JSON routes return.
 *
 * `Retry-After` is in seconds and is the machine-readable half of the same fact the message states
 * in prose — well-behaved clients back off on the header, and a person reads the body. Both inherit
 * the estimate caveat on `minutesUntilReset`; a client that retries the instant the header allows
 * may still be refused, which is the correct thing for it to handle anyway.
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
