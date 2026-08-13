import type { CSSProperties } from "react";

import { ITEM_TYPE_COLORS } from "@/config/item-type-catalog";

const LIBRARY = [
    { label: "Snippets", color: ITEM_TYPE_COLORS.snippet, active: true },
    { label: "Prompts", color: ITEM_TYPE_COLORS.prompt, active: false },
    { label: "Commands", color: ITEM_TYPE_COLORS.command, active: false },
    { label: "Notes", color: ITEM_TYPE_COLORS.note, active: false },
    { label: "Links", color: ITEM_TYPE_COLORS.link, active: false },
];

const COLLECTIONS = [
    { label: "React Patterns", color: ITEM_TYPE_COLORS.snippet },
    { label: "Design Refs", color: ITEM_TYPE_COLORS.image },
];

const CARDS = [
    { title: "useDebounce", tag: "snippet", color: ITEM_TYPE_COLORS.snippet },
    { title: "Code review", tag: "prompt", color: ITEM_TYPE_COLORS.prompt },
    { title: "compose up", tag: "command", color: ITEM_TYPE_COLORS.command },
    { title: "Deploy plan", tag: "note", color: ITEM_TYPE_COLORS.note },
    { title: "Prisma docs", tag: "link", color: ITEM_TYPE_COLORS.link },
    { title: "arch.png", tag: "image", color: ITEM_TYPE_COLORS.image },
];

/**
 * The right half of the hero figure: a still model of the dashboard, decorative and inert.
 *
 * Sized in `cqw` — percentages of the mock's own width — rather than `rem`. The panel is half of a
 * fluid container, so the mock is around 390px wide at 1000px of viewport and around 500px at
 * 1440px; with fixed type inside, every card title and sidebar row cropped somewhere in that range.
 * Container units keep type, padding, and boxes in one ratio, so what fits at one width fits at all
 * of them. The width of the sidebar lives on the sidebar for the same reason — an element cannot
 * query itself, so `cqw` in the grid template would resolve against an ancestor instead.
 */
export function AppPreview() {
    return (
        <div
            aria-hidden="true"
            className="@container grid min-h-[300px] flex-1 grid-cols-[auto_1fr] overflow-hidden rounded-md border border-border bg-background"
        >
            <aside className="w-[27cqw] border-r border-border bg-white/[0.015] px-[2cqw] py-[2.2cqw]">
                <div className="mb-[2.9cqw] flex items-center gap-[1.3cqw]">
                    <span className="size-[2.8cqw] rounded-[4px] bg-linear-to-br from-[var(--type-snippet)] to-[var(--type-prompt)]" />
                    <span className="h-[1.2cqw] w-[9.2cqw] rounded-[3px] bg-white/20" />
                </div>

                <p className="mt-[2.4cqw] mb-[1.1cqw] text-[1.75cqw] tracking-[0.09em] text-zinc-500 uppercase">
                    Library
                </p>
                <ul>
                    {LIBRARY.map((row) => (
                        <li
                            key={row.label}
                            className={`flex items-center gap-[1.3cqw] overflow-hidden rounded-[5px] px-[1.1cqw] py-[0.8cqw] text-[2cqw] text-ellipsis whitespace-nowrap ${
                                row.active ? "bg-muted text-foreground" : "text-muted-foreground"
                            }`}
                        >
                            <span
                                style={{ backgroundColor: row.color }}
                                className="size-[1.2cqw] shrink-0 rounded-[2px]"
                            />
                            {row.label}
                        </li>
                    ))}
                </ul>

                <p className="mt-[2.4cqw] mb-[1.1cqw] text-[1.75cqw] tracking-[0.09em] text-zinc-500 uppercase">
                    Collections
                </p>
                <ul>
                    {COLLECTIONS.map((row) => (
                        <li
                            key={row.label}
                            className="flex items-center gap-[1.3cqw] overflow-hidden rounded-[5px] px-[1.1cqw] py-[0.8cqw] text-[2cqw] text-ellipsis whitespace-nowrap text-muted-foreground"
                        >
                            <span
                                style={{ backgroundColor: row.color }}
                                className="size-[1.2cqw] shrink-0 rounded-[2px]"
                            />
                            {row.label}
                        </li>
                    ))}
                </ul>
            </aside>

            <div className="flex min-w-0 flex-col gap-[2.2cqw] p-[2.2cqw]">
                <div className="flex items-center gap-[1.6cqw]">
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-[1.6cqw] rounded-[6px] border border-border bg-card px-[1.6cqw] py-[1cqw] text-[2cqw] text-zinc-500">
                        Search everything…
                        <kbd className="shrink-0 rounded-[5px] border border-white/15 bg-muted px-[0.3em] py-[0.05em] font-mono text-[1.75cqw]">
                            ⌘K
                        </kbd>
                    </span>
                    <span className="rounded-[6px] bg-foreground px-[1.8cqw] py-[1cqw] text-[2cqw] font-semibold text-background">
                        New
                    </span>
                </div>

                <div className="grid grid-cols-3 gap-[1.6cqw]">
                    {CARDS.map((card) => (
                        // The coloured top border is the item's type — the same signal the real
                        // dashboard uses down the left edge of a row.
                        <article
                            key={card.title}
                            style={{ "--accent": card.color } as CSSProperties}
                            className="min-w-0 rounded-b-[6px] border border-t-2 border-border border-t-[var(--accent)] bg-card px-[1.6cqw] pt-[1.4cqw] pb-[1.6cqw]"
                        >
                            <p className="overflow-hidden text-[1.9cqw] font-medium text-ellipsis whitespace-nowrap text-foreground">
                                {card.title}
                            </p>
                            <p className="mt-[1.1cqw] h-[0.8cqw] rounded-[2px] bg-white/10" />
                            <p className="mt-[1.1cqw] h-[0.8cqw] w-3/5 rounded-[2px] bg-white/10" />
                            <span className="mt-[1.45cqw] inline-block rounded-[4px] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-[0.95cqw] py-[0.16cqw] text-[1.65cqw] font-semibold text-[var(--accent)]">
                                {card.tag}
                            </span>
                        </article>
                    ))}
                </div>
            </div>
        </div>
    );
}
