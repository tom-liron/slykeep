"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { updateItem } from "@/actions/items";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { itemTypeOwns, type UpdateItemField, type UpdateItemInput } from "@/lib/item-schemas";
import type { ItemDetailViewModel } from "@/types/view-models";

/**
 * Edit mode for the item drawer — the same panel, with its fields swapped for inputs.
 *
 * Only the fields an item's type actually owns are rendered, and only those are submitted: a
 * snippet's payload carries no `url` key at all, which the schema reads as "leave that column
 * alone" rather than "clear it". That is what keeps a form for one type from erasing another type's
 * column, and it is why the type itself is not editable here.
 *
 * Plain controlled inputs, no form library: six fields, one submit, and the server is the authority
 * on what is valid anyway. The only client-side rule is the disabled Save below, which spares an
 * obvious round trip without becoming a second copy of the validation.
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

    const {
        content: showsContent,
        url: showsUrl,
        language: showsLanguage,
    } = itemTypeOwns(detail.itemType.name);

    /** Points a rejected input at the message `Field` renders for it, as the auth forms do. */
    const invalid = (field: UpdateItemField) =>
        fieldErrors[field]
            ? { "aria-invalid": true, "aria-describedby": `item-${field}-error` }
            : undefined;

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const input: UpdateItemInput = {
            title,
            description,
            // Split only. Trimming, dropping blanks, and de-duplicating are the schema's job, so
            // "react, , React" is normalized in the one place that also has to reject a bad payload.
            tags: tags.split(","),
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
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
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

            <Field id="item-description" label="Description" error={fieldErrors.description}>
                <Textarea
                    id="item-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    {...invalid("description")}
                />
            </Field>

            {showsContent && (
                <Field id="item-content" label="Content" error={fieldErrors.content}>
                    <Textarea
                        id="item-content"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        rows={10}
                        spellCheck={false}
                        className="font-mono text-xs"
                        {...invalid("content")}
                    />
                </Field>
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

            {showsLanguage && (
                <Field id="item-language" label="Language" error={fieldErrors.language}>
                    <Input
                        id="item-language"
                        value={language}
                        onChange={(event) => setLanguage(event.target.value)}
                        placeholder="e.g. typescript"
                        {...invalid("language")}
                    />
                </Field>
            )}

            <Field
                id="item-tags"
                label="Tags"
                error={fieldErrors.tags}
                hint="Separate tags with commas."
            >
                <Input
                    id="item-tags"
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="e.g. react, hooks"
                    {...invalid("tags")}
                />
            </Field>
        </form>
    );
}
