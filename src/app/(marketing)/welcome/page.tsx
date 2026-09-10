import type { Metadata } from "next";

import { AiSection } from "@/components/marketing/AiSection";
import { CtaSection } from "@/components/marketing/CtaSection";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { Hero } from "@/components/marketing/Hero";
import { PricingPlans } from "@/components/marketing/PricingPlans";

/**
 * The marketing homepage. Signed-out visitors reach it at `/`, which `src/proxy.ts` rewrites here;
 * `/welcome` itself stays reachable directly, and sends anyone who is signed in to the dashboard.
 *
 * Its own title and description, rather than the root layout's app-wide pair: this is the page a
 * search result or a shared link lands on.
 */
export const metadata: Metadata = {
    title: "SlyKeep — Stop Losing Your Developer Knowledge",
    description:
        "One fast, searchable hub for your snippets, prompts, commands, notes, files, and links.",
};

export default function WelcomePage() {
    return (
        <>
            <Hero />
            <FeatureGrid />
            {/* Pricing precedes the AI section: `AiSection` is badged "Pro Feature", which means
                nothing to a reader who has not yet been told the plans exist. */}
            <PricingPlans />
            <AiSection />
            <CtaSection />
        </>
    );
}
