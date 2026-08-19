import { Code, File, Layers, Search, Sparkles, Terminal, type LucideIcon } from "lucide-react";

import { ITEM_TYPE_COLORS } from "./item-type-catalog";

/**
 * The copy the marketing homepage is built from: the feature cards, the AI bullets, and the two
 * pricing plans. Keeping it here is what lets the components stay layout-only — in particular the
 * two price cards, which are one component rendered twice rather than two near-identical blocks.
 *
 * The icon is the lucide component itself, not a name in the manner of `ItemTypePresentation.icon`.
 * That indirection exists because an item type's icon arrives from the database as an untyped
 * string and has to be guarded; these are authored here, so a `TypeIcon`-style switch would only
 * add a second place to edit when a card changes.
 */

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
        body: "Save the function you rewrite every project. Syntax highlighting, a language per snippet, and one click to copy it back out.",
        icon: Code,
        accent: ITEM_TYPE_COLORS.snippet,
    },
    {
        title: "AI Prompts",
        body: "The system message that finally worked, out of a chat history you will never scroll back through again.",
        icon: Sparkles,
        accent: ITEM_TYPE_COLORS.prompt,
    },
    {
        title: "Instant Search",
        body: "Hit ⌘K anywhere and match across titles, tags, and types as you type. No loading state, no waiting.",
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
    /** Rendered bold, and read as the name of the thing. */
    title: string;
    body: string;
};

export const AI_HIGHLIGHTS: readonly AiHighlight[] = [
    {
        title: "Auto-tagging.",
        body: "Tags suggested from the content itself, so search works before you have organised anything.",
    },
    {
        title: "Summaries.",
        body: "A one-line description for the long note you pasted and never titled.",
    },
    {
        title: "Explain this code.",
        body: "A plain-English read of the snippet you saved eight months ago.",
    },
    {
        title: "Prompt optimizer.",
        body: "Sharper wording, clearer constraints, on the prompts you already keep.",
    },
];

export type BillingCycle = "monthly" | "yearly";

export const BILLING_CYCLES: readonly { value: BillingCycle; label: string; badge?: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly", badge: "Save 25%" },
];

export type PlanPrice = {
    amount: string;
    period: string;
    note: string;
};

export type PlanFeature = {
    label: string;
    /** `false` renders the crossed-out row — what this plan does *not* get. */
    included: boolean;
};

export type PricingPlan = {
    name: string;
    /**
     * Priced per cycle even where the two are identical, because the card renders one shape either
     * way. Free is genuinely free on both, so both entries repeat — the alternative is a nullable
     * yearly price and a branch in the component to handle it.
     */
    price: Record<BillingCycle, PlanPrice>;
    features: readonly PlanFeature[];
    cta: { label: string; href: string };
    /** The Pro card: purple border, glow, and the "Most Popular" ribbon. */
    featured: boolean;
};

export const PRICING_PLANS: readonly PricingPlan[] = [
    {
        name: "Free",
        price: {
            monthly: {
                amount: "$0",
                period: "forever",
                note: "Everything you need to stop losing things.",
            },
            yearly: {
                amount: "$0",
                period: "forever",
                note: "Everything you need to stop losing things.",
            },
        },
        features: [
            { label: "Up to 50 items", included: true },
            { label: "3 collections", included: true },
            { label: "Snippets, prompts, commands, notes, links", included: true },
            { label: "Instant ⌘K search", included: true },
            { label: "Favorites, tags, and collections", included: true },
            { label: "File & image uploads", included: false },
            { label: "AI features", included: false },
        ],
        // Registration, for the plain reason that the free plan *is* an account and nothing else.
        // Pro's call to action goes to the billing panel instead — see below.
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
        features: [
            { label: "Unlimited items", included: true },
            { label: "Unlimited collections", included: true },
            { label: "All seven types, including files & images", included: true },
            { label: "AI auto-tagging and summaries", included: true },
            { label: "Explain this code & prompt optimizer", included: true },
            { label: "Export to JSON or ZIP", included: true },
            { label: "Priority support", included: true },
        ],
        // The billing panel, which is where checkout actually starts.
        //
        // The marketing page is only ever served without a session, so a visitor following this is
        // bounced by the proxy to `/sign-in?callbackUrl=%2Fsettings` and arrives after signing in —
        // the same number of steps as `/register` was, and strictly better for the free user who
        // came back to upgrade, who would otherwise be sent to register a second account.
        //
        // The fragment does not survive that round trip: it never reaches the server, so it is not
        // in `callbackUrl`. It does not need to — billing is the first panel on the page, so the
        // fragment only matters for the signed-in user following this link directly, which is the
        // one case where it does survive.
        cta: { label: "Go Pro", href: "/settings#billing" },
        featured: true,
    },
];
