import { Brand } from "@/components/layout/Brand";

/**
 * The signed-out shell: brand and a centered card, no sidebar.
 *
 * `(auth)` is a route group, so it adds nothing to the URL — these pages are `/sign-in` and
 * `/register`. It exists to give the signed-out routes their own layout without nesting them under
 * the dashboard chrome.
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
 * pinned to the screen and scrolling itself, which is what this always did.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-10 md:h-dvh md:overflow-y-auto">
            <Brand />
            <main className="w-full max-w-sm">{children}</main>
        </div>
    );
}
