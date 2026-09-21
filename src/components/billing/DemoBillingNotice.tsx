import { Info } from "lucide-react";

/**
 * The notice that SlyKeep's billing runs in Stripe test mode.
 *
 * Rendered on `/upgrade`, beneath the plan cards — the point where a signed-in reader is about to
 * start a checkout that cannot take a real payment. The landing page's price table leads to no
 * payment form, so it carries no notice; the Terms state the same fact for anyone reading before
 * they sign up. It sits after the cards so the caveat does not interrupt the comparison.
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
