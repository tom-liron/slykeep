"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown, Star } from "lucide-react";

import { TypeIcon } from "@/components/items/TypeIcon";
import { UserMenu } from "@/components/layout/UserMenu";
import { cn } from "@/lib/utils";
import type { SidebarCollectionViewModel, SidebarViewModel } from "@/types/view-models";

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
                                            leading={
                                                <Star
                                                    className="size-4 shrink-0 fill-yellow-400 text-yellow-400"
                                                    aria-label="Favorite"
                                                />
                                            }
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
                                            leading={
                                                <CollectionDot
                                                    itemType={collection.dominantItemType}
                                                />
                                            }
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

                        <Link
                            href="/collections"
                            onClick={onNavigate}
                            className="flex items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                        >
                            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                            <span>View all collections</span>
                        </Link>
                    </div>
                )}
            </nav>

            <UserMenu user={data.user} />
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
    leading,
    trailing,
    onNavigate,
}: {
    href: string;
    name: string;
    active: boolean;
    leading: ReactNode;
    trailing?: ReactNode;
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
                {leading}
                <span className="flex-1 truncate">{name}</span>
                {trailing}
            </Link>
        </li>
    );
}

/**
 * A collection's dominant-type colour, as a dot the width of the sidebar icons so names stay
 * aligned. Renders a neutral outline when the collection has no dominant type.
 */
function CollectionDot({ itemType }: { itemType: SidebarCollectionViewModel["dominantItemType"] }) {
    return (
        <span
            className="flex size-4 shrink-0 items-center justify-center"
            title={itemType ? `Mostly ${itemType.label}` : "No items yet"}
        >
            <span
                className={cn(
                    "size-2.5 rounded-full",
                    !itemType && "border border-muted-foreground/40",
                )}
                style={itemType ? { backgroundColor: itemType.color } : undefined}
                aria-hidden="true"
            />
        </span>
    );
}
