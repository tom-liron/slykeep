"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Brand } from "@/components/layout/Brand";
import { Button } from "@/components/ui/button";

const SECTIONS = [
    { href: "#features", label: "Features" },
    { href: "#ai", label: "AI" },
    { href: "#pricing", label: "Pricing" },
];

/**
 * The marketing bar: brand, section links, and the two account actions.
 *
 * Sticky rather than fixed, so it takes its own 64px out of the flow instead of the page having to
 * reserve room for it. Below 860px the section links and Sign In move into the menu underneath and
 * the bar keeps the brand and the primary CTA.
 *
 * The scroll listener is bound to the marketing layout's scroll container, not to `window`. The
 * root layout pins the body to the viewport height, so the window never scrolls at all here and a
 * `window` listener would simply never fire.
 */
export function MarketingNav() {
    const navRef = useRef<HTMLElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const container = navRef.current?.closest<HTMLElement>("[data-marketing-scroll]");
        if (!container) return;

        let ticking = false;
        const apply = () => {
            setScrolled(container.scrollTop > 8);
            ticking = false;
        };
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(apply);
        };

        container.addEventListener("scroll", onScroll, { passive: true });
        apply(); // a reload partway down the page must not start transparent

        return () => container.removeEventListener("scroll", onScroll);
    }, []);

    // Every way out of the menu, so it can never be left stranded open.
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setOpen(false);
            toggleRef.current?.focus(); // Escape should not strand focus inside a menu that just closed
        };
        const onClick = (event: MouseEvent) => {
            if (!navRef.current?.contains(event.target as Node)) setOpen(false);
        };

        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("click", onClick);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("click", onClick);
        };
    }, [open]);

    // Widening past the breakpoint restores the full bar, and a menu left open would then be hidden
    // but still flagged as expanded.
    useEffect(() => {
        const wide = window.matchMedia("(min-width: 861px)");
        const onChange = (event: MediaQueryListEvent) => {
            if (event.matches) setOpen(false);
        };

        wide.addEventListener("change", onChange);
        return () => wide.removeEventListener("change", onChange);
    }, []);

    return (
        <nav
            ref={navRef}
            data-scrolled={scrolled || undefined}
            data-open={open || undefined}
            className="sticky top-0 z-50 h-16 border-b border-transparent bg-background/30 backdrop-blur-[6px] transition-[background-color,border-color,backdrop-filter] duration-300 data-[open]:bg-background/95 data-[open]:backdrop-blur-[14px] data-[scrolled]:border-border data-[scrolled]:bg-background/90 data-[scrolled]:backdrop-blur-[14px]"
        >
            <div className="mx-auto flex h-full w-[min(1180px,calc(100%-2.5rem))] items-center gap-6">
                <Brand href="/" />

                <div className="ml-auto flex gap-6 text-sm text-muted-foreground max-[860px]:hidden">
                    {SECTIONS.map((section) => (
                        <a
                            key={section.href}
                            href={section.href}
                            className="transition-colors hover:text-foreground"
                        >
                            {section.label}
                        </a>
                    ))}
                </div>

                <div className="flex items-center gap-2 max-[860px]:ml-auto">
                    {/* `secondary`, not `ghost`: a button that is invisible until hovered reads as
                        nothing at all next to the white CTA. Deliberately a neutral surface rather
                        than a colour — blue is this page's one call to action and purple is what it
                        uses to mean Pro, so a tinted Sign In would either compete with Get Started
                        beside it or promise something it is not. */}
                    <Button asChild variant="secondary" className="h-9 px-4 max-[860px]:hidden">
                        <Link href="/sign-in">Sign In</Link>
                    </Button>
                    <Button asChild className="h-9 px-4">
                        <Link href="/register">Get Started</Link>
                    </Button>

                    <button
                        ref={toggleRef}
                        type="button"
                        aria-label={open ? "Close menu" : "Open menu"}
                        aria-expanded={open}
                        aria-controls="marketing-menu"
                        onClick={() => setOpen((current) => !current)}
                        className="grid size-9.5 cursor-pointer place-items-center rounded-lg border border-border transition-colors hover:bg-muted min-[861px]:hidden"
                    >
                        {/* The prototype's morph: the outer bars meet in the middle and cross, the
                            middle one goes. */}
                        <span className="relative block h-3 w-4" aria-hidden="true">
                            <span className="absolute top-0 left-0 h-[1.6px] w-full rounded-sm bg-current transition-[top,transform] duration-200 in-data-[open]:top-[5.2px] in-data-[open]:rotate-45" />
                            <span className="absolute top-[5.2px] left-0 h-[1.6px] w-full rounded-sm bg-current transition-opacity duration-150 in-data-[open]:opacity-0" />
                            <span className="absolute top-[10.4px] left-0 h-[1.6px] w-full rounded-sm bg-current transition-[top,transform] duration-200 in-data-[open]:top-[5.2px] in-data-[open]:-rotate-45" />
                        </span>
                    </button>
                </div>
            </div>

            {/* `visibility` rather than `display`, so the links leave the tab order while closed but
                the open and close still animate. */}
            <div
                id="marketing-menu"
                className="invisible absolute inset-x-0 top-full grid -translate-y-2 border-b border-border bg-background/95 px-5 pt-2 pb-4 opacity-0 backdrop-blur-[14px] transition-[opacity,transform,visibility] duration-200 in-data-[open]:visible in-data-[open]:translate-y-0 in-data-[open]:opacity-100 min-[861px]:hidden"
            >
                {SECTIONS.map((section) => (
                    <a
                        key={section.href}
                        href={section.href}
                        onClick={() => setOpen(false)}
                        className="border-b border-border px-0.5 py-2.5 text-[0.95rem] text-muted-foreground transition-colors hover:text-foreground"
                    >
                        {section.label}
                    </a>
                ))}
                <Button asChild variant="outline" className="mt-3.5 h-9 w-full">
                    <Link href="/sign-in" onClick={() => setOpen(false)}>
                        Sign In
                    </Link>
                </Button>
            </div>
        </nav>
    );
}
