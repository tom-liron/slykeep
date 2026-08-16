import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ITEM_TYPE_COLORS } from "@/config/item-type-catalog";
import { cn } from "@/lib/utils";

/**
 * The page's one blue call to action — the hero's and the closing section's "Get Started Free".
 *
 * Blue rather than the shared white `default` so the single action the page is asking for is the
 * item-type blue everything else on it is built from. It is a wrapper here rather than a new
 * `buttonVariants` entry because nothing in the signed-in app wants a coloured button, and a
 * variant that exists for one page is a variant everyone else has to read past.
 *
 * The colour is a runtime value from the catalog, so it arrives as a custom property and the fill,
 * hover, and shadow are all mixed off it — that keeps the hex in exactly one place.
 *
 * The fill is the catalog blue darkened rather than the blue itself. `#3b82f6` carries white at
 * 3.68:1, under the 4.5:1 AA needs at this size, and this is the one button the page exists to get
 * clicked; 85% of it against black measures ~4.9:1. Mixed rather than hardcoded as a second hex,
 * because `ITEM_TYPE_COLORS.snippet` is what makes this button the same blue as everything else on
 * the page — a literal here would drift from the catalog the first time the catalog moved. The glow
 * still mixes off the undarkened value, since a shadow carries no text.
 */
export function CtaButton({
    href,
    className,
    children,
}: {
    href: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <Button
            asChild
            style={{ "--cta": ITEM_TYPE_COLORS.snippet } as React.CSSProperties}
            className={cn(
                "h-11 rounded-xl bg-[color-mix(in_srgb,var(--cta)_85%,black)] px-6 text-base font-medium text-white shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--cta)_90%,transparent)] hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--cta)_74%,black)]",
                className,
            )}
        >
            <Link href={href}>{children}</Link>
        </Button>
    );
}
