"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { updateItem } from "@/actions/items";
import {
    CollectionsField,
    ContentField,
    DescriptionField,
    LanguageField,
    TagsField,
} from "@/components/items/ItemFormFields";
import { Button } from "@/components/ui/button";
import { Field, invalidFor } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { useCollectionOptions } from "@/hooks/use-collection-options";
import { formatFileSize } from "@/lib/format";
import { itemTypeOwns, type UpdateItemField, type UpdateItemInput } from "@/lib/item-schemas";
import type { ItemDraft } from "@/types/ai";
import type { ItemDetailViewModel } from "@/types/view-models";

/**
 * Edit mode for the item drawer — the same panel with its fields swapped for inputs, calling
 * `updateItem` on save.
 *
 * Renders and submits only the fields an item's type owns (`itemTypeOwns`): a snippet's payload
 * carries no `url` key, which `updateItemSchema` reads as "leave that column alone" rather than
 * "clear it", so one type's form cannot erase another type's column. The type itself is not
 * editable here for the same reason.
 *
 * @remarks
 * Plain controlled inputs, no form library — six fields, one submit, and the server validates. The
 * only client-side rule is the disabled Save, which is not a second copy of the validation.
 */
export function ItemEditForm({
    detail,
    onCancel,
    onSaved,
}: {
    detail: ItemDetailViewModel;
    onCancel: () => void;
    onSaved: (updated: ItemDetailViewModel) => void;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<UpdateItemField, string>>>({});

    const [title, setTitle] = useState(detail.title);
    const [description, setDescription] = useState(detail.description);
    const [tags, setTags] = useState(detail.tags.join(", "));
    const [content, setContent] = useState(detail.content);
    const [url, setUrl] = useState(detail.url);
    const [language, setLanguage] = useState(detail.language);
    // Seeded from where the item already lives, which is why the detail carries collection ids and
    // not only the names the read view renders.
    const [collectionIds, setCollectionIds] = useState(() =>
        detail.collections.map((collection) => collection.id),
    );

    // Fetched when edit mode opens, since that is when this form mounts.
    const collections = useCollectionOptions();

    const {
        content: showsContent,
        url: showsUrl,
        file: showsFile,
        language: showsLanguage,
    } = itemTypeOwns(detail.itemType.name);

    /**
     * The item as typed right now, for whichever AI field (description, tags) asks.
     *
     * Built once and passed to both fields, so the two cannot drift when a type gains a field. A
     * function, not an object, so it reads current state at click time rather than closing over the
     * render the button was drawn in.
     */
    const draft = (): ItemDraft => ({
        title,
        content,
        url,
        fileName: detail.fileName,
        language,
        tags,
        type: detail.itemType.name,
    });

    const invalid = invalidFor<UpdateItemField>("item", fieldErrors);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const input: UpdateItemInput = {
            title,
            description,
            // Split only. Trimming, dropping blanks, and de-duplicating are the schema's job, so
            // "react, , React" is normalized in the one place that also has to reject a bad payload.
            tags: tags.split(","),
            // Omitted while the picker has nothing to show, which the update contract reads as
            // "leave this item's collections alone". Sending an empty selection would unfile the
            // item from every collection if the options fetch had failed.
            ...(collections.options && { collectionIds }),
            ...(showsContent && { content }),
            ...(showsUrl && { url }),
            ...(showsLanguage && { language }),
        };

        startTransition(async () => {
            const result = await updateItem(detail.id, input);

            if (!result.success) {
                setFieldErrors(result.fields ?? {});
                toast.error(result.error);

                return;
            }

            setFieldErrors({});
            toast.success("Item updated.");
            onSaved(result.data);
            // The cards behind the drawer were rendered on the server from the old row, so the list
            // has to be re-fetched; the drawer itself is already showing what the action returned.
            router.refresh();
        });
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="flex items-center gap-2 pb-1">
                <Button type="submit" size="sm" disabled={!title.trim() || isPending}>
                    <Check aria-hidden="true" />
                    {isPending ? "Saving…" : "Save"}
                </Button>
                {/* The drawer toolbar's hover fill, not the ghost variant's: this row replaces
                    that toolbar in edit mode, so Cancel has to light up the same way its
                    neighbours did. The ghost default `muted/50` is nearly this panel's own surface
                    in the dark theme — see `ItemDrawerToolbar`. */}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="hover:bg-foreground/15 dark:hover:bg-foreground/15"
                    onClick={onCancel}
                    disabled={isPending}
                >
                    <X aria-hidden="true" />
                    Cancel
                </Button>
            </div>

            <Field id="item-title" label="Title" error={fieldErrors.title}>
                <Input
                    id="item-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    autoFocus
                    {...invalid("title")}
                />
            </Field>

            <DescriptionField
                id="item-description"
                value={description}
                onChange={setDescription}
                error={fieldErrors.description}
                draft={draft}
            />

            {showsLanguage && (
                <LanguageField
                    id="item-language"
                    value={language}
                    onChange={setLanguage}
                    error={fieldErrors.language}
                />
            )}

            {showsContent && (
                <ContentField
                    id="item-content"
                    value={content}
                    onChange={setContent}
                    language={language}
                    isCode={showsLanguage}
                    error={fieldErrors.content}
                />
            )}

            {showsUrl && (
                <Field id="item-url" label="URL" error={fieldErrors.url}>
                    <Input
                        id="item-url"
                        type="url"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        {...invalid("url")}
                    />
                </Field>
            )}

            {/* Shown but not editable: replacing an item's object is a separate change (see
                `updateItemSchema`). Rendering nothing would read as a file item having lost its
                file. */}
            {showsFile && detail.fileName && (
                <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">File</p>
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <p className="truncate text-sm font-medium">{detail.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                            {formatFileSize(detail.fileSize)} · replacing a file is not supported
                            yet
                        </p>
                    </div>
                </div>
            )}

            {/* `draft` reads the live inputs, not `detail`, so a mid-edit tag suggestion
                describes what was just typed. A link has no content column, so its URL is what the
                suggestion has to work from besides the title. */}
            <TagsField
                id="item-tags"
                value={tags}
                onChange={setTags}
                error={fieldErrors.tags}
                draft={draft}
            />

            <CollectionsField
                id="item-collections"
                options={collections.options ?? []}
                selectedIds={collectionIds}
                onChange={setCollectionIds}
                isLoading={collections.isLoading}
                failed={collections.failed}
                error={fieldErrors.collectionIds}
            />
        </form>
    );
}
