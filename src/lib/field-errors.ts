import type { z } from "zod";

/**
 * The first message reported against each field, keyed by field name — the toast needs one sentence
 * and the inputs need their own messages, and both come from the same parse, so there is no second
 * set of rules to keep in step.
 *
 * Read off `issues` rather than `z.flattenError`, whose field map is typed from the schema's input
 * and degrades to `any` once a helper accepts more than one schema.
 *
 * It lives here rather than beside the actions that call it because a `"use server"` module may only
 * export async functions, so `actions/items.ts` cannot share it with `actions/collections.ts`
 * directly — the choice is one module or one copy per action file.
 */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
    const fields: Record<string, string> = {};

    for (const issue of error.issues) {
        const [field] = issue.path;

        if (typeof field === "string" && !(field in fields)) {
            fields[field] = issue.message;
        }
    }

    return fields;
}
