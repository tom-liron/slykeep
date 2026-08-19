import Link from "next/link";
import { Check } from "lucide-react";

import { TypeIcon } from "@/components/items/TypeIcon";
import { Button } from "@/components/ui/button";
import type { ItemTypeViewModel } from "@/types/view-models";

/**
 * What `/items/files` and `/items/images` show an account that does not have Pro.
 *
 * A server component, and deliberately not a dialog or a redirect to `/settings`: the user asked for
 * this page by name, so the answer belongs on it. Bouncing them to billing would lose what they were
 * looking for, and a modal over an empty list would imply the list is theirs to see.
 *
 * The copy is about the feature rather than about the refusal. "Files require Pro" states a rule;
 * naming what uploads actually do is the only part a person can decide anything from — which is the
 * same reason `DeleteAccountDialog` routes a subscriber to the portal instead of stopping at "you
 * can't".
 *
 * The only control is a link to `/upgrade`, not to checkout and not to the billing panel. The split
 * is what each page is for: this one answers "what would files give me", `/upgrade` answers "what
 * does it cost and which cycle", and Stripe takes the money. Sending this button straight to the
 * billing panel skipped the comparison for someone who has just started wondering whether Pro is
 * worth it, and sending it straight to checkout would ask them to pay before they had seen a price.
 *
 * Checkout itself stays a Server Action behind a rate limit in one place, rather than being
 * reachable from every locked page in the app.
 */
export function ProTypeUpgrade({ itemType }: { itemType: ItemTypeViewModel }) {
    const isImages = itemType.name === "image";

    const benefits = isImages
        ? [
              "Upload screenshots, diagrams, and design references",
              "Browse them as a thumbnail gallery",
              "Keep them in collections beside the code they belong to",
          ]
        : [
              "Upload context files, configs, and documents",
              "Keep the original filename, size, and upload date",
              "Download them again from any machine you are signed in on",
          ];

    return (
        <div className="mx-auto max-w-2xl space-y-8 py-8 text-center">
            <div className="space-y-4">
                {/* Tinted with the type's own colour, so the page still reads as *this* type's page
                    rather than as a generic paywall that could belong to anything. */}
                <span
                    className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-card"
                    style={{ color: itemType.color }}
                >
                    <TypeIcon name={itemType.icon} className="size-7" aria-hidden="true" />
                </span>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">{itemType.label} are a Pro feature</h1>
                    <p className="text-muted-foreground">
                        {isImages
                            ? "Stash images alongside your snippets and prompts, and find them the same way."
                            : "Stash the files your projects depend on, and find them the same way you find everything else."}
                    </p>
                </div>
            </div>

            <ul className="mx-auto w-fit space-y-3 text-left">
                {benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-3 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span>{benefit}</span>
                    </li>
                ))}
            </ul>

            <div className="space-y-3">
                <Button asChild size="lg">
                    <Link href="/upgrade">See plans</Link>
                </Button>
                <p className="text-sm text-muted-foreground">
                    $8 a month, or $72 a year — two months free. Cancel any time.
                </p>
            </div>
        </div>
    );
}
