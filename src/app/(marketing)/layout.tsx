import type { CSSProperties } from "react";

import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { ITEM_TYPE_COLORS } from "@/config/item-type-catalog";

/**
 * The item-type palette, handed to the page as custom properties.
 *
 * The marketing page is built out of these colours — the headline gradient, the hero glow, the
 * accents on the panels and cards — and they are runtime values from the catalog, which Tailwind
 * cannot generate classes for. Declaring them once here is what keeps every section referencing
 * `var(--type-prompt)` instead of retyping `#8b5cf6`.
 */
const typeColorVars = Object.fromEntries(
    Object.entries(ITEM_TYPE_COLORS).map(([name, color]) => [`--type-${name}`, color]),
) as CSSProperties;

/**
 * The signed-out marketing shell: no sidebar, no app chrome.
 *
 * This owns its own scroll container. The root layout pins the body to the viewport and hides its
 * overflow, because the app shell scrolls its own main pane — a marketing page has to scroll
 * something, and changing the body would give the app two nested scrollbars. Two things follow from
 * that and are easy to get wrong: the anchor links scroll *this* element (hence `scroll-smooth`
 * here and `scroll-mt-*` on the section ids), and `MarketingNav` listens to it for scroll position
 * rather than to `window`, which never scrolls at all.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div
            data-marketing-scroll
            style={typeColorVars}
            className="h-full overflow-y-auto scroll-smooth bg-background motion-reduce:scroll-auto"
        >
            <a
                href="#main"
                className="sr-only z-100 rounded-br-md border border-border bg-muted px-4 py-2.5 focus:not-sr-only focus:absolute focus:top-0 focus:left-0"
            >
                Skip to content
            </a>

            <MarketingNav />
            <main id="main">{children}</main>
            <MarketingFooter />
        </div>
    );
}
