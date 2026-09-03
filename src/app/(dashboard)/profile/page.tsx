import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Folder, type LucideIcon } from "lucide-react";

import { TypeIcon } from "@/components/items/TypeIcon";
import { Panel } from "@/components/ui/Panel";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { DASHBOARD_STAT_COLORS } from "@/config/dashboard";
import { formatLongDate } from "@/lib/format";
import { withAlpha } from "@/lib/utils";
import { getProfile } from "@/server/profile";

export const metadata: Metadata = {
    title: "Profile · DevStash",
};

// The user is read per request from the session; nothing here can be baked in at build time.
export const dynamic = "force-dynamic";

/**
 * `/profile` — a read-only account page: identity, plan, join date, and usage totals.
 *
 * Entirely a server component; the account *actions* live on `/settings`. Two `Panel`s sharing the
 * shell the settings page uses, so the two halves of the account read as one surface.
 */
export default async function ProfilePage() {
    const { user, createdAt, totalItems, totalCollections, itemTypeCounts } = await getProfile();

    return (
        <div className="mx-auto max-w-3xl space-y-8">
            <header>
                <h1 className="text-2xl font-bold">Profile</h1>
                <p className="text-muted-foreground">Who you are, and what you have stashed.</p>
            </header>

            <Panel id="account" title="Account">
                <div className="flex items-center gap-4 p-6">
                    <UserAvatar name={user.name} image={user.image} className="size-16 text-lg" />
                    <div className="min-w-0">
                        <p className="truncate text-lg font-medium">{user.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {user.isPro ? "Pro account" : "Free account"} · Joined{" "}
                            {formatLongDate(createdAt)}
                        </p>
                    </div>
                </div>
            </Panel>

            <Panel id="usage" title="Usage" description="What is in your stash right now.">
                {/* The two totals as one band split down the middle, not two bordered cards inside a
                    bordered panel. Its own cells rather than `Stat` from `StatBand`, which brings a
                    border and padding this `Panel` already draws. One column on a phone; the
                    divider turns with it — `divide-y` stacked, `divide-x` side by side. */}
                <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                    <Total
                        label="Items"
                        value={totalItems}
                        icon={Boxes}
                        color={DASHBOARD_STAT_COLORS.items}
                    />
                    <Total
                        label="Collections"
                        value={totalCollections}
                        icon={Folder}
                        color={DASHBOARD_STAT_COLORS.collections}
                    />
                </dl>

                {/* Every accessible type is listed, including the ones at zero — the breakdown is
                    meant to show the shape of a stash, and a missing row reads as a bug rather
                    than an empty category. Each links to that type's page. */}
                <ul className="divide-y divide-border">
                    {itemTypeCounts.map((itemType) => (
                        <li key={itemType.id}>
                            <Link
                                href={`/items/${itemType.slug}`}
                                className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted"
                            >
                                <span
                                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                                    style={{
                                        backgroundColor: withAlpha(itemType.color),
                                        color: itemType.color,
                                    }}
                                >
                                    <TypeIcon
                                        name={itemType.icon}
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                </span>
                                <span className="flex-1 truncate text-sm">{itemType.label}</span>
                                <span className="text-sm font-medium tabular-nums">
                                    {itemType.itemCount}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </Panel>
        </div>
    );
}

/** One half of the usage band: a tinted type-coloured icon, the label, and the count. */
function Total({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: number;
    icon: LucideIcon;
    color: string;
}) {
    return (
        <div className="flex items-center gap-3 p-6">
            <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: withAlpha(color), color }}
            >
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
                <dt className="truncate text-sm text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-semibold">{value}</dd>
            </div>
        </div>
    );
}
