"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Copy, Download, Folder, Pencil, Pin, Star, Tag } from "lucide-react";
import { toast } from "sonner";

import { toggleItemFavorite, toggleItemPin } from "@/actions/items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { copyToClipboard } from "@/lib/clipboard";
// Aliased because the component below already owns the name `FilePreview`.
import { filePreviewFor, type FilePreview as FilePreviewInfo } from "@/lib/file-preview";
import { formatFileSize, formatLongDate } from "@/lib/format";
import { itemTypeOwns } from "@/lib/item-schemas";
import { withAlpha } from "@/lib/utils";
import type { ItemDetailViewModel, ItemSummaryViewModel } from "@/types/view-models";
import { CodeEditor } from "./CodeEditor";
import { DeleteItemDialog } from "./DeleteItemDialog";
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
    const [detail, setDetail] = useState<ItemDetailViewModel | null>(null);
    const [error, setError] = useState("");
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
    // The object's own contents, for the formats that are rendered rather than downloaded.
    const [fileText, setFileText] = useState("");
    const [fileError, setFileError] = useState("");

    const itemId = item.id;

    useEffect(() => {
        // Aborted on unmount, so a slow response for a previously opened item cannot land in the
        // drawer that replaced it. The caller keys this component by item id, which is also what
        // clears `detail` between items — resetting it here would be a synchronous setState in an
        // effect, and a cascading render the compiler rightly rejects.
        const controller = new AbortController();

        fetch(`/api/items/${itemId}`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(
                        response.status === 404
                            ? "This item no longer exists."
                            : "Could not load this item.",
                    );
                }
                return (await response.json()) as ItemDetailViewModel;
            })
            .then(setDetail)
            .catch((cause: Error) => {
                if (cause.name !== "AbortError") {
                    setError(cause.message || "Could not load this item.");
                }
            });

        return () => controller.abort();
    }, [itemId]);

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

    useEffect(() => {
        if (!isTextPreview) return;

        // A second request, deliberately: `/api/items/[id]` answers from Postgres and must not start
        // reading object storage for every item that happens to be a file. This one runs only once
        // the detail has said the object is text small enough to render.
        const controller = new AbortController();

        fetch(fileUrl, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error("Could not load this file.");

                return response.text();
            })
            .then(setFileText)
            .catch((cause: Error) => {
                if (cause.name !== "AbortError") {
                    setFileError(cause.message || "Could not load this file.");
                }
            });

        return () => controller.abort();
    }, [fileUrl, isTextPreview]);

    const accent = item.itemType.color;
    // A text file's contents are as copyable as a snippet's, once they are on screen.
    const body = detail?.url || detail?.content || fileText || "";
    const showsCopy = !isFile || isTextPreview;

    // "Owns a language" is the same thing as "its content is code" — snippets and commands. Notes
    // and prompts are prose, and get the markdown editor's rendered preview instead; a syntax
    // highlighter over English is only a distraction, and English is what people write markdown in.
    const showsCode = itemTypeOwns(item.itemType.name).language;

    // The card's summary is what the drawer opens on, but it stops being the truth the moment an
    // edit is saved: `ItemList` holds the clicked item in state, so a `router.refresh()` updates the
    // cards behind without touching this prop. Once the detail has loaded — and after every save —
    // it is the newer of the two, so everything the summary also carries is read from it.
    const view: ItemSummaryViewModel = detail ?? item;

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
                `sm`, which is a different decision from this one.

                Below `sm` the viewport is the constraint instead, and `ActionLabel` drops the words
                there, so the row cannot squeeze at the narrow end either.

                All item types share this panel, so they all widen together.

                `overflow-x-hidden` is deliberate and belongs with it. The sheet needs `overflow-y`,
                and CSS computes the other axis to `auto` when one axis is not `visible` — so *any*
                child a few pixels too wide, on any item type, silently becomes a scrollbar under the
                whole drawer. Naming the axis says what is actually meant: this panel scrolls one
                way. Content that needs horizontal room scrolls inside its own box, as monaco and the
                PDF viewer already do. */}
            <SheetContent className="app-scrollbar gap-0 overflow-x-hidden overflow-y-auto data-[side=right]:w-[min(92vw,30rem)] data-[side=right]:sm:max-w-none">
                <SheetHeader className="gap-3 p-5">
                    <div className="flex items-start gap-3 pr-8">
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
                        <div className="min-w-0 space-y-1.5">
                            <SheetTitle className="text-lg leading-tight">{view.title}</SheetTitle>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary">{item.itemType.label}</Badge>
                                {detail?.language && (
                                    <Badge variant="outline">{detail.language}</Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* The whole bar gives way to the form's Save / Cancel in edit mode. */}
                    {!isEditing && (
                        // One row, always. These buttons carry `shrink-0 whitespace-nowrap`, so a row
                        // that does not fit does not compress — it widens the panel, and the sheet's
                        // `overflow-y-auto` turns that into a horizontal scrollbar over the whole
                        // drawer. A text file shows six controls and the sheet is `w-full` below
                        // `sm`, which is exactly where `ActionLabel` drops the words and leaves the
                        // icons — the same trade the top bar's "New Item" makes.
                        <div className="flex items-center gap-1 border-t border-border pt-3">
                            {/* Titled and labelled by what the click will *do*, not by what the item
                                is — the filled star already says which of the two states it is in,
                                and a control named "Favorite" on an already-favourited item reads as
                                the one thing it will not do. */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleFavorite}
                                disabled={isFavoriting}
                                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                aria-label={
                                    isFavorite ? "Remove from favorites" : "Add to favorites"
                                }
                            >
                                <Star
                                    // Filled when on, like `CollectionActions`' star and unlike
                                    // every other one — see the note there.
                                    className={
                                        isFavorite ? "fill-favorite text-favorite" : undefined
                                    }
                                    aria-hidden="true"
                                />
                                <ActionLabel>Favorite</ActionLabel>
                            </Button>
                            {/* Named by the action for the same reason Favorite is: the filled pin
                                already says which state the item is in. */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={togglePin}
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
                                    onClick={copyBody}
                                    disabled={!body}
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
                                (detail?.fileName ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        asChild
                                        title="Download"
                                        aria-label="Download"
                                    >
                                        <a href={`${fileUrl}?download`} download={detail.fileName}>
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
                            <div className="flex items-center gap-1">
                                {/* Disabled until the body has loaded: the form is seeded from the
                                    detail, and there is nothing to seed it with before then. */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditing(true)}
                                    disabled={!detail}
                                    title="Edit"
                                    aria-label="Edit"
                                >
                                    <Pencil aria-hidden="true" />
                                    <ActionLabel>Edit</ActionLabel>
                                </Button>
                                {/* Titled from `view`, so a rename saved a moment ago is what the
                                    confirmation names. Closing is all this drawer has to do: the
                                    row is gone, and `ItemList` drops the item on the refresh. */}
                                <DeleteItemDialog
                                    itemId={itemId}
                                    title={view.title}
                                    onDeleted={onClose}
                                />
                            </div>
                        </div>
                    )}
                </SheetHeader>

                <div className="space-y-6 border-t border-border p-5">
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
                                        />
                                    ) : (
                                        <MarkdownEditor
                                            value={detail.content}
                                            readOnly
                                            label={`${view.title} content`}
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

/**
 * A toolbar button's word, dropped below `sm` so the row of them always fits the sheet — which is
 * `w-full` at those widths and `max-w-xl` above them. Each button carries its own `aria-label` and
 * `title`, so what disappears is only the visible word: the accessible name and the hover tooltip
 * both survive, exactly as they do on the delete button that has always been icon-only.
 */
function ActionLabel({ children }: { children: string }) {
    return <span className="hidden sm:inline">{children}</span>;
}

/**
 * A FILE item's body, shown rather than downloaded wherever that is possible.
 *
 * `filePreviewFor` decides which of these applies — an image is a picture, a PDF goes to the
 * browser's own viewer, markdown is rendered as a note is, and every other text format is
 * highlighted in the same editor a snippet gets. The name-and-size card is the floor, always present
 * beneath whatever was rendered, because it is the one thing true of every file.
 *
 * The image is a plain `<img>`, not `next/image`. The source is an authorized route that answers
 * from the session cookie, and Next's optimizer fetches the URL itself, without one — so the
 * optimized variant would 404 while the direct request succeeds. There is nothing to optimize
 * either: the object is already sized, and it sits behind a private route no CDN can cache.
 */
function FilePreview({
    name,
    size,
    src,
    preview,
    text,
    error,
}: {
    name: string;
    size: number;
    src: string;
    preview: FilePreviewInfo;
    /** The object's contents, once fetched. Empty for the kinds that are not text. */
    text: string;
    error: string;
}) {
    return (
        <div className="space-y-3">
            {preview.kind === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src}
                    alt={name}
                    className="max-h-80 w-full rounded-lg border border-border bg-muted/40 object-contain"
                />
            )}

            {preview.kind === "pdf" && (
                // The browser's own viewer, scrolling and paging the document itself. `#toolbar=0`
                // hides its chrome: the overflow menu offers "two page view", "annotations", and
                // "document properties", none of which do anything useful for a single embedded
                // file, and its download and print buttons duplicate ours — with the difference that
                // ours names the file correctly. `title` is what a screen reader announces.
                <iframe
                    src={`${src}#toolbar=0`}
                    title={name}
                    className="h-96 w-full rounded-lg border border-border bg-muted/40"
                />
            )}

            {(preview.kind === "markdown" || preview.kind === "code") &&
                (error ? (
                    <p className="text-sm text-destructive">{error}</p>
                ) : !text ? (
                    <div className="h-24 animate-pulse rounded-lg bg-muted" />
                ) : preview.kind === "markdown" ? (
                    <MarkdownEditor value={text} readOnly label={`${name} contents`} />
                ) : (
                    <CodeEditor
                        value={text}
                        language={preview.language}
                        readOnly
                        label={`${name} contents`}
                    />
                ))}

            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                        {formatFileSize(size)}
                        {preview.kind === "none" && " · download to open this one"}
                    </p>
                </div>
            </div>
        </div>
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
