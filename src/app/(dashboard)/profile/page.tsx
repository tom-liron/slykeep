import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Folder } from "lucide-react";

import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { DeleteAccountDialog } from "@/components/profile/DeleteAccountDialog";
import { StatCard } from "@/components/dashboard/StatCard";
import { TypeIcon } from "@/components/items/TypeIcon";
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
 * The account page: who you are, what you have stashed, and the two things you can do to the
 * account itself.
 *
 * A server component that reads once and passes view models down — the interactive parts (the
 * password form, the delete confirmation) are the only client components, and neither fetches.
 */
export default async function ProfilePage() {
    const { user, createdAt, hasPassword, totalItems, totalCollections, itemTypeCounts } =
        await getProfile();

    return (
        <div className="mx-auto max-w-3xl space-y-8">
            <header>
                <h1 className="text-2xl font-bold">Profile</h1>
                <p className="text-muted-foreground">Manage your DevStash account.</p>
            </header>

            <section className="flex items-center gap-4 rounded-xl border border-border bg-card p-6">
                <UserAvatar name={user.name} image={user.image} className="size-16 text-lg" />
                <div className="min-w-0">
                    <p className="truncate text-lg font-medium">{user.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {user.isPro ? "Pro account" : "Free account"} · Joined{" "}
                        {formatLongDate(createdAt)}
                    </p>
                </div>
            </section>

            <section aria-labelledby="usage-heading">
                <h2 id="usage-heading" className="mb-4 text-lg font-semibold">
                    Usage
                </h2>

                <div className="grid grid-cols-2 gap-4">
                    <StatCard
                        label="Items"
                        value={totalItems}
                        icon={Boxes}
                        color={DASHBOARD_STAT_COLORS.items}
                    />
                    <StatCard
                        label="Collections"
                        value={totalCollections}
                        icon={Folder}
                        color={DASHBOARD_STAT_COLORS.collections}
                    />
                </div>

                {/* Every accessible type is listed, including the ones at zero — the breakdown is
                    meant to show the shape of a stash, and a missing row reads as a bug rather
                    than an empty category. Each links to that type's page. */}
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {itemTypeCounts.map((itemType) => (
                        <li key={itemType.id}>
                            <Link
                                href={`/items/${itemType.slug}`}
                                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
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
            </section>

            {/* Each section is named for the one thing it contains, rather than nesting a category
                heading over a single card. "Danger zone" was the alternative here and is idiomatic
                for developer *infrastructure* tools; the products this app takes its direction from
                (project-overview.md §8 — Notion, Linear, Raycast) name the action and let the
                destructive border carry the warning. */}
            <section aria-labelledby="password-heading" className="space-y-4">
                <h2 id="password-heading" className="text-lg font-semibold">
                    Password
                </h2>

                <div className="rounded-xl border border-border bg-card p-6">
                    {hasPassword ? (
                        <>
                            <p className="mb-4 text-sm text-muted-foreground">
                                Update the password you use to sign in to DevStash.
                            </p>
                            <ChangePasswordForm />
                        </>
                    ) : (
                        // Not an error and not something to fix — an OAuth-only account has no
                        // password by design. Saying only that one is absent reads as a missing
                        // feature, so this names the reason and where the credential actually
                        // lives, which is the only thing the user could act on.
                        <p className="text-sm text-muted-foreground">
                            You sign in with GitHub, so there&apos;s no DevStash password to manage.
                            Your sign-in credentials are managed by GitHub.
                        </p>
                    )}
                </div>
            </section>

            <section aria-labelledby="delete-heading" className="space-y-4">
                <h2 id="delete-heading" className="text-lg font-semibold">
                    Delete account
                </h2>

                <div className="rounded-xl border border-destructive/30 bg-card p-6">
                    <p className="mb-4 text-sm text-muted-foreground">
                        Once your account is deleted, it can&apos;t be recovered. Please be certain.
                    </p>
                    <DeleteAccountDialog
                        email={user.email}
                        itemCount={totalItems}
                        collectionCount={totalCollections}
                    />
                </div>
            </section>
        </div>
    );
}
