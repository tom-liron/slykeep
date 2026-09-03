"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The signed-in account's Pro status, for the client components that render differently on it.
 *
 * A context rather than a prop because the deep consumer — the AI-suggestion buttons in the item
 * form — renders inside the edit form, inside the item drawer, mounted by `ItemList` and the
 * command palette. {@link ProProvider} sits in the dashboard layout that already reads the value;
 * {@link useIsPro} reads it from anywhere below.
 *
 * @remarks
 * The default is `false`, so a missing provider fails closed: consumers use it only to decide
 * whether to offer a Pro feature. The server is the authority — this decides what is shown,
 * `canUseAi` in the action decides what runs.
 */
const ProContext = createContext(false);

/** Wraps the dashboard tree so {@link useIsPro} can read the account's Pro status. */
export function ProProvider({ isPro, children }: { isPro: boolean; children: ReactNode }) {
    return <ProContext.Provider value={isPro}>{children}</ProContext.Provider>;
}

/** The signed-in account's Pro status; `false` with no {@link ProProvider} above. */
export function useIsPro() {
    return useContext(ProContext);
}
