import { truncateForModel } from "@/lib/ai-text";
import { isItemTypeName } from "@/config/item-type-catalog";
import { itemTypeOwns } from "@/lib/item-schemas";
import type { ItemDraft } from "@/types/ai";
import type { ItemTypeName } from "@/types/item-type";

/**
 * The rules around the explain model call: which items may be explained, what the model is shown,
 * and what is trusted from what it says back.
 *
 * Pure functions in `lib/` beside `ai-tags.ts` and `ai-description.ts`, for the same two reasons
 * those files give — a `"use server"` module may only export async functions, and these are the
 * halves that can be wrong without failing to compile.
 */

/**
 * How much of the body the model is shown.
 *
 * Three times what tagging and describing use, and the difference is the point rather than
 * generosity. Those two answer a question about the item *as a whole* — a label, a sentence — and
 * the head of the content is enough to say what the thing is. This one answers a question about the
 * content itself, so a cut is not a smaller sample of the same answer: an explanation of a function
 * whose second half was never shown describes code that does not exist. Still a cap, because input
 * is billed by the token and a stashed file can be very long, but set where a realistic snippet or
 * command fits inside it whole.
 */
export const AI_EXPLAIN_CONTENT_LIMIT = 6000;

/**
 * The largest payload the action will consider, per field. Not a product limit — an item's content
 * is not capped anywhere and legitimately runs past the limit above, which is why that one
 * truncates rather than refuses. This is a bound on what a hand-made request can make the server
 * hold in memory before the truncation gets to run.
 */
export const AI_EXPLAIN_PAYLOAD_LIMIT = 100_000;

/**
 * How much room the model gets, reasoning included.
 *
 * Covers the thinking *and* the prose, for the reason `DESCRIPTION_MAX_OUTPUT_TOKENS` explains:
 * `gpt-5-nano` is a reasoning model and bills its reasoning against `max_output_tokens` before
 * writing a visible character. The prose asked for here is 200–300 words — roughly 400 tokens
 * against the description's 80 — and code is the input that makes a reasoning model think hardest,
 * so the reasoning half wants the headroom even more than the visible half does.
 *
 * **Was 3000, and 3000 was wrong.** It was set by reasoning from the description's 2000 rather than
 * from this call's own shape, and in use it truncated roughly every third explanation: the user got
 * "That explanation was cut short" on a request that had already done all its thinking.
 *
 * The correction is not that a bigger number is worth paying for — it is that the small number was
 * never the cheaper one. `max_output_tokens` is a **ceiling, not a reservation**: a call that
 * finishes in 2,200 tokens is billed for 2,200 whatever this says, so raising it costs exactly
 * nothing on every request that already worked. What it changes is the requests that failed, and
 * those were the expensive ones — OpenAI's reasoning guide is explicit that running out mid-thought
 * bills the input and reasoning tokens with no response to show for it. So one in three clicks was
 * paying full price for a toast. Doubling it makes those cheaper, not dearer.
 *
 * Still far under the ~25,000 that same guide suggests reserving while a prompt is being tuned, and
 * the visible half has its own separate bound in `MAX_EXPLANATION_LENGTH` — so what this number
 * actually limits is a reasoning loop that never terminates, which is the only thing it should.
 *
 * `EXPLAIN_REASONING_EFFORT` was added after this and attacks the same problem from the other side:
 * with the thinking itself cut back, this ceiling should now be unreachable rather than merely
 * roomy. Both are kept — the effort setting is what makes truncation unlikely, and this is what
 * still bounds the cost if a request ever defeats it.
 */
export const EXPLAIN_MAX_OUTPUT_TOKENS = 6000;

/**
 * How hard the model thinks before it starts writing.
 *
 * The default is `medium`, which is what every other AI call in this app uses by saying nothing.
 * This is the one that opts out, because this is the one where the thinking was the problem: the
 * truncations that raised `EXPLAIN_MAX_OUTPUT_TOKENS` were reasoning tokens, not prose, so the
 * ceiling above only made room for a cost rather than removing it. This removes it.
 *
 * `low` rather than `minimal`. The task is genuinely easy — say what this code does, in 300 words,
 * with the code right there in the prompt — but it is still comprehension rather than
 * classification, which is what `minimal` is documented for. A dense snippet whose point is subtle
 * is where any of this thinking earns its keep, and `low` keeps some.
 *
 * What it buys, in order of how much the user notices: the spinner gets shorter, the call gets
 * cheaper, and running out mid-thought stops being reachable at all. What it risks is a shallower
 * answer on the hard tail — the snippet with a non-obvious bug in it — which is the thing to watch
 * for if these ever start reading as generic.
 */
export const EXPLAIN_REASONING_EFFORT = "low" as const;

/**
 * The longest explanation that will be accepted back.
 *
 * A guard against a model that ignored the instruction outright, not a trim — roughly four times
 * the 300 words the prompt asks for. Deliberately looser than `MAX_DESCRIPTION_LENGTH`, which is
 * tight because it protects a two-row textarea: this lands in a scrolling panel that can show
 * whatever arrives, so length is not a layout problem here and the only thing worth catching is a
 * runaway. Over the bound is **rejected** rather than cut, as the description is, and for the same
 * reason: half an explanation says something the model did not say.
 */
export const MAX_EXPLANATION_LENGTH = 8000;

/**
 * Which items have code worth explaining.
 *
 * Derived from `itemTypeOwns(...).language` rather than a second `["snippet", "command"]` written
 * out here. "Has a language worth declaring" and "is code a person might want explained" are the
 * same property, and the drawer already picks the monaco editor over the markdown one by exactly
 * that test — so a literal list would be a third copy of one rule, and the first thing to drift if
 * a code-shaped type is ever added.
 *
 * Prompts and notes are prose, and a link, a file, or an image has no body to read. Explaining
 * those is not a smaller version of this feature; it is the summary feature, which is its own line
 * in `docs/ai-integration-plan.md`.
 */
export function isExplainableType(type: string | undefined): type is ItemTypeName {
    return type !== undefined && isItemTypeName(type) && itemTypeOwns(type).language;
}

/** What the model is told it is doing. Constant, so it is not rebuilt per call. */
export const EXPLAIN_INSTRUCTIONS = [
    "You are a developer tool assistant that explains saved code and shell commands to the developer who stashed them.",
    "Explain what the code does and the key concepts behind it, in 200 to 300 words.",
    "Lead with what it does as a whole, then walk through the parts that carry the meaning.",
    "Write for a competent developer who has not seen this particular code: skip syntax basics, cover the intent.",
    "Explain only what is present. Do not guess at a framework, a version, or a caller the content does not show, and say so plainly when something is missing rather than inventing it.",
    "Respond in GitHub-flavoured markdown. Use short paragraphs, and a bulleted list only where the content is genuinely a list.",
    "Wrap command names, flags, paths, revisions, and code identifiers in inline backticks, so that markdown does not read their punctuation as formatting.",
    "Do not restate the code in a fenced block, do not add a heading, and do not address the reader.",
].join(" ");

/**
 * The user half of the request.
 *
 * Labelled parts rather than a bare body, as in `buildDescriptionInput` — the model can tell a name
 * from the thing it names, so an untitled snippet reads as code with no name instead of code whose
 * first line looks like one.
 *
 * The **type** is here for the reason tagging includes it, and it matters more in this prompt than
 * in either of the others: the same line of text is a `command` or a `snippet` depending only on
 * where it was stashed, and that is the difference between explaining a shell invocation and
 * explaining a program. The **language** is the item's own free-text field, which is what the user
 * said it was — worth more than the model's guess at it, and the only hint a two-line snippet may
 * carry at all.
 *
 * No "return this as JSON" line, unlike the other two builders: this call does not ask for
 * `json_object` back. See `parseExplanation`.
 */
export function buildExplainInput(draft: ItemDraft): string {
    const parts = [`Item type: ${draft.type ?? "item"}`];

    if (draft.title) parts.push(`Title: ${draft.title}`);
    if (draft.language) parts.push(`Language: ${draft.language}`);
    if (draft.tags) parts.push(`Tags: ${draft.tags}`);

    parts.push(`Content:\n${truncateForModel(draft.content ?? "", AI_EXPLAIN_CONTENT_LIMIT)}`);

    return parts.join("\n\n");
}

/**
 * Whether there is anything to explain.
 *
 * Stricter than `hasDescribableContent`, which accepts a title alone. A description can be written
 * from a name — "useDebounce" says something — but an explanation of code cannot be written from
 * the absence of code, and a model asked to try will produce a plausible paragraph about a function
 * nobody wrote. The body is the whole input here, so it is required.
 */
export function hasExplainableContent(draft: ItemDraft): boolean {
    return Boolean(draft.content?.trim());
}

/**
 * Reads the explanation out of whatever the model returned.
 *
 * **Markdown straight out, not a JSON field** — the one place this feature departs from the other
 * two, and deliberately. Those ask for `json_object` because they want a *part* of the answer: an
 * array of labels, one trimmed sentence. Here the whole response is the answer, and it is a
 * markdown document — so wrapping it would mean asking the model to escape every newline of a
 * multi-paragraph text into a JSON string literal, paying tokens for the escaping and gaining a
 * parse that can fail on a document that was perfectly good. The bound below is what the wrapper
 * would have bought, without the escaping.
 *
 * Nothing here escapes markdown punctuation in the answer, and that is not an oversight: the text
 * *is* markdown and is meant to be rendered as such. What stops a `HEAD~1` from being read as
 * formatting is the renderer's configuration — see `MARKDOWN_PLUGINS` — plus the instruction above
 * asking for inline backticks around anything code-shaped. Escaping here would fight both.
 *
 * The two shapes it still defends against are the model's habits rather than the prompt's: a
 * response wrapped in a ```markdown fence, and — despite being asked for prose — an object with the
 * text inside it. Both are understood rather than failed over, because in both cases the answer did
 * arrive and only its packaging is wrong.
 *
 * Anything unusable comes back as `null` rather than throwing, and the caller has one message for
 * all of it.
 */
export function parseExplanation(raw: string): string | null {
    const unwrapped = unwrap(raw.trim());

    if (unwrapped === null) return null;

    const explanation = unwrapped.trim();

    if (explanation === "" || explanation.length > MAX_EXPLANATION_LENGTH) return null;

    return explanation;
}

/**
 * The markdown inside the response, whichever packaging it arrived in — or `null` when the
 * packaging is broken and there is no way to tell where the answer inside it ends.
 */
function unwrap(raw: string): string | null {
    // A whole-response fence, not a fence *within* the explanation — the closing ``` has to be the
    // end of the text. An explanation that legitimately quotes a fenced block mid-paragraph starts
    // with prose, so it never matches, and one that opens with a block is not the shape asked for.
    const fenced = /^```[a-z]*\n([\s\S]*)\n```$/i.exec(raw);

    if (fenced) return fenced[1];

    // Only attempted on something that actually looks like an object. Prose is the expected shape
    // here, and prose starting with a brace would otherwise take a pointless trip through
    // `JSON.parse` on every single call.
    if (!raw.startsWith("{")) return raw;

    try {
        const parsed: unknown = JSON.parse(raw);

        if (typeof parsed === "object" && parsed !== null) {
            const { explanation } = parsed as { explanation?: unknown };

            if (typeof explanation === "string") return explanation;
        }
    } catch {
        // A broken object, not a document — the same call `parseSuggestedDescription` refuses, and
        // refused here too. A body that *starts* like JSON and fails to parse is a truncated object,
        // not prose, so handing it back would render a stray `{"explanation": "` as the first line
        // of the explanation. The caller's one message covers it and the user clicks again.
        return null;
    }

    // Parsed, but not the object shape — a bare JSON string, an array, a `null`. Nothing here is
    // the markdown that was asked for.
    return null;
}
