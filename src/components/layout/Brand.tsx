import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The SlyKeep wordmark and logo. Rendered in the top bar, the mobile drawer header, and the
 * marketing/auth bar.
 *
 * `href` is optional: with it, the lockup is a `<Link>`; without it, a plain label for a surface
 * where the brand is not a way out. `onNavigate` lets the mobile drawer close itself on the way,
 * like its nav links.
 *
 * @remarks
 * `compact` hides the wordmark below `sm`, leaving the mark alone — a phone shows the mark, not a
 * truncated word. Only the top bar sets it; every other surface has room for the full lockup.
 * `min-w-0` and `truncate` stay as a floor under call sites that do not control their row's width.
 */
export function Brand({
    href,
    onNavigate,
    compact = false,
}: {
    href?: string;
    onNavigate?: () => void;
    /** Hide the wordmark below `sm`, leaving the mark on its own. */
    compact?: boolean;
}) {
    const content = (
        <>
            {/* The fox mark. Literal colours rather than theme tokens: it is the logo, and it keeps
                the same geometry and colours as `app/icon.svg`, which the two must share. */}
            <svg viewBox="0 0 30 30" className="size-8 shrink-0" aria-hidden="true">
                <rect width="30" height="30" rx="8" fill="#F2B544" />
                <path d="M8 21V9.5l5 4.2h4l5-4.2V21l-7 3.2z" fill="#1D1405" />
            </svg>
            <span className={cn("truncate text-lg font-semibold", compact && "hidden sm:inline")}>
                SlyKeep
            </span>
        </>
    );

    if (!href) {
        return <div className="flex min-w-0 items-center gap-2">{content}</div>;
    }

    return (
        <Link
            href={href}
            onClick={onNavigate}
            // `-m-1.5 p-1.5` on a coarse pointer: 6px of padding makes the 32px mark a 44px
            // target, and the negative margin hands that space back to the layout so nothing
            // moves. Padding, not a bigger mark (its size is the logo's design) and not an
            // `::after` overhang (the hamburger is 8px away).
            className="flex min-w-0 items-center gap-2 rounded-lg transition-opacity pointer-coarse:-m-1.5 pointer-coarse:p-1.5 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            {content}
        </Link>
    );
}
