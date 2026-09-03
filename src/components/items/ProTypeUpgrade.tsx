import Link from "next/link";
import { Check } from "lucide-react";

import { TypeIcon } from "@/components/items/TypeIcon";
import { Button } from "@/components/ui/button";
import type { ItemTypeViewModel } from "@/types/view-models";

/**
 * The full-page upsell `/items/files` and `/items/images` render for an account without Pro.
 *
 * A server component that stands in for the item list on those two routes. The user reached the
 * page by name, so the answer is shown on it rather than as a redirect or a modal. Copy describes
 * what the feature does, not the refusal.
 *
 * @remarks
 * The only control links to `/upgrade` — the plan comparison — not to checkout or the billing
 * panel. Each surface has one job: this page answers "what would files give me", `/upgrade`
 * answers cost and cycle, and checkout stays a rate-limited Server Action reached from one place.
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
        <div className="mx-auto max-w-2xl space-y-6 py-2 text-center">
            <div className="space-y-4">
                {/* Tinted with the type's own colour, so the page reads as this type's page rather
                    than a generic paywall. */}
                <span
                    className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-card"
                    style={{ color: itemType.color }}
                >
                    <TypeIcon name={itemType.icon} className="size-7" aria-hidden="true" />
                </span>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">{itemType.label} are a Pro feature</h1>
                    {/* Fixed one-line subtitle, no reserved height: only one of these two strings
                        ever renders, and both fit one line at this width. */}
                    <p className="text-muted-foreground">
                        {isImages
                            ? "Stash images alongside your snippets and prompts, and find them the same way."
                            : "Stash the files your projects depend on, and find them the same way."}
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
                    $8 a month, or $72 a year — save 25%. Cancel any time.
                </p>
            </div>
        </div>
    );
}
