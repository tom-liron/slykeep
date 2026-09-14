"use client";

import { useState, type ReactNode } from "react";

import { LoopingVideo } from "@/components/marketing/LoopingVideo";
import { Reveal } from "@/components/marketing/Reveal";
import { AI_HIGHLIGHTS } from "@/config/marketing";
import { cn } from "@/lib/utils";

/**
 * The AI section's feature picker and clip player.
 *
 * `AiSection` passes its heading copy in as `children`; this renders it above the list of
 * {@link AI_HIGHLIGHTS} and plays the selected feature's recording beside it. Each clip plays once
 * and then advances to the next feature, so a visitor who only watches still sees all four.
 *
 * @remarks
 * The player's 4:5 box matches the drawer crop in `AI_CLIP_CAPTURE` (`config/marketing-media.ts`),
 * which the recording script cuts each AI clip to.
 */
export function AiFeatureShowcase({ children }: { children: ReactNode }) {
    const [active, setActive] = useState(0);
    const feature = AI_HIGHLIGHTS[active];
    const advance = () => setActive((index) => (index + 1) % AI_HIGHLIGHTS.length);

    return (
        <div className="mx-auto grid w-[min(1180px,calc(100%-2.5rem))] grid-cols-[minmax(0,1fr)_minmax(0,28rem)] items-center gap-[clamp(2rem,5vw,4rem)] max-[980px]:grid-cols-1">
            <Reveal className="min-w-0">
                {children}

                <ul className="mt-7 grid gap-2">
                    {AI_HIGHLIGHTS.map((highlight, index) => (
                        <li key={highlight.title}>
                            <button
                                type="button"
                                aria-pressed={index === active}
                                onClick={() => setActive(index)}
                                className={cn(
                                    "w-full rounded-xl border px-4 py-3 text-left text-[0.95rem] text-muted-foreground transition-colors",
                                    index === active
                                        ? "border-[color-mix(in_srgb,var(--type-prompt)_45%,transparent)] bg-[color-mix(in_srgb,var(--type-prompt)_10%,transparent)]"
                                        : "border-transparent hover:bg-white/[0.03]",
                                )}
                            >
                                <strong className="font-semibold text-foreground">
                                    {highlight.title}
                                </strong>{" "}
                                {highlight.body}
                            </button>
                        </li>
                    ))}
                </ul>
            </Reveal>

            <Reveal className="min-w-0">
                <div className="mx-auto aspect-[4/5] w-full max-w-[28rem] overflow-hidden rounded-xl border border-border bg-background shadow-[0_40px_70px_-50px_rgba(0,0,0,1)]">
                    <LoopingVideo
                        video={feature.video}
                        label={`Recording of ${feature.title.replace(/\.$/, "")} in the SlyKeep item drawer`}
                        loop={false}
                        onEnded={advance}
                        className="size-full object-cover object-top"
                    />
                </div>
            </Reveal>
        </div>
    );
}
