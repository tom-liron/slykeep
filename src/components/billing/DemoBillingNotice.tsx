import { Info } from "lucide-react";

/**
 * The notice that SlyKeep's billing runs in Stripe test mode.
 *
 * Rendered on `/upgrade`, beneath the plan cards — the point where a signed-in reader is about to
 * start a checkout that cannot take a real payment. That is the surface the disclosure is owed on;
 * the landing page deliberately does without it, since a price table reaches no payment form (the
 * Pro call to action leads to `/settings#billing`, behind authentication) and Stripe hosts the card
 * fields on its own domain. The Terms carry the same fact in prose for anyone reading before they
 * sign up.
 *
 * It sits after the cards rather than before them: the plans are what the page is for, and a caveat
 * above them interrupts the comparison before it has been read.
 *
 * Remove it if and when live Stripe keys are configured — along with the matching paragraph in
 * `/terms`.
 */
export function DemoBillingNotice() {
    return (
        <p className="mx-auto flex max-w-[560px] items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-[0.85rem] text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
                <strong className="font-medium text-foreground">Demo project.</strong> SlyKeep is a
                portfolio app — billing runs in Stripe test mode, so no real payment is taken and no
                card is ever charged.
            </span>
        </p>
    );
}
