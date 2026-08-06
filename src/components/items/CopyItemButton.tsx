"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { filePreviewFor } from "@/lib/file-preview";
import { cn } from "@/lib/utils";
import type { ItemDetailViewModel, ItemSummaryViewModel } from "@/types/view-models";

/** Where an item's body has to be read from, and how to read it out of the response. */
type CopySource = { url: string; kind: "detail" | "file" };

/**
 * How to copy this item, or null if there is nothing about it worth putting on the clipboard.
 *
 * The rule is the drawer's, deliberately: a TEXT or URL item copies its body, and a FILE item copies
 * its object only when that object is text — an image or a PDF has nothing to write to a clipboard,
 * which is why the drawer hides Copy for them rather than offering a control that can never do
 * anything. Same test, `filePreviewFor` over the name and size the card already carries.
 *
 * The source differs because the body does. A file's contents are an object in R2, and its `content`
 * and `url` columns are empty, so it is read from the file route; everything else is read from the
 * item route. That is the only thing item type changes here.
 *
 * Exported for its own test: it is the one part of this component with branches, and the branch that
 * matters — a file that must not offer a copy — is invisible until someone stashes a PNG.
 */
export function copyableSourceFor(item: ItemSummaryViewModel): CopySource | null {
    if (item.itemType.contentType !== "FILE") {
        return { url: `/api/items/${item.id}`, kind: "detail" };
    }

    if (!item.fileName) return null;

    const { kind } = filePreviewFor({ name: item.fileName, size: item.fileSize });

    return kind === "markdown" || kind === "code"
        ? { url: `/api/files/${item.id}`, kind: "file" }
        : null;
}

/** The item's body, fetched on demand. Rejects when there is none — see `copy` below. */
async function fetchBody(source: CopySource): Promise<string> {
    const response = await fetch(source.url);

    if (!response.ok) throw new Error("Could not load this item.");

    let body: string;

    if (source.kind === "file") {
        body = await response.text();
    } else {
        // `url || content`, as the drawer reads it: the item's content type says which of the two
        // columns holds the body, and the other is empty.
        const detail = (await response.json()) as ItemDetailViewModel;
        body = detail.url || detail.content;
    }

    if (!body) throw new Error("This item has nothing to copy.");

    return body;
}

/**
 * Copy an item's body without opening it.
 *
 * The drawer has had this button since it was built; the difference here is that a card has no body
 * to copy. List queries never select `content` / `url` — that is the rule the summary view model
 * exists to enforce — so the body is fetched when the icon is clicked, from the same routes the
 * drawer reads. Nothing is loaded for a card nobody copies.
 *
 * The fetch is handed to `copyToClipboard` unawaited, which is what keeps this working in Safari:
 * see `writeClipboardText`. It also means an item with an empty body has to be reported by rejecting
 * rather than by disabling the control up front, the way the drawer disables its Copy — the drawer
 * knows the body is empty because it already has it, and this one cannot know until it asks.
 *
 * Placement is the caller's: this renders a bare button, and `ItemList` positions it over the card
 * and decides when it appears.
 */
export function CopyItemButton({
    item,
    className,
}: {
    item: ItemSummaryViewModel;
    className?: string;
}) {
    const [isCopying, setIsCopying] = useState(false);

    const source = copyableSourceFor(item);

    if (!source) return null;

    const copy = async () => {
        setIsCopying(true);
        try {
            await copyToClipboard(fetchBody(source));
        } finally {
            setIsCopying(false);
        }
    };

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={copy}
            disabled={isCopying}
            title="Copy"
            // Named with the item, because a list of these is otherwise a column of identically
            // labelled buttons to anyone reading it one control at a time.
            aria-label={`Copy ${item.title}`}
            className={cn("text-muted-foreground", className)}
        >
            <Copy aria-hidden="true" />
        </Button>
    );
}
