import Link from "next/link";
import { Suspense } from "react";
import { Boxes, Folder, FolderHeart, Pin, Star } from "lucide-react";

import { WelcomeToast } from "@/components/auth/WelcomeToast";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { Stat, StatBand } from "@/components/dashboard/StatBand";
import { ItemList } from "@/components/items/ItemList";
import { EmptyState } from "@/components/ui/EmptyState";
import { CARD_GRID, DASHBOARD_STAT_COLORS } from "@/config/dashboard";
import { getFirstName } from "@/lib/format";
import { getDashboardCollections } from "@/server/collections";
import { getCurrentUser } from "@/server/current-user";
import { getDashboardItems } from "@/server/items";

export default async function DashboardPage() {
    // `getCurrentUser` is request-cached, so this shares the read the sidebar already performs.
    const [collections, items, user] = await Promise.all([
        getDashboardCollections(),
        getDashboardItems(),
        getCurrentUser(),
    ]);

    return (
        <div className="mx-auto max-w-6xl space-y-8">
            {/* Suspense because `useSearchParams` opts its subtree into client-side rendering; the
                boundary keeps that from bubbling up and deopting the whole page. */}
            <Suspense fallback={null}>
                <WelcomeToast name={getFirstName(user.name)} />
            </Suspense>

            <header>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Your developer knowledge hub</p>
            </header>

            {/* `StatBand` owns its breakpoints, and they are derived from the longest label rather
                than picked off the scale — see the reasoning there, including why they are the
                window's width and not this box's. */}
            <StatBand>
                <Stat
                    label="Items"
                    value={items.totalItems}
                    icon={Boxes}
                    color={DASHBOARD_STAT_COLORS.items}
                />
                <Stat
                    label="Collections"
                    value={collections.totalCollections}
                    icon={Folder}
                    color={DASHBOARD_STAT_COLORS.collections}
                />
                <Stat
                    label="Favorite Items"
                    value={items.favoriteItems}
                    icon={Star}
                    color={DASHBOARD_STAT_COLORS.favoriteItems}
                />
                <Stat
                    label="Favorite Collections"
                    value={collections.favoriteCollections}
                    icon={FolderHeart}
                    color={DASHBOARD_STAT_COLORS.favoriteCollections}
                />
            </StatBand>

            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Recent Collections</h2>
                    {/* `-mr-2` so the padding that makes this a 44px target on a thumb does not
                        push the text off the grid the cards below line up on. */}
                    <Link
                        href="/collections"
                        className="text-sm text-muted-foreground transition-colors pointer-coarse:-mr-2 pointer-coarse:inline-flex pointer-coarse:h-11 pointer-coarse:items-center pointer-coarse:px-2 hover:text-foreground"
                    >
                        View all
                    </Link>
                </div>
                {collections.recentCollections.length > 0 ? (
                    <div className={CARD_GRID}>
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
                    <ItemList items={items.pinnedItems} className="space-y-3" />
                ) : (
                    <EmptyState message="No pinned items." />
                )}
            </section>

            <section>
                <h2 className="mb-4 text-lg font-semibold">Recent Items</h2>
                {items.recentItems.length > 0 ? (
                    <ItemList items={items.recentItems} className="space-y-3" />
                ) : (
                    <EmptyState message="No recent items." />
                )}
            </section>
        </div>
    );
}
