import { Check, X } from "lucide-react";

import type { BillingCycle, PricingPlan } from "@/config/marketing";

/**
 * One plan card: name, price for the chosen cycle, the feature list, and a caller-supplied footer.
 *
 * Shared by the landing page's `PricingPlans` and the in-app `UpgradePlans`, so a visitor meets the
 * same card either side of sign-up rather than two that resemble each other. `cta` is the main
 * seam: the marketing card links (no session), `/upgrade` runs a Server Action that opens Stripe
 * with the cycle chosen. `cycleSwitch` is the other, carrying the billing switch into the Pro card
 * on narrow screens. Everything else lives here.
 *
 * A server component — it renders props and holds no state; the cycle is decided above it.
 *
 * @remarks
 * Uses `--type-prompt` / `--type-image` from the item-type catalog, which Tailwind cannot generate
 * classes for, so an ancestor must supply them (`TYPE_COLOR_VARS` in `lib/type-color-vars.ts`).
 */
export function PricingPlanCard({
    plan,
    cycle,
    cta,
    cycleSwitch,
}: {
    plan: PricingPlan;
    cycle: BillingCycle;
    cta: React.ReactNode;
    /**
     * Rendered between the plan name and the price. Callers pass the billing switch to the featured
     * card only, hidden at the widths where the switch above the cards shows instead.
     */
    cycleSwitch?: React.ReactNode;
}) {
    const price = plan.price[cycle];

    return (
        <article
            // Narrower side padding below 380px leaves the Pro card's full-width billing switch
            // room on the smallest phones.
            className={`relative flex h-full flex-col rounded-xl border p-7 max-[380px]:px-5 ${
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

            <h3 className="text-[1.3rem] font-semibold tracking-[-0.015em]">{plan.name}</h3>

            {cycleSwitch}

            <p className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-[2.9rem] leading-none font-bold tracking-[-0.04em]">
                    {price.amount}
                </span>
                <span className="text-[0.88rem] text-zinc-400">{price.period}</span>
            </p>

            {/* `min-h` for two lines, so the card does not grow a line when the switch flips
                between the shorter monthly note and the longer yearly one. */}
            <p className="mt-2 min-h-[3.2em] text-[0.85rem] text-muted-foreground">{price.note}</p>

            {/* `flex-1` pins both CTAs to the bottom of their cards whatever the list length. */}
            <div className="my-6 flex flex-1 flex-col border-t border-border pt-6">
                {/* Unconditional, so both feature lists start on a shared baseline and can be
                    compared row against row. On Pro it also carries the inheritance line, so that
                    list holds only the rows Free does not have. */}
                <p className="mb-4 text-[0.85rem] font-medium text-foreground">
                    {plan.featuresHeading}
                </p>

                <ul className="grid content-start gap-2.5 text-[0.9rem] text-muted-foreground">
                    {plan.features.map((feature) => (
                        <li key={feature.label} className="flex items-start gap-2.5">
                            {feature.included ? (
                                // Accented only on the featured card: neutral on Free, purple on
                                // Pro, so the two lists differ before a word is read. The tick
                                // already says "included", so colour is spent on the plan being
                                // sold.
                                <span
                                    aria-hidden="true"
                                    className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border ${
                                        plan.featured
                                            ? "border-[color-mix(in_srgb,var(--type-prompt)_40%,transparent)] bg-[color-mix(in_srgb,var(--type-prompt)_16%,transparent)] text-purple-300"
                                            : "border-foreground/25 bg-foreground/10 text-foreground/75"
                                    }`}
                                >
                                    <Check className="size-2.5" strokeWidth={3} />
                                </span>
                            ) : (
                                // Tinted rose, not grey: an excluded row is what a reader scans a
                                // cheaper plan *for*, and a neutral circle on a near-black card
                                // vanishes. Rose at 12% is a signal, not an error state — the label
                                // stays `muted-foreground`.
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border border-rose-500/30 bg-rose-500/12 text-rose-300"
                                >
                                    <X className="size-2.5" strokeWidth={3} />
                                </span>
                            )}
                            {feature.label}
                        </li>
                    ))}
                </ul>
            </div>

            {cta}
        </article>
    );
}
