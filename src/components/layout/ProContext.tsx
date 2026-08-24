"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether the signed-in account is Pro, for the client components that render differently because
 * of it.
 *
 * A context rather than a prop, and only because of where the consumers are. The top bar and the
 * sidebar already take `isPro` as a prop and keep doing so — they are one hop from the layout that
 * reads it. The tags field is not: it renders inside the edit form, inside the item drawer, which
 * is mounted by `ItemList` at five call sites and by the command palette at a sixth. Threading a
 * user fact through five pages, a list, and a drawer — none of which have anything to do with
 * entitlements — to reach one button is a worse trade than one provider in the layout that already
 * holds the value.
 *
 * `false` is the default rather than a thrown error, unlike `useSidebar`. Every consumer of this
 * uses it to decide whether to offer a Pro feature, so a missing provider has to fail *closed* — a
 * throw would take down a form over a hidden button, and a default of `true` would offer a control
 * that the server then refuses. The server is the authority either way: this decides what is shown,
 * `canUseAi` in the action decides what runs.
 */
const ProContext = createContext(false);

export function ProProvider({ isPro, children }: { isPro: boolean; children: ReactNode }) {
    return <ProContext.Provider value={isPro}>{children}</ProContext.Provider>;
}

export function useIsPro() {
    return useContext(ProContext);
}
