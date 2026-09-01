"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import { FileUpload } from "@/components/items/FileUpload";
import {
    CollectionsField,
    ContentField,
    DescriptionField,
    LanguageField,
    TagsField,
} from "@/components/items/ItemFormFields";
import { TypeIcon } from "@/components/items/TypeIcon";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, invalidFor } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { PLACEHOLDERS } from "@/config/item-placeholders";
import { ITEM_TYPE_CATALOG } from "@/config/item-type-catalog";
import { useCollectionOptions } from "@/hooks/use-collection-options";
import type { UploadedFile } from "@/hooks/use-file-upload";
import { isFileItemTypeName } from "@/lib/file-constraints";
import {
    CREATABLE_ITEM_TYPE_NAMES,
    itemTypeOwns,
    type CreatableItemTypeName,
    type CreateItemField,
    type CreateItemInput,
} from "@/lib/item-schemas";
import type { ItemDraft } from "@/types/ai";

const DEFAULT_TYPE: CreatableItemTypeName = "snippet";

/**
 * Which type the dialog opens on, read from the page behind it: on `/items/prompts` a new item is
 * almost certainly a prompt, so preselecting it saves the click that would otherwise be made on
 * every single create from a type page.
 *
 * Everywhere else — the dashboard, a collection, the profile — there is nothing to infer from, and
 * it falls back to the first type. The choice is only a starting point in any case; the buttons are
 * right there.
 */
function typeForPath(pathname: string): CreatableItemTypeName {
    const slug = pathname.match(/^\/items\/([^/]+)/)?.[1];

    return (
        CREATABLE_ITEM_TYPE_NAMES.find((name) => ITEM_TYPE_CATALOG[name].slug === slug) ??
        DEFAULT_TYPE
    );
}

/**
 * The top bar's "New Item" control and the dialog behind it.
 *
 * A centered modal rather than the drawer that view and edit share: creating is the one item flow
 * that starts from nothing, so there is no card underneath for a side panel to sit beside.
 *
 * The form is a separate component on purpose — Radix unmounts the dialog's content when it closes,
 * so every field resets itself and there is no teardown to remember when a new item is started.
 */
export function CreateItemDialog({
    open: controlledOpen,
    onOpenChange,
}: {
    /**
     * Omit both and the dialog keeps its own state and its own trigger button. Pass them and the
     * trigger is dropped, so whoever is driving it owns the button — which is what the top bar does
     * below `sm`, where one create menu stands in for two buttons that no longer fit.
     */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
} = {}) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setUncontrolledOpen;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    {/* `lg`, measured rather than picked. The labelled pair of create buttons needs
                        ~250px, and with the brand, the search field, and the star beside them the
                        bar only has that from about 900px — so the labels belong at the next
                        breakpoint above it, not at `sm`, where they overflowed their track.
                        `aria-label` carries the name at every width regardless. */}
                    <Button aria-label="New Item">
                        <Plus className="size-4" aria-hidden="true" />
                        <span className="hidden lg:inline">New Item</span>
                    </Button>
                </DialogTrigger>
            )}

            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>New item</DialogTitle>
                    <DialogDescription>Pick a type — the fields below follow it.</DialogDescription>
                </DialogHeader>

                <CreateItemForm onCreated={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}

/**
 * Only the fields the chosen type owns are rendered, and only those are submitted — the same
 * absent-versus-empty rule the edit form follows, so a note's payload has no `url` key rather than
 * an empty one. `itemTypeOwns` is what both forms and the schema read that from.
 *
 * Switching type mid-typing keeps what has been written: the fields that are still shown keep their
 * values, and anything the new type has no column for is dropped by the schema rather than here.
 */
function CreateItemForm({ onCreated }: { onCreated: () => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<CreateItemField, string>>>({});

    // Radix unmounts the dialog's content when it closes, so this is re-read on every open rather
    // than once per session — navigating to another type page and creating again picks up the move.
    const [type, setType] = useState<CreatableItemTypeName>(() => typeForPath(pathname));
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");
    const [content, setContent] = useState("");
    const [url, setUrl] = useState("");
    const [language, setLanguage] = useState("");
    // Held here rather than inside `FileUpload`, because it is what the payload and the submit gate
    // both read. It survives a type switch, exactly as the typed fields do — an upload made, then
    // reconsidered, then chosen again is not asked for twice. `chooseType` below is the one
    // exception, and it is about what an upload *is* rather than about keeping state.
    const [file, setFile] = useState<UploadedFile | null>(null);
    const [collectionIds, setCollectionIds] = useState<string[]>([]);

    // Fetched when the dialog opens, since Radix mounts this form then — so a collection created
    // from the top bar's other dialog a moment ago is already in the list.
    const collections = useCollectionOptions();

    /**
     * Switching type keeps everything typed so far, and drops a held upload in exactly one case.
     *
     * `file` and `image` have *disjoint* extension lists (`FILE_CONSTRAINTS`), so an object uploaded
     * as one is never valid as the other. Keeping it across that switch left the submit button
     * enabled over a payload `createItem` refuses — with "That upload could not be verified. Try
     * uploading the file again.", which is a dead end: the same file re-uploaded under the same type
     * fails identically, and nothing on screen says the type is what made it invalid.
     *
     * Every other switch is unaffected, including `image → snippet → image`, where the upload is
     * still valid for the type it was made under and asking for it twice would be the bug.
     */
    const chooseType = (next: CreatableItemTypeName) => {
        if (isFileItemTypeName(type) && isFileItemTypeName(next) && type !== next) {
            setFile(null);
        }

        setType(next);
    };

    const {
        content: showsContent,
        url: showsUrl,
        file: showsFile,
        language: showsLanguage,
    } = itemTypeOwns(type);

    /**
     * The item as typed right now, for whichever AI button asks — see the edit form's copy of this.
     *
     * The type is always the one the chips currently show, which matters more here than in the edit
     * form: switching from Snippet to Link between typing and clicking changes what the item *is*,
     * and reading it at click time is what keeps the prompt describing the right thing.
     */
    const draft = (): ItemDraft => ({
        title,
        content,
        url,
        fileName: file?.fileName,
        language,
        tags,
        type,
    });

    const invalid = invalidFor<CreateItemField>("new-item", fieldErrors);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const input: CreateItemInput = {
            type,
            title,
            description,
            // Split only — trimming, dropping blanks, and de-duplicating are the schema's job.
            tags: tags.split(","),
            collectionIds,
            ...(showsContent && { content }),
            ...(showsUrl && { url }),
            ...(showsLanguage && { language }),
            ...(showsFile &&
                file && {
                    fileKey: file.key,
                    fileName: file.fileName,
                    fileSize: file.fileSize,
                }),
        };

        startTransition(async () => {
            const result = await createItem(input);

            if (!result.success) {
                setFieldErrors(result.fields ?? {});
                toast.error(result.error);

                return;
            }

            toast.success("Item created.");
            onCreated();
            // The lists behind the dialog were rendered on the server, so they know nothing about
            // the row that has just been written.
            router.refresh();
        });
    };

    return (
        // One scroller, and it is `DialogContent`'s. This form used to add a second one — a body
        // `div` capped at `60vh` with its own `overflow-y-auto` — so the dialog and the form each
        // clipped independently, against caps that knew nothing about each other (`100dvh - 2rem`
        // here, `60vh` there). The result was a dialog whose `scrollHeight` counted content its
        // child had already clipped: on a 375x667 phone the box measured 621px tall and reported
        // 885px of scroll, so the last ~264px scrolled to nothing but background. Measured, with
        // the footer sitting at the top of the screen and a screen of empty below it.
        //
        // Sizing the inner scroller from the dialog instead of from the viewport does not fix it —
        // a compressible grid row and a `minmax(0,1fr)` track were both tried and both still leak.
        // Removing the second scroller does: scrolled fully down, the element under the pointer is
        // the footer, which is the last real thing in the form.
        //
        // What this costs is a footer that no longer stays pinned while a long form scrolls. On a
        // phone that is the better trade — the whole form is reachable and nothing scrolls into
        // emptiness — and it is what every other dialog in the app already does.
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
            <div className="space-y-5 px-1 pb-1">
                <fieldset className="space-y-1.5" disabled={isPending}>
                    <legend className="text-xs font-medium text-muted-foreground">Type</legend>
                    <div className="flex flex-wrap gap-2 pt-1.5">
                        {CREATABLE_ITEM_TYPE_NAMES.map((name) => {
                            const { icon, color } = ITEM_TYPE_CATALOG[name];
                            const selected = name === type;

                            return (
                                <ToggleChip
                                    key={name}
                                    type="radio"
                                    name="new-item-type"
                                    value={name}
                                    checked={selected}
                                    onChange={() => chooseType(name)}
                                    className="capitalize"
                                    // Type colours are user-facing data, not theme tokens, so they
                                    // cannot be Tailwind classes — the same exception the cards take.
                                    style={
                                        selected
                                            ? { borderColor: color, backgroundColor: `${color}1a` }
                                            : undefined
                                    }
                                >
                                    <TypeIcon
                                        name={icon}
                                        className="size-3.5 shrink-0"
                                        style={{ color }}
                                        aria-hidden="true"
                                    />
                                    {name}
                                </ToggleChip>
                            );
                        })}
                    </div>
                </fieldset>

                <Field id="new-item-title" label="Title" error={fieldErrors.title}>
                    <Input
                        id="new-item-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder={PLACEHOLDERS[type].title}
                        autoFocus
                        {...invalid("title")}
                    />
                </Field>

                {showsUrl && (
                    <Field id="new-item-url" label="URL" error={fieldErrors.url}>
                        <Input
                            id="new-item-url"
                            type="url"
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            placeholder="https://example.com"
                            {...invalid("url")}
                        />
                    </Field>
                )}

                {showsFile && (
                    <Field
                        id="new-item-file"
                        label={type === "image" ? "Image" : "File"}
                        error={fieldErrors.fileKey}
                    >
                        <FileUpload
                            inputId="new-item-file"
                            // Narrowed by `showsFile`, which is `contentType === "FILE"` — the same
                            // predicate, read from the catalog rather than a second list of names.
                            itemType={isFileItemTypeName(type) ? type : "file"}
                            value={file}
                            onUploaded={setFile}
                            onError={toast.error}
                            disabled={isPending}
                        />
                    </Field>
                )}

                {showsLanguage && (
                    <LanguageField
                        id="new-item-language"
                        value={language}
                        onChange={setLanguage}
                        error={fieldErrors.language}
                    />
                )}

                {showsContent && (
                    <ContentField
                        id="new-item-content"
                        value={content}
                        onChange={setContent}
                        language={language}
                        isCode={showsLanguage}
                        error={fieldErrors.content}
                        placeholder={PLACEHOLDERS[type].content}
                    />
                )}

                <DescriptionField
                    id="new-item-description"
                    value={description}
                    onChange={setDescription}
                    error={fieldErrors.description}
                    placeholder="Add a short summary"
                    draft={draft}
                />

                <TagsField
                    id="new-item-tags"
                    value={tags}
                    onChange={setTags}
                    error={fieldErrors.tags}
                    draft={draft}
                />

                {/* Last, and after the tags: filing is what happens to an item once it exists, so
                    it belongs below the fields that describe it. */}
                <CollectionsField
                    id="new-item-collections"
                    options={collections.options ?? []}
                    selectedIds={collectionIds}
                    onChange={setCollectionIds}
                    isLoading={collections.isLoading}
                    failed={collections.failed}
                    error={fieldErrors.collectionIds}
                />
            </div>

            <DialogFooter className="mt-4">
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isPending}>
                        Cancel
                    </Button>
                </DialogClose>
                {/* Submit stays a plain button, not a `DialogClose`: the action can fail, and a
                    dialog that has already dismissed has nowhere to report it. */}
                {/* A file item with no upload is the one incomplete payload worth stopping here:
                    the schema rejects it anyway, but the reason is a step above the form — there is
                    nothing to fix in a field, only a file to choose. */}
                <Button type="submit" disabled={!title.trim() || (showsFile && !file) || isPending}>
                    {isPending ? "Creating…" : "Create item"}
                </Button>
            </DialogFooter>
        </form>
    );
}
