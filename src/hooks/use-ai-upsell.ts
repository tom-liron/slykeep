"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { type AiFeatureNoun, proRequiredMessage } from "@/lib/ai-features";
import { TOAST_IDS } from "@/lib/toast-ids";

/**
 * The answer a free account gets when it clicks one of the four AI controls.
 *
 * All four — Suggest Tags, Describe, Explain, Optimize — stay visible and clickable without Pro,
 * crowned rather than hidden or disabled, and every one of them calls this instead of its action.
 * The button stays enabled because a disabled one fires no click, and its native `title` never
 * shows on a touch screen.
 *
 * @remarks
 * The click never reaches the server, so this is the one place the refusal is composed for the UI.
 * It decides what is *said*, not what is allowed — `guardAiRequest` in `actions/ai.ts` refuses the
 * request itself, and would refuse it again if this were bypassed.
 */
export function useAiUpsell() {
    const router = useRouter();

    return (feature: AiFeatureNoun) =>
        toast.error(proRequiredMessage(feature), {
            // One id for all four: a crowned button invites the click it refuses, and a rage-click
            // on one — or a run along the row of them — should leave one toast rather than a column.
            id: TOAST_IDS.aiUpsell,
            // `/upgrade`, the plan comparison, not checkout: the same destination `ProTypeUpgrade`
            // sends the Pro-only item types to, so every paywall in the app lands in one place.
            action: { label: "Upgrade", onClick: () => router.push("/upgrade") },
        });
}
