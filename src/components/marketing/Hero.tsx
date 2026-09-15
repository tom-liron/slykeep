import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { CtaButton } from "@/components/marketing/CtaButton";
import { LoopingVideo } from "@/components/marketing/LoopingVideo";
import { Reveal } from "@/components/marketing/Reveal";
import { Button } from "@/components/ui/button";
import { HERO_VIDEO } from "@/config/marketing-media";

/**
 * The landing page's hero: the headline, the sign-up call to action, and a recorded walkthrough
 * of the real app playing in a {@link BrowserFrame}.
 *
 * The first section the `/welcome` page composes. The clip is {@link HERO_VIDEO}.
 */
export function Hero() {
    return (
        <header
            // `-mt-16` pulls the box up under the sticky marketing bar and the extra `4rem` of top
            // padding puts the content back, so the hero starts at the top of the document. This lets the
            // background glow sit behind the nav, which is what makes the nav read as glass —
            // `overflow-hidden` here clips the glow, so a hero starting at the nav's bottom edge
            // would leave nothing behind it to see through.
            className="relative -mt-16 overflow-hidden pt-[calc(4rem_+_clamp(3rem,8vw,6rem))] pb-[clamp(3rem,7vw,6rem)]"
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-64 left-1/2 h-[620px] w-[min(1100px,120vw)] -translate-x-1/2 blur-[90px]"
            >
                <div className="absolute top-[15%] left-[6%] size-[55%] rounded-full bg-primary opacity-[0.16]" />
                <div className="absolute top-[6%] right-[8%] size-[55%] rounded-full bg-[var(--type-image)] opacity-10" />
            </div>

            <div className="mx-auto w-[min(1180px,calc(100%-2.5rem))]">
                <Reveal className="relative mx-auto max-w-[780px] text-center">
                    <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-[0.78rem] text-muted-foreground">
                        <span
                            aria-hidden="true"
                            className="size-1.5 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                        />
                        Snippets · Prompts · Commands · Notes · Files · Links
                    </p>

                    <h1 className="font-display text-[clamp(2.35rem,6.2vw,4.15rem)] leading-[1.05] font-bold font-stretch-112% tracking-[-0.025em]">
                        Save it once.{" "}
                        <span className="inline-block text-primary">Find it in seconds.</span>
                    </h1>

                    <p className="mx-auto mt-5.5 max-w-[600px] text-[clamp(1rem,1.6vw,1.15rem)] text-muted-foreground">
                        Snippets, prompts, commands, notes, files and links in one searchable
                        library. Copy anything back out in a click.
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
                            <a href="#features">Explore the features</a>
                        </Button>
                    </div>

                    <p className="mt-4 text-[0.82rem] text-muted-foreground">
                        For the things you always forget and always need
                    </p>
                </Reveal>

                <Reveal className="mx-auto mt-[clamp(3rem,7vw,4.5rem)] max-w-[1080px]">
                    <BrowserFrame>
                        <LoopingVideo
                            video={HERO_VIDEO}
                            label="SlyKeep walkthrough: searching the library, opening an item and copying it"
                            className="size-full object-cover object-top"
                        />
                    </BrowserFrame>
                </Reveal>
            </div>
        </header>
    );
}
