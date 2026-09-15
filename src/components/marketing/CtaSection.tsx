import { CtaButton } from "@/components/marketing/CtaButton";
import { Reveal } from "@/components/marketing/Reveal";

/**
 * The landing page's closing call-to-action panel: a headline, a line of copy, and the
 * "Get Started Free" button.
 *
 * One of the sections composed by the `/welcome` page. Static content wrapped in {@link Reveal} for
 * the scroll-in animation.
 */
export function CtaSection() {
    return (
        <section className="pt-[clamp(3rem,6vw,4.5rem)] pb-[clamp(3rem,6vw,4.5rem)]">
            <Reveal className="relative mx-auto w-[min(1180px,calc(100%-2.5rem))] rounded-[20px] border border-border px-6 py-[clamp(2.5rem,6vw,4.5rem)] text-center [background-image:radial-gradient(90%_120%_at_50%_0%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_65%),linear-gradient(180deg,var(--card),var(--background))]">
                <h2 className="font-display text-[clamp(1.8rem,3.7vw,2.7rem)] leading-[1.15] font-bold font-stretch-112% tracking-[-0.025em]">
                    Keep the next thing you look up
                </h2>
                <p className="mx-auto mt-3.5 max-w-[480px] text-[1.02rem] text-muted-foreground">
                    Create a free account and start your library. It takes about a minute.
                </p>
                <CtaButton href="/register" className="mt-7">
                    Get Started Free
                </CtaButton>
                <p className="mt-4 text-[0.82rem] text-muted-foreground">
                    Your first 50 items are free
                </p>
            </Reveal>
        </section>
    );
}
