import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The landing page's gold call to action — "Get Started Free" in the hero and the closing section.
 *
 * A wrapper around {@link Button}'s default variant, which already paints the brand gold with dark
 * text. It adds only what the signed-in app never uses: the larger rounded shape, a lift on hover,
 * and a gold glow beneath.
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
            className={cn(
                "h-11 rounded-xl px-6 text-base font-medium shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--primary)_90%,transparent)] hover:-translate-y-px",
                className,
            )}
        >
            <Link href={href}>{children}</Link>
        </Button>
    );
}
