import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UpgradePlans } from "@/components/billing/UpgradePlans";
import { TYPE_COLOR_VARS } from "@/lib/type-color-vars";
import { getCurrentUser } from "@/server/current-user";

export const metadata: Metadata = {
    title: "Upgrade · DevStash",
};

// Entitlement is read per request from the database; nothing here can be baked in at build time.
export const dynamic = "force-dynamic";

/**
 * The plan comparison for someone who is already signed in.
 *
 * It exists because the landing page's pricing cards are unreachable the moment you have an
 * account: `/welcome` is only ever served without a session, so the one place the product explains
 * what Pro costs disappears at exactly the point the user could buy it. Settings' billing panel
 * offers the two cycle buttons but no comparison — it answers "how do I pay" rather than "what am I
 * paying for".
 *
 * A Pro account is sent to the billing panel instead. There is nothing here for a subscriber: every
 * control would either be disabled or would open a second checkout for a plan they already hold,
 * whereas `/settings#billing` can actually do something for them — change the card, switch cycle,
 * cancel. Redirecting rather than rendering a "you're already Pro" page keeps one destination for
 * the question they are really asking.
 */
export default async function UpgradePage() {
    const { isPro } = await getCurrentUser();

    if (isPro) {
        redirect("/settings#billing");
    }

    return (
        // The item-type palette, the same way the marketing shell hands it down: the pricing cards
        // are built out of these colours, and they are runtime catalog values Tailwind cannot make
        // classes for.
        <div className="mx-auto max-w-3xl space-y-8" style={TYPE_COLOR_VARS}>
            <header className="space-y-2 text-center">
                <h1 className="text-2xl font-bold">Upgrade to Pro</h1>
                <p className="text-muted-foreground">
                    Unlimited items and collections, file and image uploads, AI features, and
                    export. Cancel any time.
                </p>
            </header>

            <UpgradePlans />
        </div>
    );
}
