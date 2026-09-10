import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { Reveal } from "@/components/marketing/Reveal";
import { AI_HIGHLIGHTS } from "@/config/marketing";

/**
 * The landing page's AI section: the Pro-feature copy from `AI_HIGHLIGHTS` beside an editor mock
 * whose tags animate in one at a time.
 *
 * One of the sections composed by the `/welcome` page. The tag animation keys off {@link Reveal}'s
 * `data-revealed`, so it needs no observer of its own.
 */

const KW = "text-purple-400";
const STR = "text-green-300";
const FN = "text-sky-300";
const NUM = "text-orange-300";

/**
 * The twelve-line snippet in the editor mock, written out as pre-coloured token spans rather than
 * run through a highlighter — it is one fixed illustration, and the real highlighter is Monaco.
 */
const CODE_LINES: readonly ReactNode[] = [
    <>
        <span className={KW}>import</span> {"{ useEffect, useState } "}
        <span className={KW}>from</span> <span className={STR}>&quot;react&quot;</span>;
    </>,
    null,
    <>
        <span className={KW}>export function</span> <span className={FN}>useDebounce</span>
        {"<T>(value: T, delay = "}
        <span className={NUM}>300</span>
        {") {"}
    </>,
    <>
        {"    "}
        <span className={KW}>const</span> {"[debounced, setDebounced] = "}
        <span className={FN}>useState</span>
        {"(value);"}
    </>,
    null,
    <>
        {"    "}
        <span className={FN}>useEffect</span>
        {"(() => {"}
    </>,
    <>
        {"        "}
        <span className={KW}>const</span> {"id = "}
        <span className={FN}>setTimeout</span>
        {"(() => "}
        <span className={FN}>setDebounced</span>
        {"(value), delay);"}
    </>,
    <>
        {"        "}
        <span className={KW}>return</span> {"() => "}
        <span className={FN}>clearTimeout</span>
        {"(id);"}
    </>,
    <>{"    }, [value, delay]);"}</>,
    null,
    <>
        {"    "}
        <span className={KW}>return</span> {"debounced;"}
    </>,
    <>{"}"}</>,
];

const TAGS = ["react", "hooks", "typescript", "debounce", "performance"];

/** Per-tag entry delays, so the tags land one at a time after the section scrolls in. */
const TAG_DELAYS = [
    "delay-[350ms]",
    "delay-[500ms]",
    "delay-[650ms]",
    "delay-[800ms]",
    "delay-[950ms]",
];

export function AiSection() {
    return (
        <section
            id="ai"
            // Two background layers. The radial is the purple bloom, centred in the middle of the
            // section rather than on its top edge; the linear over it holds the first and last 30%
            // at `--background`, the same colour the sections above and below paint. The tint
            // therefore reaches both boundaries at zero, and the section blends into its neighbours
            // instead of starting at a hard line.
            className="scroll-mt-20 bg-background py-[clamp(3rem,6vw,4.5rem)] [background-image:linear-gradient(180deg,var(--background)_0%,transparent_30%,transparent_70%,var(--background)_100%),radial-gradient(85%_70%_at_15%_50%,color-mix(in_srgb,var(--type-prompt)_12%,transparent),transparent_70%)]"
        >
            <div className="mx-auto grid w-[min(1180px,calc(100%-2.5rem))] grid-cols-2 items-center gap-[clamp(2rem,5vw,4rem)] max-[980px]:grid-cols-1">
                <Reveal className="min-w-0">
                    <span className="mb-4.5 inline-block rounded-full border border-[color-mix(in_srgb,var(--type-prompt)_45%,transparent)] bg-[color-mix(in_srgb,var(--type-prompt)_14%,transparent)] px-2.5 py-1 text-[0.72rem] font-bold tracking-[0.06em] text-purple-300 uppercase">
                        Pro Feature
                    </span>
                    <h2 className="text-[clamp(1.8rem,3.7vw,2.7rem)] leading-[1.15] font-bold tracking-[-0.03em]">
                        Let the AI do the filing
                    </h2>
                    <p className="mt-3.5 text-[1.02rem] text-muted-foreground">
                        Stashing something should cost one paste, not five minutes of tidying.
                        SlyKeep reads what you saved and fills in the rest.
                    </p>

                    <ul className="mt-7 grid gap-4">
                        {AI_HIGHLIGHTS.map((highlight) => (
                            <li
                                key={highlight.title}
                                className="flex gap-3 text-[0.95rem] text-muted-foreground"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-[color-mix(in_srgb,var(--type-prompt)_40%,transparent)] bg-[color-mix(in_srgb,var(--type-prompt)_16%,transparent)] text-purple-300"
                                >
                                    <Check className="size-3" strokeWidth={3} />
                                </span>
                                <span>
                                    <strong className="font-semibold text-foreground">
                                        {highlight.title}
                                    </strong>{" "}
                                    {highlight.body}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Reveal>

                <Reveal className="min-w-0">
                    <div
                        aria-hidden="true"
                        className="overflow-hidden rounded-xl border border-border bg-background shadow-[0_40px_70px_-50px_rgba(0,0,0,1)]"
                    >
                        <div className="flex items-center gap-1.5 border-b border-border bg-card px-3.5 py-2.5">
                            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                            <span className="size-2.5 rounded-full bg-[#febc2e]" />
                            <span className="size-2.5 rounded-full bg-[#28c840]" />
                            <span className="ml-2.5 font-mono text-xs text-zinc-400">
                                useDebounce.ts
                            </span>
                        </div>

                        <pre className="overflow-x-auto px-4 pt-4 pb-[1.1rem] font-mono text-[0.76rem] leading-[1.75] text-zinc-300 max-[680px]:text-[0.68rem]">
                            <code>
                                {CODE_LINES.map((line, index) => (
                                    <span key={index} className="block">
                                        <span className="mr-[1.1em] inline-block w-[1.4em] text-right text-zinc-700">
                                            {index + 1}
                                        </span>
                                        {line}
                                    </span>
                                ))}
                            </code>
                        </pre>

                        <div className="border-t border-border bg-[color-mix(in_srgb,var(--type-prompt)_5%,transparent)] px-4 pt-3.5 pb-4">
                            <p className="mb-2.5 flex items-center gap-1.5 text-[0.72rem] font-semibold tracking-[0.04em] text-purple-300 uppercase">
                                <span className="size-2 rounded-[2px] bg-[var(--type-prompt)] shadow-[0_0_10px_1px_color-mix(in_srgb,var(--type-prompt)_80%,transparent)]" />
                                AI Generated Tags
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {TAGS.map((tag, index) => (
                                    <span
                                        key={tag}
                                        className={`translate-y-1.5 scale-95 rounded-full border border-[color-mix(in_srgb,var(--type-prompt)_35%,transparent)] bg-[color-mix(in_srgb,var(--type-prompt)_12%,transparent)] px-2 py-0.5 font-mono text-[0.72rem] text-violet-200 opacity-0 transition-[opacity,transform] duration-[400ms] group-data-[revealed]/reveal:translate-y-0 group-data-[revealed]/reveal:scale-100 group-data-[revealed]/reveal:opacity-100 motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none ${TAG_DELAYS[index]}`}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
