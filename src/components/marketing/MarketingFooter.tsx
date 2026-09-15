import Link from "next/link";

import { Brand } from "@/components/layout/Brand";

/**
 * The landing page's footer: the {@link Brand} lockup, the in-page Product nav, and the Company
 * column of written pages.
 *
 * One of the sections composed by the `/welcome` page.
 */

const PRODUCT_LINKS = [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
];

/**
 * The Company column: the site's written pages, each a route rather than an in-page jump.
 *
 * Every entry points at a page that exists. A link with nowhere to go does not belong here — a
 * footer advertising documentation and support that were never built reads as a mockup, which is
 * the opposite of what these pages are for.
 */
const COMPANY_LINKS = [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
];

export function MarketingFooter() {
    return (
        <footer className="border-t border-border bg-background pt-[clamp(2.5rem,5vw,3.5rem)] pb-8">
            <div className="mx-auto grid w-[min(1180px,calc(100%-2.5rem))] grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] gap-10 max-[860px]:grid-cols-1 max-[860px]:gap-8">
                <div>
                    <Brand href="/" />
                    <p className="mt-3.5 max-w-[320px] text-[0.88rem] text-muted-foreground">
                        A searchable library for the snippets, prompts and commands developers keep.
                    </p>
                </div>

                {/* Flex, not a two-column grid: equal grid tracks would push Product and Company
                    to opposite ends of the nav area now that there are only two of them. Sized by
                    their content and anchored right, they stay adjacent and the column keeps the
                    right edge it had when there were three. */}
                <nav
                    aria-label="Footer"
                    className="flex flex-wrap justify-end gap-x-16 gap-y-8 max-[860px]:justify-start"
                >
                    <div className="grid min-w-[7rem] content-start gap-2">
                        <p className="text-[0.78rem] font-bold tracking-[0.06em] uppercase">
                            Product
                        </p>
                        {PRODUCT_LINKS.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                // 21px tall with 8px between them: the tightest touch targets on the
                                // page, and three links stacked close enough that the wrong one is
                                // easy to hit. The floor only applies on a coarse pointer, so the
                                // desktop footer keeps its density.
                                className="flex items-center text-[0.88rem] text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-11"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>

                    <div className="grid min-w-[7rem] content-start gap-2">
                        <p className="text-[0.78rem] font-bold tracking-[0.06em] uppercase">
                            Company
                        </p>
                        {COMPANY_LINKS.map((link) => (
                            // `next/link`, unlike the Product column's plain anchors: those are
                            // in-page jumps, these leave the page for a route.
                            <Link
                                key={link.href}
                                href={link.href}
                                className="flex items-center text-[0.88rem] text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-11"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </nav>
            </div>

            <div className="mx-auto mt-10 flex w-[min(1180px,calc(100%-2.5rem))] flex-wrap justify-between gap-2 border-t border-border pt-6 text-[0.82rem] text-muted-foreground">
                {/* Rendered on the server: a `new Date()` in the browser would disagree with the
                    markup that was sent, and this is a number nobody needs to the minute. */}
                <p>© {new Date().getFullYear()} SlyKeep. All rights reserved.</p>
                <p>Save it once. Find it in seconds.</p>
            </div>
        </footer>
    );
}
