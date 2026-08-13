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
 * The account page: who you are and what you have stashed.
 *
 * Read-only, and entirely a server component — the account *actions* live on `/settings`, which is
 * where the client components that perform them went. Nothing here links across to them: the account
 * menu already lists both pages, and a page that ends by explaining where its buttons went is a
 * migration note, not a design.
 *
 * Two panels rather than a stack of cards, sharing the shell the settings page uses, so the two
 * halves of the account read as one product.
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
                {/* The two totals, as one band split down the middle rather than two bordered cards
                    inside a bordered panel. The dashboard's summary has since become a band too,
                    for a different reason — cards there looked clickable and were not — so the two
                    pages now agree. This one keeps its own cells rather than importing `Stat` from
                    `StatBand`: it is already inside a `Panel` that draws the border and the padding,
                    and the shared cell brings both of its own.

                    One column on a phone, where half of the band is ~145px of content box for an
                    icon, a label, and a 2xl number. The divider turns with it: `divide-y` stacked
                    and `divide-x` side by side, because a vertical rule between two rows is a line
                    drawn between nothing. */}
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
