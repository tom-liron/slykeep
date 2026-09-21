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
import { usePaletteShortcutLabel } from "@/hooks/use-palette-shortcut-label";
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
 * The searchable fields of an item and their weights, for `rankBySearch`.
 *
 * Title first as the most-typed field; the type label last, so "snippet" does not return every
 * snippet ahead of the one named that. Only title and tags accept a scattered (non-contiguous)
 * match — a description is prose, which contains the letters of a short query in order by chance.
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
 * The ⌘K command palette: the search trigger in the top bar and the dialog behind it, matching in
 * the browser against the `SearchDataViewModel` the dashboard layout already fetched.
 *
 * Selecting a collection navigates to its page; selecting an item opens {@link ItemDrawer}, the
 * same drawer the item lists use, because there is no item route. The search data carries whole
 * item summaries so this needs no round trip.
 *
 * @remarks
 * cmdk's own filtering is off — ranking is `rankBySearch` in `lib/fuzzy-search.ts`, which weighs a
 * title hit above a description hit, something a flattened `value` string cannot. This owns its
 * trigger as well as its dialog, so the query reset is an event handler here rather than an effect
 * watching `open`.
 */
export function CommandPalette({ data }: { data: SearchDataViewModel }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const shortcutLabel = usePaletteShortcutLabel();

    // Two pieces of state rather than one, so the drawer can animate out after the palette has gone:
    // `drawerOpen` goes false on close while `selectedItem` keeps rendering until the transition
    // finishes. The same pairing `ItemList` uses.
    const [selectedItem, setSelectedItem] = useState<ItemSummaryViewModel | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Cleared on the way in, so the palette never reopens on a stale query.
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
            {/* A `<button>` dressed as the search field, not a `readOnly` input, since it opens a
                dialog rather than accepting text. Two shapes: a square icon button below `sm`
                where a full field would not fit, the field itself from `sm` up. The dialog behind
                it insets itself on a phone, so only the trigger changes shape. `aria-label`
                repeats the visible label, which is one of the things that goes in the icon-only
                state. */}
            <button
                type="button"
                onClick={openPalette}
                aria-label="Search items and collections"
                title="Search items and collections"
                className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-left text-sm text-muted-foreground transition-colors pointer-coarse:size-11 hover:bg-muted focus-glow sm:h-9 sm:w-auto sm:min-w-0 sm:flex-1 sm:justify-start sm:gap-2 sm:rounded-md sm:border sm:border-input sm:bg-field sm:max-w-md sm:pr-2 sm:pl-9 sm:pointer-coarse:h-11 sm:pointer-coarse:w-auto sm:hover:bg-muted/50"
            >
                <Search
                    className="size-4 shrink-0 sm:pointer-events-none sm:absolute sm:top-1/2 sm:left-3 sm:-translate-y-1/2"
                    aria-hidden="true"
                />
                <span className="hidden truncate sm:block">Search items and collections...</span>
                {shortcutLabel && (
                    <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-sans text-xs sm:inline-block">
                        {shortcutLabel}
                    </kbd>
                )}
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                {/* Off: `rankBySearch` already ranks and filters the results, and cmdk would
                    filter them a second time by a different rule. */}
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
