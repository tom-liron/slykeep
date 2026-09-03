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
 * Where to read this item's body from for a copy, or `null` when it has nothing to copy.
 *
 * Applies the same rule the drawer's Copy control uses: a TEXT or URL item copies its body; a FILE
 * item copies its object only when that object is text (an image or PDF returns `null`). The FILE
 * test is `filePreviewFor` over the name and size the summary already carries.
 *
 * The URL depends on the type because the body does: a file's contents are an object in R2 with
 * empty `content` / `url` columns, so it reads from the file route; everything else reads from the
 * item route.
 *
 * @remarks
 * Exported for its own unit test — the file-that-offers-no-copy branch has no other coverage.
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
 * Copies an item's body from a card, without opening the drawer.
 *
 * List queries never select `content` / `url` (the rule the summary view model enforces), so the
 * body is fetched when the icon is clicked, from the same routes the drawer reads. Nothing loads
 * for a card nobody copies.
 *
 * @remarks
 * The pending fetch is passed to `copyToClipboard` unawaited — see `writeClipboardText` in
 * `lib/clipboard.ts` for why Safari needs the clipboard write to start synchronously. A
 * consequence: an empty body is reported by the fetch rejecting, not by disabling the button up
 * front, since this cannot know the body is empty until it asks.
 *
 * Renders a bare button; `ItemList` positions it over the card and decides when it appears.
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
            // Named with the item so a column of these does not read as identically labelled
            // buttons to assistive tech.
            aria-label={`Copy ${item.title}`}
            className={cn("text-muted-foreground", className)}
        >
            <Copy aria-hidden="true" />
        </Button>
    );
}
