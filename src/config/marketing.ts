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
     * The line above the feature list.
     *
     * Required rather than optional, and that is the point: every card renders exactly one of
     * these, so the lists below them start on the same row across the whole grid. An optional
     * lead-in put Pro's first bullet one line lower than Free's, and two lists that do not share a
     * baseline cannot be read across.
     *
     * On the higher tier it carries the inheritance — "Everything in Free, plus" — which is what
     * lets that card list only what it *adds*. Without it, Pro has to restate every Free row,
     * burying the real difference among lines identical on both cards, or omit them and read as
     * though upgrading takes search and favourites away.
     */
    featuresHeading: string;
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
        // Eight rows, exactly as many as Pro. Two lists of different lengths do not read as a
        // comparison — and a Free card *longer* than the one being sold argues against the upgrade.
        // The pair of counts is a constraint on this file: adding a row to either plan means
        // finding one for the other, or the grid goes lopsided again.
        //
        // Markdown editing and pinned items are ungated too and are deliberately left off. A
        // pricing card carries the five to seven rows that decide the choice, not an inventory;
        // both are covered by the features section above this on the landing page.
        featuresHeading: "What's included",
        features: [
            { label: "Up to 50 items", included: true },
            { label: "3 collections", included: true },
            // "Five" against the Pro card's "All seven", rather than naming the five. The list
            // was the one row on either card long enough to wrap, which broke the parallel this
            // comparison depends on — and the two numbers put the difference in the row itself,
            // where a reader comparing the cards can see it without counting nouns. Which five
            // they are is what the features section above this exists to say.
            { label: "Five item types", included: true },
            { label: "Instant ⌘K search", included: true },
            // "in place" is the claim, and the drawer is what makes it true: §4A of the overview
            // asks for items to be quick to access, and `ItemDrawer` answers it with Favorite, Pin,
            // Copy, Download and Edit on one row, over whatever page you were already on. Naming
            // three of those controls beats naming the drawer, which means nothing to a reader who
            // has not seen one.
            //
            // Earlier attempts here named parts of the app — favorites, tags, syntax highlighting,
            // one-click copy — each true and ungated, none of them a reason to sign up, because
            // every editor a developer already has open does them. The difference is that this row
            // is about not having to leave what you are doing.
            { label: "Pin, copy, and edit in place", included: true },
            { label: "Markdown and code editors", included: true },
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
        featuresHeading: "Everything in Free, plus",
        features: [
            { label: "Unlimited items", included: true },
            { label: "Unlimited collections", included: true },
            // Word for word the row the Free card crosses out. The same label ticked on one card
            // and struck through on the other is the clearest comparison a pair of cards can make:
            // there is nothing to interpret, and the eye finds it without reading. It replaces
            // "All seven item types", which asked the reader to work out which two they were.
            { label: "File & image uploads", included: true },
            // One row per AI capability, named rather than described. Four rows out of eight is
            // the prominence — AI is half of what Pro is, and a reader scanning the card counts
            // rows before reading any of them. Two rows carrying four features under-sold it
            // against three rows of quota.
            //
            // Every label is a short noun phrase, 15–21 characters, so no row wraps and the column
            // reads as a list rather than as prose. Sentences were tried here first
            // ("AI explains any snippet, in plain English") and were wrong twice over: they wrapped
            // to two lines each, which turns three consecutive rows into a paragraph, and they
            // broke parallel with the Free card beside them, whose rows are all noun phrases. A
            // pricing card is a comparison, and a comparison only works if both sides are written
            // the same way.
            //
            // Each names a Server Action that exists in `actions/ai.ts` — `generateAutoTags`,
            // `generateDescription`, `explainCode`, `optimizePrompt`. That rule is not decorative:
            // an "Export to JSON or ZIP" row sat here promising a Pro feature with no route, no
            // dependency and no implementation, directly beneath a comment claiming this card
            // promised nothing the product does not do. It is removed rather than crossed out,
            // since a crossed-out row on the *Pro* card claims Pro does not get it either.
            { label: "AI tag suggestions", included: true },
            { label: "AI item summaries", included: true },
            { label: "AI code explanations", included: true },
            { label: "AI prompt optimizer", included: true },
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
