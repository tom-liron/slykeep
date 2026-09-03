import type { CreateCollectionField, UpdateCollectionField } from "@/lib/collection-schemas";

/**
 * The result contracts of the collection write path, and the reduced collection shape its controls
 * act on.
 *
 * The four unions are what the mutations in `actions/collections.ts` hand back to
 * `CreateCollectionDialog`, `EditCollectionDialog`, `DeleteCollectionDialog` and the favourite star;
 * {@link CollectionActionTarget} is what those controls are given to act on. They live here rather
 * than beside the actions because a `"use server"` module may export only async functions.
 *
 * @see {@link CreateCollectionField} and {@link UpdateCollectionField} in
 * `lib/collection-schemas.ts`, which name the fields a failure may report on.
 */

/**
 * What `createCollection` hands back.
 *
 * The success arm carries the new collection's id and nothing else. The dialog closes and refreshes
 * the surfaces behind it — the dashboard grid, `/collections` and the sidebar — all of which are
 * server components, so a view model assembled here would be discarded.
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
 * Nothing on success, unlike `updateItem`: every surface showing a collection's name and description
 * — the page header, the cards, the sidebar — was rendered on the server, so the dialog's move after
 * a save is `router.refresh()`.
 */
export type UpdateCollectionResult =
    | { success: true }
    | {
          success: false;
          error: string;
          fields?: Partial<Record<UpdateCollectionField, string>>;
      };

/**
 * What `deleteCollection` hands back. Nothing on success: the row is gone, and the caller either
 * leaves the page or refreshes the list it was in.
 */
export type DeleteCollectionResult = { success: true } | { success: false; error: string };

/**
 * What `toggleCollectionFavorite` hands back — the state the row is now in, read back from the
 * write, so the star renders what was written rather than what was asked for.
 *
 * @remarks
 * The twin of `ToggleItemFavoriteResult` in `types/item.ts`, restated rather than shared: the two
 * write paths are independent, and a shape one of them outgrows should not drag the other with it.
 */
export type ToggleCollectionFavoriteResult =
    { success: true; data: { isFavorite: boolean } } | { success: false; error: string };

/**
 * The collection an edit, delete or favourite control is acting on, reduced to what those three
 * need: an id to act on, a name for the confirmation and the dialog's fields, a description to edit,
 * and the favourite state the star renders.
 *
 * @remarks
 * Narrower than `CollectionViewModel` in `types/view-models.ts` because the controls are client
 * components rendered from server ones, so whatever this declares is serialized into the payload for
 * every card on the page. `CollectionViewModel` is assignable to it, so both call sites pass what
 * they already hold.
 */
export type CollectionActionTarget = {
    id: string;
    name: string;
    description: string;
    isFavorite: boolean;
};
