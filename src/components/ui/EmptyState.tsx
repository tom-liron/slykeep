/**
 * Placeholder shown in place of a list or section that has no content.
 *
 * The dashboard, the item-type and collection pages, and the favorites view all render this when a
 * query comes back empty, so an empty area reads as "nothing here yet" rather than as a section
 * that failed to load. Presentational and server-safe: it takes a message and nothing else.
 */
export function EmptyState({ message }: { message: string }) {
    return (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {message}
        </p>
    );
}
