import { CtaButton } from "@/components/marketing/CtaButton";
import { Reveal } from "@/components/marketing/Reveal";

export function CtaSection() {
    return (
        <section className="pt-[clamp(4rem,9vw,7rem)] pb-[clamp(4rem,9vw,7rem)]">
            <Reveal className="relative mx-auto w-[min(1180px,calc(100%-2.5rem))] rounded-[20px] border border-border px-6 py-[clamp(2.5rem,6vw,4.5rem)] text-center [background-image:radial-gradient(90%_120%_at_50%_0%,color-mix(in_srgb,var(--type-snippet)_14%,transparent),transparent_65%),radial-gradient(90%_120%_at_80%_100%,color-mix(in_srgb,var(--type-image)_10%,transparent),transparent_65%),linear-gradient(180deg,var(--card),var(--background))]">
                <h2 className="text-[clamp(1.8rem,3.7vw,2.7rem)] leading-[1.15] font-bold tracking-[-0.03em]">
                    Ready to Organize Your Knowledge?
                </h2>
                <p className="mx-auto mt-3.5 max-w-[480px] text-[1.02rem] text-muted-foreground">
                    It takes about a minute to stash the first thing, and you will never hunt for it
                    again.
                </p>
                <CtaButton href="/register" className="mt-7">
                    Get Started Free
                </CtaButton>
                <p className="mt-4 text-[0.82rem] text-zinc-400">
                    No card required · Your first 50 items are on us
                </p>
            </Reveal>
        </section>
    );
}
