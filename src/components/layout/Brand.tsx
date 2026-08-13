import Link from "next/link";
import { Layers } from "lucide-react";

/**
 * DevStash wordmark + logo. Lives in the top bar, the mobile drawer header, and the signed-out
 * auth shell.
 *
 * `href` is opt-in rather than always "/" because the auth shell renders this to visitors who are
 * not signed in, and "/" does not mean the app for them — the proxy serves the marketing page
 * there instead, so a wordmark over a sign-in form would be a link back out to the sales page. The
 * signed-in call sites pass it, as does the marketing page itself; `onNavigate` lets the mobile
 * drawer close itself on the way, the same way its nav links do.
 */
export function Brand({ href, onNavigate }: { href?: string; onNavigate?: () => void }) {
    const content = (
        <>
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <Layers className="size-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold">DevStash</span>
        </>
    );

    if (!href) {
        return <div className="flex items-center gap-2">{content}</div>;
    }

    return (
        <Link
            href={href}
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            {content}
        </Link>
    );
}
