"use client";

import { Check, Copy } from "lucide-react";

import { useCopyAction } from "@/hooks/use-copy-action";

/**
 * The support code on an error page: the digest React attaches to a server-side failure, labelled
 * and copyable.
 *
 * In production Next strips an error's message before it reaches the browser and sends a hash of it
 * instead, printing that same hash beside the stack in the server log. It is the only thing tying
 * the page a visitor saw to the line that failed, so it is shown — but a bare number beside "500"
 * reads as noise, and a visitor reporting a problem cannot quote what they cannot tell is a code.
 * The three error boundaries pass it to `RouteNotice` in `components/ui/RouteNotice.tsx` as its
 * `reference`. The copy itself is {@link useCopyAction}, the same confirm-on-the-button behaviour
 * the item copy controls use.
 *
 * @remarks
 * Renders nothing without a digest. React attaches one only to an error thrown while rendering on
 * the server; a client component that fails in the browser reaches the same boundary carrying none,
 * and an error page must not point at a reference that is not there.
 */
export function ErrorReference({ digest }: { digest?: string }) {
    const { copy, isCopied } = useCopyAction();

    if (!digest) return null;

    return (
        <button
            type="button"
            onClick={() => copy(digest)}
            className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted pointer-coarse:py-2.5"
        >
            Error reference
            <span className="font-mono text-foreground">{digest}</span>
            {isCopied ? (
                <Check className="size-3.5 text-emerald-500" aria-hidden="true" />
            ) : (
                <Copy className="size-3.5" aria-hidden="true" />
            )}
            {/* The icon is the only thing that changes on a copy, so the state it signals is spelled
                out for a reader who cannot see it. */}
            <span className="sr-only">{isCopied ? "Copied" : "Copy error reference"}</span>
        </button>
    );
}
