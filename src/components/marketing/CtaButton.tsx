import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ITEM_TYPE_COLORS } from "@/config/item-type-catalog";
import { cn } from "@/lib/utils";

/**
 * The landing page's one blue call to action — "Get Started Free" in the hero and the closing
 * section.
 *
 * A wrapper around {@link Button} rather than a new `buttonVariants` entry, since nothing in the
 * signed-in app wants a coloured button. The colour is the snippet blue from `ITEM_TYPE_COLORS`,
 * passed as a `--cta` custom property so the fill, hover, and glow all mix off one value.
 *
 * @remarks
 * The fill is that blue darkened to ~85%: `#3b82f6` carries white at 3.68:1, under AA at this
 * size, and 85% against black measures ~4.9:1. It is mixed from the catalog value rather than
 * hardcoded so it cannot drift from the rest of the page's blue. The glow mixes off the undarkened
 * value, since a shadow carries no text.
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
