"use client";

import { Copy, Download, Pencil, Pin, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ActionLabel } from "./ActionLabel";
import { DeleteItemDialog } from "./DeleteItemDialog";

/**
 * The drawer's action row: favourite, pin, copy, download, edit, delete.
 *
 * Its own component because of what it is made of. Six controls and nearly three hundred lines of
 * layout reasoning — a container query, a grid that becomes a flex row, and the measurements behind
 * every one of those decisions — sat in the middle of `ItemDrawer`, between the fetch that loads an
 * item and the markup that renders it, and made the drawer's actual data flow hard to find. None of
 * that reasoning is about the drawer; all of it is about whether six buttons fit in a tray.
 *
 * It owns no state. The two optimistic toggles stay in the drawer, which is where the writes and the
 * `router.refresh()` calls that follow them live — this takes their current value and their handler,
 * and renders the row. The whole bar gives way to the form's Save / Cancel in edit mode, so the
 * drawer simply does not render it then.
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
    return (
        // One row wherever it fits, and it fits everywhere worth designing for:
        // `ActionLabel` drops the words on a narrow panel, which leaves six icons, and
        // six 44px touch targets plus their gaps and the tray's padding come to
        // ~294px against the 328px a 360px phone gives them.
        //
        // `flex-wrap` is for the width below that. These buttons carry `shrink-0
        // whitespace-nowrap`, so a row that does not fit does not compress — and
        // with `overflow-x-hidden` on the sheet it is not a scrollbar either, it is
        // Delete being clipped off the edge with no way to reach it. At 320px the
        // six need ~294px and the panel offers 288, so wrapping is the difference
        // between the last control moving down a line and the last control being
        // gone. Nothing above 320px sees a second row.
        //
        // On a narrow panel it is not a flex row at all — it is
        // `grid-flow-col auto-cols-fr`, one row of equal columns, and that is the
        // point: a grid of a fixed column count cannot wrap, so there is no width
        // at which a control gets stranded. Two flex arrangements were tried here
        // and both failed on real hardware. Left to their natural size the icons
        // clumped at one end and left a 71px dead strip, reading as a toolbar that
        // had lost its last button. Given `grow` instead, they filled the line —
        // until one did not fit, and then the last one wrapped and grew to the
        // whole width of the second row, which put a single full-bleed Delete under
        // the other four. Equal columns give the even spread the second attempt was
        // after without the failure mode, because "how many per row" stops being
        // something the browser decides from arithmetic.
        //
        // `justify-between` above the stop, so the row spans the tray without any
        // control changing size. The panel is a fixed 640px there and a
        // five-control row is 406px of it, so packed at their natural widths the
        // buttons left a third of the toolbar as dead space on the right, reading
        // as a bar that had lost its last buttons.
        //
        // It was `grow` first, which filled the row equally well and had one bad
        // property: a control that wrapped grew to the *whole width of its line*,
        // so the one time the row did not fit, Delete appeared alone and full-bleed
        // beneath the others. Distributing the slack as gaps rather than as width
        // has no such failure mode — a wrapped control keeps its own size.
        //
        // The `Edit`/`Delete` pair is `contents` at every width now, not just below
        // the stop. As a flex item it was one box taking a single share of that
        // growth and splitting it, so those two came out half the width of the
        // three beside them. Dissolving it costs nothing the row wanted: the pair
        // was never meant to be pushed apart from the others — see the note above
        // about not using `ml-auto` — and an evenly spread row is what "reads as
        // one toolbar" was asking for in the first place.
        //
        // The grid's default stretch is left alone, so each control fills its
        // column. That works because every control in the row is now the same
        // shape — `size="sm"`, which sets padding and a minimum but no explicit
        // width. It briefly needed `justify-items-center` instead, when the delete
        // trigger was `size="icon-sm"`: an explicit `size-7`/`size-11` cannot
        // stretch, so it sat 44px wide at the start of a 59px cell while its
        // neighbours filled theirs — one ragged control in a row whose whole
        // purpose is being even. Making it match the other four fixed the cause.
        //
        // Above the stop the controls `grow`, so the row spans the tray. The
        // panel is a fixed 576px there and the widest row — a previewable text
        // file's six controls, the only shape showing `Copy` and `Download`
        // together — is 480px of a 516px tray. Packed at their natural widths the
        // rest left a third of the toolbar empty on the right, reading as a bar
        // that had lost its last buttons.
        //
        // 36rem is the floor, and it is set by that one row rather than by the
        // four that are narrower. A snippet needs 376px and an image 405px, so
        // most of the time the panel is wider than the toolbar strictly requires —
        // but a panel cannot be two widths, and sizing it to the common row is
        // what put the six-control row on two lines for several revisions. 36px of
        // slack on the widest row is the whole of the margin; below this the words
        // have to start disappearing again.
        //
        // `grow` only ever *adds* space to a flex item, never shrinks it below its
        // content, so it cannot overflow. Its one bad property is that a control
        // which *wraps* grows to the whole width of its line, and that is exactly
        // what a stranded, full-bleed Delete looked like when the row did not fit.
        // It does fit now, with 36px to spare on the widest row there is, so the
        // failure mode has no width to occur at.
        //
        // `max-w-40` is the belt to that braces, and it is deliberately slack. The
        // narrowest this row ever gets is four controls sharing the tray, which is
        // ~129px each, so 160px never binds in any layout that is working. It binds
        // only on the one that is not: a lone control wrapped onto its own line,
        // where `grow` would otherwise stretch it across the full width. That was
        // measured once at 569px in a 571px tray — a Delete button rendered as a
        // full-bleed bar — and it happened on a stylesheet that did not match the
        // source. The cap does not fix the wrap; it stops the wrap from looking
        // catastrophic while the real cause is found. `justify-between` was the other
        // way to fill the row and is worse: it turns the slack into gaps, which on
        // a five-control row is 34px between every icon.
        //
        // A quantity query — `:has(> *:nth-child(5))`, hiding the words when the
        // row has six controls — lived here for several revisions and is gone. It
        // was correct CSS solving a problem that did not exist: it was introduced
        // on the belief that the reported rendering was ~20% wider than this one,
        // measured from a screenshot, and a later screenshot of the same toolbar
        // put the five-label row at ~364px against the 377px measured here. The
        // renderings agree. What actually differed was the *panel*, which was
        // 480px then and gave a 418px tray, 63px short of the six-control row —
        // and, more often than not, a dev server serving a stale stylesheet. Two
        // conclusions worth keeping: measure the element, never a screenshot, and
        // confirm the CSS being served is the CSS that was written before
        // concluding anything at all.
        //
        // The switch is a *container* query against the wrapper above, plus an
        // `sm:` floor, and it must stay identical to `ActionLabel`'s — that is where
        // the words appear, and labelled buttons cannot go in a grid that has no
        // line to wrap onto. The reasoning for both halves is recorded there.
        //
        // The container is the wrapper rather than this element because a container
        // query styles a container's *descendants* and never the container itself,
        // and this element's own `display` is one of the two things that changes.
        //
        // `gap-0.5` narrow, not `gap-1`, and it is load-bearing at exactly one
        // width: six controls on a 320px screen leave 278px, which is 44.7px a
        // column at 2px gaps and 43px at 4px — just under the 44px the buttons ask
        // for, which would overflow the tracks. Two pixels of gap buy the floor.
        //
        // The Edit/Delete pair is `contents` at that width so its two buttons are
        // grid items in their own right. Left as one box it would occupy a single
        // column and split it, and those two would come out half the width of the
        // rest. The pair is a grouping for the wide layout, where it is a real flex
        // row again.
        // The hover fill is stated once, here, rather than on each control. It
        // used to be six identical `dark:hover:bg-muted` classes plus a seventh
        // inside `DeleteItemDialog`, and a fill that lives in seven places is a
        // fill that drifts.
        //
        // It is written twice, and the duplicate is not redundant. `[&_button]:`
        // alone is `.tray button:hover` — specificity (0,2,1) — which beats the
        // ghost variant's light `hover:bg-muted` at (0,2,0) but *loses* to its
        // `dark:hover:bg-muted/50`: this project's `dark` variant is
        // `&:is(.dark *)`, and that `:is()` counts as a class, putting the
        // variant at (0,3,0). The rule applied everywhere except the theme the app
        // ships in, which is the one place it was written for. Repeating it under
        // `dark:` lands at (0,3,1) and settles it.
        //
        // `foreground/15`, not `muted`. Full-strength `muted` was already an
        // improvement on the variant's `muted/50`, which at `oklch(0.269)` against
        // this panel is very nearly the panel — but it is still a flat token a
        // couple of steps above the surface, and the row wanted a fill you can see
        // land. An alpha over `foreground` is brighter in the dark theme and
        // *darker* in the light one, which is the same instruction — "more
        // present" — expressed once instead of as two hand-picked colours.
        //
        // Note this is the row only. The editor below keeps its own hover, which is
        // a white alpha over a hard-coded monaco surface that does not flip with
        // the theme; nothing here reaches into it.
        // Two elements, because they do two things. The rule separates the actions
        // from the content above them; the tray inside groups the six controls into
        // one object. The hover override below fixed how this row reads *under the
        // pointer* — the tray is what it reads as at rest, which is where six ghost
        // buttons on a bare panel read as a line of text rather than a toolbar.
        // One tray rather than a border on each control: six outlines side by side
        // compete with each other and with the item's own chrome, and the thing that
        // needs a boundary here is the set, not its members.
        <div className="border-t border-border pt-3">
            <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg border border-border bg-muted/30 p-1 dark:[&_a]:hover:bg-foreground/15 dark:[&_button]:hover:bg-foreground/15 [&_a]:hover:bg-foreground/15 [&_button]:hover:bg-foreground/15 min-[42.5rem]:flex min-[42.5rem]:flex-wrap min-[42.5rem]:items-center min-[42.5rem]:gap-1 min-[42.5rem]:[&_a]:grow min-[42.5rem]:[&_button]:grow min-[42.5rem]:[&_a]:max-w-40 min-[42.5rem]:[&_button]:max-w-40">
                {/* Titled and labelled by what the click will *do*, not by what the item
                is — the filled star already says which of the two states it is in,
                and a control named "Favorite" on an already-favourited item reads as
                the one thing it will not do. */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleFavorite}
                    disabled={isFavoriting}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                    <Star
                        // Filled when on, like `CollectionActions`' star and unlike
                        // every other one — see the note there.
                        className={isFavorite ? "fill-favorite text-favorite" : undefined}
                        aria-hidden="true"
                    />
                    <ActionLabel>Favorite</ActionLabel>
                </Button>
                {/* Named by the action for the same reason Favorite is: the filled pin
                already says which state the item is in. */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onTogglePin}
                    disabled={isPinning}
                    title={isPinned ? "Unpin" : "Pin to the top"}
                    aria-label={isPinned ? "Unpin" : "Pin to the top"}
                >
                    {/* Filled sky blue when pinned, the same way the star goes filled
                    yellow — a fill alone reads as "slightly bolder icon" at 14px,
                    which is not a state. Blue rather than any of the type accents'
                    blues would be, at `sky-400`: light enough to carry on the dark
                    surface, and not `#3b82f6`, which is what a snippet's own accent
                    is drawn in three inches above this. */}
                    <Pin
                        className={isPinned ? "fill-sky-400 text-sky-400" : undefined}
                        aria-hidden="true"
                    />
                    <ActionLabel>Pin</ActionLabel>
                </Button>
                {/* Copy appears for a file only when the file is text, where its rendered
                contents are as copyable as a snippet's. An image or a PDF has
                nothing to put on the clipboard, so a Copy beside Download would be a
                control that can never do anything. */}
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
                    // An anchor rather than a click handler, so the browser downloads it
                    // the way it downloads anything else. Rendered as a plain disabled
                    // button until the detail has loaded, because `disabled` means
                    // nothing to an `<a>` — it would still be clickable.
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

                {/* Grouped with the rest rather than pushed right by `ml-auto`: the
                wider the panel got, the further Edit and Delete drifted from the
                controls they belong with, until Delete was alone against the edge.
                One evenly spaced row reads as one toolbar. */}
                <div className="contents">
                    {/* Disabled until the body has loaded: the form is seeded from the
                    detail, and there is nothing to seed it with before then. */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onEdit}
                        disabled={!canEdit}
                        title="Edit"
                        aria-label="Edit"
                    >
                        <Pencil aria-hidden="true" />
                        <ActionLabel>Edit</ActionLabel>
                    </Button>
                    {/* Titled from `view`, so a rename saved a moment ago is what the
                    confirmation names. Closing is all this drawer has to do: the
                    row is gone, and `ItemList` drops the item on the refresh. */}
                    <DeleteItemDialog itemId={itemId} title={title} onDeleted={onDeleted} />
                </div>
            </div>
        </div>
    );
}
