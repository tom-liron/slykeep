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

/**
 * The item-creation dialog: the "New Item" trigger, the type picker, and the type-driven form that
 * calls `createItem`.
 *
 * A centred `Dialog` rather than the drawer that view and edit share, because creating starts from
 * nothing and has no card underneath for a side panel to sit beside. {@link CreateItemForm} is a
 * separate component so Radix unmounting the dialog content resets every field with no teardown to
 * remember.
 */

const DEFAULT_TYPE: CreatableItemTypeName = "snippet";

/**
 * The type the dialog opens on, inferred from the route behind it — a prompt on `/items/prompts`,
 * and so on.
 *
 * Falls back to {@link DEFAULT_TYPE} everywhere with nothing to infer from (the dashboard, a
 * collection). Only a starting point; the picker chips are right there.
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
 * Uncontrolled by default (own trigger, own open state). Passing `open`/`onOpenChange` drops the
 * trigger and hands control to the caller — the top bar does this below `sm`, where one create
 * menu replaces two buttons.
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
                    {/* Label appears at `lg`: the top bar only has room for the labelled create
                        buttons alongside the brand, search field and star from about 900px.
                        `aria-label` carries the name at every width. */}
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
 * The type picker plus the fields the chosen type owns, submitted via `createItem`.
 *
 * Renders and submits only the fields `itemTypeOwns` reports for the current type — the same
 * absent-versus-empty rule the edit form follows, so a note's payload has no `url` key. Switching
 * type mid-typing keeps the values of the fields that stay visible; the schema drops the rest.
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
    // Held here, not inside `FileUpload`, because the payload and the submit gate both read it. It
    // survives a type switch like the typed fields do, except the one case `chooseType` handles
    // below.
    const [file, setFile] = useState<UploadedFile | null>(null);
    const [collectionIds, setCollectionIds] = useState<string[]>([]);

    // Fetched when the dialog opens, since Radix mounts this form then — so a collection created
    // from the top bar's other dialog a moment ago is already in the list.
    const collections = useCollectionOptions();

    /**
     * Sets the type, dropping a held upload only on a `file` ↔ `image` switch.
     *
     * `file` and `image` have disjoint extension lists (`FILE_CONSTRAINTS`), so an object uploaded
     * as one is never valid as the other — kept across that switch it would leave the submit button
     * enabled over a payload `createItem` refuses. Every other switch keeps the upload, including
     * `image → snippet → image`, where it is still valid.
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
     * The item as typed right now, for whichever AI field asks — the create-form counterpart of
     * the edit form's `draft`.
     *
     * Reads the currently selected type, so switching Snippet → Link between typing and clicking
     * changes what the AI prompt describes.
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
        // One scroller only, `DialogContent`'s. A second scroller on an inner `div` clips against
        // its own cap independently of the dialog's, so the dialog measures scroll height for
        // content its child has already clipped and the tail scrolls into empty background. The
        // cost is a footer that scrolls with the form rather than staying pinned, which is what
        // every other dialog in the app does.
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
