import type { Metadata } from "next";

import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { Panel, PanelRow } from "@/components/ui/Panel";
import { getAccountSettings } from "@/server/profile";

export const metadata: Metadata = {
    title: "Settings · DevStash",
};

// The account is read per request from the session; nothing here can be baked in at build time.
export const dynamic = "force-dynamic";

/**
 * Settings: the things you can *do* to the account, as opposed to the profile page, which is a
 * read-only account of what is in it.
 *
 * A server component that reads once and passes view models down — the password form and the delete
 * confirmation are the only client components, and neither fetches.
 *
 * One panel for now. Billing and export are the next two, and each becomes another `Panel` rather
 * than another loose card.
 */
export default async function SettingsPage() {
    const { email, hasPassword, totalItems, totalCollections } = await getAccountSettings();

    return (
        <div className="mx-auto max-w-3xl space-y-8">
            <header>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Manage your DevStash account.</p>
            </header>

            <Panel id="account" title="Account" description="Your sign-in and your data.">
                {hasPassword ? (
                    <PanelRow
                        title="Password"
                        description="Update the password you use to sign in to DevStash."
                    >
                        <ChangePasswordDialog />
                    </PanelRow>
                ) : (
                    // Not an error and not something to fix — an OAuth-only account has no password
                    // by design. Saying only that one is absent reads as a missing feature, so this
                    // names the reason and where the credential actually lives, which is the only
                    // thing the user could act on. No control, so the row is copy alone.
                    <PanelRow
                        title="Password"
                        description="You sign in with GitHub, so there's no DevStash password to manage. Your sign-in credentials are managed by GitHub."
                    />
                )}

                {/* Last in the panel, which is where a destructive action belongs: nothing below it
                    to reach past on the way to something harmless. */}
                <PanelRow
                    title="Delete account"
                    description="Once your account is deleted, it can't be recovered. Please be certain."
                    tone="destructive"
                >
                    <DeleteAccountDialog
                        email={email}
                        itemCount={totalItems}
                        collectionCount={totalCollections}
                    />
                </PanelRow>
            </Panel>
        </div>
    );
}
