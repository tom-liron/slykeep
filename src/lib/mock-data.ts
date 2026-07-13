/**
 * Single source of truth for mock dashboard data.
 *
 * Used to render the dashboard UI until the database is wired up.
 * Mirrors the shape of the eventual Prisma models (see context/project-overview.md)
 * but kept intentionally flat and simple — for display only.
 */

export type ContentKind = "text" | "url" | "file";

export interface ItemType {
  id: string;
  name: string;
  /** lucide-react icon name */
  icon: string;
  /** hex color */
  color: string;
  /** /items/[slug] route segment */
  slug: string;
  kind: ContentKind;
  isPro: boolean;
  /** number of items of this type (sidebar count) */
  count: number;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  isFavorite: boolean;
  /** ids of the item types this collection holds, in display order */
  typeIds: string[];
}

export interface Item {
  id: string;
  title: string;
  description: string;
  typeId: string;
  /** text content, link url, or file name depending on the type's kind */
  content: string;
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  /** ids of the collections this item belongs to */
  collectionIds: string[];
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isPro: boolean;
}

export const currentUser: User = {
  id: "user_1",
  name: "John Doe",
  email: "john@example.com",
  image: null,
  isPro: true,
};

export const itemTypes: ItemType[] = [
  {
    id: "type_snippet",
    name: "Snippets",
    icon: "Code",
    color: "#3b82f6",
    slug: "snippets",
    kind: "text",
    isPro: false,
    count: 24,
  },
  {
    id: "type_prompt",
    name: "Prompts",
    icon: "Sparkles",
    color: "#8b5cf6",
    slug: "prompts",
    kind: "text",
    isPro: false,
    count: 18,
  },
  {
    id: "type_command",
    name: "Commands",
    icon: "Terminal",
    color: "#f97316",
    slug: "commands",
    kind: "text",
    isPro: false,
    count: 15,
  },
  {
    id: "type_note",
    name: "Notes",
    icon: "StickyNote",
    color: "#fde047",
    slug: "notes",
    kind: "text",
    isPro: false,
    count: 12,
  },
  {
    id: "type_file",
    name: "Files",
    icon: "File",
    color: "#6b7280",
    slug: "files",
    kind: "file",
    isPro: true,
    count: 5,
  },
  {
    id: "type_image",
    name: "Images",
    icon: "Image",
    color: "#ec4899",
    slug: "images",
    kind: "file",
    isPro: true,
    count: 3,
  },
  {
    id: "type_link",
    name: "Links",
    icon: "Link",
    color: "#10b981",
    slug: "links",
    kind: "url",
    isPro: false,
    count: 8,
  },
];

export const collections: Collection[] = [
  {
    id: "col_react",
    name: "React Patterns",
    description: "Common React patterns and hooks",
    itemCount: 12,
    isFavorite: true,
    typeIds: ["type_snippet", "type_note", "type_link"],
  },
  {
    id: "col_python",
    name: "Python Snippets",
    description: "Useful Python code snippets",
    itemCount: 8,
    isFavorite: false,
    typeIds: ["type_snippet", "type_note"],
  },
  {
    id: "col_context",
    name: "Context Files",
    description: "AI context files for projects",
    itemCount: 5,
    isFavorite: true,
    typeIds: ["type_file", "type_note"],
  },
  {
    id: "col_interview",
    name: "Interview Prep",
    description: "Technical interview preparation",
    itemCount: 24,
    isFavorite: false,
    typeIds: ["type_note", "type_snippet", "type_link", "type_prompt"],
  },
  {
    id: "col_git",
    name: "Git Commands",
    description: "Frequently used git commands",
    itemCount: 15,
    isFavorite: true,
    typeIds: ["type_command", "type_note"],
  },
  {
    id: "col_ai",
    name: "AI Prompts",
    description: "Curated AI prompts for coding",
    itemCount: 18,
    isFavorite: false,
    typeIds: ["type_prompt", "type_snippet", "type_note"],
  },
];

export const items: Item[] = [
  {
    id: "item_useauth",
    title: "useAuth Hook",
    description: "Custom authentication hook for React applications",
    typeId: "type_snippet",
    content:
      "export function useAuth() {\n  const ctx = useContext(AuthContext);\n  if (!ctx) throw new Error('useAuth must be used within AuthProvider');\n  return ctx;\n}",
    tags: ["react", "auth", "hooks"],
    isFavorite: true,
    isPinned: true,
    collectionIds: ["col_react", "col_interview"],
    updatedAt: "2026-01-15",
  },
  {
    id: "item_api_error",
    title: "API Error Handling Pattern",
    description: "Fetch wrapper with exponential backoff retry logic",
    typeId: "type_snippet",
    content:
      "async function fetchWithRetry(url, options, retries = 3) {\n  for (let i = 0; i < retries; i++) {\n    try {\n      return await fetch(url, options);\n    } catch (e) {\n      await new Promise((r) => setTimeout(r, 2 ** i * 100));\n    }\n  }\n  throw new Error('Request failed after retries');\n}",
    tags: ["api", "error-handling", "fetch"],
    isFavorite: false,
    isPinned: true,
    collectionIds: ["col_react"],
    updatedAt: "2026-01-12",
  },
  {
    id: "item_optimize_prompt",
    title: "Code Review Prompt",
    description: "Prompt for thorough AI code reviews",
    typeId: "type_prompt",
    content:
      "Review the following code for bugs, security issues, and readability. Suggest concrete improvements with examples.",
    tags: ["ai", "review", "prompt"],
    isFavorite: true,
    isPinned: false,
    collectionIds: ["col_ai"],
    updatedAt: "2026-01-10",
  },
  {
    id: "item_git_undo",
    title: "Undo Last Commit",
    description: "Reset the last commit but keep the changes staged",
    typeId: "type_command",
    content: "git reset --soft HEAD~1",
    tags: ["git", "undo"],
    isFavorite: false,
    isPinned: false,
    collectionIds: ["col_git"],
    updatedAt: "2026-01-08",
  },
  {
    id: "item_py_dedupe",
    title: "Deduplicate a List",
    description: "Remove duplicates from a list while preserving order",
    typeId: "type_snippet",
    content: "def dedupe(items):\n    return list(dict.fromkeys(items))",
    tags: ["python", "list"],
    isFavorite: false,
    isPinned: false,
    collectionIds: ["col_python"],
    updatedAt: "2026-01-06",
  },
  {
    id: "item_docs_link",
    title: "Next.js App Router Docs",
    description: "Official documentation for the App Router",
    typeId: "type_link",
    content: "https://nextjs.org/docs/app",
    tags: ["nextjs", "docs"],
    isFavorite: false,
    isPinned: false,
    collectionIds: ["col_react", "col_interview"],
    updatedAt: "2026-01-04",
  },
  {
    id: "item_context_file",
    title: "project-context.md",
    description: "Base AI context file for new projects",
    typeId: "type_file",
    content: "project-context.md",
    tags: ["context", "ai"],
    isFavorite: true,
    isPinned: false,
    collectionIds: ["col_context"],
    updatedAt: "2026-01-02",
  },
];
