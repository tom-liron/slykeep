"use client";

import { BILLING_CYCLES, type BillingCycle } from "@/config/marketing";

/**
 * The monthly/yearly switch above the plan cards.
 *
 * Controlled rather than self-owning, because the cycle is not this control's state: the price on
 * every card depends on it, so it belongs to whichever component holds the cards. Both callers
 * happen to keep it in a `useState`, but the marketing page and `/upgrade` do different things with
 * it — one only re-renders a price, the other also decides which Stripe Price is bought.
 */
export function BillingCycleToggle({
    value,
    onChange,
}: {
    value: BillingCycle;
    onChange: (cycle: BillingCycle) => void;
}) {
    return (
        <div
            role="group"
            aria-label="Billing cycle"
            className="inline-flex gap-1 rounded-full border border-border bg-card p-1"
        >
            {BILLING_CYCLES.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    // 32px under a mouse; the coarse-pointer padding takes it to the 44px floor
                    // `buttonVariants` applies everywhere else. Padding rather than a height, so the
                    // pressed pill grows with it.
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground pointer-coarse:py-3"
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
    );
}
