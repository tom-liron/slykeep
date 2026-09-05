import "server-only";

import OpenAI from "openai";

/**
 * The OpenAI client and the model id every AI feature calls.
 *
 * The four AI Server Actions in `actions/ai.ts` reach OpenAI through {@link openai}, passing
 * {@link AI_MODEL}. The prompt building and response parsing for each feature live in the
 * `lib/ai-*.ts` modules; this file owns only the connection.
 *
 * @remarks
 * `import "server-only"` so `OPENAI_API_KEY` can never reach a browser bundle; every module in
 * `server/infra/` carries the directive.
 */

/**
 * The model id, in one place so replacing it is one edit. Shared by all four features rather than
 * set per feature, which would scatter a pricing decision.
 */
export const AI_MODEL = "gpt-5-nano";

/**
 * The client, built on first use so importing this module cannot throw. `next build` evaluates
 * server modules while collecting page data, and a top-level construction would make
 * `OPENAI_API_KEY` a build-time requirement — the same reason `stripe()` and `r2()` defer theirs.
 */
let client: OpenAI | null = null;

export function openai(): OpenAI {
    if (client) return client;

    const key = process.env.OPENAI_API_KEY;

    if (!key) throw new Error("OpenAI is not configured — set OPENAI_API_KEY.");

    client = new OpenAI({
        apiKey: key,
        // Bounded here rather than per call: a hung AI request holds a serverless invocation open
        // for as long as it takes while the user watches a spinner. Thirty seconds is well beyond
        // what this model needs for a tag list and short enough that a stuck call fails while
        // someone is still waiting.
        timeout: 30_000,
        maxRetries: 2,
    });

    return client;
}
