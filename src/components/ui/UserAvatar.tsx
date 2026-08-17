import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A user's picture, or their initials when there is none.
 *
 * OAuth accounts arrive with an `image`; credentials accounts never do, and an empty circle reads
 * as a broken avatar rather than a deliberate one. `getInitials` already handles the awkward names
 * (extra whitespace, single words, blank), so this only decides which of the two to render.
 *
 * The picture is decorative, hence `alt=""`. Every caller renders the user's name as visible text
 * directly beside it, so an `alt` of the name announces it twice in a row — and in `UserMenu` those
 * two are inside one button, whose accessible name would become "Ada Lovelace Ada Lovelace". If a
 * caller ever shows the avatar *without* the name next to it, that one needs a real `alt` and this
 * should take it as a prop rather than being changed globally.
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
                <img src={image} alt="" className="size-full object-cover" />
            ) : (
                getInitials(name)
            )}
        </span>
    );
}
