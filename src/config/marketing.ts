/**
 * The copy and plan definitions the product's selling surfaces render.
 *
 * `FeatureGrid`, `AiSection` and `PricingPlans` build the signed-out landing page out of these
 * arrays, and the signed-in `/upgrade` page renders the same {@link PRICING_PLANS} through the same
 * `PricingPlanCard`, so a visitor and a free user comparing plans always read one pricing table.
 * Each AI highlight's clip is one of {@link AI_VIDEOS}, from `config/marketing-media.ts`, which
 * also holds the hero video and device screenshots. Holding the copy here is what lets those
 * components stay layout-only.
 *
 * {@link BillingCycle} is declared here and travels well beyond marketing: `actions/billing.ts`
 * takes it as checkout input, `config/billing.ts` maps it to a Stripe Price, and `BillingViewModel`
 * reports it back to the settings panel.
 *
 * @remarks
 * The prices are copy and are not read from Stripe, so they stay in step with `config/billing.ts`
 * and `project-overview.md` §7 by hand.
 *
 * A feature's icon ({@link MarketingFeature}) is the lucide component itself, unlike
 * `ItemTypePresentation.icon` in `types/item-type.ts`, which is a name: an item type's icon arrives
 * from the database and has to be narrowed, while these are authored here.
 */

import { Code, File, Layers, Search, Sparkles, Terminal, type LucideIcon } from "lucide-react";

import { ITEM_TYPE_COLORS } from "./item-type-catalog";
import { AI_VIDEOS, type MarketingVideo } from "./marketing-media";

export type MarketingFeature = {
    title: string;
    body: string;
    icon: LucideIcon;
    /** Drives the card's icon chip, hover border, and top rule. */
    accent: string;
};

export const MARKETING_FEATURES: readonly MarketingFeature[] = [
    {
        title: "Code Snippets",
        body: "Keep the function you rewrite every project. Syntax highlighting, a language per snippet, and one click to copy it back out.",
        icon: Code,
        accent: ITEM_TYPE_COLORS.snippet,
    },
    {
        title: "Prompts",
        body: "The system prompt that finally worked, kept where you can find it and run it again on the next model.",
        icon: Sparkles,
        accent: ITEM_TYPE_COLORS.prompt,
    },
    {
        title: "Instant Search",
        body: "⌘K or Ctrl+K from any page. Find any item by title, tag or description as you type.",
        icon: Search,
        accent: ITEM_TYPE_COLORS.note,
    },
    {
        title: "Commands",
        body: "The docker incantation, the psql one-liner, the git command you look up every single time. Copy, paste, move on.",
        icon: Terminal,
        accent: ITEM_TYPE_COLORS.command,
    },
    {
        title: "Files & Docs",
        body: "Context files, diagrams, screenshots, PDFs. Uploaded, previewed in place, and served back only to you.",
        icon: File,
        accent: ITEM_TYPE_COLORS.file,
    },
    {
        title: "Collections",
        body: "Group anything with anything. One snippet can sit in React Patterns and Interview Prep at once — no copies, no choosing.",
        icon: Layers,
        accent: ITEM_TYPE_COLORS.link,
    },
];

export type AiHighlight = {
    /** Rendered bold, and read as the name of the capability. */
    title: string;
    body: string;
    /** The feature running in the item drawer, played while this highlight is selected. */
    video: MarketingVideo;
};

export const AI_HIGHLIGHTS: readonly AiHighlight[] = [
    {
        title: "Auto-tagging.",
        body: "Tags suggested from the content itself, so search works before you have organised anything.",
        video: AI_VIDEOS.tags,
    },
    {
        title: "Summaries.",
        body: "A one-line description for the long note you pasted and never titled.",
        video: AI_VIDEOS.summary,
    },
    {
        title: "Explain this code.",
        body: "A plain-English read of the snippet you saved eight months ago.",
        video: AI_VIDEOS.explain,
    },
    {
        title: "Prompt optimizer.",
        body: "Sharper wording, clearer constraints, on the prompts you already keep.",
        video: AI_VIDEOS.optimize,
    },
];

export type BillingCycle = "monthly" | "yearly";

/** Billing-cycle options shown by `BillingCycleToggle` on landing and upgrade plan cards. */
export const BILLING_CYCLES: readonly { value: BillingCycle; label: string; badge?: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly", badge: "Save 25%" },
];

/** Displayed price text for one billing cycle on a plan card. */
export type PlanPrice = {
    amount: string;
    period: string;
    note: string;
};

export type PlanFeature = {
    label: string;
    /** `false` renders the crossed-out row — what this {@link PricingPlan} does *not* get. */
    included: boolean;
};

export type PricingPlan = {
    name: string;
    /**
     * The line above the feature list.
     *
     * @remarks
     * Required rather than optional: every {@link PricingPlan} renders exactly one, so the lists start
     * on the same row and can be read across. On the higher tier it carries the inheritance —
     * "Everything in Free, plus" — which is what lets that card list only what it adds.
     */
    featuresHeading: string;
    /**
     * Priced per cycle even where the two are identical, so the card renders one shape either way.
     * Free repeats itself rather than carrying a nullable yearly price the component must branch on.
     */
    price: Record<BillingCycle, PlanPrice>;
    features: readonly PlanFeature[];
    cta: { label: string; href: string };
    /** The Pro card: gold border, glow, and the "Most Popular" ribbon. */
    featured: boolean;
};

export const PRICING_PLANS: readonly PricingPlan[] = [
    {
        name: "Free",
        price: {
            monthly: {
                amount: "$0",
                period: "forever",
                note: "Enough for the things you reach for most.",
            },
            yearly: {
                amount: "$0",
                period: "forever",
                note: "Enough for the things you reach for most.",
            },
        },
        // Eight rows, the same count as Pro: two lists of different lengths do not read as a
        // comparison. Adding a row to either plan means finding one for the other. A card carries
        // the handful of rows that decide the choice, not an inventory of everything ungated.
        featuresHeading: "What's included",
        features: [
            { label: "Up to 50 items", included: true },
            { label: "3 collections", included: true },
            // A count rather than a list of the five: naming them is the one row long enough to
            // wrap, and the number puts the difference in the row itself. The features section
            // above this on the landing page is what says which five.
            { label: "Five item types", included: true },
            { label: "Instant search", included: true },
            // The row names three of `ItemDrawer`'s controls rather than the drawer, which means
            // nothing to a reader who has not seen one. "in place" is the claim being made: the
            // drawer opens over whatever page the user was already on.
            { label: "Pin, copy, and edit in place", included: true },
            { label: "Markdown and code editors", included: true },
            { label: "File & image uploads", included: false },
            { label: "AI features", included: false },
        ],
        // Registration: the free plan is an account and nothing else. Pro's call to action goes to
        // the billing panel instead — see below.
        cta: { label: "Get Started Free", href: "/register" },
        featured: false,
    },
    {
        name: "Pro",
        price: {
            monthly: {
                amount: "$8",
                period: "per month",
                note: "Billed monthly. Cancel any time.",
            },
            yearly: {
                amount: "$72",
                period: "per year",
                note: "That is $6 a month, billed annually — $24 less than monthly.",
            },
        },
        featuresHeading: "Everything in Free, plus",
        features: [
            { label: "Unlimited items", included: true },
            { label: "Unlimited collections", included: true },
            // Word for word the row the Free card crosses out. One label ticked on one card and
            // struck through on the other is a comparison that needs no interpreting.
            { label: "File & image uploads", included: true },
            // One row per AI capability: four rows of eight is the prominence, since a reader
            // scanning the card counts rows before reading any of them. Each label is a short noun
            // phrase so no row wraps and the column stays parallel with the Free card's rows.
            //
            // Every row names a Server Action that exists in `actions/ai.ts` — `generateAutoTags`,
            // `generateDescription`, `explainCode`, `optimizePrompt`. A capability with no
            // implementation is removed from this card rather than crossed out: a struck-through
            // row on the Pro card claims Pro does not get it either.
            { label: "AI tag suggestions", included: true },
            { label: "AI item summaries", included: true },
            { label: "AI code explanations", included: true },
            { label: "AI prompt optimizer", included: true },
            { label: "Priority support", included: true },
        ],
        // The billing panel, where checkout starts. This page is only served without a session, so
        // a visitor following the link is bounced by the proxy to `/sign-in?callbackUrl=%2Fsettings`
        // and lands on it after signing in; a free user returning to upgrade is not sent to
        // register a second account.
        //
        // The fragment does not survive that round trip — it never reaches the server, so it is not
        // in `callbackUrl`. Billing is the first panel on the page, and the fragment matters only
        // for a signed-in user following the link directly, which is the case where it does survive.
        cta: { label: "Go Pro", href: "/settings#billing" },
        featured: true,
    },
];
