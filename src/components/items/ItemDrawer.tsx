"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Folder, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { toggleItemFavorite, toggleItemPin, updateItem } from "@/actions/items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFileText } from "@/hooks/use-file-text";
import { useItemDetail } from "@/hooks/use-item-detail";
import { copyToClipboard } from "@/lib/clipboard";
import { filePreviewFor } from "@/lib/file-preview";
import { formatLongDate } from "@/lib/format";
import { itemTypeOwns } from "@/lib/item-schemas";
import { withAlpha } from "@/lib/utils";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { CodeEditor } from "./CodeEditor";
import { FilePreview } from "./FilePreview";
import { ItemDrawerToolbar } from "./ItemDrawerToolbar";
import { ItemEditForm } from "./ItemEditForm";
import { MarkdownEditor } from "./MarkdownEditor";
import { TypeIcon } from "./TypeIcon";

/**
 * The item detail view. There is no item page — this drawer is where an item is read.
 *
 * It opens on the summary the card already had, and fetches only what the card could not show. List
 * queries never select an item body, so the content, the collections holding it, and its creation
 * date are the parts that have to be waited for; the title, type, tags, and description are on
 * screen before the request is even sent. That is what makes the open feel immediate rather than a
 * spinner over an empty panel.
 */
export function ItemDrawer({
    item,
    open,
    onClose,
}: {
    item: ItemSummaryViewModel;
    open: boolean;
    onClose: () => void;
}) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [isFavoriting, startFavoriting] = useTransition();
    /**
     * The favourite state this drawer has written, or null when it has written none.
     *
     * Neither `item` nor `detail` can hold it on its own: the prop is a snapshot the list passed in
     * and never updates, and the detail may still be in flight when the star is clicked — the toolbar
     * is on screen before the fetch lands. This wins over both once it is set, so the star answers
     * the click immediately and keeps answering it if a slower detail response arrives afterwards.
     */
    const [writtenFavorite, setWrittenFavorite] = useState<boolean | null>(null);
    const [isPinning, startPinning] = useTransition();
    /** The pinned state this drawer has written, held for the same reason `writtenFavorite` is. */
    const [writtenPinned, setWrittenPinned] = useState<boolean | null>(null);

    const itemId = item.id;

    const { detail, setDetail, error } = useItemDetail(itemId);

    const isFile = item.itemType.contentType === "FILE";
    const bodyLabel = isFile ? "File" : item.itemType.contentType === "URL" ? "URL" : "Content";

    // Both the preview and the download read the same route; `?download` only changes the
    // `Content-Disposition` it answers with. The R2 key is never in this URL — the route resolves it
    // from the item, after checking the item is this user's.
    const fileUrl = `/api/files/${itemId}`;

    // How this item's object is shown, if at all — text under the cap is rendered, a PDF goes to the
    // browser's viewer, anything else is name and size. Null until the detail says what the file is.
    const preview =
        isFile && detail?.fileName
            ? filePreviewFor({ name: detail.fileName, size: detail.fileSize })
            : null;

    const isTextPreview = preview?.kind === "markdown" || preview?.kind === "code";

    const { fileText, fileError } = useFileText(fileUrl, isTextPreview);

    const accent = item.itemType.color;
    // A text file's contents are as copyable as a snippet's, once they are on screen.
    const body = detail?.url || detail?.content || fileText || "";
    const showsCopy = !isFile || isTextPreview;

    // "Owns a language" is the same thing as "its content is code" — snippets and commands. Notes
    // and prompts are prose, and get the markdown editor's rendered preview instead; a syntax
    // highlighter over English is only a distraction, and English is what people write markdown in.
    const showsCode = itemTypeOwns(item.itemType.name).language;

    // The one type the optimizer accepts, and the same test the action re-applies server-side as
    // `isOptimizablePromptType`. A literal comparison rather than a catalog property, because there
    // is no property in the catalog that means "is a prompt" other than being one.
    const isPrompt = item.itemType.name === "prompt";

    // The card's summary is what the drawer opens on, but it stops being the truth the moment an
    // edit is saved: `ItemList` holds the clicked item in state, so a `router.refresh()` updates the
    // cards behind without touching this prop. Once the detail has loaded — and after every save —
    // it is the newer of the two, so everything the summary also carries is read from it.
    const view: ItemSummaryViewModel = detail ?? item;

    /**
     * What the Explain button sends the model, built at click time.
     *
     * Handed only to the read-only editor below, which is the whole of "not in the create and edit
     * forms": those render their own `CodeEditor` without this prop, so the button does not exist
     * there rather than being hidden there. `showsCode` is the same test the action re-applies as
     * `isExplainableType` — a snippet or a command — so a hand-made request cannot ask for an
     * explanation of a note.
     *
     * It reads `detail`, not `item`: the summary the card passed in has no body at all, and the
     * body is the entire input. Everything else is context the prompt uses to tell a shell line
     * from a program — the type most of all.
     */
    const explainDraft = () => ({
        title: view.title,
        content: detail?.content ?? "",
        language: detail?.language,
        tags: view.tags.join(", "),
        type: item.itemType.name,
    });

    /**
     * What the Optimize button sends the model, built at click time.
     *
     * `explainDraft`'s twin, and handed to the same read-only editor for the same reason: the create
     * and edit forms render their own `MarkdownEditor` without this prop, so the button does not
     * exist there rather than being hidden there.
     *
     * No `language` — a prompt has none — and the type is what `optimizePrompt` re-checks as
     * `isOptimizablePromptType`, so a hand-made request cannot ask for a note to be rewritten.
     */
    const optimizeDraft = () => ({
        title: view.title,
        content: detail?.content ?? "",
        tags: view.tags.join(", "),
        type: item.itemType.name,
    });

    /**
     * Saves an accepted rewrite over the prompt's own body.
     *
     * **The payload names only what changes.** `updateItem` reads an absent field as "leave this
     * alone" — `tags` and `collections` are written as Prisma relation operations guarded by
     * `tags && {...}` / `collectionIds && {...}`, and the optional text columns are `undefined`,
     * which Prisma skips. So omitting them is not a shortcut that happens to work; it is the
     * contract, and it is safer than rebuilding the full payload from `detail` would be, because a
     * field this drawer forgot to copy across would silently clear the column rather than being
     * left untouched.
     *
     * `title` is the exception and has to be sent: `updateItemSchema` requires a non-empty one.
     *
     * Returns whether it saved, which is what lets `MarkdownEditor` keep the review panel open on a
     * failure instead of throwing away the rewrite the user just accepted.
     */
    const useOptimizedPrompt = async (prompt: string): Promise<boolean> => {
        const result = await updateItem(itemId, { title: view.title, content: prompt });

        if (!result.success) {
            toast.error(result.error);

            return false;
        }

        setDetail(result.data);
        toast.success("Prompt updated.");
        // The cards behind were rendered on the server from the old row. Same pair of steps the
        // edit form's save makes, for the same reason.
        router.refresh();

        return true;
    };

    // The write and both toasts moved to `copyToClipboard`, shared with the cards' copy icon: the
    // same action reached two ways should not be able to start reporting itself two ways.
    const copyBody = () => copyToClipboard(body);

    const isFavorite = writtenFavorite ?? view.isFavorite;

    const toggleFavorite = () => {
        const next = !isFavorite;

        startFavoriting(async () => {
            const result = await toggleItemFavorite(itemId, next);

            if (!result.success) {
                toast.error(result.error);

                return;
            }

            setWrittenFavorite(result.data.isFavorite);
            toast.success(
                result.data.isFavorite ? "Added to favorites." : "Removed from favorites.",
            );

            // Re-renders the page behind the drawer: the card's star, the dashboard's favourite
            // count, and — when the drawer was opened from `/favorites` — the list this item is
            // being removed from. That last one takes the row out from under an open drawer, which
            // is the honest outcome: the item is no longer a favourite, and the drawer stays open on
            // it until it is closed.
            router.refresh();
        });
    };

    const isPinned = writtenPinned ?? view.isPinned;

    const togglePin = () => {
        const next = !isPinned;

        startPinning(async () => {
            const result = await toggleItemPin(itemId, next);

            if (!result.success) {
                toast.error(result.error);

                return;
            }

            setWrittenPinned(result.data.isPinned);
            toast.success(result.data.isPinned ? "Pinned to the top." : "Unpinned.");

            // The listing behind the drawer orders by pin, so this moves the row the drawer was
            // opened from — and on the dashboard it adds the item to the Pinned section without
            // removing it from Recent, which the two lists no longer being disjoint is what allows.
            // Same trade the star makes: the page tells the truth immediately, and the drawer stays
            // open on the item until it is closed.
            router.refresh();
        });
    };

    return (
        <Sheet
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    // Closing leaves edit mode, so reopening the same item shows it rather than a
                    // half-filled form. The drawer stays mounted between opens — it is keyed by item
                    // id, not by whether it is on screen — so this does not reset itself.
                    setIsEditing(false);
                    onClose();
                }
            }}
        >
            {/* Both width utilities carry the sheet's own `data-[side=right]` variant, because that is
                the only way to replace what `SheetContent` already declares.

                Its defaults are `data-[side=right]:w-3/4` and `data-[side=right]:sm:max-w-sm`, which
                compile to `.class[data-side="right"]` — specificity (0,2,0). A plain `sm:max-w-xl`
                passed in here is (0,1,0) and loses, and `cn` cannot merge the two because the
                modifiers differ, so both survive into the DOM. The panel was therefore **24rem** on
                every viewport at or above `sm`, whatever cap this file asked for. That is the whole
                explanation for the drawer feeling cramped and for the horizontal scrollbar: five
                labelled toolbar buttons need about 400px, which 384px cannot give them — and the
                file types were the ones to show it because "Download" is wider than "Copy".

                Matching the variant exactly lets `cn` drop both defaults instead of fighting them.

                30rem is the smallest this can be while the toolbar still reads as one row: its five
                labelled buttons need about 400px and the panel adds 40px of padding, so 440px is the
                point below which they start to squeeze — 480px leaves that a little air and nothing
                more. Deliberately minimal: a drawer beside the page, not a second page. Going
                narrower means giving up the button labels at every width rather than only below
                560px, which is a different decision from this one.

                **600px is where the drawer stops being the page and becomes a panel**, and it is
                the only stop this component has — the width, the header's shape, where the ✕ sits,
                the toolbar's grid-or-flex, and whether its buttons carry words are all the same
                question asked once. It was `sm` (640px), which was too high to be logical: a 700px
                window is a laptop, and a laptop does not want one item taking the whole screen.

                **36rem, and the cap is the variable — not the breakpoint.** Whether the toolbar's
                words fit is not a question a breakpoint can answer: above the stop the panel is a
                fixed width at every window size, so the row's headroom is identical at 600px and at
                4K. The words either always fit or never do. Four breakpoints were moved chasing a
                wrapping report before that became obvious.

                The rows are not all the same width, which is what made 30rem look sufficient. A
                snippet's five controls measure 377px, so against a 418px tray they fitted by 41px
                and the arithmetic looked fine. But `Copy` and `Download` are conditional and not
                mutually exclusive. An **image** swaps the first for the second — five controls
                again, but 406px, because "Download" is the longest word in the set, and 406 against
                that 418px tray is 12px from wrapping, which is exactly what it did. A **previewable
                text file** shows both: `showsCopy` is `!isFile || isTextPreview`, so a `.txt` or
                `.json` under the preview size cap gets six controls and 481px, while the same file
                over the cap — or any extension the language map does not know — is back to five.
                Sizing the panel to the common row is what put a two-line toolbar on every image.

                36rem gives a 525px tray: 148px spare for a snippet and 119px for an image, both
                comfortable. The six-control row is not solved by the cap and cannot be. Above the
                stop the panel is capped, so the tray is a constant 525px at every window size, and
                just above the stop it is ~501px against a 481px row — 4%. Making *that* fit would
                need the stop near 700px, which is the full-screen takeover this moved away from.
                So the six-control row drops its words instead; see the quantity query below.

                600 rather than something smaller because of what the panel becomes: the cap only
                binds once `92vw` exceeds it, so below ~592px a "panel" would show a crack of page
                rather than a margin, which reads as a broken full-screen instead of a drawer. At
                600 it leaves 56px, and it grows from there. The stop also sits above every phone in
                portrait — a 16 Pro Max is 440px — and below every tablet, which is the line asked
                for.

                Below it this is not a panel at all — it is `w-full`, the whole screen, and the
                border down its left edge goes with it. A drawer that leaves 8vw of blurred page
                behind it is showing a strip of something you cannot read or touch, and charging the
                panel's own contents ~30px for it; on a phone the item *is* the page. It also fixes
                the two things that made this header look broken at that width, rather than papering
                over them: the close button and the six-button toolbar both get that room back.
                `ActionLabel` drops the words when the row is too narrow for them, so it cannot
                squeeze either.

                All item types share this panel, so they all widen together.

                `overflow-x-hidden` is deliberate and belongs with it. The sheet needs `overflow-y`,
                and CSS computes the other axis to `auto` when one axis is not `visible` — so *any*
                child a few pixels too wide, on any item type, silently becomes a scrollbar under the
                whole drawer. Naming the axis says what is actually meant: this panel scrolls one
                way. Content that needs horizontal room scrolls inside its own box, as monaco and the
                PDF viewer already do. */}
            <SheetContent
                showCloseButton={false}
                className="app-scrollbar gap-0 overflow-x-hidden overflow-y-auto data-[side=right]:w-full data-[side=right]:border-l-0 data-[side=right]:drawer:w-[min(92vw,36rem)] data-[side=right]:drawer:max-w-none data-[side=right]:sm:max-w-none data-[side=right]:drawer:border-l"
            >
                <SheetHeader className="gap-3 p-4 drawer:p-5">
                    {/* `sm:pr-12` and nothing below it, because the close button is only laid over
                        this row from 600px up — see it below. Padding is the wrong instrument on a
                        phone: it has to be guessed against a button whose width depends on the
                        pointer (28px with a mouse, 44px under `pointer-coarse:`), and on a 344px
                        Galaxy Fold the reserved strip and the title still ended up close enough
                        that the ✕ read as the last character of the title rather than as a control.
                        48px is generous for the wide case and costs nothing there. */}
                    {/* One row at every width: the type icon, the title block, then the ✕.

                        It briefly wrapped below the stop — `basis-full order-last` on the title
                        block, putting the icon and the ✕ alone on a bar with the title beneath
                        them. That was aimed at the ✕ colliding with the title, but the collision
                        was already fixed by taking the button out of `position: absolute` and
                        making it a member of this row, where it cannot overlap anything. The
                        second line was solving a problem that no longer existed, and it made the
                        narrow header a different shape from the wide one for no reason. One shape
                        everywhere is both simpler and what the drawer looked like before.

                        `drawer:pr-12` only above the stop, because that is the only place the ✕
                        leaves the flow and is laid over this row's right-hand end. */}
                    <div className="flex items-start gap-3 drawer:pr-12">
                        <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: withAlpha(accent), color: accent }}
                        >
                            <TypeIcon
                                name={item.itemType.icon}
                                className="size-5"
                                aria-hidden="true"
                            />
                        </span>
                        {/* `flex-1` at every width: it takes the room the icon and the ✕ leave, and
                            below the stop that is also what pushes the ✕ to the row's right edge. */}
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <SheetTitle className="text-lg leading-tight">{view.title}</SheetTitle>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary">{item.itemType.label}</Badge>
                                {detail?.language && (
                                    <Badge variant="outline">{detail.language}</Badge>
                                )}
                            </div>
                        </div>

                        {/* One button, two placements — which is why `SheetContent` is told not to
                            draw its own. `showCloseButton` is a boolean prop and cannot answer "it
                            depends how wide the screen is", and this is the one drawer in the app
                            that goes full-screen, so the choice belongs here rather than in the
                            primitive.

                            Below 600px it is a member of this row: last item, after a `flex-1` title
                            block that pushes it to the edge. In flow it cannot overlap anything, at
                            any width, under either pointer — which is the whole reason to move it,
                            rather than keep tuning a reserved strip against a button that is 28px
                            or 44px depending on the device. It also stops the ✕ sitting on the
                            title's own baseline, where at 344px it read as punctuation.

                            From 600px up it returns to the panel's top-right corner, where it is the
                            same control in the same place every other overlay in the app puts it,
                            and the row takes its `sm:pr-12` back. `SheetContent` is `fixed`, so it
                            is the containing block for this — the same one the primitive's own
                            button uses, which is what makes the two placements identical. */}
                        <SheetClose asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                // `size-10`, which is the type icon's box, and that is the whole
                                // point: in flow these two are the row's bookends, and the eye
                                // reads them as a pair. At the variant's own 28px, top-aligned
                                // against a 40px icon, the ✕ sat 6px high — level with the title's
                                // first line and level with nothing else, which is what "not
                                // aligned" was. At 40px the two centres land within 2px. It stays
                                // 44px under a coarse pointer, because `pointer-coarse:size-11` is
                                // a media rule layered on top of this rather than replaced by it,
                                // and 44 against 40 is still centred to within 2px.
                                //
                                // No negative margins. They were pulling it up and out past the
                                // row's right edge, so it aligned with neither the icon beside it
                                // nor the content below it. Flush is what reads as deliberate.
                                // `ml-auto` puts it at the far end of the bar it shares with the
                                // type icon. That is the whole of the narrow placement — the size
                                // is left to the variant, 28px with a mouse and 44px under a coarse
                                // pointer, which is what pairs it with the 40px icon on the device
                                // that actually shows this bar. An earlier pass forced `size-10` so
                                // the two matched at any pointer, and since only `position` changes
                                // at that stop, it followed the button to the desktop corner and made
                                // its hover fill a 40px square for a 16px glyph.
                                // `hover:bg-foreground/15` is the toolbar's fill, written out
                                // because this is the one control of the set that does not sit
                                // inside the tray and so is not reached by its rule. Same value on
                                // purpose: the ✕ and the six below it are the drawer's controls,
                                // and they should answer the pointer the same way.
                                className="ml-auto hover:bg-foreground/15 dark:hover:bg-foreground/15 drawer:absolute drawer:top-3 drawer:right-3 drawer:ml-0"
                            >
                                <X aria-hidden="true" />
                                <span className="sr-only">Close</span>
                            </Button>
                        </SheetClose>
                    </div>

                    {/* The whole bar gives way to the form's Save / Cancel in edit mode. */}
                    {!isEditing && (
                        <ItemDrawerToolbar
                            isFavorite={isFavorite}
                            isFavoriting={isFavoriting}
                            onToggleFavorite={toggleFavorite}
                            isPinned={isPinned}
                            isPinning={isPinning}
                            onTogglePin={togglePin}
                            showsCopy={showsCopy}
                            canCopy={Boolean(body)}
                            onCopy={copyBody}
                            isFile={isFile}
                            fileName={detail?.fileName ?? ""}
                            fileUrl={fileUrl}
                            canEdit={Boolean(detail)}
                            onEdit={() => setIsEditing(true)}
                            itemId={itemId}
                            title={view.title}
                            onDeleted={onClose}
                        />
                    )}
                </SheetHeader>

                <div className="space-y-6 border-t border-border p-4 drawer:p-5">
                    {isEditing && detail ? (
                        <ItemEditForm
                            detail={detail}
                            onCancel={() => setIsEditing(false)}
                            onSaved={(updated) => {
                                setDetail(updated);
                                setIsEditing(false);
                            }}
                        />
                    ) : (
                        <>
                            {view.description && (
                                <Section label="Description">
                                    <p className="text-sm">{view.description}</p>
                                </Section>
                            )}

                            <Section label={bodyLabel}>
                                {error ? (
                                    <p className="text-sm text-destructive">{error}</p>
                                ) : !detail ? (
                                    <div className="h-24 animate-pulse rounded-lg bg-muted" />
                                ) : isFile ? (
                                    detail.fileName && preview ? (
                                        <FilePreview
                                            name={detail.fileName}
                                            size={detail.fileSize}
                                            src={fileUrl}
                                            preview={preview}
                                            text={fileText}
                                            error={fileError}
                                        />
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No file.</p>
                                    )
                                ) : detail.url ? (
                                    <a
                                        href={detail.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm break-all text-primary underline-offset-4 hover:underline"
                                    >
                                        {detail.url}
                                    </a>
                                ) : detail.content ? (
                                    showsCode ? (
                                        <CodeEditor
                                            value={detail.content}
                                            language={detail.language}
                                            readOnly
                                            label={`${view.title} content`}
                                            explain={explainDraft}
                                        />
                                    ) : (
                                        <MarkdownEditor
                                            value={detail.content}
                                            readOnly
                                            label={`${view.title} content`}
                                            // Prompts only. Notes get the same editor and no
                                            // button: rewriting someone's notes is a different
                                            // feature, and `optimizePrompt` refuses the type
                                            // anyway. This is the same narrowing `explain` makes
                                            // with `showsCode`, one type narrower.
                                            {...(isPrompt && {
                                                optimize: optimizeDraft,
                                                onUseOptimized: useOptimizedPrompt,
                                            })}
                                        />
                                    )
                                ) : (
                                    <p className="text-sm text-muted-foreground">No content.</p>
                                )}
                            </Section>

                            {view.tags.length > 0 && (
                                <Section label="Tags" icon={Tag}>
                                    <div className="flex flex-wrap gap-1.5">
                                        {view.tags.map((tag) => (
                                            <Badge key={tag} variant="secondary">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                </Section>
                            )}
                        </>
                    )}

                    {detail && detail.collections.length > 0 && (
                        <Section label="Collections" icon={Folder}>
                            <div className="flex flex-wrap gap-1.5">
                                {detail.collections.map((collection) => (
                                    <Badge key={collection.id} variant="outline">
                                        {collection.name}
                                    </Badge>
                                ))}
                            </div>
                        </Section>
                    )}

                    <Section label="Details" icon={Calendar}>
                        <dl className="space-y-1 text-sm">
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-muted-foreground">Created</dt>
                                <dd>{detail ? formatLongDate(detail.createdAt) : "—"}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-muted-foreground">Edited</dt>
                                <dd>{formatLongDate(view.editedAt)}</dd>
                            </div>
                        </dl>
                    </Section>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function Section({
    label,
    icon: Icon,
    children,
}: {
    label: string;
    icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {Icon && <Icon className="size-3.5" aria-hidden={true} />}
                {label}
            </h3>
            {children}
        </section>
    );
}
