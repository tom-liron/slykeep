"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Folder, Search } from "lucide-react";

import { ItemDrawer } from "@/components/items/ItemDrawer";
import { TypeIcon } from "@/components/items/TypeIcon";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { rankBySearch, type SearchField } from "@/lib/fuzzy-search";
import type {
    ItemSummaryViewModel,
    SearchCollectionViewModel,
    SearchDataViewModel,
} from "@/types/view-models";

/** How many of each kind a result list shows, and how many an empty query falls back to. */
const MAX_ITEM_RESULTS = 8;
const MAX_COLLECTION_RESULTS = 5;

/**
 * What an item can be found by, and how much each way of finding it counts. A title is what someone
 * is most likely to be typing; the type label is last because "snippet" would otherwise return every
 * snippet ahead of the one actually named that.
 *
 * Only the title and the tags accept a scattered match. A description is prose, and prose contains
 * the letters of a short query in order whether or not it is about it.
 */
function itemFields(item: ItemSummaryViewModel): SearchField[] {
    return [
        { text: item.title, weight: 1, scattered: true },
        ...item.tags.map((tag) => ({ text: tag, weight: 0.85, scattered: true })),
        { text: item.description, weight: 0.7 },
        { text: item.itemType.label, weight: 0.5 },
    ];
}

function collectionFields(collection: SearchCollectionViewModel): SearchField[] {
    return [{ text: collection.name, weight: 1, scattered: true }];
}

/**
 * The ⌘K palette: everything the user has stashed, matched in the browser against data the dashboard
 * layout already fetched.
 *
 * Selecting a collection navigates to its page. Selecting an item opens `ItemDrawer` — the same
 * drawer the item lists open, rendered here for the same reason it is rendered there: there is no
 * item route, so the drawer is state rather than a destination. The search data carries whole item
 * summaries precisely so this can happen without a second round trip.
 *
 * cmdk's own filtering is off. The ranking lives in `lib/fuzzy-search.ts`, which can weigh a title
 * hit above a description hit — something a single flattened `value` string per item cannot express.
 *
 * It owns its trigger as well as its dialog, the way `CreateItemDialog` and `CreateCollectionDialog`
 * do — the top bar places it and nothing else. That is also what keeps the query reset out of an
 * effect: every path that opens the palette is an event handler here, so the field is cleared on the
 * way in rather than by watching `open` change.
 */
export function CommandPalette({ data }: { data: SearchDataViewModel }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

    // Two pieces of state rather than one, so the drawer can animate out after the palette has gone:
    // `drawerOpen` goes false on close while `selectedItem` keeps rendering until the transition
    // finishes. The same pairing `ItemList` uses.
    const [selectedItem, setSelectedItem] = useState<ItemSummaryViewModel | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // A palette that reopens on last week's query is one you have to clear before using.
    const openPalette = () => {
        setQuery("");
        setOpen(true);
    };

    // The shortcut is registered here because the top bar is mounted on every dashboard route, which
    // is the scope a global shortcut needs. `metaKey` for macOS, `ctrlKey` elsewhere; the default is
    // prevented because ⌘K focuses the address bar in some browsers.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            // `key` is not as guaranteed as its `string` type claims: a `window` listener receives
            // every keydown on the page, and one dispatched as a plain `new Event("keydown")`
            // carries none. TypeScript types the interface, not what actually arrives.
            if (!(event.metaKey || event.ctrlKey) || event.key?.toLowerCase() !== "k") {
                return;
            }
            event.preventDefault();
            // Cleared either way: on the way in it is the reset, and on the way out the dialog is
            // unmounting, so there is nothing left to clear it for.
            setQuery("");
            setOpen((isOpen) => !isOpen);
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const items = useMemo(
        () =>
            query.trim()
                ? rankBySearch(query, data.items, itemFields, MAX_ITEM_RESULTS)
                : data.items.slice(0, MAX_ITEM_RESULTS),
        [query, data.items],
    );

    const collections = useMemo(
        () =>
            query.trim()
                ? rankBySearch(query, data.collections, collectionFields, MAX_COLLECTION_RESULTS)
                : data.collections.slice(0, MAX_COLLECTION_RESULTS),
        [query, data.collections],
    );

    const openItem = (item: ItemSummaryViewModel) => {
        setOpen(false);
        setSelectedItem(item);
        setDrawerOpen(true);
    };

    const openCollection = (collection: SearchCollectionViewModel) => {
        setOpen(false);
        router.push(`/collections/${collection.id}`);
    };

    return (
        <>
            {/* A button dressed as the input it replaces, not an input. It opens a dialog rather
                than accepting text — the palette owns the field you actually type in — and a
                `readOnly` input that swallows its own focus is a control that lies about what it
                does to anyone reaching it by keyboard or screen reader.

                Two shapes, one control. Below `sm` it is a square icon button like the rest of the
                bar, because a field wide enough to read its own placeholder is wider than a phone
                has to spare once the brand and the create actions have taken theirs. From `sm` up it
                is the field again. Collapsing it rather than shrinking it is what keeps the bar off
                the point where every control is squeezed and none of them fit.

                The dialog behind it is unchanged and already insets itself on a phone, so only the
                trigger has two shapes.

                `aria-label` because the visible text is one of the things that goes: without it the
                icon-only state would be a button with no accessible name at all. It repeats the
                visible label rather than replacing it, so the two agree at the widths where both
                exist. */}
            <button
                type="button"
                onClick={openPalette}
                aria-label="Search items and collections"
                title="Search items and collections"
                className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-left text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:h-9 sm:w-auto sm:min-w-0 sm:flex-1 sm:justify-start sm:gap-2 sm:rounded-md sm:border sm:border-input sm:bg-transparent sm:max-w-md sm:pr-2 sm:pl-9 sm:hover:bg-muted/50"
            >
                <Search
                    className="size-4 shrink-0 sm:pointer-events-none sm:absolute sm:top-1/2 sm:left-3 sm:-translate-y-1/2"
                    aria-hidden="true"
                />
                <span className="hidden truncate sm:block">Search items and collections...</span>
                <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-sans text-xs sm:inline-block">
                    ⌘K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                {/* Off, because the ranking is ours. Left on, cmdk would filter our already-filtered
                    list a second time by a different rule. */}
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search items and collections..."
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>

                        {items.length > 0 && (
                            <CommandGroup heading="Items">
                                {items.map((item) => (
                                    <CommandItem
                                        key={item.id}
                                        value={`item-${item.id}`}
                                        onSelect={() => openItem(item)}
                                    >
                                        <TypeIcon
                                            name={item.itemType.icon}
                                            className="size-4 shrink-0"
                                            style={{ color: item.itemType.color }}
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">{item.title}</span>
                                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                            {item.itemType.label}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {collections.length > 0 && (
                            <CommandGroup heading="Collections">
                                {collections.map((collection) => (
                                    <CommandItem
                                        key={collection.id}
                                        value={`collection-${collection.id}`}
                                        onSelect={() => openCollection(collection)}
                                    >
                                        <Folder
                                            className="size-4 shrink-0 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">{collection.name}</span>
                                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                            {collection.itemCount}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </CommandDialog>

            {selectedItem && (
                <ItemDrawer
                    key={selectedItem.id}
                    item={selectedItem}
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                />
            )}
        </>
    );
}
