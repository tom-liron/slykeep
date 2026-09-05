import { cn } from "@/lib/utils";

/**
 * Centered heading block for the `/welcome` page's features and pricing sections.
 *
 * `FeatureGrid` and `PricingPlans` supply their section copy; `children` holds the billing-cycle
 * toggle. `Hero` and `AiSection` use their own heading treatments.
 */
export function SectionHeading({
    eyebrow,
    title,
    sub,
    className,
    children,
}: {
    eyebrow: string;
    title: string;
    sub: string;
    className?: string;
    children?: React.ReactNode;
}) {
    return (
        <div className={cn("mx-auto max-w-[660px] text-center", className)}>
            <p className="mb-2.5 text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                {eyebrow}
            </p>
            <h2 className="text-[clamp(1.8rem,3.7vw,2.7rem)] leading-[1.15] font-bold tracking-[-0.03em]">
                {title}
            </h2>
            <p className="mt-3.5 text-[1.02rem] text-muted-foreground">{sub}</p>
            {children}
        </div>
    );
}
