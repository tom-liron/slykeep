"use client";

import { useState } from "react";
import Link from "next/link";

import { Reveal } from "@/components/marketing/Reveal";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { BillingCycleToggle } from "@/components/pricing/BillingCycleToggle";
import { PricingPlanCard } from "@/components/pricing/PricingPlanCard";
import { Button } from "@/components/ui/button";
import { PRICING_PLANS, type BillingCycle } from "@/config/marketing";

/**
 * The two plans, and the monthly/yearly switch above them.
 *
 * The cycle is the only state on the page that two things depend on — the switch and the Pro card's
 * price — so it lives here and the cards stay a single component rendered twice from config.
 *
 * The cards themselves are `PricingPlanCard`, shared with `/upgrade` inside the app. What stays here
 * is the landing page's own furniture: the section, the heading with its eyebrow, and the `Reveal`
 * animations — none of which belongs on a short page inside a workspace. The card's `cta` is a link,
 * because this page's reader has no session yet.
 */
export function PricingPlans() {
    const [cycle, setCycle] = useState<BillingCycle>("monthly");

    return (
        <section id="pricing" className="scroll-mt-20 py-[clamp(4rem,9vw,7rem)]">
            <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))]">
                <Reveal>
                    <SectionHeading
                        eyebrow="Pricing"
                        title="Start free. Upgrade when it earns it."
                        sub="Everything you need to stop losing things is free. Pro is for when your stash becomes the thing you work out of."
                        className="mb-[clamp(2.5rem,5vw,3.5rem)]"
                    >
                        <div className="mt-7 inline-flex">
                            <BillingCycleToggle value={cycle} onChange={setCycle} />
                        </div>
                    </SectionHeading>
                </Reveal>

                <div className="mx-auto grid max-w-[860px] grid-cols-2 items-stretch gap-5 max-[680px]:grid-cols-1">
                    {PRICING_PLANS.map((plan) => (
                        <Reveal
                            key={plan.name}
                            // The second card follows the first in, while they are still side by
                            // side. Once they stack it leads instead, and a delay would only hold
                            // back the card the visitor is already looking at.
                            className={
                                plan.featured
                                    ? "h-full max-[680px]:order-first min-[681px]:delay-[80ms]"
                                    : "h-full"
                            }
                        >
                            <PricingPlanCard
                                plan={plan}
                                cycle={cycle}
                                cta={
                                    <Button
                                        asChild
                                        variant={plan.featured ? "default" : "outline"}
                                        className="h-9 w-full"
                                    >
                                        <Link href={plan.cta.href}>{plan.cta.label}</Link>
                                    </Button>
                                }
                            />
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
