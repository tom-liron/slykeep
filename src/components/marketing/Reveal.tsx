"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Fades and lifts its children in the first time they scroll into view.
 *
 * The scroll-in wrapper every landing-page section uses. The `IntersectionObserver` is one-shot,
 * so an arrived section does not fade back out when it scrolls away.
 *
 * @remarks
 * The hidden state is CSS, so it survives a server render, and `motion-reduce` overrides it
 * outright. `group/reveal` and `data-revealed` are contract: descendants key their own transitions
 * off the same signal (the AI section's tags do) with no second observer. The flag is written to
 * the DOM, not React state — only CSS reads it, so a render pass would change nothing.
 */
export function Reveal({ className, children }: { className?: string; children: React.ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const reveal = () => {
            el.dataset.revealed = "true";
        };

        if (!("IntersectionObserver" in window)) {
            reveal();
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    reveal();
                    observer.unobserve(entry.target);
                }
            },
            // Slightly inside the bottom edge, so a section starts moving once it is properly on
            // screen rather than the instant its first pixel is.
            { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={cn(
                "group/reveal translate-y-5 opacity-0 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)] data-[revealed]:translate-y-0 data-[revealed]:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
                className,
            )}
        >
            {children}
        </div>
    );
}
