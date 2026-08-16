import { MarketingNav } from "@/components/marketing/MarketingNav";

/**
 * The signed-out shell: the marketing bar and a centered card, no sidebar.
 *
 * `(auth)` is a route group, so it adds nothing to the URL — these pages are `/sign-in`,
 * `/register`, `/forgot-password`, and `/reset-password`. It exists to give the signed-out routes
 * their own layout without nesting them under the dashboard chrome.
 *
 * All four get the bar, not just the two the visitor arrives on from the marketing page. They share
 * this layout, and a password-reset page that suddenly loses the brand and the way back to `/` reads
 * as a different site. The bar replaces the bare `<Brand />` that used to sit above the card — it
 * carries the same lockup, plus somewhere to go.
 *
 * The nav sits *outside* the centering wrapper on purpose. Both used to be children of one
 * `justify-center` column, which would now center the bar and the card together as a group and
 * leave the bar floating in the middle of the screen.
 *
 * `justify-center` centers a short form at every width. What differs is where a *tall* one goes —
 * the register form with three field errors showing, on a landscape phone.
 *
 * Below `md` the body scrolls, so `min-h-dvh` alone is right: the box grows past the screen and the
 * document takes over. That is the point — the sign-in page is the first thing a new phone visitor
 * sees, and it should behave like a page rather than a pane.
 *
 * From `md` up the body is still pinned and hides its overflow, so a box that grows past the screen
 * is a box that gets clipped with nothing left to scroll it. Hence `md:h-dvh md:overflow-y-auto`:
 * pinned to the screen and scrolling itself, which is what this always did. The wrapper takes
 * `flex-1` so it fills whatever the 64px bar leaves and centers the card inside that, and it keeps
 * its automatic minimum height, so a form taller than the space available grows and hands the
 * overflow to whichever of the two is scrolling.
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
