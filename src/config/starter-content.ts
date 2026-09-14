import { normalizeTagName } from "@/lib/item-schemas";
import type { ItemTypeName } from "@/types/item-type";

/**
 * The content a new account starts life with: two collections and a handful of loose items.
 *
 * Two consumers write these fixtures, and they are the reason the content lives in `config/` rather
 * than beside either one. `server/onboarding.ts` writes them into every account the moment it is
 * created, so a new sign-up lands on a populated dashboard instead of an empty one;
 * `prisma/seed-data.ts` composes the development demo account's content from the same records, so
 * the two cannot drift.
 *
 * @remarks
 * The size is an entitlement constraint, not a preference. A free account may hold three
 * collections and fifty items (`lib/limits.ts`), and content seeded on registration counts against
 * both — so this set stays at two collections, leaving a new account a slot of its own to create,
 * and well under the item ceiling. Adding a third collection here would make the first
 * "New collection" click refuse with an upgrade toast.
 */

/**
 * One seeded item. `body` holds the content in whichever form the item's type stores — the writer
 * routes it to `content` or `url` from the type's `contentType`, so a fixture never names a column.
 */
export interface StarterItem {
    title: string;
    type: ItemTypeName;
    description: string;
    body: string;
    /** Language hint used for syntax highlighting. */
    language?: string;
    tags: string[];
    isFavorite?: boolean;
    isPinned?: boolean;
}

/** One seeded collection, and the items filed into it. */
export interface StarterCollection {
    name: string;
    description: string;
    /** Fallback item type displayed when the collection has no items. */
    defaultType: ItemTypeName;
    isFavorite?: boolean;
    items: StarterItem[];
}

/** The two collections a new account is given. */
export const STARTER_COLLECTIONS: StarterCollection[] = [
    {
        name: "React Patterns",
        description: "Reusable React patterns and hooks",
        defaultType: "snippet",
        isFavorite: true,
        items: [
            {
                title: "Render a filtered list",
                type: "snippet",
                description:
                    "Filter an array down to what you need, then map each item to a list row with a stable key.",
                language: "javascript",
                tags: ["react", "arrays", "javascript"],
                isFavorite: true,
                isPinned: true,
                body: `export function ActiveUsers({ users }) {
    return (
        <ul>
            {users
                .filter((user) => user.isActive)
                .map((user) => (
                    <li key={user.id}>{user.name}</li>
                ))}
        </ul>
    );
}`,
            },
            {
                title: "createSafeContext",
                type: "snippet",
                description:
                    "Context factory that throws when consumed outside its provider, so a missing provider fails loudly instead of yielding undefined.",
                language: "typescript",
                tags: ["react", "context", "typescript"],
                isPinned: true,
                body: `import { createContext, useContext } from "react";

export function createSafeContext<T>(name: string) {
    const Context = createContext<T | null>(null);

    function useSafeContext(): T {
        const value = useContext(Context);
        if (value === null) {
            throw new Error(\`use\${name} must be used inside <\${name}Provider>\`);
        }
        return value;
    }

    return [Context.Provider, useSafeContext] as const;
}`,
            },
            {
                title: "groupBy",
                type: "snippet",
                description: "Groups a list into a Map keyed by a derived value.",
                language: "typescript",
                tags: ["typescript", "utils"],
                body: `export function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
    const groups = new Map<K, T[]>();

    for (const item of items) {
        const key = keyOf(item);
        const group = groups.get(key);
        if (group) {
            group.push(item);
        } else {
            groups.set(key, [item]);
        }
    }

    return groups;
}`,
            },
        ],
    },
    {
        name: "Toolbox",
        description: "Commands, infrastructure snippets and the references worth keeping",
        defaultType: "command",
        items: [
            {
                title: "Multi-stage Dockerfile for Next.js",
                type: "snippet",
                description: "Standalone output, non-root user, minimal runtime layer.",
                language: "dockerfile",
                tags: ["docker", "nextjs", "deployment"],
                isFavorite: true,
                body: `FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \\
 && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]`,
            },
            {
                title: "Build, tag and push an image",
                type: "command",
                description:
                    "Tags with the current commit SHA so a deploy is traceable to a build.",
                language: "bash",
                tags: ["docker", "deployment", "ci"],
                body: `TAG=$(git rev-parse --short HEAD)
docker build -t "$IMAGE:$TAG" -t "$IMAGE:latest" .
docker push "$IMAGE:$TAG"
docker push "$IMAGE:latest"`,
            },
            {
                title: "Dockerfile best practices",
                type: "link",
                description: "Official guidance on layer caching, image size and build stages.",
                tags: ["docker", "reference"],
                body: "https://docs.docker.com/build/building/best-practices/",
            },
            {
                title: "Undo the last commit, keep the changes",
                type: "command",
                description: "Moves HEAD back one commit and leaves the work staged.",
                language: "bash",
                tags: ["git"],
                isPinned: true,
                body: `git reset --soft HEAD~1`,
            },
            {
                title: "Find and kill whatever holds a port",
                type: "command",
                description: "For the usual 'port 3000 already in use'.",
                language: "bash",
                tags: ["process", "debugging"],
                isFavorite: true,
                body: `lsof -ti :3000
kill -9 $(lsof -ti :3000)`,
            },
            {
                title: "Tailwind CSS documentation",
                type: "link",
                description: "Utility reference and theme configuration.",
                tags: ["css", "tailwind", "reference"],
                isFavorite: true,
                body: "https://tailwindcss.com/docs",
            },
        ],
    },
];

/**
 * Seeded items that belong to no collection.
 *
 * An item is not required to be filed, and these are what show that: they populate the Prompts
 * type page and the recent list while the two collections stay within the free entitlement. The
 * demo seed files them into a third collection instead, which it can afford.
 */
export const STARTER_UNFILED_ITEMS: StarterItem[] = [
    {
        title: "Code review",
        type: "prompt",
        description: "Asks for a prioritised review rather than a list of nitpicks.",
        tags: ["ai", "review"],
        isFavorite: true,
        body: `Review the diff below as a senior engineer on this codebase.

Prioritise, in order:
1. Correctness — logic errors, unhandled edge cases, race conditions.
2. Security — unvalidated input, missing authorisation, leaked secrets.
3. Clarity — naming and structure that will confuse the next reader.

For each finding give the file and line, why it matters, and a concrete fix.
Say "no issues" for a category rather than inventing one. Skip style points
the formatter already handles.

DIFF:
"""
{{diff}}
"""`,
    },
    {
        title: "Generate documentation",
        type: "prompt",
        description: "Documents intent and constraints, not a restatement of the code.",
        tags: ["ai", "docs"],
        body: `Write documentation for the module below.

Cover: what it is for, the public API (signature, parameters, return, thrown
errors), and one realistic usage example.

Document the *why* — constraints and invariants a caller cannot infer from the
signature. Do not narrate what each line does; the code already says that.
If some behaviour is genuinely unclear from the source, say so instead of
guessing.

CODE:
"""
{{code}}
"""`,
    },
    {
        title: "Refactoring assistance",
        type: "prompt",
        description: "Behaviour-preserving refactor with the reasoning made explicit.",
        tags: ["ai", "refactor"],
        body: `Refactor the code below for clarity without changing its behaviour.

Rules:
- Preserve the public API and all observable behaviour, including error cases.
- Prefer deleting code over adding abstraction.
- Do not introduce a dependency to save a few lines.

Return the refactored code, then a short list of what changed and why. Call out
anything you are unsure preserves behaviour rather than quietly assuming it.

CODE:
"""
{{code}}
"""`,
    },
];

/**
 * The tag spellings across a set of items, one row per `normalized` form.
 *
 * Keeps the first spelling seen, which is what `@@unique([userId, normalized])` enforces across
 * submissions: the row for `React` is the row for `react`, so letting both through would attempt
 * two rows for one tag.
 */
export function uniqueTags(items: readonly StarterItem[]): string[] {
    const byNormalized = new Map<string, string>();

    for (const item of items) {
        for (const name of item.tags) {
            const normalized = normalizeTagName(name);
            if (!byNormalized.has(normalized)) byNormalized.set(normalized, name);
        }
    }

    return [...byNormalized.values()];
}
