import { ArrowRight } from "lucide-react";

import { AppPreview } from "@/components/marketing/AppPreview";
import { ChaosField } from "@/components/marketing/ChaosField";
import { CtaButton } from "@/components/marketing/CtaButton";
import { Reveal } from "@/components/marketing/Reveal";
import { Button } from "@/components/ui/button";

/**
 * The headline, and under it the chaos → order figure the whole page turns on: eight app icons
 * drifting on the left, the dashboard they collapse into on the right.
 *
 * The two panels stack below 1024px rather than at the nav's 860. Side by side each one is half the
 * container, and the dashboard mock — which scales its own type to its width — gets too small to
 * read well before the bar itself needs to collapse.
 */
export function Hero() {
    return (
        <header className="relative overflow-hidden pt-[clamp(3rem,8vw,6rem)] pb-[clamp(3rem,7vw,6rem)]">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-64 left-1/2 h-[620px] w-[min(1100px,120vw)] -translate-x-1/2 blur-[90px]"
            >
                <div className="absolute top-[15%] left-[6%] size-[55%] rounded-full bg-[var(--type-snippet)] opacity-20" />
                <div className="absolute top-[6%] right-[8%] size-[55%] rounded-full bg-[var(--type-prompt)] opacity-[0.18]" />
            </div>

            <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))]">
                <Reveal className="relative mx-auto max-w-[780px] text-center">
                    <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-[0.78rem] text-muted-foreground">
                        <span
                            aria-hidden="true"
                            className="size-1.5 rounded-full bg-[var(--type-link)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--type-link)_18%,transparent)]"
                        />
                        Snippets · Prompts · Commands · Notes · Files · Links
                    </p>

                    <h1 className="text-[clamp(2.35rem,6.2vw,4.15rem)] leading-[1.05] font-bold tracking-[-0.035em]">
                        Stop Losing Your{" "}
                        <span className="inline-block bg-[linear-gradient(100deg,var(--type-snippet),var(--type-prompt)_48%,var(--type-image))] bg-clip-text text-transparent">
                            Developer Knowledge
                        </span>
                    </h1>

                    <p className="mx-auto mt-5.5 max-w-[620px] text-[clamp(1rem,1.6vw,1.15rem)] text-muted-foreground">
                        Your snippets live in VS Code, your prompts are buried in chat history, your
                        commands are in a{" "}
                        <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                            .txt
                        </code>{" "}
                        file somewhere. DevStash puts all of it in one fast, searchable place you
                        actually come back to.
                    </p>

                    <div className="mt-8 flex flex-wrap justify-center gap-3 max-[680px]:flex-col">
                        <CtaButton href="/register">Get Started Free</CtaButton>
                        <Button
                            asChild
                            variant="outline"
                            className="h-11 rounded-xl px-6 text-base font-medium hover:-translate-y-px"
                        >
                            {/* A plain anchor, like every other jump on this page: `next/link`
                                would route to `/` and re-enter the proxy for a scroll. */}
                            <a href="#features">See how it works</a>
                        </Button>
                    </div>

                    <p className="mt-4 text-[0.82rem] text-zinc-500">
                        Free forever for your first 50 items · No card required
                    </p>
                </Reveal>

                <Reveal className="mt-[clamp(3rem,7vw,5rem)] grid grid-cols-[1fr_auto_1fr] items-stretch gap-[clamp(0.75rem,2.5vw,2rem)] max-[1024px]:grid-cols-1 max-[1024px]:gap-4">
                    <section
                        aria-labelledby="chaos-label"
                        className="flex flex-col rounded-xl border border-[color-mix(in_srgb,var(--color-red-500)_18%,transparent)] p-4 [background-image:radial-gradient(120%_90%_at_50%_0%,color-mix(in_srgb,var(--color-red-500)_7%,transparent),transparent_70%),linear-gradient(180deg,var(--card),var(--background))]"
                    >
                        <p
                            id="chaos-label"
                            className="mb-3.5 text-[0.8rem] font-medium text-muted-foreground"
                        >
                            Your knowledge today…
                        </p>
                        <ChaosField />
                        <p className="mt-3.5 text-xs text-zinc-500">
                            8 places. None of them searchable together.
                        </p>
                    </section>

                    <div aria-hidden="true" className="grid place-items-center">
                        <span className="relative grid size-[54px] place-items-center rounded-full border border-[color-mix(in_srgb,var(--type-prompt)_40%,transparent)] bg-[color-mix(in_srgb,var(--type-prompt)_12%,transparent)] text-purple-300 max-[1024px]:rotate-90">
                            <span className="absolute inset-0 rounded-full bg-[var(--type-prompt)] opacity-30 motion-safe:animate-ping motion-safe:[animation-duration:2.4s]" />
                            <ArrowRight className="relative size-6" strokeWidth={2.2} />
                        </span>
                    </div>

                    <section
                        aria-labelledby="preview-label"
                        className="flex flex-col rounded-xl border border-[color-mix(in_srgb,var(--type-link)_18%,transparent)] p-4 [background-image:radial-gradient(120%_90%_at_50%_0%,color-mix(in_srgb,var(--type-link)_7%,transparent),transparent_70%),linear-gradient(180deg,var(--card),var(--background))]"
                    >
                        <p
                            id="preview-label"
                            className="mb-3.5 text-[0.8rem] font-medium text-muted-foreground"
                        >
                            …with DevStash
                        </p>
                        <AppPreview />
                        <p className="mt-3.5 text-xs text-zinc-500">
                            One place. Searchable in a keystroke.
                        </p>
                    </section>
                </Reveal>
            </div>
        </header>
    );
}
