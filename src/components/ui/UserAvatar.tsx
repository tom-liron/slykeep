import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A user's picture, or their initials when there is none.
 *
 * Rendered by `UserMenu` in the sidebar and by the profile page. OAuth accounts arrive with an
 * `image`; credentials accounts never do, so this falls back to initials rather than an empty
 * circle. `getInitials` in `lib/format.ts` handles the awkward names (extra whitespace, single
 * words, blank), so this only chooses which of the two to render.
 *
 * @remarks
 * The image is decorative because every current caller renders the user's name beside it — in
 * `UserMenu`, both sit inside one button — so `alt=""` prevents duplicate announcements. This
 * component has no `alt` prop; add an accessible-name contract before using it without visible text.
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
