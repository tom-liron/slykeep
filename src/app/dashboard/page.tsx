import Link from "next/link";
import { Boxes, Folder, FolderHeart, Pin, Star } from "lucide-react";

import { CollectionCard } from "@/components/collections/CollectionCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { ItemCard } from "@/components/items/ItemCard";
import { dashboardStats, pinnedItems, recentItems } from "@/lib/dashboard";
import { collections } from "@/lib/mock-data";

export default function DashboardPage() {
    const stats = dashboardStats();
    const recentCollections = collections.slice(0, 6);
    const pinned = pinnedItems();
    const recent = recentItems(10);

    return (
        <div className="mx-auto max-w-6xl space-y-8">
            <header>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Your developer knowledge hub</p>
            </header>

            {/* Stats */}
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                    label="Items"
                    value={stats.totalItems}
                    icon={Boxes}
                    color="#3b82f6"
                />
                <StatCard
                    label="Collections"
                    value={stats.totalCollections}
                    icon={Folder}
                    color="#10b981"
                />
                <StatCard
                    label="Favorite Items"
                    value={stats.favoriteItems}
                    icon={Star}
                    color="#fde047"
                />
                <StatCard
                    label="Favorite Collections"
                    value={stats.favoriteCollections}
                    icon={FolderHeart}
                    color="#8b5cf6"
                />
            </section>

            {/* Collections */}
            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Collections</h2>
                    <Link
                        href="/collections"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        View all
                    </Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {recentCollections.map((collection) => (
                        <CollectionCard key={collection.id} collection={collection} />
                    ))}
                </div>
            </section>

            {/* Pinned items */}
            {pinned.length > 0 && (
                <section>
                    <div className="mb-4 flex items-center gap-2">
                        <Pin className="size-4 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">Pinned</h2>
                    </div>
                    <div className="space-y-3">
                        {pinned.map((item) => (
                            <ItemCard key={item.id} item={item} />
                        ))}
                    </div>
                </section>
            )}

            {/* Recent items */}
            <section>
                <h2 className="mb-4 text-lg font-semibold">Recent Items</h2>
                <div className="space-y-3">
                    {recent.map((item) => (
                        <ItemCard key={item.id} item={item} />
                    ))}
                </div>
            </section>
        </div>
    );
}
