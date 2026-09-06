import { cn } from "@/lib/utils";

/**
 * One placeholder block, sized by its caller.
 *
 * The building piece of the route-level `loading.tsx` skeletons: a page that is still fetching
 * shows the shape of what is coming rather than an empty pane. Decorative, so it is hidden from
 * assistive technology — the route's `loading.tsx` is what announces the wait.
 */
export function Skeleton({ className }: { className?: string }) {
    return (
        <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-muted", className)} />
    );
}
