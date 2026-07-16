import Link from "next/link";
import { Boxes, Folder, FolderHeart, Pin, Star } from "lucide-react";

import { CollectionCard } from "@/components/collections/CollectionCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { ItemCard } from "@/components/items/ItemCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DASHBOARD_STAT_COLORS } from "@/config/dashboard";
import { getDashboardCollections } from "@/server/collections";
import { getDashboardItems } from "@/server/items";

export default async function DashboardPage() {
    const [collections, items] = await Promise.all([
        getDashboardCollections(),
        getDashboardItems(),
    ]);

    return (
        <div className="mx-auto max-w-6xl space-y-8">
            <header>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Your developer knowledge hub</p>
            </header>

            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Summary">
                <StatCard
                    label="Items"
                    value={items.totalItems}
                    icon={Boxes}
                    color={DASHBOARD_STAT_COLORS.items}
                />
                <StatCard
                    label="Collections"
                    value={collections.totalCollections}
                    icon={Folder}
                    color={DASHBOARD_STAT_COLORS.collections}
                />
                <StatCard
                    label="Favorite Items"
                    value={items.favoriteItems}
                    icon={Star}
                    color={DASHBOARD_STAT_COLORS.favoriteItems}
                />
                <StatCard
                    label="Favorite Collections"
                    value={collections.favoriteCollections}
                    icon={FolderHeart}
                    color={DASHBOARD_STAT_COLORS.favoriteCollections}
                />
            </section>

            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Recent Collections</h2>
                    <Link
                        href="/collections"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        View all
                    </Link>
                </div>
                {collections.recentCollections.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {collections.recentCollections.map((collection) => (
                            <CollectionCard key={collection.id} collection={collection} />
                        ))}
                    </div>
                ) : (
                    <EmptyState message="No collections yet." />
                )}
            </section>

            <section>
                <div className="mb-4 flex items-center gap-2">
                    <Pin className="size-4 text-muted-foreground" aria-hidden="true" />
                    <h2 className="text-lg font-semibold">Pinned</h2>
                </div>
                {items.pinnedItems.length > 0 ? (
                    <div className="space-y-3">
                        {items.pinnedItems.map((item) => (
                            <ItemCard key={item.id} item={item} />
                        ))}
                    </div>
                ) : (
                    <EmptyState message="No pinned items." />
                )}
            </section>

            <section>
                <h2 className="mb-4 text-lg font-semibold">Recent Items</h2>
                {items.recentItems.length > 0 ? (
                    <div className="space-y-3">
                        {items.recentItems.map((item) => (
                            <ItemCard key={item.id} item={item} />
                        ))}
                    </div>
                ) : (
                    <EmptyState message="No recent items." />
                )}
            </section>
        </div>
    );
}
