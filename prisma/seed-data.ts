import type { ItemTypeName } from "../src/types/item-type";

/**
 * Demo content for `prisma/seed.ts`. Kept separate so the seed reads as logic, not as a wall of
 * strings.
 *
 * `body` is written into whichever column the item type's content type calls for — `content` for
 * TEXT, `url` for URL — so an item can never end up with its text in the wrong column.
 */
export interface SeedItem {
    title: string;
    type: ItemTypeName;
    description: string;
    body: string;
    /** Only meaningful for code; drives syntax highlighting. */
    language?: string;
    tags: string[];
    isFavorite?: boolean;
    isPinned?: boolean;
}

export interface SeedCollection {
    name: string;
    description: string;
    /** Used only when a collection is empty; set anyway so the column is exercised. */
    defaultType: ItemTypeName;
    isFavorite?: boolean;
    items: SeedItem[];
}

export const DEMO_USER = {
    email: "demo@devstash.io",
    name: "Demo User",
    password: "12345678",
    isPro: false,
} as const;

/**
 * **Three collections, and that is a limit rather than a coincidence.** The demo account is a free
 * account (`isPro: false` above), and the free tier holds three collections and fifty items
 * (`src/lib/limits.ts`). Seeding a fourth would put the demo user over a cap the app now enforces,
 * so the account would open already in a state its own plan does not allow — and "create a
 * collection" would fail for a reason that looks like a bug rather than the tier working.
 *
 * Sitting exactly *at* the collection cap is deliberate: the usage meter reads 3 / 3 on first load
 * and the next create is refused, which is the behaviour worth seeing without having to build up to
 * it. The item count is well under fifty, so items are the half that still has room.
 */
export const SEED_COLLECTIONS: SeedCollection[] = [
    {
        name: "React Patterns",
        description: "Reusable React patterns and hooks",
        defaultType: "snippet",
        isFavorite: true,
        items: [
            {
                title: "useDebounce",
                type: "snippet",
                description: "Defers a rapidly changing value until it settles.",
                language: "typescript",
                tags: ["react", "hooks", "typescript"],
                isFavorite: true,
                isPinned: true,
                body: `import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
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
        name: "AI Workflows",
        description: "AI prompts and workflow automations",
        defaultType: "prompt",
        isFavorite: true,
        items: [
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
                title: "GitHub Actions workflow syntax",
                type: "link",
                description: "Full reference for triggers, jobs, matrices and caching.",
                tags: ["ci", "github", "reference"],
                body: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax",
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
                title: "Reclaim Docker disk space",
                type: "command",
                description:
                    "Removes stopped containers, unused networks, dangling images and the build cache. Add --volumes only if you are certain.",
                language: "bash",
                tags: ["docker", "cleanup"],
                body: `docker system prune --all --force
docker builder prune --all --force`,
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
                title: "Audit and update dependencies",
                type: "command",
                description: "Shows what is outdated, then applies only non-breaking fixes.",
                language: "bash",
                tags: ["npm", "maintenance"],
                body: `npm outdated
npm audit fix
npm dedupe`,
            },
            {
                title: "Tailwind CSS documentation",
                type: "link",
                description: "Utility reference and theme configuration.",
                tags: ["css", "tailwind", "reference"],
                isFavorite: true,
                body: "https://tailwindcss.com/docs",
            },
            {
                title: "shadcn/ui",
                type: "link",
                description:
                    "Copy-in components built on Radix primitives — the library this app uses.",
                tags: ["components", "react", "ui"],
                body: "https://ui.shadcn.com",
            },
            {
                title: "Material Design 3",
                type: "link",
                description:
                    "A full design system worth reading for its tokens and motion guidance.",
                tags: ["design-system", "reference"],
                body: "https://m3.material.io",
            },
            {
                title: "Lucide icons",
                type: "link",
                description: "The icon set DevStash uses for item types.",
                tags: ["icons", "reference"],
                body: "https://lucide.dev/icons",
            },
        ],
    },
];
