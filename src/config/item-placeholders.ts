import type { CreatableItemTypeName } from "@/lib/item-schemas";

/**
 * Placeholder copy for the item creation form, keyed by item type.
 *
 * `CreateItemDialog` reads these for its title and content fields, which change together with the
 * type the user picks. Adding an item type, or rewording what a field asks for, belongs here.
 *
 * @remarks
 * A placeholder never restates its field's label. A title is an example, prefixed "e.g." so an
 * empty field cannot be read as a filled-in one; a content placeholder is an instruction naming
 * what goes in, which is why it differs by type. Both rules, and {@link TITLE_MAX_LENGTH}, are
 * asserted by the test beside this file.
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

/**
 * The character budget a title placeholder has, enforced by the test beside this file.
 *
 * @remarks
 * A stand-in for width, which is the real constraint: the title field is around 215px wide on a
 * 320px phone. A title of capitals reaches the limit sooner than its character count suggests.
 */
export const TITLE_MAX_LENGTH = 26;
