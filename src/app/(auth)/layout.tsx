import { MarketingNav } from "@/components/marketing/MarketingNav";

/**
 * The signed-out shell: the marketing bar above a centered card, no sidebar.
 *
 * `(auth)` is a route group, so it adds nothing to the URL — the pages beneath it are `/sign-in`,
 * `/register`, `/forgot-password`, `/reset-password` and `/verify-email`. All five get the
 * `MarketingNav` bar in its `auth` variant, so every one keeps the brand and a way back to `/`. The
 * bar sits outside the `justify-center` wrapper, which centers only the card.
 *
 * @remarks
 * `min-h-dvh` with `md:h-dvh md:overflow-y-auto` follows the two scroll models the root layout
 * sets: below `md` the document scrolls and the card grows past the screen; from `md` up this
 * element is pinned and scrolls itself, since the body's overflow is hidden there. The wrapper
 * takes `flex-1` to fill what the bar leaves and keeps its automatic minimum height, so a form
 * taller than the space available hands the overflow to whichever element is scrolling.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-dvh flex-col bg-background md:h-dvh md:overflow-y-auto">
            {/* The bar puts the brand, three section links, an action, and the menu toggle ahead of
                the email field in the tab order, which is exactly what a skip link is for. */}
            <a
                href="#main"
                className="sr-only z-100 rounded-br-md border border-border bg-muted px-4 py-2.5 focus:not-sr-only focus:absolute focus:top-0 focus:left-0"
            >
                Skip to content
            </a>

            <MarketingNav variant="auth" />

            <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
                <main id="main" className="w-full max-w-sm">
                    {children}
                </main>
            </div>
        </div>
    );
}
