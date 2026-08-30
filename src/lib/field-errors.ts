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

/**
 * The whole failure result a Server Action returns when its Zod parse did not pass.
 *
 * The toast shows the *first* field's message, and falls back to a generic sentence only when the
 * parse produced no field-scoped issue at all — a form-level `.refine()` with an empty `path`. That
 * ordering rule is the reason this is one function rather than four copies: it is a real decision,
 * and so is the fallback sentence, which was a user-facing string with four identical copies and
 * nothing keeping them identical.
 *
 * `success` is typed as the literal `false` rather than inferred as `boolean`, or the discriminated
 * result unions in `types/item.ts` and `types/collection.ts` stop accepting the return.
 */
export function fieldFailure(error: z.ZodError): {
    success: false;
    error: string;
    fields: Record<string, string>;
} {
    const fields = fieldErrorsOf(error);

    return {
        success: false,
        error: Object.values(fields)[0] ?? "Check the highlighted fields and try again.",
        fields,
    };
}
