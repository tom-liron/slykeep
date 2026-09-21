"use client";

import { BILLING_CYCLES, type BillingCycle } from "@/config/marketing";
import { cn } from "@/lib/utils";

/**
 * The monthly/yearly switch for the plan cards.
 *
 * Controlled rather than self-owning, because the cycle is not this control's state: the price on
 * every card depends on it, so it belongs to whichever component holds the cards. Both callers
 * happen to keep it in a `useState`, but the marketing page and `/upgrade` do different things with
 * it — one only re-renders a price, the other also decides which Stripe Price is bought.
 *
 * Both callers render it twice from that one state: above the cards while they sit side by side,
 * and `fullWidth` inside the Pro card once they stack, so the switch stays beside the price it
 * changes.
 */
export function BillingCycleToggle({
    value,
    onChange,
    fullWidth = false,
    className,
}: {
    value: BillingCycle;
    onChange: (cycle: BillingCycle) => void;
    /**
     * Stretches the switch across a card. Each option grows from its own content width rather than
     * taking an equal share, and may shrink below it: the badge then drops whole onto its own line
     * beneath the label instead of pushing the option out of the switch.
     *
     * @remarks
     * Everything here is sized in `rem`, so a visitor's raised browser font size enlarges the switch
     * while the card's width stays fixed by the screen. The wrap is what keeps it inside the card
     * then, on a 320px screen as much as a 344px one.
     */
    fullWidth?: boolean;
    /** Spacing and the breakpoint at which this copy shows. */
    className?: string;
}) {
    return (
        <div
            role="group"
            aria-label="Billing cycle"
            className={cn(
                "inline-flex gap-1 rounded-full border border-border bg-card p-1",
                fullWidth && "flex w-full",
                className,
            )}
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
                    className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-[0.85rem] whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground pointer-coarse:py-3",
                        fullWidth && "min-w-0 flex-auto flex-wrap justify-center gap-1 px-2.5",
                    )}
                >
                    {option.label}
                    {option.badge ? (
                        // One line, at every width, so the badge keeps its pill shape. When it no
                        // longer fits beside the label, the button's own `flex-wrap` drops it whole
                        // onto the next line.
                        <span
                            className={cn(
                                "rounded-full bg-confirm/16 px-1.5 py-px text-[0.68rem] font-bold text-confirm",
                                fullWidth && "px-2 py-0.5",
                            )}
                        >
                            {option.badge}
                        </span>
                    ) : null}
                </button>
            ))}
        </div>
    );
}
