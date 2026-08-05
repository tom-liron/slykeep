"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import { CodeEditor } from "@/components/items/CodeEditor";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
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
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ITEM_TYPE_CATALOG } from "@/config/item-type-catalog";
import {
    CREATABLE_ITEM_TYPE_NAMES,
    itemTypeOwns,
    type CreatableItemTypeName,
    type CreateItemField,
    type CreateItemInput,
} from "@/lib/item-schemas";
import { cn } from "@/lib/utils";

const DEFAULT_TYPE: CreatableItemTypeName = "snippet";

/**
 * Which type the dialog opens on, read from the page behind it: on `/items/prompts` a new item is
 * almost certainly a prompt, so preselecting it saves the click that would otherwise be made on
 * every single create from a type page.
 *
 * Everywhere else — the dashboard, a collection, the profile — there is nothing to infer from, and
 * it falls back to the first type. So does `/items/files` and `/items/images`: those pages exist,
 * but uploads are Phase 4 and nothing can create one yet, which is exactly what the creatable list
 * says. The choice is only a starting point in any case; the buttons are right there.
 */
function typeForPath(pathname: string): CreatableItemTypeName {
    const slug = pathname.match(/^\/items\/([^/]+)/)?.[1];

    return (
        CREATABLE_ITEM_TYPE_NAMES.find((name) => ITEM_TYPE_CATALOG[name].slug === slug) ??
        DEFAULT_TYPE
    );
}

/**
 * Two rules, both from the same finding: a placeholder must never restate the label, which is noise
 * at best and at worst makes an empty field look filled in.
 *
 * Where the field's *format* matters — language, tags, URL — the placeholder is an example, prefixed
 * "e.g." so it cannot be mistaken for a value. Where the field is open-ended and format is beside
 * the point, it is an instruction naming what goes in, which is why `content` differs by type: the
 * verb for a command is not the verb for a note. Title keeps an example rather than "Enter a title",
 * since the label already says "Title" and a sample shows what a useful one looks like.
 */
const PLACEHOLDERS: Record<CreatableItemTypeName, { title: string; content: string }> = {
    snippet: { title: "e.g. Debounce hook", content: "Paste your code" },
    prompt: { title: "e.g. Code review prompt", content: "Write your prompt" },
    command: { title: "e.g. Reset a branch to origin", content: "Paste your command" },
    note: { title: "e.g. Postgres connection pooling", content: "Write your note" },
    link: { title: "e.g. Prisma migrate reference", content: "" },
};

/**
 * The top bar's "New Item" control and the dialog behind it.
 *
 * A centered modal rather than the drawer that view and edit share: creating is the one item flow
 * that starts from nothing, so there is no card underneath for a side panel to sit beside.
 *
 * The form is a separate component on purpose — Radix unmounts the dialog's content when it closes,
 * so every field resets itself and there is no teardown to remember when a new item is started.
 */
export function CreateItemDialog() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button aria-label="New Item">
                    <Plus className="size-4" aria-hidden="true" />
                    <span className="hidden lg:inline">New Item</span>
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
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

    const { content: showsContent, url: showsUrl, language: showsLanguage } = itemTypeOwns(type);

    /** Points a rejected input at the message `Field` renders for it, as the edit form does. */
    const invalid = (field: CreateItemField) =>
        fieldErrors[field]
            ? { "aria-invalid": true, "aria-describedby": `new-item-${field}-error` }
            : undefined;

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const input: CreateItemInput = {
            type,
            title,
            description,
            // Split only — trimming, dropping blanks, and de-duplicating are the schema's job.
            tags: tags.split(","),
            ...(showsContent && { content }),
            ...(showsUrl && { url }),
            ...(showsLanguage && { language }),
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
        <form onSubmit={handleSubmit} noValidate>
            <div className="max-h-[60vh] space-y-5 overflow-y-auto px-1 pb-1">
                <fieldset className="space-y-1.5" disabled={isPending}>
                    <legend className="text-xs font-medium text-muted-foreground">Type</legend>
                    <div className="flex flex-wrap gap-2 pt-1.5">
                        {CREATABLE_ITEM_TYPE_NAMES.map((name) => {
                            const { icon, color } = ITEM_TYPE_CATALOG[name];
                            const selected = name === type;

                            return (
                                <label
                                    key={name}
                                    className={cn(
                                        "flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                                        selected
                                            ? "text-foreground"
                                            : "border-border text-muted-foreground hover:text-foreground",
                                    )}
                                    // Type colours are user-facing data, not theme tokens, so they
                                    // cannot be Tailwind classes — the same exception the cards take.
                                    style={
                                        selected
                                            ? { borderColor: color, backgroundColor: `${color}1a` }
                                            : undefined
                                    }
                                >
                                    <input
                                        type="radio"
                                        name="new-item-type"
                                        value={name}
                                        checked={selected}
                                        onChange={() => setType(name)}
                                        className="sr-only"
                                    />
                                    <TypeIcon
                                        name={icon}
                                        className="size-3.5"
                                        style={{ color }}
                                        aria-hidden="true"
                                    />
                                    {name}
                                </label>
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

                {/* Above the content, as in the edit form: the language is what the editor
                    highlights by, so it has to be answerable before the code is pasted. */}
                {showsLanguage && (
                    <Field id="new-item-language" label="Language" error={fieldErrors.language}>
                        <Input
                            id="new-item-language"
                            value={language}
                            onChange={(event) => setLanguage(event.target.value)}
                            placeholder="e.g. typescript"
                            {...invalid("language")}
                        />
                    </Field>
                )}

                {showsContent && (
                    <Field id="new-item-content" label="Content" error={fieldErrors.content}>
                        {/* Code gets the code editor, prose gets the markdown one — the same split
                            the edit form and the drawer make, off the same predicate. */}
                        {showsLanguage ? (
                            <CodeEditor
                                id="new-item-content"
                                label="Content"
                                value={content}
                                language={language}
                                onChange={setContent}
                                placeholder={PLACEHOLDERS[type].content}
                                {...invalid("content")}
                            />
                        ) : (
                            <MarkdownEditor
                                id="new-item-content"
                                label="Content"
                                value={content}
                                onChange={setContent}
                                placeholder={PLACEHOLDERS[type].content}
                                {...invalid("content")}
                            />
                        )}
                    </Field>
                )}

                <Field
                    id="new-item-description"
                    label="Description"
                    error={fieldErrors.description}
                >
                    <Textarea
                        id="new-item-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Add a short summary"
                        rows={2}
                        {...invalid("description")}
                    />
                </Field>

                <Field
                    id="new-item-tags"
                    label="Tags"
                    error={fieldErrors.tags}
                    hint="Separate tags with commas."
                >
                    <Input
                        id="new-item-tags"
                        value={tags}
                        onChange={(event) => setTags(event.target.value)}
                        placeholder="e.g. react, hooks"
                        {...invalid("tags")}
                    />
                </Field>
            </div>

            <DialogFooter className="mt-4">
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isPending}>
                        Cancel
                    </Button>
                </DialogClose>
                {/* Submit stays a plain button, not a `DialogClose`: the action can fail, and a
                    dialog that has already dismissed has nowhere to report it. */}
                <Button type="submit" disabled={!title.trim() || isPending}>
                    {isPending ? "Creating…" : "Create item"}
                </Button>
            </DialogFooter>
        </form>
    );
}
