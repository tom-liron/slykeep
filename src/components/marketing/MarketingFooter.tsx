import { Brand } from "@/components/layout/Brand";

const PRODUCT_LINKS = [
    { href: "#features", label: "Features" },
    { href: "#ai", label: "AI" },
    { href: "#pricing", label: "Pricing" },
];

/**
 * None of these have a page yet, so they render as muted text rather than links — the columns are
 * what give the footer its shape, and nothing on this page is allowed to point at a 404. Turn an
 * entry into an `<a>` the moment its page exists.
 */
const PLACEHOLDER_COLUMNS = [
    { heading: "Resources", labels: ["Docs", "Changelog", "Support"] },
    { heading: "Company", labels: ["About", "Privacy", "Terms"] },
];

export function MarketingFooter() {
    return (
        <footer className="border-t border-border bg-background pt-[clamp(2.5rem,5vw,3.5rem)] pb-8">
            <div className="mx-auto grid w-[min(1180px,calc(100%-2.5rem))] grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] gap-10 max-[860px]:grid-cols-1 max-[860px]:gap-8">
                <div>
                    <Brand href="/" />
                    <p className="mt-3.5 max-w-[320px] text-[0.88rem] text-zinc-400">
                        One fast, searchable hub for everything a developer needs to stash.
                    </p>
                </div>

                <nav aria-label="Footer" className="grid grid-cols-3 gap-6 max-[460px]:grid-cols-2">
                    <div className="grid content-start gap-2">
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

                    {PLACEHOLDER_COLUMNS.map((column) => (
                        <div key={column.heading} className="grid content-start gap-2">
                            <p className="text-[0.78rem] font-bold tracking-[0.06em] uppercase">
                                {column.heading}
                            </p>
                            {column.labels.map((label) => (
                                <span key={label} className="text-[0.88rem] text-zinc-400">
                                    {label}
                                </span>
                            ))}
                        </div>
                    ))}
                </nav>
            </div>

            <div className="mx-auto mt-10 flex w-[min(1180px,calc(100%-2.5rem))] flex-wrap justify-between gap-2 border-t border-border pt-6 text-[0.82rem] text-zinc-400">
                {/* Rendered on the server: a `new Date()` in the browser would disagree with the
                    markup that was sent, and this is a number nobody needs to the minute. */}
                <p>© {new Date().getFullYear()} DevStash. All rights reserved.</p>
                <p>Built for developers who are tired of looking for things.</p>
            </div>
        </footer>
    );
}
