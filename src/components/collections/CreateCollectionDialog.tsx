"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";

import { createCollection } from "@/actions/collections";
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
import type { CreateCollectionField, CreateCollectionInput } from "@/lib/collection-schemas";

/**
 * The top bar's "New Collection" control and the dialog behind it.
 *
 * A centered modal for the same reason `CreateItemDialog` is one: creating starts from nothing, so
 * there is no card underneath for a side panel to sit beside.
 *
 * The form is a separate component on purpose — Radix unmounts the dialog's content when it closes,
 * so every field resets itself and there is no teardown to remember when a new collection is
 * started.
 */
export function CreateCollectionDialog() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" aria-label="New Collection">
                    <FolderPlus className="size-4" aria-hidden="true" />
                    <span className="hidden lg:inline">New Collection</span>
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>New collection</DialogTitle>
                    <DialogDescription>
                        Collections group items of any type. You can add items to it afterwards.
                    </DialogDescription>
                </DialogHeader>

                <CreateCollectionForm onCreated={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}

function CreateCollectionForm({ onCreated }: { onCreated: () => void }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<CreateCollectionField, string>>>(
        {},
    );

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    /** Points a rejected input at the message `Field` renders for it, as the item forms do. */
    const invalid = (field: CreateCollectionField) =>
        fieldErrors[field]
            ? { "aria-invalid": true, "aria-describedby": `new-collection-${field}-error` }
            : undefined;

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const input: CreateCollectionInput = { name, description };

        startTransition(async () => {
            const result = await createCollection(input);

            if (!result.success) {
                setFieldErrors(result.fields ?? {});
                toast.error(result.error);

                return;
            }

            toast.success("Collection created.");
            onCreated();
            // The dashboard grid, `/collections`, and the sidebar's favourites and recents were all
            // rendered on the server, so none of them know about the row that has just been written.
            router.refresh();
        });
    };

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-5 px-1 pb-1">
                <Field id="new-collection-name" label="Name" error={fieldErrors.name}>
                    <Input
                        id="new-collection-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="e.g. React Patterns"
                        autoFocus
                        {...invalid("name")}
                    />
                </Field>

                <Field
                    id="new-collection-description"
                    label="Description"
                    error={fieldErrors.description}
                >
                    <Textarea
                        id="new-collection-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Add a short summary"
                        rows={2}
                        {...invalid("description")}
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
                <Button type="submit" disabled={!name.trim() || isPending}>
                    {isPending ? "Creating…" : "Create collection"}
                </Button>
            </DialogFooter>
        </form>
    );
}
