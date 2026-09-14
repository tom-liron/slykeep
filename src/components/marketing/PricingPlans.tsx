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
 * The landing page's pricing section: the monthly/yearly switch and the two plan cards from
 * `PRICING_PLANS`.
 *
 * One of the sections composed by the `/welcome` page. Holds the `cycle` state that the
 * {@link BillingCycleToggle} and the Pro card's price both depend on. The cards are
 * {@link PricingPlanCard}, shared with `/upgrade`; this adds the landing page's own section,
 * heading, and {@link Reveal} animations, and passes a `<Link>` as the `cta` since the reader has
 * no session.
 */
export function PricingPlans() {
    const [cycle, setCycle] = useState<BillingCycle>("monthly");

    return (
        <section id="pricing" className="scroll-mt-20 py-[clamp(3rem,6vw,4.5rem)]">
            <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))]">
                <Reveal>
                    <SectionHeading
                        eyebrow="Pricing"
                        title="Start free. Upgrade when it earns it."
                        sub="Free holds a working library of 50 items. Pro lifts the limits and adds files, images and AI."
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
                            // The featured card follows the first in while side by side, and leads
                            // (no delay) once they stack.
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
