"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brand } from "@/components/layout/Brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SECTIONS = [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
];

/**
 * The two account actions, in bar order. `primary` is the one that stays in the bar at every width;
 * the other drops into the small-screen menu below 861px.
 */
const ACTIONS = [
    { href: "/sign-in", label: "Sign In", primary: false },
    { href: "/register", label: "Get Started", primary: true },
];

/**
 * One section link, which is two different things depending on where the bar is rendered.
 *
 * On the marketing page the href is a bare hash: an in-page jump, animated by the smooth scrolling
 * the marketing layout sets on whichever element scrolls the page. From an auth page there is no
 * such section on the page, so it becomes a real navigation to `/` — and a `<Link>` rather than an
 * `<a>`, so Next drives it and scrolls to the hash on arrival instead of the browser doing a full
 * document load.
 */
function SectionLink({
    href,
    onAuth,
    className,
    onClick,
    children,
}: {
    href: string;
    onAuth: boolean;
    className?: string;
    onClick?: () => void;
    children: React.ReactNode;
}) {
    if (onAuth) {
        return (
            <Link href={`/${href}`} onClick={onClick} className={className}>
                {children}
            </Link>
        );
    }

    return (
        <a href={href} onClick={onClick} className={className}>
            {children}
        </a>
    );
}

/**
 * The marketing bar: brand, section links, and the two account actions.
 *
 * Sticky rather than fixed, so it takes its own 64px out of the flow instead of the page having to
 * reserve room for it. Below 860px the section links and Sign In move into the menu underneath and
 * the bar keeps the brand and the primary CTA.
 *
 * The scroll listener watches both `window` and the marketing layout's scroll container, and either
 * one past 8px counts as scrolled: below `md` the document scrolls, and from `md` up the root layout
 * pins the body and the container scrolls instead.
 *
 * `variant="auth"` renders the same bar on the signed-out auth shell, which is not the marketing
 * page and differs from it in three ways that all have the same cause — there is no marketing page
 * underneath it:
 *
 * - **The section links leave.** `#features` has no section to find on `/sign-in`, so the hrefs
 *   become absolute and point back at `/`. They also switch from `<a>` to `<Link>`: on the marketing
 *   page a bare hash is an in-page jump and the page's smooth scrolling is what animates it,
 *   while from an auth page it is a real navigation and Next has to own the scroll to the hash on
 *   the far side.
 * - **The bar stops reacting to scroll.** It is pinned to the state the marketing bar reaches after
 *   8px — bordered and opaque — rather than starting transparent. An auth page has nothing to
 *   scroll past, so a bar that fades in on scroll would just be a bar that never fades in, floating
 *   borderless over the card.
 * - **The current page is not offered as a button on itself.** `/sign-in` keeps Get Started,
 *   `/register` keeps Sign In, and the two password routes keep both.
 */
export function MarketingNav({ variant = "marketing" }: { variant?: "marketing" | "auth" }) {
    const navRef = useRef<HTMLElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    const onAuth = variant === "auth";
    const actions = onAuth ? ACTIONS.filter((action) => action.href !== pathname) : ACTIONS;

    useEffect(() => {
        if (onAuth) return;

        const container = navRef.current?.closest<HTMLElement>("[data-marketing-scroll]");
        if (!container) return;

        let ticking = false;
        const apply = () => {
            // Only one of the two ever scrolls at a given width; the other stays at 0.
            setScrolled(window.scrollY > 8 || container.scrollTop > 8);
            ticking = false;
        };
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(apply);
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        container.addEventListener("scroll", onScroll, { passive: true });
        apply(); // a reload partway down the page must not start transparent

        return () => {
            window.removeEventListener("scroll", onScroll);
            container.removeEventListener("scroll", onScroll);
        };
    }, [onAuth]);

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
            data-scrolled={scrolled || onAuth || undefined}
            data-open={open || undefined}
            // `shrink-0` matters only on the auth shell, a flex column where `h-16` is a flex
            // basis, not a floor: without it a tall form squeezes the bar to different heights on
            // sign-in and register.
            //
            // Opaque while the menu is open, translucent otherwise. The fade to opaque on scroll
            // is fast (`data-[scrolled]:duration-75`) and the fade back to glass is slow
            // (`duration-300`): a CSS transition times from the state it moves *to*. Going opaque
            // has to keep up with content arriving underneath; returning to glass is decoration.
            className="sticky top-0 z-50 h-16 shrink-0 border-b border-transparent bg-background/30 backdrop-blur-[6px] transition-[background-color,border-color,backdrop-filter] duration-300 data-[open]:bg-background data-[open]:backdrop-blur-[14px] data-[scrolled]:border-border data-[scrolled]:bg-background/90 data-[scrolled]:backdrop-blur-[14px] data-[scrolled]:duration-75"
        >
            <div className="mx-auto flex h-full w-[min(1180px,calc(100%-2.5rem))] items-center gap-6">
                <Brand href="/" />

                <div className="ml-auto flex gap-6 text-sm text-muted-foreground max-[860px]:hidden">
                    {SECTIONS.map((section) => (
                        <SectionLink
                            key={section.href}
                            href={section.href}
                            onAuth={onAuth}
                            className="transition-colors hover:text-foreground"
                        >
                            {section.label}
                        </SectionLink>
                    ))}
                </div>

                <div className="flex items-center gap-2 max-[860px]:ml-auto">
                    {/* `secondary`, not `ghost`, for the non-primary action, so it is visible
                        beside the gold CTA. Neutral rather than tinted: gold marks this page's call
                        to action and its Pro accents, so a coloured Sign In would compete with both. */}
                    {actions.map((action) => (
                        <Button
                            key={action.href}
                            asChild
                            variant={action.primary ? "default" : "secondary"}
                            className={cn("h-9 px-4", !action.primary && "max-[860px]:hidden")}
                        >
                            <Link href={action.href}>{action.label}</Link>
                        </Button>
                    ))}

                    <button
                        ref={toggleRef}
                        type="button"
                        aria-label={open ? "Close menu" : "Open menu"}
                        aria-expanded={open}
                        aria-controls="marketing-menu"
                        onClick={() => setOpen((current) => !current)}
                        // 38px is comfortable under a mouse and short of the 44px WCAG 2.5.5 floor
                        // under a finger — and on a phone this is the only way into the nav. Sized
                        // off pointer type rather than viewport width, matching `buttonVariants`;
                        // this toggle draws its own morphing bars, so it is not a `Button` and
                        // inherits none of that.
                        className="grid size-9.5 cursor-pointer place-items-center rounded-lg border border-border transition-colors hover:bg-muted pointer-coarse:size-11 min-[861px]:hidden"
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
                className="invisible absolute inset-x-0 top-full grid -translate-y-2 border-b border-border bg-background px-5 pt-2 pb-4 opacity-0 transition-[opacity,transform,visibility] duration-200 in-data-[open]:visible in-data-[open]:translate-y-0 in-data-[open]:opacity-100 min-[861px]:hidden"
            >
                {SECTIONS.map((section) => (
                    <SectionLink
                        key={section.href}
                        href={section.href}
                        onAuth={onAuth}
                        onClick={() => setOpen(false)}
                        className="flex items-center border-b border-border px-0.5 py-2.5 text-[0.95rem] text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-11"
                    >
                        {section.label}
                    </SectionLink>
                ))}
                {/* Whatever the bar drops below 861px — the non-primary action, when this page
                    offers it at all. */}
                {actions
                    .filter((action) => !action.primary)
                    .map((action) => (
                        <Button
                            key={action.href}
                            asChild
                            variant="outline"
                            className="mt-3.5 h-9 w-full"
                        >
                            <Link href={action.href} onClick={() => setOpen(false)}>
                                {action.label}
                            </Link>
                        </Button>
                    ))}
            </div>
        </nav>
    );
}
