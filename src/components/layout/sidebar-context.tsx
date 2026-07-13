"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface SidebarContextValue {
    /** Desktop: whether the sidebar rail is collapsed (hidden). */
    collapsed: boolean;
    /** Toggle the desktop rail collapsed/expanded. */
    toggleCollapsed: () => void;
    /** Mobile: whether the sidebar drawer is open. */
    mobileOpen: boolean;
    setMobileOpen: (open: boolean) => void;
    /** Toggle the mobile slide-out drawer. */
    toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);
    const toggleMobile = useCallback(() => setMobileOpen((prev) => !prev), []);

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
    const ctx = useContext(SidebarContext);
    if (!ctx) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return ctx;
}
