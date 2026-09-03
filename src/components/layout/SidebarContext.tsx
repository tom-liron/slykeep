"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Client state for the dashboard sidebar: the desktop rail's collapsed state and the mobile
 * drawer's open state.
 *
 * `SidebarProvider` wraps the dashboard layout; `TopBar` and `Sidebar` read it through
 * {@link useSidebar}. The rail's *default* state is CSS in `Sidebar` — this context only carries an
 * explicit user choice ({@link SidebarContextValue.collapsed} is `null` until the toggle is
 * touched) and the drawer state.
 */

interface SidebarContextValue {
    /**
     * `null` means nobody has touched the toggle, so the rail follows the width-aware default `Sidebar`
     * expresses in CSS — closed below `lg`, open from `lg`. A boolean is an explicit choice, and an
     * explicit choice holds at every width until it is made again.
     */
    collapsed: boolean | null;
    toggleCollapsed: () => void;
    mobileOpen: boolean;
    setMobileOpen: (open: boolean) => void;
    toggleMobile: () => void;
}

/**
 * The `lg` breakpoint as a media query — the width at or above which the rail is open on arrival.
 *
 * The default rail state itself is CSS, in `Sidebar`, because the server renders the markup without
 * knowing the window width. This is the same threshold in the one place JavaScript needs it:
 * deciding which way a never-touched toggle flips, read once at click time.
 */
const RAIL_OPEN_BY_DEFAULT = "(min-width: 64rem)";

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState<boolean | null>(null);
    const [mobileOpen, setMobileOpen] = useState(false);

    // From `null`, the flip is away from whatever the CSS default currently is: the rail is open
    // above the threshold, so the first click closes it, and closed below, so the first click opens
    // it. `matches` is that default, which is why it is returned rather than negated.
    const toggleCollapsed = useCallback(() => {
        setCollapsed((previous) =>
            previous === null ? window.matchMedia(RAIL_OPEN_BY_DEFAULT).matches : !previous,
        );
    }, []);
    const toggleMobile = useCallback(() => setMobileOpen((previous) => !previous), []);

    // A `popstate` listener closes the drawer on back and forward: a link inside the drawer closes
    // it on the tap, but the browser's navigation buttons are not taps. A listener fires on the
    // event, so it does not reopen on forward the way a `usePathname`-derived open state does when
    // the paths drift back into agreement.
    useEffect(() => {
        const close = () => setMobileOpen(false);
        window.addEventListener("popstate", close);
        return () => window.removeEventListener("popstate", close);
    }, []);

    return (
        <SidebarContext.Provider
            value={{
                collapsed,
                toggleCollapsed,
                mobileOpen,
                setMobileOpen,
                toggleMobile,
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
}
