import Link from "next/link";
import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * DevStash wordmark + logo. Lives in the top bar, the mobile drawer header, and the signed-out
 * auth shell.
 *
 * `href` is opt-in rather than always "/" because the auth shell renders this to visitors who are
 * not signed in, and "/" does not mean the app for them — the proxy serves the marketing page
 * there instead, so a wordmark over a sign-in form would be a link back out to the sales page. The
 * signed-in call sites pass it, as does the marketing page itself; `onNavigate` lets the mobile
 * drawer close itself on the way, the same way its nav links do.
 *
 * `compact` drops the wordmark below `sm` and leaves the mark alone. That is what a brand does on a
 * phone — the mark stays, the word goes — and it is deliberately not the same thing as letting the
 * word truncate: "DevSt…" reads as a broken layout rather than a compact one. Only the top bar sets
 * it. The drawer header, the auth shell, and the marketing bar all have room for the full lockup at
 * every width they are rendered at.
 *
 * `min-w-0` and `truncate` stay regardless, as the floor under both: no call site controls the width
 * of the row it is dropped into, and a wordmark that clips is still better than one that paints over
 * its neighbour. With `compact` set they should never actually fire.
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
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <Layers className="size-5" aria-hidden="true" />
            </span>
            <span className={cn("truncate text-lg font-semibold", compact && "hidden sm:inline")}>
                DevStash
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
            className="flex min-w-0 items-center gap-2 rounded-lg transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            {content}
        </Link>
    );
}
