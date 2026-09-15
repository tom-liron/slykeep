import { AiFeatureShowcase } from "@/components/marketing/AiFeatureShowcase";

/**
 * The landing page's AI section: the Pro badge and pitch, beside recordings of each AI feature
 * working in the real item drawer.
 *
 * One of the sections composed by the `/welcome` page. The heading copy renders here on the server;
 * {@link AiFeatureShowcase} owns which feature is selected and plays its clip.
 */
export function AiSection() {
    return (
        <section id="ai" className="scroll-mt-20 bg-background py-[clamp(3rem,6vw,4.5rem)]">
            <AiFeatureShowcase>
                <span className="mb-4.5 inline-block rounded-full border border-primary/45 bg-primary/14 px-2.5 py-1 text-[0.72rem] font-bold tracking-[0.06em] text-[#F6C76A] uppercase">
                    Pro Feature
                </span>
                <h2 className="font-display text-[clamp(1.8rem,3.7vw,2.7rem)] leading-[1.15] font-bold font-stretch-112% tracking-[-0.025em]">
                    Paste it in. AI does the rest.
                </h2>
                <p className="mt-3.5 text-[1.02rem] text-muted-foreground">
                    With SlyKeep Pro, everything you save gets suggested tags and a clear summary,
                    plus code explanations and sharper prompts on demand. Your library stays
                    organised without the busywork.
                </p>
            </AiFeatureShowcase>
        </section>
    );
}
