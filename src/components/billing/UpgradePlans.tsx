"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { startCheckout } from "@/actions/billing";
import { BillingCycleToggle } from "@/components/pricing/BillingCycleToggle";
import { PricingPlanCard } from "@/components/pricing/PricingPlanCard";
import { Button } from "@/components/ui/button";
import { PRICING_PLANS, type BillingCycle } from "@/config/marketing";

/**
 * The plan comparison on the signed-in `/upgrade` page.
 *
 * Renders the same {@link PricingPlanCard} as the landing page, so a visitor meets the card they
 * already saw. What it adds is the session-only difference: the Pro card's button runs
 * `startCheckout` and goes straight to Stripe with the chosen cycle, where the marketing card only
 * links. No section heading or `Reveal` animations — the page is one screen inside the app.
 */
export function UpgradePlans() {
    const [cycle, setCycle] = useState<BillingCycle>("monthly");
    const [pending, start] = useTransition();

    // Only ever returns on failure — success is a redirect to Stripe — so any value is an error.
    const upgrade = () =>
        start(async () => {
            const result = await startCheckout(cycle);
            if (result) toast.error(result.error);
        });

    return (
        <div className="space-y-8">
            <div className="flex justify-center">
                <BillingCycleToggle value={cycle} onChange={setCycle} />
            </div>

            <div className="grid items-stretch gap-5 sm:grid-cols-2">
                {PRICING_PLANS.map((plan) => (
                    <PricingPlanCard
                        key={plan.name}
                        plan={plan}
                        cycle={cycle}
                        cta={
                            plan.featured ? (
                                <Button onClick={upgrade} disabled={pending} className="h-9 w-full">
                                    {pending ? "Opening Stripe…" : plan.cta.label}
                                </Button>
                            ) : (
                                // The reader is already on the free plan. Disabled rather than
                                // absent, so both cards keep the same shape.
                                <Button variant="outline" className="h-9 w-full" disabled>
                                    Your current plan
                                </Button>
                            )
                        }
                    />
                ))}
            </div>
        </div>
    );
}
