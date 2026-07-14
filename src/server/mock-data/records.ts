import "server-only";

import { ITEM_TYPE_CATALOG, SYSTEM_ITEM_TYPE_NAMES } from "@/config/item-type-catalog";
import type { ContentType, ItemTypeName } from "@/types/item-type";

/**
 * Stand-in for the database. Records mirror the persisted row shapes: ids are opaque (nothing may
 * derive one from a name), timestamps are `Date`, and nullable columns are actually nullable.
 */

/** Mirrors an `item_types` row. `icon` is a plain string in the schema, as it is here. */
export interface MockItemTypeRecord {
    id: string;
    name: ItemTypeName;
    icon: string;
    color: string;
    isSystem: boolean;
    userId: string | null;
}

export interface MockUserRecord {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    isPro: boolean;
}

export interface MockCollectionRecord {
    id: string;
    name: string;
    description: string | null;
    isFavorite: boolean;
    defaultTypeId: string | null;
    updatedAt: Date;
}

/** `contentType` discriminates which of `content` / `url` / `fileUrl` is populated. */
export interface MockItemRecord {
    id: string;
    title: string;
    description: string | null;
    itemTypeId: string;
    contentType: ContentType;
    content: string | null;
    url: string | null;
    fileUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
    language: string | null;
    tags: string[];
    isFavorite: boolean;
    isPinned: boolean;
    collectionIds: string[];
    updatedAt: Date;
}

/** Stands in for the ids the seed would assign. Private: callers resolve types by name. */
const ITEM_TYPE_IDS: Record<ItemTypeName, string> = {
    snippet: "hq7v0a3xh4d2fs601b3k9wzm",
    prompt: "b4n8t2ycu6rk0pd93shx1amv",
    command: "x2gk9dqe7wt5nbz408rlvj6c",
    note: "m6zp1wf4khs8yq3tb70vdxe2",
    file: "t9crh5ub2xam7kv1nl4gpwqd",
    image: "v3jd8ks0yqbt6mzr5haewnx1",
    link: "k5wnq2hf9vzt3bx7cdmg1yre",
};

const COLLECTION_IDS = {
    react: "c1rk9wvz3htqm60bdx8fpyn4",
    python: "p2yb7dmk4wqtx91vnhz5cgrf",
    context: "n3fq8xtc5bkwd02hmvyr6plj",
    interview: "i4mv6hbz7ncqk83twdxg9prs",
    git: "g5td4kwn8hbmx17qcvyz2fjr",
    ai: "a6px3nqv9cmwt45bkhdz7yls",
    scratch: "s7lz5bcw0dnqk29mxvhg4tpr",
} as const;

const ITEM_IDS = {
    useAuth: "u1hb4kqz7wmnv93cdxtg5rpy",
    apiError: "e2xn8vcw5btqk04hmzdg1yfr",
    useDebounce: "d3qm7wbz0knvx58ctlhg2rps",
    pyDedupe: "y4kc2nhv6bwqm71xzdtg8flr",
    pyTimer: "t5vz9hmk3cbnq06wxdlg7pfs",
    reviewPrompt: "r6bn1qzw8hkcm52vxdtg0yjl",
    refactorPrompt: "f7cq3vhz5bnkm84wxdtg1pms",
    gitUndo: "o8dk6bwz2hnqm10cxvtg9frl",
    gitSquash: "q9fm4nvz7hbck63wxdtg2ply",
    gitPrune: "w0gn5czv8hkbm27qxdtf3rjs",
    tsGenerics: "z1hp6dwv9kbcm38rxqtg4nlf",
    readmeNote: "j2kq7fwz0mbcn49sxdtg5phr",
    docsLink: "l3mr8gxz1nbcp50tydtg6qks",
    tailwindLink: "h4ns9hyz2pbcq61uzetg7rlm",
    contextFile: "c5pt0jzw3qbcr72vafug8smn",
    archDiagram: "b6qu1kaz4rbcs83wbgvh9tno",
} as const;

const USER_ID = "usr0mvz8kqhc41bwxdtg2rnpy";

export const itemTypeRecords: MockItemTypeRecord[] = SYSTEM_ITEM_TYPE_NAMES.map((name) => ({
    id: ITEM_TYPE_IDS[name],
    name,
    icon: ITEM_TYPE_CATALOG[name].icon,
    color: ITEM_TYPE_CATALOG[name].color,
    isSystem: true,
    userId: null,
}));

export const currentUserRecord: MockUserRecord = {
    id: USER_ID,
    name: "John Doe",
    email: "john@example.com",
    image: null,
    isPro: true,
};

export const collectionRecords: MockCollectionRecord[] = [
    {
        id: COLLECTION_IDS.react,
        name: "React Patterns",
        description: "Common React patterns and hooks",
        isFavorite: true,
        defaultTypeId: ITEM_TYPE_IDS.snippet,
        updatedAt: new Date("2026-01-15T00:00:00Z"),
    },
    {
        id: COLLECTION_IDS.python,
        name: "Python Snippets",
        description: "Useful Python code snippets",
        isFavorite: false,
        defaultTypeId: ITEM_TYPE_IDS.snippet,
        updatedAt: new Date("2026-01-06T00:00:00Z"),
    },
    {
        id: COLLECTION_IDS.context,
        name: "Context Files",
        description: "AI context files for projects",
        isFavorite: true,
        defaultTypeId: ITEM_TYPE_IDS.file,
        updatedAt: new Date("2026-01-13T00:00:00Z"),
    },
    {
        id: COLLECTION_IDS.interview,
        name: "Interview Prep",
        description: "Technical interview preparation",
        isFavorite: false,
        defaultTypeId: ITEM_TYPE_IDS.note,
        updatedAt: new Date("2026-01-15T00:00:00Z"),
    },
    {
        id: COLLECTION_IDS.git,
        name: "Git Commands",
        description: "Frequently used git commands",
        isFavorite: true,
        defaultTypeId: ITEM_TYPE_IDS.command,
        updatedAt: new Date("2026-01-08T00:00:00Z"),
    },
    {
        id: COLLECTION_IDS.ai,
        name: "AI Prompts",
        description: "Curated AI prompts for coding",
        isFavorite: false,
        defaultTypeId: ITEM_TYPE_IDS.prompt,
        updatedAt: new Date("2026-01-11T00:00:00Z"),
    },
    {
        // Empty, with no default type: exercises the null dominant-type path.
        id: COLLECTION_IDS.scratch,
        name: "Scratchpad",
        description: null,
        isFavorite: false,
        defaultTypeId: null,
        updatedAt: new Date("2025-12-28T00:00:00Z"),
    },
];

/** Text items: `content` holds the body, `url` and the file columns are null. */
function textItem(
    fields: Omit<MockItemRecord, "contentType" | "url" | "fileUrl" | "fileName" | "fileSize">,
): MockItemRecord {
    return {
        ...fields,
        contentType: "TEXT",
        url: null,
        fileUrl: null,
        fileName: null,
        fileSize: null,
    };
}

export const itemRecords: MockItemRecord[] = [
    textItem({
        id: ITEM_IDS.useAuth,
        title: "useAuth Hook",
        description: "Custom authentication hook for React applications",
        itemTypeId: ITEM_TYPE_IDS.snippet,
        content:
            "export function useAuth() {\n  const ctx = useContext(AuthContext);\n  if (!ctx) throw new Error('useAuth must be used within AuthProvider');\n  return ctx;\n}",
        language: "typescript",
        tags: ["react", "auth", "hooks"],
        isFavorite: true,
        isPinned: true,
        collectionIds: [COLLECTION_IDS.react, COLLECTION_IDS.interview],
        updatedAt: new Date("2026-01-15T00:00:00Z"),
    }),
    textItem({
        id: ITEM_IDS.apiError,
        title: "API Error Handling Pattern",
        description: "Fetch wrapper with exponential backoff retry logic",
        itemTypeId: ITEM_TYPE_IDS.snippet,
        content:
            "async function fetchWithRetry(url, options, retries = 3) {\n  for (let i = 0; i < retries; i++) {\n    try {\n      return await fetch(url, options);\n    } catch (e) {\n      await new Promise((r) => setTimeout(r, 2 ** i * 100));\n    }\n  }\n  throw new Error('Request failed after retries');\n}",
        language: "javascript",
        tags: ["api", "error-handling", "fetch"],
        isFavorite: false,
        isPinned: true,
        collectionIds: [COLLECTION_IDS.react],
        updatedAt: new Date("2026-01-12T00:00:00Z"),
    }),
    textItem({
        id: ITEM_IDS.useDebounce,
        title: "useDebounce Hook",
        description: "Debounce a rapidly changing value in React",
        itemTypeId: ITEM_TYPE_IDS.snippet,
        content:
            "export function useDebounce<T>(value: T, delay = 300) {\n  const [debounced, setDebounced] = useState(value);\n  useEffect(() => {\n    const id = setTimeout(() => setDebounced(value), delay);\n    return () => clearTimeout(id);\n  }, [value, delay]);\n  return debounced;\n}",
        language: "typescript",
        tags: ["react", "hooks", "performance"],
        isFavorite: true,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.react, COLLECTION_IDS.interview],
        updatedAt: new Date("2026-01-14T00:00:00Z"),
    }),
    textItem({
        id: ITEM_IDS.pyDedupe,
        title: "Deduplicate a List",
        description: "Remove duplicates from a list while preserving order",
        itemTypeId: ITEM_TYPE_IDS.snippet,
        content: "def dedupe(items):\n    return list(dict.fromkeys(items))",
        language: "python",
        tags: ["python", "list"],
        isFavorite: false,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.python],
        updatedAt: new Date("2026-01-06T00:00:00Z"),
    }),
    textItem({
        id: ITEM_IDS.pyTimer,
        title: "Timing Decorator",
        description: "Decorator that logs how long a function takes to run",
        itemTypeId: ITEM_TYPE_IDS.snippet,
        content:
            "import time\n\ndef timed(fn):\n    def wrapper(*args, **kwargs):\n        start = time.perf_counter()\n        result = fn(*args, **kwargs)\n        print(f'{fn.__name__} took {time.perf_counter() - start:.4f}s')\n        return result\n    return wrapper",
        language: "python",
        tags: ["python", "decorator", "profiling"],
        isFavorite: false,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.python],
        updatedAt: new Date("2026-01-03T00:00:00Z"),
    }),
    textItem({
        id: ITEM_IDS.reviewPrompt,
        title: "Code Review Prompt",
        description: "Prompt for thorough AI code reviews",
        itemTypeId: ITEM_TYPE_IDS.prompt,
        content:
            "Review the following code for bugs, security issues, and readability. Suggest concrete improvements with examples.",
        language: null,
        tags: ["ai", "review", "prompt"],
        isFavorite: true,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.ai],
        updatedAt: new Date("2026-01-10T00:00:00Z"),
    }),
    textItem({
        id: ITEM_IDS.refactorPrompt,
        title: "Refactor System Prompt",
        description: "System prompt that keeps refactors behavior-preserving",
        itemTypeId: ITEM_TYPE_IDS.prompt,
        content:
            "You are a senior engineer. Refactor for clarity without changing behavior. Explain each change briefly and preserve the public API.",
        language: null,
        tags: ["ai", "refactor", "system-prompt"],
        isFavorite: false,
        isPinned: true,
        collectionIds: [COLLECTION_IDS.ai, COLLECTION_IDS.interview],
        updatedAt: new Date("2026-01-11T00:00:00Z"),
    }),
    textItem({
        id: ITEM_IDS.gitUndo,
        title: "Undo Last Commit",
        description: "Reset the last commit but keep the changes staged",
        itemTypeId: ITEM_TYPE_IDS.command,
        content: "git reset --soft HEAD~1",
        language: "bash",
        tags: ["git", "undo"],
        isFavorite: false,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.git],
        updatedAt: new Date("2026-01-08T00:00:00Z"),
    }),
    textItem({
        id: ITEM_IDS.gitSquash,
        title: "Squash Last N Commits",
        description: "Interactively squash the most recent commits into one",
        itemTypeId: ITEM_TYPE_IDS.command,
        content: "git rebase -i HEAD~3",
        language: "bash",
        tags: ["git", "rebase"],
        isFavorite: true,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.git],
        updatedAt: new Date("2026-01-07T00:00:00Z"),
    }),
    textItem({
        id: ITEM_IDS.gitPrune,
        title: "Prune Merged Branches",
        description: "Delete local branches already merged into main",
        itemTypeId: ITEM_TYPE_IDS.command,
        content: "git branch --merged main | grep -v main | xargs git branch -d",
        language: "bash",
        tags: ["git", "cleanup"],
        isFavorite: false,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.git],
        updatedAt: new Date("2026-01-05T00:00:00Z"),
    }),
    textItem({
        id: ITEM_IDS.tsGenerics,
        title: "TypeScript Generics Cheatsheet",
        description: "Common generic constraints and utility type patterns",
        itemTypeId: ITEM_TYPE_IDS.note,
        content:
            "- `T extends U` constrains a generic\n- `keyof T` yields the union of keys\n- `Pick<T, K>` / `Omit<T, K>` reshape objects\n- `ReturnType<typeof fn>` infers a return type",
        language: null,
        tags: ["typescript", "types", "reference"],
        isFavorite: true,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.interview],
        updatedAt: new Date("2026-01-09T00:00:00Z"),
    }),
    textItem({
        id: ITEM_IDS.readmeNote,
        title: "README Template",
        description: null,
        itemTypeId: ITEM_TYPE_IDS.note,
        content: "# Project\n\n## Getting Started\n\n## Scripts\n\n## Architecture\n\n## License",
        language: "markdown",
        tags: ["docs", "template"],
        isFavorite: false,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.context],
        updatedAt: new Date("2026-01-01T00:00:00Z"),
    }),
    {
        id: ITEM_IDS.docsLink,
        title: "Next.js App Router Docs",
        description: "Official documentation for the App Router",
        itemTypeId: ITEM_TYPE_IDS.link,
        contentType: "URL",
        content: null,
        url: "https://nextjs.org/docs/app",
        fileUrl: null,
        fileName: null,
        fileSize: null,
        language: null,
        tags: ["nextjs", "docs"],
        isFavorite: false,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.react, COLLECTION_IDS.interview],
        updatedAt: new Date("2026-01-04T00:00:00Z"),
    },
    {
        id: ITEM_IDS.tailwindLink,
        title: "Tailwind CSS v4 Docs",
        description: "Reference for the CSS-first Tailwind v4 configuration",
        itemTypeId: ITEM_TYPE_IDS.link,
        contentType: "URL",
        content: null,
        url: "https://tailwindcss.com/docs",
        fileUrl: null,
        fileName: null,
        fileSize: null,
        language: null,
        tags: ["tailwind", "css", "docs"],
        isFavorite: false,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.react],
        updatedAt: new Date("2026-01-02T00:00:00Z"),
    },
    {
        id: ITEM_IDS.contextFile,
        title: "project-context.md",
        description: "Base AI context file for new projects",
        itemTypeId: ITEM_TYPE_IDS.file,
        contentType: "FILE",
        content: null,
        url: null,
        fileUrl: "https://r2.devstash.dev/mock/project-context.md",
        fileName: "project-context.md",
        fileSize: 4096,
        language: null,
        tags: ["context", "ai"],
        isFavorite: true,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.context],
        updatedAt: new Date("2026-01-13T00:00:00Z"),
    },
    {
        id: ITEM_IDS.archDiagram,
        title: "architecture.png",
        description: "System architecture diagram for the dashboard",
        itemTypeId: ITEM_TYPE_IDS.image,
        contentType: "FILE",
        content: null,
        url: null,
        fileUrl: "https://r2.devstash.dev/mock/architecture.png",
        fileName: "architecture.png",
        fileSize: 182_400,
        language: null,
        tags: ["diagram", "architecture"],
        isFavorite: false,
        isPinned: false,
        collectionIds: [COLLECTION_IDS.context],
        updatedAt: new Date("2025-12-30T00:00:00Z"),
    },
];
