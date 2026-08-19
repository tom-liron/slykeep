import { Check, X } from "lucide-react";

import type { BillingCycle, PricingPlan } from "@/config/marketing";

/**
 * One plan card: name, price for the chosen cycle, the feature list, and whatever the caller puts
 * at the bottom.
 *
 * **Shared between the marketing page and `/upgrade` on purpose.** Those two show the same two plans
 * to the same person either side of a sign-up, so they have to be the same object rather than two
 * that resemble each other — this file existing is what stops one of them drifting into a different
 * product. It was briefly two copies, and the copy immediately grew its own palette.
 *
 * `cta` is the seam, and it is the only real difference between the callers: the marketing card
 * links somewhere, because its reader has no session, while `/upgrade` runs a Server Action that
 * opens Stripe with the cycle already chosen. Everything above the button is identical, so
 * everything above the button lives here.
 *
 * Not a client component: it renders props and holds no state. The cycle is decided above it.
 *
 * Leans on `--type-prompt` / `--type-image`, which are runtime values from the item-type catalog —
 * Tailwind cannot generate classes for them, so an ancestor must supply them (`TYPE_COLOR_VARS`).
 */
export function PricingPlanCard({
    plan,
    cycle,
    cta,
}: {
    plan: PricingPlan;
    cycle: BillingCycle;
    cta: React.ReactNode;
}) {
    const price = plan.price[cycle];

    return (
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

            <h3 className="text-[1.3rem] font-semibold tracking-[-0.015em]">{plan.name}</h3>

            <p className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-[2.9rem] leading-none font-bold tracking-[-0.04em]">
                    {price.amount}
                </span>
                <span className="text-[0.88rem] text-zinc-400">{price.period}</span>
            </p>

            {/* Two lines' worth of room, always: the yearly note runs longer than the monthly one,
                and without a floor the Pro card grew a line the moment the switch was touched. */}
            <p className="mt-2 min-h-[3.2em] text-[0.85rem] text-muted-foreground">{price.note}</p>

            {/* `flex-1` is what pins both CTAs to the bottom of their cards however many lines the
                feature lists run to. */}
            <ul className="my-6 grid flex-1 content-start gap-2.5 border-t border-border pt-6 text-[0.9rem] text-muted-foreground">
                {plan.features.map((feature) => (
                    <li key={feature.label} className="flex items-start gap-2.5">
                        {feature.included ? (
                            <span
                                aria-hidden="true"
                                className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border border-[color-mix(in_srgb,var(--type-prompt)_40%,transparent)] bg-[color-mix(in_srgb,var(--type-prompt)_16%,transparent)] text-purple-300"
                            >
                                <Check className="size-2.5" strokeWidth={3} />
                            </span>
                        ) : (
                            // Tinted rose rather than left grey. The row it marks is the only thing
                            // on this card a reader is scanning *for* — what the cheaper plan does
                            // not include — and a neutral circle on a near-black card is the one
                            // element that disappeared into it. Rose at 12% is a signal, not an
                            // error state: the excluded label itself stays `muted-foreground`, so
                            // nothing here shouts.
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

            {cta}
        </article>
    );
}
