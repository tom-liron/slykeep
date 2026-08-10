import type { CreateCollectionField, UpdateCollectionField } from "@/lib/collection-schemas";

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

/**
 * What `updateCollection` hands back.
 *
 * Nothing on success, unlike `updateItem` — which returns the whole item because the drawer holds it
 * in client state and has to re-render from what came back. Every surface showing a collection's
 * name and description here (the page header, the cards, the sidebar) was rendered on the server, so
 * the dialog's move after a save is `router.refresh()`, and a view model assembled here would be
 * thrown away exactly as `createCollection`'s would.
 */
export type UpdateCollectionResult =
    | { success: true }
    | {
          success: false;
          error: string;
          fields?: Partial<Record<UpdateCollectionField, string>>;
      };

/**
 * What `deleteCollection` hands back. Nothing on success: the row is gone, and the caller's next
 * move is either to leave the page or to refresh the list it was in.
 */
export type DeleteCollectionResult = { success: true } | { success: false; error: string };

/**
 * The collection an edit / delete / favorite control is acting on, reduced to what those three
 * actually need: an id to act on, a name to put in the confirmation and the dialog's fields, a
 * description to edit, and the favourite state the star renders.
 *
 * Narrower than `CollectionViewModel` on purpose. The controls are client components rendered from
 * server ones, so whatever this declares is serialized into the payload for every card on a page —
 * and a card's derived item types and counts are of no use to a menu. `CollectionViewModel` is
 * assignable to it, so both call sites pass what they already have.
 */
export type CollectionActionTarget = {
    id: string;
    name: string;
    description: string;
    isFavorite: boolean;
};
