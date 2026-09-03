import type { z } from "zod";

/**
 * Turns a Zod parse failure into what a Server Action returns to a form.
 *
 * The item, collection, auth and account actions validate with the schemas in `lib/*-schemas.ts`;
 * on failure they call {@link fieldFailure} to get the `{ success: false, error, fields }` shape the
 * form contracts in `types/item.ts` and `types/collection.ts` expect. The form renders
 * `fields[name]` under each input and `error` in a toast.
 *
 * @remarks
 * It lives in `lib/` rather than beside the actions because a `"use server"` module may only export
 * async functions, so `actions/items.ts` cannot share a plain helper with `actions/collections.ts`.
 */

/**
 * The first error message for each field, keyed by field name.
 *
 * Reads `error.issues` directly rather than `z.flattenError`, whose field map is typed from the
 * schema's input and degrades to `any` once a helper accepts more than one schema.
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
 * The complete failure result a Server Action returns for a rejected parse.
 *
 * `error` is the first field's message, falling back to a generic sentence only when the parse
 * produced no field-scoped issue at all — a form-level `.refine()` with an empty `path`. `success`
 * is the literal `false` rather than `boolean`, or the discriminated result unions in
 * `types/item.ts` and `types/collection.ts` stop accepting the return.
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
