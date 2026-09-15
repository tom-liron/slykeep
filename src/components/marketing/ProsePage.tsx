/**
 * The shared shell for the site's written pages — `/privacy` and `/terms`: a narrow prose column
 * with a title and the date the text was last changed.
 *
 * Both render inside the `(marketing)` route group, so they arrive with `MarketingNav` and
 * `MarketingFooter` already around them and read as part of the site rather than as loose
 * documents. This supplies only what sits between: a measure narrow enough for continuous prose,
 * which the 1180px marketing sections are not.
 *
 * A new written page composes {@link ProsePage} and {@link ProseSection}; neither holds any copy of
 * its own.
 */

/**
 * One `<h2>`-titled section of a written page.
 *
 * `id` is set on the section rather than the heading so that a link to it lands above the heading
 * instead of level with it.
 */
export function ProseSection({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-20">
            <h2 className="mt-10 mb-3 text-[1.25rem] font-semibold tracking-[-0.01em]">{title}</h2>
            <div className="grid gap-3 text-[0.95rem] leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_li]:leading-relaxed [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-5">
                {children}
            </div>
        </section>
    );
}

/**
 * The page frame: title, last-updated line, a lead paragraph, and the sections beneath it.
 *
 * @param lastUpdated - Rendered as written, so it carries the document's own date rather than the
 * date it happens to be read. Update it whenever the copy changes.
 */
export function ProsePage({
    title,
    lastUpdated,
    lead,
    children,
}: {
    title: string;
    lastUpdated: string;
    lead: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <article className="mx-auto w-[min(760px,calc(100%-2.5rem))] py-[clamp(3rem,7vw,5rem)]">
            <h1 className="text-[clamp(2rem,4.5vw,2.75rem)] leading-[1.1] font-bold tracking-[-0.03em]">
                {title}
            </h1>
            <p className="mt-3 text-[0.85rem] text-muted-foreground">Last updated {lastUpdated}</p>
            <p className="mt-6 text-[1.02rem] leading-relaxed text-muted-foreground">{lead}</p>
            {children}
        </article>
    );
}
