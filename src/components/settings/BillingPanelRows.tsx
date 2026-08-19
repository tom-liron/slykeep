"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { openBillingPortal, startCheckout } from "@/actions/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelRow } from "@/components/ui/Panel";
import type { BillingCycle } from "@/config/marketing";
import { formatLongDate } from "@/lib/format";
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from "@/lib/limits";
import { cn } from "@/lib/utils";
import type { BillingViewModel } from "@/types/view-models";

/**
 * How long to wait before re-reading the page after a successful checkout that the webhook has not
 * caught up with yet. Long enough that Stripe has almost always delivered by then, short enough that
 * nobody is left reading "being confirmed" and wondering.
 */
const WEBHOOK_GRACE_MS = 3000;

/**
 * The billing panel's rows: which plan this account is on, what it is using, and the control that
 * changes it.
 *
 * The rows rather than the whole panel, so `Panel` stays where it is — drawn by the page as a server
 * component, with only the controls inside it crossing to the client. The same split
 * `EditorPreferencesRows` uses.
 *
 * Two rows in both states, deliberately symmetrical: the plan, then the usage. The plan's *name* is
 * a badge rather than the row's heading, because "Free" and "Pro" are a value that changes while
 * "Current plan" is the label that does not — a heading that reads "Free plan" one day and "Pro —
 * annual" the next is a heading doing a value's job, and it gives the eye nothing fixed to find.
 *
 * Both actions redirect to Stripe on success, so neither returns anything on the happy path — a
 * result only ever arrives when something failed, which is why the handlers below toast on *any*
 * returned value rather than checking `success`.
 */
export function BillingPanelRows({
    billing,
    itemCount,
    collectionCount,
    justCheckedOut,
}: {
    billing: BillingViewModel;
    itemCount: number;
    collectionCount: number;
    justCheckedOut: boolean;
}) {
    const [pending, start] = useTransition();
    const router = useRouter();

    // Coming back from a successful checkout before the webhook has landed is the one genuine race
    // in this flow: Stripe redirects the browser and delivers the event independently, so the
    // settings page can render from a row that is still `isPro: false`. One delayed re-read fixes
    // it, and the ref keeps it to one — `router.refresh()` re-renders this component rather than
    // remounting it, so the ref survives and a still-missing webhook does not become a poll.
    const refreshed = useRef(false);
    const awaitingWebhook = justCheckedOut && !billing.isPro;

    useEffect(() => {
        if (!awaitingWebhook || refreshed.current) return;

        const timer = setTimeout(() => {
            refreshed.current = true;
            router.refresh();
        }, WEBHOOK_GRACE_MS);

        return () => clearTimeout(timer);
    }, [awaitingWebhook, router]);

    const upgrade = (cycle: BillingCycle) =>
        start(async () => {
            const result = await startCheckout(cycle);
            if (result) toast.error(result.error);
        });

    const manage = () =>
        start(async () => {
            const result = await openBillingPortal();
            if (result) toast.error(result.error);
        });

    if (awaitingWebhook) {
        return (
            <PanelRow
                title="Your upgrade is being confirmed…"
                description="Payment went through. Stripe is letting us know, which takes a few seconds — this page will update itself."
            />
        );
    }

    return (
        <>
            <PanelRow
                title={
                    <span className="flex items-center gap-2">
                        Current plan
                        <Badge variant={billing.isPro ? "default" : "secondary"}>
                            {billing.isPro ? planLabel(billing.cycle) : "Free"}
                        </Badge>
                    </span>
                }
                description={planDescription(billing)}
            >
                {billing.isPro ? (
                    <Button
                        variant="outline"
                        onClick={manage}
                        disabled={pending}
                        className="shrink-0"
                    >
                        Manage subscription
                    </Button>
                ) : (
                    <div className="flex shrink-0 gap-2">
                        <Button
                            variant="outline"
                            onClick={() => upgrade("monthly")}
                            disabled={pending}
                        >
                            $8 / month
                        </Button>
                        <Button onClick={() => upgrade("yearly")} disabled={pending}>
                            $72 / year
                        </Button>
                    </div>
                )}
            </PanelRow>

            <PanelRow
                title="Usage"
                description={
                    billing.isPro
                        ? "Pro lifts every cap — this is what you have stashed so far."
                        : "What you have stashed, against what the Free plan holds."
                }
            >
                {/* Fixed width so the two meters' bars and numbers line up as a column rather than
                    sizing themselves to their own labels. */}
                <div className="w-full shrink-0 space-y-3 sm:w-56">
                    <UsageMeter
                        label="Items"
                        used={itemCount}
                        limit={billing.isPro ? null : FREE_ITEM_LIMIT}
                    />
                    <UsageMeter
                        label="Collections"
                        used={collectionCount}
                        limit={billing.isPro ? null : FREE_COLLECTION_LIMIT}
                    />
                </div>
            </PanelRow>
        </>
    );
}

/**
 * One "23 / 50" line and its bar.
 *
 * `limit === null` is the Pro case: there is no denominator to show and no proportion to draw, so it
 * says "Unlimited" and the track stays empty rather than rendering a bar that is always full or
 * always empty and means neither.
 *
 * The bar is `aria-hidden` and the numbers are not: the text already states the whole fact, so a
 * screen reader gets it once rather than once as prose and once as a percentage.
 */
function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
    const atLimit = limit !== null && used >= limit;
    const ratio = limit === null ? 0 : Math.min(used / limit, 1);

    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className={cn("font-medium tabular-nums", atLimit && "text-destructive")}>
                    {limit === null ? (
                        <>
                            {used} <span className="text-muted-foreground">· Unlimited</span>
                        </>
                    ) : (
                        <>
                            {used}{" "}
                            <span className="text-muted-foreground">
                                / {limit} {/* the allowance, not a target */}
                            </span>
                        </>
                    )}
                </span>
            </div>

            <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                    className={cn(
                        "h-full rounded-full transition-[width]",
                        atLimit ? "bg-destructive" : "bg-primary",
                    )}
                    style={{ width: `${ratio * 100}%` }}
                />
            </div>
        </div>
    );
}

/** "Pro" alone until the cycle is known, so an unrecognized price never renders a blank badge. */
function planLabel(cycle: BillingCycle | null): string {
    if (cycle === "yearly") return "Pro · Annual";
    if (cycle === "monthly") return "Pro · Monthly";

    return "Pro";
}

/**
 * The line under the plan heading.
 *
 * A cancelled subscription keeps its date and keeps entitling until that date, so the same value
 * means two opposite things — "Renews on" would be telling someone who has already left that they
 * are about to be charged again.
 */
function planDescription(billing: BillingViewModel): string {
    if (!billing.isPro) {
        return "Upgrade for unlimited items and collections, file and image uploads, AI features, and export. $8 a month, or $72 a year — two months free. Cancel any time.";
    }

    if (!billing.currentPeriodEnd) return "Change your plan, update your card, or cancel.";

    const date = formatLongDate(billing.currentPeriodEnd);

    return billing.cancelAtPeriodEnd
        ? `Cancelled — your Pro access ends on ${date}.`
        : `Renews on ${date}.`;
}
