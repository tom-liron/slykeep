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
import { Field, invalidFor } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CreateCollectionField, CreateCollectionInput } from "@/lib/collection-schemas";

/**
 * The collection-creation dialog: the "New Collection" trigger and the two-field form behind it,
 * calling `createCollection`.
 *
 * A centred `Dialog`, like `CreateItemDialog`, since creating starts from nothing.
 * {@link CreateCollectionForm} is a separate component so Radix unmounting the dialog content
 * resets every field.
 *
 * Uncontrolled by default; passing `open`/`onOpenChange` drops the trigger and hands control to
 * the caller (`TopBar` below `sm`, and `NewCollectionCard`).
 */
export function CreateCollectionDialog({
    open: controlledOpen,
    onOpenChange,
}: {
    /** As `CreateItemDialog`: omit both to keep the built-in trigger, pass them to drive it. */
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
                    {/* Label at `lg`, in step with `CreateItemDialog`'s — the two share a track
                        and appear together. */}
                    <Button variant="outline" aria-label="New Collection">
                        <FolderPlus className="size-4" aria-hidden="true" />
                        <span className="hidden lg:inline">New Collection</span>
                    </Button>
                </DialogTrigger>
            )}

            <DialogContent className="max-w-lg">
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

/** The name and description fields, submitted via `createCollection`. */
function CreateCollectionForm({ onCreated }: { onCreated: () => void }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<CreateCollectionField, string>>>(
        {},
    );

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const invalid = invalidFor<CreateCollectionField>("new-collection", fieldErrors);

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
