/** Dashed placeholder shown when a list or section has no content. */
export function EmptyState({ message }: { message: string }) {
    return (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {message}
        </p>
    );
}
