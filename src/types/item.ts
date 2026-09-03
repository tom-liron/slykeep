import type { CreateItemField, UpdateItemField } from "@/lib/item-schemas";
import type { ItemDetailViewModel } from "./view-models";

/**
 * The result contracts of the item write path: what each mutation in `actions/items.ts` hands back
 * to the drawer, the create dialog and the card controls that called it.
 *
 * Every one is a discriminated union, so a caller that has checked `success` reads `data` without a
 * second null check, and the failure arms carry both a sentence for a toast and — where a form
 * submitted the write — the per-field messages `lib/field-errors.ts` derived from the Zod parse. The
 * types live here rather than beside the actions because a `"use server"` module may export only
 * async functions.
 *
 * @see {@link CreateItemField} and {@link UpdateItemField} in `lib/item-schemas.ts`, which name the
 * fields a failure may report on.
 */

/**
 * What `updateItem` hands back.
 *
 * The success arm carries the whole item because the drawer holds it in client state and re-renders
 * from what came back rather than re-fetching it.
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
 * What `createItem` hands back.
 *
 * The success arm carries the new item's id and nothing else: the dialog closes and refreshes the
 * listing behind it, which is a server component, so a view model assembled here would be discarded.
 */
export type CreateItemResult =
    | { success: true; data: { id: string } }
    | {
          success: false;
          error: string;
          fields?: Partial<Record<CreateItemField, string>>;
      };

/**
 * What `deleteItem` hands back. The success arm carries no payload — the row is gone and the
 * drawer's next move is to close.
 */
export type DeleteItemResult = { success: true } | { success: false; error: string };

/**
 * What `toggleItemFavorite` hands back: the state the row is now in, read back from the write.
 *
 * @remarks
 * The star renders from what came back rather than from what was asked for, so a write that lands
 * differently than requested cannot leave a filled star over an unfavourited row.
 */
export type ToggleItemFavoriteResult =
    { success: true; data: { isFavorite: boolean } } | { success: false; error: string };

/**
 * What `toggleItemPin` hands back, drawn from the state that was written for the reason its
 * neighbour above is.
 */
export type ToggleItemPinResult =
    { success: true; data: { isPinned: boolean } } | { success: false; error: string };
