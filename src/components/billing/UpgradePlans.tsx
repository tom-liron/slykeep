"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { startCheckout } from "@/actions/billing";
import { BillingCycleToggle } from "@/components/pricing/BillingCycleToggle";
import { PricingPlanCard } from "@/components/pricing/PricingPlanCard";
import { Button } from "@/components/ui/button";
import { PRICING_PLANS, type BillingCycle } from "@/config/marketing";

/**
 * The plan comparison, inside the app.
 *
 * The same `PricingPlanCard` the landing page renders — a visitor who read the pricing before
 * signing up meets the object they already saw, not a cousin of it. What this adds is the only thing
 * that actually differs once there is a session: the Pro card's button runs `startCheckout` and goes
 * straight to Stripe with the chosen cycle, where the marketing card can only link.
 *
 * The landing page's `Reveal` animations and section heading are deliberately absent. Nothing here
 * scrolls into view — the page is one screen inside a workspace.
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
                                // The reader is already on this plan, so the marketing card's "Get
                                // Started Free" would invite them to do what they have done.
                                // Disabled rather than absent, so both cards keep the same shape and
                                // the comparison stays a comparison.
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
