import type { Metadata } from "next";

import { BillingPanelRows } from "@/components/settings/BillingPanelRows";
import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { EditorPreferencesRows } from "@/components/settings/EditorPreferencesRows";
import { Panel, PanelRow } from "@/components/ui/Panel";
import { getBillingSummary } from "@/server/billing";
import { getAccountSettings } from "@/server/profile";

export const metadata: Metadata = {
    title: "Settings · DevStash",
};

// The account is read per request from the session; nothing here can be baked in at build time.
export const dynamic = "force-dynamic";

/**
 * `/settings` — the account *actions*: billing, change password, delete account, and editor
 * preferences. The profile page is the read-only counterpart.
 *
 * A server component that reads once and passes view models down; the billing rows, the password
 * form, the delete confirmation and the editor rows are the only client components, and none
 * fetches.
 *
 * @remarks
 * The Billing panel is first because other surfaces link into it — the marketing Pro CTA and the
 * delete dialog's cancel route both land on `#billing` — and an anchor target that needs scrolling
 * to looks broken.
 */
export default async function SettingsPage({
    searchParams,
}: {
    // Stripe's own return URLs, and the only reason this page reads the query string: `success` here
    // can arrive before the webhook that grants Pro has landed, which the billing rows explain
    // rather than showing the account as still free.
    searchParams: Promise<{ checkout?: string }>;
}) {
    const [
        { email, hasPassword, subscriptionBlocksDeletion, totalItems, totalCollections },
        billing,
        { checkout },
    ] = await Promise.all([getAccountSettings(), getBillingSummary(), searchParams]);

    return (
        <div className="mx-auto max-w-3xl space-y-8">
            <header>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Manage your DevStash account.</p>
            </header>

            <Panel
                id="billing"
                title="Billing"
                description="Your plan, and everything about paying for it."
            >
                {/* The two totals are already in hand for the delete dialog's confirmation copy,
                    so the usage meters cost no extra query. */}
                <BillingPanelRows
                    billing={billing}
                    itemCount={totalItems}
                    collectionCount={totalCollections}
                    justCheckedOut={checkout === "success"}
                />
            </Panel>

            <Panel id="account" title="Account" description="Your sign-in and your data.">
                {hasPassword ? (
                    <PanelRow
                        title="Password"
                        description="Update the password you use to sign in to DevStash."
                    >
                        <ChangePasswordDialog />
                    </PanelRow>
                ) : (
                    // An OAuth-only account has no password. The row names the reason and where the
                    // credential lives rather than just stating an absence, and carries no control.
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
                        subscriptionBlocksDeletion={subscriptionBlocksDeletion}
                        itemCount={totalItems}
                        collectionCount={totalCollections}
                    />
                </PanelRow>
            </Panel>

            {/* No values are read for this panel: the preferences are already in the tree, supplied
                by the provider in the dashboard layout, because every editor in the app renders from
                them. The rows below are the only client component here, and they both read and
                write through that provider — there is no save button, each change is stored as it
                is made. */}
            <Panel
                id="editor"
                title="Item editor"
                description="Font, spacing and syntax colours for the editor you write item content in — in the drawer, and on the create and edit forms. Changes save as you make them."
            >
                <EditorPreferencesRows />
            </Panel>
        </div>
    );
}
