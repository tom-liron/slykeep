import {
    STARTER_COLLECTIONS,
    STARTER_UNFILED_ITEMS,
    type StarterCollection,
    type StarterItem,
} from "../src/config/starter-content";

/**
 * The development demo account, and the content `prisma/seed.ts` writes into it.
 *
 * The records themselves live in `src/config/starter-content.ts`, because the application writes
 * them too — `server/onboarding.ts` gives every newly registered account the same starting content.
 * This module adds only what is specific to the demo account: its credentials, and the third
 * collection a seeded database can afford that a fresh free account cannot.
 *
 * @remarks
 * The demo user is free-tier, so `SEED_COLLECTIONS` stays at the three-collection entitlement limit
 * while its items remain well below the fifty-item one.
 */

/** The item and collection fixture shapes, named as the seed script refers to them. */
export type SeedItem = StarterItem;
export type SeedCollection = StarterCollection;

export const DEMO_USER = {
    email: "demo@devstash.io",
    name: "Demo User",
    password: "12345678",
    isPro: false,
} as const;

/**
 * The demo account's collections: the two every account starts with, plus one that files the
 * prompts a registered account receives unfiled.
 */
export const SEED_COLLECTIONS: SeedCollection[] = [
    ...STARTER_COLLECTIONS,
    {
        name: "AI Workflows",
        description: "AI prompts and workflow automations",
        defaultType: "prompt",
        isFavorite: true,
        items: STARTER_UNFILED_ITEMS,
    },
];
