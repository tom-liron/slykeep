import type { CreatableItemTypeName } from "@/lib/item-schemas";

/**
 * Two rules, both from the same finding: a placeholder must never restate the label, which is noise
 * at best and at worst makes an empty field look filled in.
 *
 * Where the field's *format* matters — language, tags, URL — the placeholder is an example, prefixed
 * "e.g." so it cannot be mistaken for a value. Where the field is open-ended and format is beside
 * the point, it is an instruction naming what goes in, which is why `content` differs by type: the
 * verb for a command is not the verb for a note. Title keeps an example rather than "Enter a title",
 * since the label already says "Title" and a sample shows what a useful one looks like.
 *
 * A third rule, learned the hard way and enforced by the test beside this file: a title has to fit
 * the field on a phone. The input is `text-base` until `md`, so it renders at 16px on every phone,
 * and at a 320px viewport its content box is 215px. "e.g. Reset a branch to origin" measured 203px
 * — twelve pixels of margin, under two characters — and clipped outright below 308px. That was
 * fixed one string at a time twice before the rule was written down, which is what the test is for.
 * `TITLE_MAX_LENGTH` is a character-count proxy for roughly 190px at 16px; the real constraint is
 * width, and a title full of capitals will reach it sooner than the count suggests.
 *
 * 16px is an assumption, and a breakable one: nothing pins a root font size, every size in the app
 * is a `rem`, so a browser set to a larger default scales all of it. Measured on a 344px phone with
 * a 20px root, "e.g. Deployment runbook" wants 228px of a 227px field — over by one pixel. That is
 * deliberately not solved here. Shortening every title until it fits an unknown multiple of the
 * budget would strip the examples of their point, and the larger font is an accessibility
 * preference to honour rather than design around. `text-ellipsis` on the `Input` primitive is what
 * catches it, and one trimmed character is the correct outcome.
 */
export const PLACEHOLDERS: Record<CreatableItemTypeName, { title: string; content: string }> = {
    snippet: { title: "e.g. Debounce hook", content: "Paste your code" },
    prompt: { title: "e.g. Code review prompt", content: "Write your prompt" },
    command: { title: "e.g. Reset a branch", content: "Paste your command" },
    note: { title: "e.g. Connection pooling", content: "Write your note" },
    link: { title: "e.g. Prisma migrate docs", content: "" },
    // The file types render an upload rather than a content field, so only the title is used.
    file: { title: "e.g. Deployment runbook", content: "" },
    image: { title: "e.g. Architecture diagram", content: "" },
};

/** The character budget a title placeholder has before it risks clipping on a 320px phone. */
export const TITLE_MAX_LENGTH = 26;
