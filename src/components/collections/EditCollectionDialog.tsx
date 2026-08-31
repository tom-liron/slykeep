"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateCollection } from "@/actions/collections";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, invalidFor } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UpdateCollectionField, UpdateCollectionInput } from "@/lib/collection-schemas";
import type { CollectionActionTarget } from "@/types/collection";

/**
 * The edit dialog for a collection's metadata — its name and its description, the same two fields
 * creation set.
 *
 * Controlled from the outside rather than owning a `DialogTrigger` of its own, which is what lets
 * one dialog serve both surfaces: on the collection's page it opens from a header button, and on a
 * card it opens from a dropdown item. The second case is why the trigger cannot live here at all —
 * a Radix menu closes on select and unmounts everything inside it, taking a dialog nested in the
 * item with it. `CollectionActions` holds the state and renders this as the menu's sibling.
 *
 * A centered modal rather than a side panel, matching `CreateCollectionDialog`: there are two fields
 * and no content to keep in view beside them.
 */
export function EditCollectionDialog({
    collection,
    open,
    onOpenChange,
}: {
    collection: CollectionActionTarget;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit collection</DialogTitle>
                    <DialogDescription>
                        Rename this collection or change what it says it holds. The items in it are
                        not affected.
                    </DialogDescription>
                </DialogHeader>

                <EditCollectionForm collection={collection} onSaved={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
}

/**
 * Split out for the reason `CreateCollectionForm` is: Radix unmounts the dialog's content when it
 * closes, so seeding the fields from props here means they are re-seeded from the collection's
 * current values every time it is reopened — including straight after a save, with no reset to
 * remember and no stale draft left behind by a cancel.
 */
function EditCollectionForm({
    collection,
    onSaved,
}: {
    collection: CollectionActionTarget;
    onSaved: () => void;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<UpdateCollectionField, string>>>(
        {},
    );

    const [name, setName] = useState(collection.name);
    const [description, setDescription] = useState(collection.description);

    const invalid = invalidFor<UpdateCollectionField>("edit-collection", fieldErrors);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const input: UpdateCollectionInput = { name, description };

        startTransition(async () => {
            const result = await updateCollection(collection.id, input);

            if (!result.success) {
                setFieldErrors(result.fields ?? {});
                toast.error(result.error);

                return;
            }

            toast.success("Collection updated.");
            onSaved();
            // Every surface that renders this collection's name — the page header it may have been
            // opened from, the cards on the dashboard and `/collections`, the sidebar's favourites
            // and recents — was rendered on the server and still holds the old one.
            router.refresh();
        });
    };

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-5 px-1 pb-1">
                <Field id="edit-collection-name" label="Name" error={fieldErrors.name}>
                    <Input
                        id="edit-collection-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="e.g. React Patterns"
                        autoFocus
                        {...invalid("name")}
                    />
                </Field>

                <Field
                    id="edit-collection-description"
                    label="Description"
                    error={fieldErrors.description}
                >
                    <Textarea
                        id="edit-collection-description"
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
                    {isPending ? "Saving…" : "Save changes"}
                </Button>
            </DialogFooter>
        </form>
    );
}
