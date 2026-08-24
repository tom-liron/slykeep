import "server-only";

import OpenAI from "openai";

/**
 * The OpenAI client, and the model every AI feature calls.
 *
 * `import "server-only"` despite living in `lib/`, for the reason `stripe.ts`, `rate-limit.ts`, and
 * `r2.ts` all state: `lib/` is client-reachable — components import `@/lib/format` and
 * `@/lib/utils` — and the API key must never reach a bundle the browser can read. The directive
 * turns a mistaken client import into a build error rather than a leak.
 */

/**
 * One constant rather than a string at each call site, so the day this model is replaced is one
 * edit and not a grep. Every AI feature shares it deliberately — a per-feature model would be a
 * pricing decision hidden in four places.
 */
export const AI_MODEL = "gpt-5-nano";

/**
 * Built lazily rather than at module load, so importing this module cannot throw. `next build`
 * evaluates server modules while collecting page data, and a top-level construction would make
 * `OPENAI_API_KEY` a build-time requirement — the same reason `stripe()` and `r2()` defer theirs.
 */
let client: OpenAI | null = null;

export function openai(): OpenAI {
    if (client) return client;

    const key = process.env.OPENAI_API_KEY;

    if (!key) throw new Error("OpenAI is not configured — set OPENAI_API_KEY.");

    client = new OpenAI({
        apiKey: key,
        // Bounded here rather than per call: an AI request that hangs holds a serverless invocation
        // open for as long as it takes, and the user is watching a spinner the whole time. Thirty
        // seconds is far longer than this model needs for a tag list and short enough that a stuck
        // call fails while someone is still waiting for it.
        timeout: 30_000,
        maxRetries: 2,
    });

    return client;
}
