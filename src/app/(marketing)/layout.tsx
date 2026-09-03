import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { TYPE_COLOR_VARS } from "@/lib/type-color-vars";

/**
 * The signed-out marketing shell: `MarketingNav`, the page, and `MarketingFooter`, with no app
 * chrome. Wraps `/welcome`.
 *
 * This element is its own scroll container, because the root layout pins the body from `md` up and
 * a marketing page still has to scroll something. Two things depend on that: the anchor links
 * scroll this element (`scroll-smooth` here, `scroll-mt-*` on the section ids), and `MarketingNav`
 * reads its scroll position from this element rather than from `window`.
 *
 * @remarks
 * `h-dvh`, not `h-full`: below `md` the body is not a fixed height, so `height: 100%` would resolve
 * to `auto`, this element would grow to its content, and `overflow-y-auto` would never fire — the
 * anchors would jump instead of glide and the nav would never see a scroll event. A
 * viewport-relative height keeps the container definite at every width.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div
            data-marketing-scroll
            style={TYPE_COLOR_VARS}
            className="h-dvh overflow-y-auto scroll-smooth bg-background motion-reduce:scroll-auto"
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
