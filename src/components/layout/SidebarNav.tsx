"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Folder, Settings, Star } from "lucide-react";

import { TypeIcon } from "@/components/items/TypeIcon";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SidebarViewModel } from "@/types/view-models";

export function SidebarNav({
    data,
    onNavigate,
}: {
    data: SidebarViewModel;
    onNavigate?: () => void;
}) {
    const pathname = usePathname();
    const [typesOpen, setTypesOpen] = useState(true);
    const [collectionsOpen, setCollectionsOpen] = useState(true);
    const itemTypesPanelId = useId();
    const collectionsPanelId = useId();

    return (
        <div className="flex h-full flex-col">
            {/* Scrollable nav */}
            <nav className="flex-1 overflow-y-auto p-2">
                {/* Types */}
                <SectionHeader
                    label="Types"
                    open={typesOpen}
                    controls={itemTypesPanelId}
                    onToggle={() => setTypesOpen((v) => !v)}
                />
                {typesOpen && (
                    <ul id={itemTypesPanelId} className="mb-2 mt-1 space-y-0.5">
                        {data.itemTypes.map((itemType) => {
                            const href = `/items/${itemType.slug}`;
                            const active = pathname === href;
                            return (
                                <li key={itemType.id}>
                                    <Link
                                        href={href}
                                        onClick={onNavigate}
                                        className={cn(
                                            "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                                            active && "bg-sidebar-accent font-medium",
                                        )}
                                    >
                                        <TypeIcon
                                            name={itemType.icon}
                                            className="size-4 shrink-0"
                                            style={{ color: itemType.color }}
                                            aria-hidden="true"
                                        />
                                        <span className="flex-1 truncate">{itemType.label}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {itemType.itemCount}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <div className="my-2 border-t border-border" />

                {/* Collections */}
                <SectionHeader
                    label="Collections"
                    open={collectionsOpen}
                    controls={collectionsPanelId}
                    onToggle={() => setCollectionsOpen((v) => !v)}
                />
                {collectionsOpen && (
                    <div id={collectionsPanelId} className="mt-1 space-y-3">
                        {data.favoriteCollections.length > 0 && (
                            <div>
                                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Favorites
                                </p>
                                <ul className="space-y-0.5">
                                    {data.favoriteCollections.map((collection) => (
                                        <CollectionLink
                                            key={collection.id}
                                            href={`/collections/${collection.id}`}
                                            name={collection.name}
                                            active={pathname === `/collections/${collection.id}`}
                                            onNavigate={onNavigate}
                                            trailing={
                                                <Star
                                                    className="size-3.5 fill-yellow-400 text-yellow-400"
                                                    aria-label="Favorite"
                                                />
                                            }
                                        />
                                    ))}
                                </ul>
                            </div>
                        )}

                        {data.recentNonFavoriteCollections.length > 0 && (
                            <div>
                                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Recent
                                </p>
                                <ul className="space-y-0.5">
                                    {data.recentNonFavoriteCollections.map((collection) => (
                                        <CollectionLink
                                            key={collection.id}
                                            href={`/collections/${collection.id}`}
                                            name={collection.name}
                                            active={pathname === `/collections/${collection.id}`}
                                            onNavigate={onNavigate}
                                            trailing={
                                                <span className="text-xs text-muted-foreground">
                                                    {collection.itemCount}
                                                </span>
                                            }
                                        />
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </nav>

            {/* User area */}
            <div className="flex shrink-0 items-center gap-3 border-t border-border p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {data.user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={data.user.image}
                            alt={data.user.name}
                            className="size-9 rounded-full object-cover"
                        />
                    ) : (
                        getInitials(data.user.name)
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{data.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{data.user.email}</p>
                </div>
                <button
                    type="button"
                    disabled
                    aria-label="Settings"
                    title="Settings are coming soon"
                    className="flex size-8 shrink-0 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground opacity-50"
                >
                    <Settings className="size-4" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

function SectionHeader({
    label,
    open,
    controls,
    onToggle,
}: {
    label: string;
    open: boolean;
    controls: string;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={open}
            aria-controls={controls}
        >
            <span>{label}</span>
            <ChevronDown
                className={cn("size-4 transition-transform", open ? "rotate-0" : "-rotate-90")}
                aria-hidden="true"
            />
        </button>
    );
}

function CollectionLink({
    href,
    name,
    active,
    trailing,
    onNavigate,
}: {
    href: string;
    name: string;
    active: boolean;
    trailing: ReactNode;
    onNavigate?: () => void;
}) {
    return (
        <li>
            <Link
                href={href}
                onClick={onNavigate}
                className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                    active && "bg-sidebar-accent font-medium",
                )}
            >
                <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 truncate">{name}</span>
                {trailing}
            </Link>
        </li>
    );
}
