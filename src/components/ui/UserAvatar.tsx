import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A user's picture, or their initials when there is none.
 *
 * OAuth accounts arrive with an `image`; credentials accounts never do, and an empty circle reads
 * as a broken avatar rather than a deliberate one. `getInitials` already handles the awkward names
 * (extra whitespace, single words, blank), so this only decides which of the two to render.
 */
export function UserAvatar({
    name,
    image,
    className,
}: {
    name: string;
    image: string | null;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium",
                className,
            )}
        >
            {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={name} className="size-full object-cover" />
            ) : (
                getInitials(name)
            )}
        </span>
    );
}
