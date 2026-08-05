import type { CreateItemField, UpdateItemField } from "@/lib/item-schemas";
import type { ItemDetailViewModel } from "./view-models";

/**
 * What the item mutations hand back. A discriminated union rather than one optional-everything
 * object, so a caller that has checked `success` gets `data` without a second null check.
 *
 * Lives here rather than beside the action for the same reason `AccountActionState` does: a
 * `"use server"` module may only export async functions.
 */
export type UpdateItemResult =
    | { success: true; data: ItemDetailViewModel }
    | {
          success: false;
          error: string;
          /** Per-field validation messages, so the drawer can mark the input that was rejected. */
          fields?: Partial<Record<UpdateItemField, string>>;
      };

/**
 * What `createItem` hands back. The success arm carries the new item's id and nothing else: the
 * dialog's next move is to close and refresh the list behind it, and the cards it will re-fetch are
 * rendered on the server anyway — so a view model assembled here would only be thrown away.
 */
export type CreateItemResult =
    | { success: true; data: { id: string } }
    | {
          success: false;
          error: string;
          fields?: Partial<Record<CreateItemField, string>>;
      };

/**
 * What `deleteItem` hands back. There is nothing to return on success — the row is gone, and the
 * drawer's next move is to close — so the success arm carries no payload.
 */
export type DeleteItemResult = { success: true } | { success: false; error: string };
