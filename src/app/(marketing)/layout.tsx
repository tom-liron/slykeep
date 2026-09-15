import { Mona_Sans } from "next/font/google";

import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { TYPE_COLOR_VARS } from "@/lib/type-color-vars";

/**
 * Mona Sans on `--font-display`, with the width axis the landing headlines expand along.
 *
 * Loaded here rather than in the root layout so the signed-in app never downloads it; the
 * `font-display` utility resolves only inside this shell.
 */
const monaSans = Mona_Sans({
    variable: "--font-display",
    subsets: ["latin"],
    axes: ["wdth"],
});

/**
 * The signed-out marketing shell: {@link MarketingNav}, the page, and {@link MarketingFooter}, with
 * no app chrome. Wraps `/welcome`, `/privacy` and `/terms`, and supplies the headline typeface
 * ({@link monaSans}) and the item-type colour variables to everything beneath it.
 *
 * @remarks
 * Follows the root layout's two scroll models. Below `md` the document scrolls, which is what lets a
 * phone browser collapse its toolbars on scroll; the anchor links glide there through the `html`
 * rule in `globals.css` keyed on `data-marketing-scroll`. From `md` up the body is pinned, so this
 * element becomes a viewport-high scroll container with its own `scroll-smooth`. `MarketingNav`
 * listens to both scrollers for the same reason.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div
            data-marketing-scroll
            style={TYPE_COLOR_VARS}
            className={`${monaSans.variable} min-h-dvh bg-background md:h-dvh md:overflow-y-auto md:scroll-smooth md:motion-reduce:scroll-auto`}
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
