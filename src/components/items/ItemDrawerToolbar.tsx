"use client";

import { Copy, Download, Pencil, Pin, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWriteBlockedReason } from "@/components/layout/VerifiedContext";
import { ActionLabel } from "./ActionLabel";
import { DeleteItemDialog } from "./DeleteItemDialog";

/**
 * Item drawer action toolbar.
 *
 * Renders the favourite, pin, copy, download, edit and delete actions for the currently open item.
 * `ItemDrawer` owns the item state and mutation handlers; this component takes those values and
 * callbacks and renders the controls. `ItemDrawer` omits the toolbar in edit mode, where Save and
 * Cancel take its place.
 *
 * @remarks
 * Two layouts, switching at 680px (`min-[42.5rem]`) in step with `ActionLabel`:
 * - Below it, an equal-width grid (`grid auto-cols-fr grid-flow-col`) so all six actions stay
 *   evenly spread and reachable on a narrow drawer, with the labels dropped. Keep the `gap-0.5` —
 *   a wider gap drops the columns under the 44px touch-target minimum at the narrowest width.
 * - From it up, a `flex flex-wrap` row; each control `grow`s, capped at `max-w-40` so a lone
 *   wrapped control cannot stretch full-bleed. Wrapping is the fallback for the rare six-control
 *   row (a text file showing Copy and Download); `flex-nowrap` would let the sheet's
 *   `overflow-x-hidden` clip Delete.
 *
 * The Edit/Delete pair is wrapped in `display: contents` so both buttons are grid/flex items in
 * their own right rather than sharing one slot. Every control is `size="sm"` (including
 * `DeleteItemDialog`'s) so the grid stretches them to equal width.
 *
 * The tray's hover fill is written twice — `[&_button]:hover:bg-foreground/15` and its `dark:`
 * form — because this project's `dark` variant (`&:is(.dark *)`) adds specificity, so the plain
 * rule loses to the ghost button's `dark:hover:bg-muted/50` without the repeat. `ItemDrawer`'s
 * close button sits outside the tray and repeats the same fill itself.
 */
export function ItemDrawerToolbar({
    isFavorite,
    isFavoriting,
    onToggleFavorite,
    isPinned,
    isPinning,
    onTogglePin,
    showsCopy,
    canCopy,
    onCopy,
    isFile,
    /** Empty until the detail has loaded, which is what the disabled Download stands in for. */
    fileName,
    fileUrl,
    canEdit,
    onEdit,
    itemId,
    title,
    onDeleted,
}: {
    isFavorite: boolean;
    isFavoriting: boolean;
    onToggleFavorite: () => void;
    isPinned: boolean;
    isPinning: boolean;
    onTogglePin: () => void;
    showsCopy: boolean;
    canCopy: boolean;
    onCopy: () => void;
    isFile: boolean;
    fileName: string;
    fileUrl: string;
    canEdit: boolean;
    onEdit: () => void;
    itemId: string;
    title: string;
    onDeleted: () => void;
}) {
    // Copy and Download stay live for an unconfirmed account; the other three write, so they are
    // disabled here and refused again in the action. See `VerifiedContext`.
    const blocked = useWriteBlockedReason();
    return (
        // Outer `border-t` separates the row from the content above; the inner tray groups the six
        // controls into one bordered object so a row of ghost buttons does not read as loose text.
        <div className="border-t border-border pt-3">
            <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg border border-border bg-muted/30 p-1 dark:[&_a]:hover:bg-foreground/15 dark:[&_button]:hover:bg-foreground/15 [&_a]:hover:bg-foreground/15 [&_button]:hover:bg-foreground/15 min-[42.5rem]:flex min-[42.5rem]:flex-wrap min-[42.5rem]:items-center min-[42.5rem]:gap-1 min-[42.5rem]:[&_a]:grow min-[42.5rem]:[&_button]:grow min-[42.5rem]:[&_a]:max-w-40 min-[42.5rem]:[&_button]:max-w-40">
                {/* Titled and labelled by what the click does, not the item's state: the filled
                    star already shows which state it is in. */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleFavorite}
                    disabled={isFavoriting || blocked !== null}
                    title={blocked ?? (isFavorite ? "Remove from favorites" : "Add to favorites")}
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                    <Star
                        // Filled when on, like `CollectionActions`' star and unlike every other one
                        // — see the note there.
                        className={isFavorite ? "fill-favorite text-favorite" : undefined}
                        aria-hidden="true"
                    />
                    <ActionLabel>Favorite</ActionLabel>
                </Button>
                {/* Named by the action, like Favorite. */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onTogglePin}
                    disabled={isPinning || blocked !== null}
                    title={blocked ?? (isPinned ? "Unpin" : "Pin to the top")}
                    aria-label={isPinned ? "Unpin" : "Pin to the top"}
                >
                    {/* Filled `sky-400` when pinned — a fill alone reads as a bolder icon, not a
                        state. Not `#3b82f6`, which is a snippet's own accent. */}
                    <Pin
                        className={isPinned ? "fill-sky-400 text-sky-400" : undefined}
                        aria-hidden="true"
                    />
                    <ActionLabel>Pin</ActionLabel>
                </Button>
                {/* A file shows Copy only when its contents are text; an image or PDF has nothing
                    to put on the clipboard. */}
                {showsCopy && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCopy}
                        disabled={!canCopy}
                        title="Copy"
                        aria-label="Copy"
                    >
                        <Copy aria-hidden="true" />
                        <ActionLabel>Copy</ActionLabel>
                    </Button>
                )}
                {isFile &&
                    // An anchor, so the browser downloads it normally. A plain disabled button
                    // until the detail loads, because `disabled` does nothing on an `<a>`.
                    (fileName ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title="Download"
                            aria-label="Download"
                        >
                            <a href={`${fileUrl}?download`} download={fileName}>
                                <Download aria-hidden="true" />
                                <ActionLabel>Download</ActionLabel>
                            </a>
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            title="Download"
                            aria-label="Download"
                        >
                            <Download aria-hidden="true" />
                            <ActionLabel>Download</ActionLabel>
                        </Button>
                    ))}

                {/* `display: contents`, not `ml-auto`: keeps Edit and Delete evenly spaced with the
                    rest so the row reads as one toolbar. */}
                <div className="contents">
                    {/* Disabled until the body has loaded: the form is seeded from the detail. */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onEdit}
                        disabled={!canEdit || blocked !== null}
                        title={blocked ?? "Edit"}
                        aria-label="Edit"
                    >
                        <Pencil aria-hidden="true" />
                        <ActionLabel>Edit</ActionLabel>
                    </Button>
                    {/* Titled from `view`, so a rename saved a moment ago is what the confirmation
                        names. Closing is all this drawer has to do: `ItemList` drops the item on
                        the refresh. */}
                    <DeleteItemDialog itemId={itemId} title={title} onDeleted={onDeleted} />
                </div>
            </div>
        </div>
    );
}
