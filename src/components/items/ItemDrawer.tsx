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
            {/* `--breakpoint-drawer` (600px, `globals.css`) is the drawer's one stop. Below it,
                `w-full` and no left border — full screen, because on a phone the item is the page.
                From it up, a fixed `w-[min(92vw, 36rem)]` panel with a left border.

                Every width class carries the `data-[side=right]` variant so it can beat
                `SheetContent`'s own `data-[side=right]:*` defaults; a plain `max-w-*` would lose on
                specificity and both would reach the DOM.

                `overflow-x-hidden` with `overflow-y-auto`: CSS resolves the unset axis to `auto`
                when the other is not `visible`, so any too-wide child would draw a scrollbar under
                the whole drawer. Content that needs horizontal room scrolls in its own box (monaco,
                the PDF viewer). */}
            <SheetContent
                showCloseButton={false}
                className="app-scrollbar gap-0 overflow-x-hidden overflow-y-auto data-[side=right]:w-full data-[side=right]:border-l-0 data-[side=right]:drawer:w-[min(92vw,36rem)] data-[side=right]:drawer:max-w-none data-[side=right]:sm:max-w-none data-[side=right]:drawer:border-l"
            >
                <SheetHeader className="gap-3 p-4 drawer:p-5">
                    {/* `drawer:pr-12` reserves space for the ✕ only from 600px up, where it leaves
                        the flow and is laid over this row's right-hand end. */}
                    {/* One row at every width: the type icon, the title block, then the ✕. Below
                        600px the ✕ is an in-flow member of the row and needs no reserved strip. */}
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

                        {/* Two placements, which is why `SheetContent` is told not to draw its own
                            (`showCloseButton` is a boolean and cannot depend on width). Below
                            600px it is an in-flow member of the header row, pushed to the edge by
                            the `flex-1` title block; from 600px up it is absolutely positioned in
                            the panel's top-right corner like every other overlay's close button. */}
                        <SheetClose asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                // Hover fill written out here because this control sits outside
                                // `ItemDrawerToolbar`'s tray and so misses its hover rule; the
                                // value matches so the ✕ and the toolbar answer the pointer alike.
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
