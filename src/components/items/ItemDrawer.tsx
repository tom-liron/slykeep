"use client";

import { useEffect, useState } from "react";
import { Calendar, Copy, Folder, Pencil, Pin, Star, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatLongDate } from "@/lib/format";
import { withAlpha } from "@/lib/utils";
import type { ItemDetailViewModel, ItemSummaryViewModel } from "@/types/view-models";
import { TypeIcon } from "./TypeIcon";

/**
 * The item detail view. There is no item page — this drawer is where an item is read.
 *
 * It opens on the summary the card already had, and fetches only what the card could not show. List
 * queries never select an item body, so the content, the collections holding it, and its creation
 * date are the parts that have to be waited for; the title, type, tags, and description are on
 * screen before the request is even sent. That is what makes the open feel immediate rather than a
 * spinner over an empty panel.
 */
export function ItemDrawer({
    item,
    open,
    onClose,
}: {
    item: ItemSummaryViewModel;
    open: boolean;
    onClose: () => void;
}) {
    const [detail, setDetail] = useState<ItemDetailViewModel | null>(null);
    const [error, setError] = useState("");

    const itemId = item.id;

    useEffect(() => {
        // Aborted on unmount, so a slow response for a previously opened item cannot land in the
        // drawer that replaced it. The caller keys this component by item id, which is also what
        // clears `detail` between items — resetting it here would be a synchronous setState in an
        // effect, and a cascading render the compiler rightly rejects.
        const controller = new AbortController();

        fetch(`/api/items/${itemId}`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(
                        response.status === 404
                            ? "This item no longer exists."
                            : "Could not load this item.",
                    );
                }
                return (await response.json()) as ItemDetailViewModel;
            })
            .then(setDetail)
            .catch((cause: Error) => {
                if (cause.name !== "AbortError") {
                    setError(cause.message || "Could not load this item.");
                }
            });

        return () => controller.abort();
    }, [itemId]);

    const accent = item.itemType.color;
    const body = detail?.url || detail?.content || "";
    const bodyLabel = item.itemType.contentType === "URL" ? "URL" : "Content";

    const copyBody = async () => {
        try {
            await navigator.clipboard.writeText(body);
            toast.success("Copied to clipboard");
        } catch {
            toast.error("Could not copy to clipboard");
        }
    };

    return (
        <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
            <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
                <SheetHeader className="gap-3 p-5">
                    <div className="flex items-start gap-3 pr-8">
                        <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: withAlpha(accent), color: accent }}
                        >
                            <TypeIcon
                                name={item.itemType.icon}
                                className="size-5"
                                aria-hidden="true"
                            />
                        </span>
                        <div className="min-w-0 space-y-1.5">
                            <SheetTitle className="text-lg leading-tight">{item.title}</SheetTitle>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary">{item.itemType.label}</Badge>
                                {detail?.language && (
                                    <Badge variant="outline">{detail.language}</Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Layout only for now: everything but Copy is a mutation, and mutations are the
                        next feature. They render in their resting state — a favourited item shows a
                        filled star — so the bar is not lying about the item, only inert. */}
                    <div className="flex items-center gap-1 border-t border-border pt-3">
                        <Button variant="ghost" size="sm" disabled title="Coming soon">
                            <Star
                                className={
                                    item.isFavorite ? "fill-yellow-400 text-yellow-400" : undefined
                                }
                                aria-hidden="true"
                            />
                            Favorite
                        </Button>
                        <Button variant="ghost" size="sm" disabled title="Coming soon">
                            <Pin aria-hidden="true" />
                            Pin
                        </Button>
                        <Button variant="ghost" size="sm" onClick={copyBody} disabled={!body}>
                            <Copy aria-hidden="true" />
                            Copy
                        </Button>

                        <div className="ml-auto flex items-center gap-1">
                            <Button variant="ghost" size="sm" disabled title="Coming soon">
                                <Pencil aria-hidden="true" />
                                Edit
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled
                                title="Coming soon"
                                className="text-destructive"
                            >
                                <Trash2 aria-hidden="true" />
                                <span className="sr-only">Delete</span>
                            </Button>
                        </div>
                    </div>
                </SheetHeader>

                <div className="space-y-6 border-t border-border p-5">
                    {item.description && (
                        <Section label="Description">
                            <p className="text-sm">{item.description}</p>
                        </Section>
                    )}

                    <Section label={bodyLabel}>
                        {error ? (
                            <p className="text-sm text-destructive">{error}</p>
                        ) : !detail ? (
                            <div className="h-24 animate-pulse rounded-lg bg-muted" />
                        ) : detail.url ? (
                            <a
                                href={detail.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm break-all text-primary underline-offset-4 hover:underline"
                            >
                                {detail.url}
                            </a>
                        ) : detail.content ? (
                            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs">
                                {detail.content}
                            </pre>
                        ) : (
                            <p className="text-sm text-muted-foreground">No content.</p>
                        )}
                    </Section>

                    {item.tags.length > 0 && (
                        <Section label="Tags" icon={Tag}>
                            <div className="flex flex-wrap gap-1.5">
                                {item.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </Section>
                    )}

                    {detail && detail.collections.length > 0 && (
                        <Section label="Collections" icon={Folder}>
                            <div className="flex flex-wrap gap-1.5">
                                {detail.collections.map((name) => (
                                    <Badge key={name} variant="outline">
                                        {name}
                                    </Badge>
                                ))}
                            </div>
                        </Section>
                    )}

                    <Section label="Details" icon={Calendar}>
                        <dl className="space-y-1 text-sm">
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-muted-foreground">Created</dt>
                                <dd>{detail ? formatLongDate(detail.createdAt) : "—"}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-muted-foreground">Updated</dt>
                                <dd>{formatLongDate(item.updatedAt)}</dd>
                            </div>
                        </dl>
                    </Section>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function Section({
    label,
    icon: Icon,
    children,
}: {
    label: string;
    icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {Icon && <Icon className="size-3.5" aria-hidden={true} />}
                {label}
            </h3>
            {children}
        </section>
    );
}
