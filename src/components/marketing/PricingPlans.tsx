"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

import { Reveal } from "@/components/marketing/Reveal";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { Button } from "@/components/ui/button";
import { BILLING_CYCLES, PRICING_PLANS, type BillingCycle } from "@/config/marketing";

/**
 * The two plans, and the monthly/yearly switch above them.
 *
 * The cycle is the only state on the page that two things depend on — the switch and the Pro card's
 * price — so it lives here and the cards stay a single component rendered twice from config.
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
                        <div
                            role="group"
                            aria-label="Billing cycle"
                            className="mt-7 inline-flex gap-1 rounded-full border border-border bg-card p-1"
                        >
                            {BILLING_CYCLES.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    aria-pressed={cycle === option.value}
                                    onClick={() => setCycle(option.value)}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
                                >
                                    {option.label}
                                    {option.badge ? (
                                        <span className="rounded-full bg-[color-mix(in_srgb,var(--type-link)_16%,transparent)] px-1.5 py-px text-[0.68rem] font-bold text-emerald-300">
                                            {option.badge}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
                        </div>
                    </SectionHeading>
                </Reveal>

                <div className="mx-auto grid max-w-[860px] grid-cols-2 items-stretch gap-5 max-[680px]:grid-cols-1">
                    {PRICING_PLANS.map((plan) => {
                        const price = plan.price[cycle];

                        return (
                            <Reveal
                                key={plan.name}
                                // The second card follows the first in, while they are still side
                                // by side. Once they stack it leads instead, and a delay would only
                                // hold back the card the visitor is already looking at.
                                className={
                                    plan.featured
                                        ? "h-full max-[680px]:order-first min-[681px]:delay-[80ms]"
                                        : "h-full"
                                }
                            >
                                <article
                                    className={`relative flex h-full flex-col rounded-xl border p-7 ${
                                        plan.featured
                                            ? "border-[color-mix(in_srgb,var(--type-prompt)_45%,transparent)] shadow-[0_30px_70px_-50px_color-mix(in_srgb,var(--type-prompt)_90%,transparent)] [background-image:radial-gradient(100%_60%_at_50%_0%,color-mix(in_srgb,var(--type-prompt)_13%,transparent),transparent_70%),linear-gradient(180deg,var(--card),var(--background))]"
                                            : "border-border bg-linear-to-b from-card to-background"
                                    }`}
                                >
                                    {plan.featured ? (
                                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[linear-gradient(100deg,var(--type-prompt),var(--type-image))] px-3 py-0.5 text-[0.7rem] font-bold whitespace-nowrap text-white">
                                            Most Popular
                                        </span>
                                    ) : null}

                                    <h3 className="text-[1.3rem] font-semibold tracking-[-0.015em]">
                                        {plan.name}
                                    </h3>

                                    <p className="mt-2.5 flex items-baseline gap-1.5">
                                        <span className="text-[2.9rem] leading-none font-bold tracking-[-0.04em]">
                                            {price.amount}
                                        </span>
                                        <span className="text-[0.88rem] text-zinc-500">
                                            {price.period}
                                        </span>
                                    </p>

                                    {/* Two lines' worth of room, always: the yearly note runs longer
                                        than the monthly one, and without a floor the Pro card grew a
                                        line the moment the switch was touched. */}
                                    <p className="mt-2 min-h-[3.2em] text-[0.85rem] text-muted-foreground">
                                        {price.note}
                                    </p>

                                    {/* `flex-1` is what pins both CTAs to the bottom of their cards
                                        however many lines the feature lists run to. */}
                                    <ul className="my-6 grid flex-1 content-start gap-2.5 border-t border-border pt-6 text-[0.9rem] text-muted-foreground">
                                        {plan.features.map((feature) => (
                                            <li
                                                key={feature.label}
                                                className={`flex items-start gap-2.5 ${feature.included ? "" : "text-zinc-500"}`}
                                            >
                                                {feature.included ? (
                                                    <span
                                                        aria-hidden="true"
                                                        className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border border-[color-mix(in_srgb,var(--type-prompt)_40%,transparent)] bg-[color-mix(in_srgb,var(--type-prompt)_16%,transparent)] text-purple-300"
                                                    >
                                                        <Check
                                                            className="size-2.5"
                                                            strokeWidth={3}
                                                        />
                                                    </span>
                                                ) : (
                                                    <span
                                                        aria-hidden="true"
                                                        className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border border-border bg-white/5 text-zinc-500"
                                                    >
                                                        <X className="size-2.5" strokeWidth={3} />
                                                    </span>
                                                )}
                                                {feature.label}
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        asChild
                                        variant={plan.featured ? "default" : "outline"}
                                        className="h-9 w-full"
                                    >
                                        <Link href={plan.cta.href}>{plan.cta.label}</Link>
                                    </Button>
                                </article>
                            </Reveal>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
