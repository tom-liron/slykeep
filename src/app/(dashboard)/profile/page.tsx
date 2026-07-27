import type { Metadata } from "next";

import { UserAvatar } from "@/components/ui/UserAvatar";
import { getCurrentUser } from "@/server/current-user";

export const metadata: Metadata = {
    title: "Profile · DevStash",
};

// The user is read per request from the session; nothing here can be baked in at build time.
export const dynamic = "force-dynamic";

/**
 * A read-only account summary — the destination for the sidebar menu's Profile link.
 *
 * Deliberately minimal. The spec asks for the link to go somewhere real, and a stub beats pointing
 * a shipped menu item at a 404. Editing, avatar upload, and billing belong with the planned
 * `settings/` route, not here.
 */
export default async function ProfilePage() {
    const user = await getCurrentUser();

    return (
        <div className="mx-auto max-w-2xl space-y-8">
            <header>
                <h1 className="text-2xl font-bold">Profile</h1>
                <p className="text-muted-foreground">Your account details</p>
            </header>

            <section className="flex items-center gap-4 rounded-xl border border-border p-6">
                <UserAvatar name={user.name} image={user.image} className="size-16 text-lg" />
                <div className="min-w-0">
                    <p className="truncate text-lg font-medium">{user.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {user.isPro ? "Pro account" : "Free account"}
                    </p>
                </div>
            </section>

            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Account settings and billing are coming soon.
            </p>
        </div>
    );
}
