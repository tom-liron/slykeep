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
        <section
            id="ai"
            // Two background layers. The radial is the purple bloom, centred in the middle of the
            // section rather than on its top edge; the linear over it holds the first and last 30%
            // at `--background`, the same colour the sections above and below paint. The tint
            // therefore reaches both boundaries at zero, and the section blends into its neighbours
            // instead of starting at a hard line.
            className="scroll-mt-20 bg-background py-[clamp(3rem,6vw,4.5rem)] [background-image:linear-gradient(180deg,var(--background)_0%,transparent_30%,transparent_70%,var(--background)_100%),radial-gradient(85%_70%_at_15%_50%,color-mix(in_srgb,var(--type-prompt)_12%,transparent),transparent_70%)]"
        >
            <AiFeatureShowcase>
                <span className="mb-4.5 inline-block rounded-full border border-[color-mix(in_srgb,var(--type-prompt)_45%,transparent)] bg-[color-mix(in_srgb,var(--type-prompt)_14%,transparent)] px-2.5 py-1 text-[0.72rem] font-bold tracking-[0.06em] text-purple-300 uppercase">
                    Pro Feature
                </span>
                <h2 className="text-[clamp(1.8rem,3.7vw,2.7rem)] leading-[1.15] font-bold tracking-[-0.03em]">
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
