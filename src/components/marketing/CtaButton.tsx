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
 * The colour is a runtime value from the catalog, so it arrives as a custom property and the hover
 * and shadow are mixed off it — that keeps the hex in exactly one place.
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
                "h-11 rounded-xl bg-[var(--cta)] px-6 text-base font-medium text-white shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--cta)_90%,transparent)] hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--cta)_88%,black)]",
                className,
            )}
        >
            <Link href={href}>{children}</Link>
        </Button>
    );
}
