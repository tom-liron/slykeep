"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

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
 * `lg`, as a media query — the width at which the rail is open on arrival.
 *
 * The default itself is CSS, in `Sidebar`, and has to be: the server renders this markup without
 * knowing the window width, so a default computed in JavaScript would paint the wrong rail and then
 * correct itself. This is the same threshold in the one place JavaScript genuinely needs it, which
 * is deciding which way a never-touched toggle should flip. Read at click time rather than
 * subscribed to, because it is only ever a question about right now.
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

    // Back and forward close the drawer. Nothing else notices them: a link inside the drawer closes
    // it on the tap, but the browser's own navigation buttons are not taps on anything.
    //
    // Two other shapes were tried first and both were worse. An effect watching `usePathname` is
    // what `react-hooks/set-state-in-effect` exists to reject. Deriving it — storing which path the
    // drawer was opened on, and calling it open only while that is still the current path — passes
    // the lint and reads well, and it reopens the drawer on *forward*: going back closes it because
    // the paths stop matching, and going forward makes them match again. Measured, not reasoned
    // about. A listener has no equivalent, because it fires on the event rather than comparing two
    // pieces of state that can drift back into agreement.
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
