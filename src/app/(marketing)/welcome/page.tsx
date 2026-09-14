import type { Metadata } from "next";

import { AiSection } from "@/components/marketing/AiSection";
import { CtaSection } from "@/components/marketing/CtaSection";
import { DeviceShowcase } from "@/components/marketing/DeviceShowcase";
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
    title: "SlyKeep — Save it once. Find it in seconds.",
    description:
        "A searchable library for your snippets, prompts, commands, notes, files and links, with instant search and AI tagging.",
};

export default function WelcomePage() {
    return (
        <>
            <Hero />
            <FeatureGrid />
            <DeviceShowcase />
            {/* Pricing precedes the AI section: `AiSection` is badged "Pro Feature", which means
                nothing to a reader who has not yet been told the plans exist. */}
            <PricingPlans />
            <AiSection />
            <CtaSection />
        </>
    );
}
