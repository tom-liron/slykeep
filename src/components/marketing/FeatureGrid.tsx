import type { CSSProperties } from "react";

import { Reveal } from "@/components/marketing/Reveal";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { MARKETING_FEATURES } from "@/config/marketing";

/**
 * Cards arrive in sequence rather than as one block — but only at three columns. Narrower than that
 * they come into view one at a time anyway, and a delay would just hold back a card that is already
 * on screen. Static strings because Tailwind reads the source, not the rendered class list.
 */
const STAGGER = [
    "",
    "lg:delay-[80ms]",
    "lg:delay-[160ms]",
    "lg:delay-[240ms]",
    "lg:delay-[320ms]",
    "lg:delay-[400ms]",
];

export function FeatureGrid() {
    return (
        <section id="features" className="scroll-mt-20 py-[clamp(4rem,9vw,7rem)]">
            <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))]">
                <Reveal>
                    <SectionHeading
                        eyebrow="Features"
                        title="Everything you stash, in one shape"
                        sub="Seven built-in types, one search box, and collections that let an item live in as many places as it belongs."
                        className="mb-[clamp(2.5rem,5vw,3.5rem)]"
                    />
                </Reveal>

                <div className="grid grid-cols-3 gap-4 max-[980px]:grid-cols-2 max-[680px]:grid-cols-1">
                    {MARKETING_FEATURES.map((feature, index) => (
                        <Reveal
                            key={feature.title}
                            className={`h-full ${STAGGER[index] ?? ""}`.trim()}
                        >
                            <article
                                style={{ "--accent": feature.accent } as CSSProperties}
                                className="group relative h-full rounded-xl border border-border bg-linear-to-b from-card to-background p-6 transition-[transform,border-color,box-shadow] duration-[250ms] hover:-translate-y-[3px] hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:shadow-[0_22px_45px_-30px_color-mix(in_srgb,var(--accent)_70%,transparent)]"
                            >
                                <span className="absolute -inset-x-px -top-px h-0.5 rounded-t-xl bg-[var(--accent)] opacity-0 transition-opacity duration-[250ms] group-hover:opacity-100" />
                                <span className="mb-4.5 grid size-[42px] place-items-center rounded-[11px] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]">
                                    <feature.icon className="size-[21px]" aria-hidden="true" />
                                </span>
                                <h3 className="text-[1.08rem] font-semibold tracking-[-0.015em]">
                                    {feature.title}
                                </h3>
                                <p className="mt-2 text-[0.92rem] text-muted-foreground">
                                    {feature.body}
                                </p>
                            </article>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
