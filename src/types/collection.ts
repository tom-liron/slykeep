import type { CreateCollectionField } from "@/lib/collection-schemas";

/**
 * What `createCollection` hands back. A discriminated union rather than one optional-everything
 * object, so a caller that has checked `success` gets `data` without a second null check.
 *
 * Lives here rather than beside the action for the same reason the item results do: a `"use server"`
 * module may only export async functions.
 *
 * The success arm carries the new collection's id and nothing else. The dialog's next move is to
 * close and refresh the surfaces behind it — the dashboard grid, `/collections`, and the sidebar —
 * all of which are server components, so a view model assembled here would only be thrown away.
 */
export type CreateCollectionResult =
    | { success: true; data: { id: string } }
    | {
          success: false;
          error: string;
          /** Per-field validation messages, so the dialog can mark the input that was rejected. */
          fields?: Partial<Record<CreateCollectionField, string>>;
      };
