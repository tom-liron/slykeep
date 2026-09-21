import { truncateForModel } from "@/lib/ai-text";
import { isItemTypeName } from "@/config/item-type-catalog";
import { itemTypeOwns } from "@/lib/item-schemas";
import type { ItemDraft } from "@/types/ai";
import type { ItemTypeName } from "@/types/item-type";

/**
 * Prompt building and response parsing for the "explain this code" model call.
 *
 * `actions/ai.ts` calls {@link isExplainableType} and {@link hasExplainableContent} to gate the
 * feature, {@link buildExplainInput} for the request, and {@link parseExplanation} for what comes
 * back. Pure functions in `lib/` beside `ai-tags.ts` and `ai-description.ts`, for the reasons those
 * files give — a `"use server"` module may only export async functions, and these are the halves a
 * unit test needs without a network.
 */

/**
 * How much of the body the model is shown — three times what tagging and describing use.
 *
 * @remarks
 * Tagging and describing answer a question about the item as a whole, so the head of the content is
 * a fair sample. This answers a question about the content itself, where a cut is not a smaller
 * sample of the same answer: explaining a function whose second half was never shown describes code
 * that does not exist. Still a cap, since input is billed by the token, but set where a realistic
 * snippet or command fits whole.
 */
export const AI_EXPLAIN_CONTENT_LIMIT = 6000;

/**
 * The `max_output_tokens` ceiling for the call, covering reasoning as well as prose.
 *
 * @remarks
 * `gpt-5-nano` bills reasoning against `max_output_tokens` before any visible character, as
 * `DESCRIPTION_MAX_OUTPUT_TOKENS` in `ai-description.ts` explains. The prose asked for is
 * 200–300 words (≈400 tokens) and code makes a reasoning model think hardest, so the reasoning half
 * needs the headroom more than the visible half. `max_output_tokens` is a ceiling, not a
 * reservation — a call that finishes early is billed for what it used — so this is set well above
 * what a completed request needs and far under the ~25,000 OpenAI suggests reserving while a prompt
 * is tuned. What it bounds is a reasoning loop that never terminates; the visible length has its
 * own bound in {@link MAX_EXPLANATION_LENGTH}, and {@link EXPLAIN_REASONING_EFFORT} keeps the
 * thinking short enough that this ceiling should be unreachable.
 */
export const EXPLAIN_MAX_OUTPUT_TOKENS = 6000;

/**
 * How hard the model thinks before it starts writing.
 *
 * @remarks
 * Every other AI call leaves this at the `medium` default. Explain opts out because explain is
 * where the reasoning is the cost — the tokens that press against {@link EXPLAIN_MAX_OUTPUT_TOKENS}
 * are reasoning, not prose. `low` rather than `minimal`: the task is comprehension, not
 * classification, and a dense snippet with a subtle point is where the thinking earns its keep.
 * `low` shortens the spinner and lowers the cost; the risk it carries is a shallower answer on a
 * non-obvious bug.
 */
export const EXPLAIN_REASONING_EFFORT = "low" as const;

/**
 * The longest explanation accepted back — roughly four times the 300 words the prompt asks for.
 *
 * @remarks
 * A guard against a model that ignored the instruction, not a trim. Looser than
 * `MAX_DESCRIPTION_LENGTH` in `ai-description.ts`, which protects a two-row textarea: an explanation
 * lands in a scrolling panel, so length is not a layout problem and the only thing to catch is a
 * runaway. Over the bound is rejected rather than cut, as the description is — half an explanation
 * says something the model did not.
 */
export const MAX_EXPLANATION_LENGTH = 8000;

/**
 * Which items have code worth explaining.
 *
 * Derived from `itemTypeOwns(...).language` rather than a second `["snippet", "command"]` written
 * here: "has a language worth declaring" and "is code a person might want explained" are the same
 * property, and the drawer already picks the monaco editor by that test. Prompts and notes are
 * prose; a link, file or image has no body to read. Explaining those is the summary feature, a
 * separate line in `docs/ai-integration-plan.md`.
 */
export function isExplainableType(type: string | undefined): type is ItemTypeName {
    return type !== undefined && isItemTypeName(type) && itemTypeOwns(type).language;
}

/** What the model is told it is doing. Constant, so it is not rebuilt per call. */
export const EXPLAIN_INSTRUCTIONS = [
    "You are a developer tool assistant that explains saved code and shell commands to the developer who saved them.",
    "Explain what the code does and the key concepts behind it, in 200 to 300 words.",
    "Lead with what it does as a whole, then walk through the parts that carry the meaning.",
    "Write for a competent developer who has not seen this particular code: skip syntax basics, cover the intent.",
    "Explain only what is present. Do not guess at a framework, a version, or a caller the content does not show, and say so plainly when something is missing rather than inventing it.",
    "Respond in GitHub-flavoured markdown. Use short paragraphs, and a bulleted list only where the content is genuinely a list.",
    "Wrap command names, flags, paths, revisions, and code identifiers in inline backticks, so that markdown does not read their punctuation as formatting.",
    "Do not restate the code in a fenced block, do not add a heading, and do not address the reader.",
].join(" ");

/**
 * Builds the user half of the request.
 *
 * Labelled parts rather than a bare body, as in `buildDescriptionInput`. The type matters more here
 * than in the other prompts: the same line of text is a `command` or a `snippet` depending on where
 * it was stashed, which is the difference between explaining a shell invocation and a program. The
 * language is the item's own free-text field — what the user said it was, and the only hint a
 * two-line snippet may carry.
 *
 * @remarks
 * No "return as JSON" line, unlike the other builders: this call does not request `json_object`
 * back. See {@link parseExplanation}.
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
 * Stricter than `hasDescribableContent`, which accepts a title alone: a description can be written
 * from a name, but an explanation of code cannot be written from the absence of code, and a model
 * asked to try produces a plausible paragraph about a function nobody wrote. The body is the whole
 * input here, so it is required.
 */
export function hasExplainableContent(draft: ItemDraft): boolean {
    return Boolean(draft.content?.trim());
}

/**
 * Reads the explanation out of whatever the model returned.
 *
 * @remarks
 * Markdown straight out, not a JSON field — the one place this feature departs from the other two.
 * They request `json_object` because they want a *part* of the answer; here the whole response is a
 * markdown document, and wrapping it would mean escaping every newline into a JSON string literal,
 * paying tokens for the escaping and adding a parse that can fail on a good document.
 * {@link MAX_EXPLANATION_LENGTH} is what the wrapper would have bought. Nothing here escapes
 * markdown punctuation: the text is markdown and is rendered as such, and `MARKDOWN_PLUGINS` plus
 * the instruction to backtick code-shaped tokens is what stops `HEAD~1` reading as formatting. The
 * two shapes {@link unwrap} still handles are model habits — a whole-response fenced block, and an
 * object with the text inside it. Anything unusable returns `null`.
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
    // A whole-response fence, not a fence within the explanation — the closing ``` has to be the
    // end of the text. An explanation that quotes a fenced block mid-paragraph starts with prose,
    // so it never matches.
    const fenced = /^```[a-z]*\n([\s\S]*)\n```$/i.exec(raw);

    if (fenced) return fenced[1];

    // Only attempted on something that looks like an object. Prose starting with a brace would
    // otherwise take a pointless trip through JSON.parse on every call.
    if (!raw.startsWith("{")) return raw;

    try {
        const parsed: unknown = JSON.parse(raw);

        if (typeof parsed === "object" && parsed !== null) {
            const { explanation } = parsed as { explanation?: unknown };

            if (typeof explanation === "string") return explanation;
        }
    } catch {
        // A body that starts like JSON and fails to parse is a truncated object, not prose —
        // handing it back would render a stray `{"explanation": "` as the first line. The same call
        // `parseSuggestedDescription` refuses.
        return null;
    }

    // Parsed, but not the object shape — a bare string, an array, a `null`. None of these is the
    // markdown that was asked for.
    return null;
}
