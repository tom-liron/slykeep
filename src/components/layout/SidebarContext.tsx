"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface SidebarContextValue {
    collapsed: boolean;
    toggleCollapsed: () => void;
    mobileOpen: boolean;
    setMobileOpen: (open: boolean) => void;
    toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const toggleCollapsed = useCallback(() => setCollapsed((previous) => !previous), []);
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
