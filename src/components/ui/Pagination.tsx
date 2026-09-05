import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { getPageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { PaginationViewModel } from "@/types/view-models";

/**
 * Numbered page navigation for the paginated listings (item-type pages, the collections grid, a
 * collection's items).
 *
 * A server component builds a {@link PaginationViewModel} from `?page=` — see `lib/pagination.ts`
 * and `config/pagination.ts` — and this renders the links from it. {@link getPageWindow} decides
 * which page numbers show and where the ellipses fall.
 */

/** Page 1 is the bare path; a listing's canonical URL carries no `?page=` param for the default. */
function pageHref(basePath: string, page: number): string {
    return page === 1 ? basePath : `${basePath}?page=${page}`;
}

/**
 * Renders numbered page links and unavailable prev/next controls.
 *
 * Prev and next use `<span>` instead of `<Link>` when unavailable, so disabled controls are neither
 * clickable nor announced as links.
 */
export function Pagination({
    pagination,
    basePath,
    className,
}: {
    pagination: PaginationViewModel;
    basePath: string;
    className?: string;
}) {
    const { page, pageCount } = pagination;

    // A single page has no navigation to offer, and the item count above the list already said so.
    if (pageCount <= 1) {
        return null;
    }

    const stepClass = buttonVariants({ variant: "outline", size: "icon" });
    const disabledStepClass = cn(stepClass, "pointer-events-none opacity-50");

    return (
        <nav
            aria-label="Pagination"
            // `flex-wrap`: the widest window — prev, 1, …, p-1, p, p+1, …, last, next — is seven
            // `size="icon"` buttons plus two ellipses, and each button carries a 44px
            // `pointer-coarse:` floor, so on a narrow phone the row is wider than the viewport.
            // Nothing here shrinks or clips, so it must wrap rather than push a horizontal
            // scrollbar under the document.
            className={cn("flex flex-wrap items-center justify-center gap-1", className)}
        >
            {page > 1 ? (
                <Link
                    href={pageHref(basePath, page - 1)}
                    rel="prev"
                    aria-label="Previous page"
                    className={stepClass}
                >
                    <ChevronLeft aria-hidden="true" />
                </Link>
            ) : (
                <span aria-hidden="true" className={disabledStepClass}>
                    <ChevronLeft />
                </span>
            )}

            {getPageWindow(page, pageCount).map((entry, index) =>
                entry === "ellipsis" ? (
                    // Keyed by position because the two ellipses are otherwise identical, and
                    // neither is a page number that could key it.
                    <span
                        key={`ellipsis-${index}`}
                        aria-hidden="true"
                        className="px-1 text-sm text-muted-foreground"
                    >
                        &hellip;
                    </span>
                ) : (
                    <Link
                        key={entry}
                        href={pageHref(basePath, entry)}
                        // The current page is still a link — it is where you already are, so it
                        // needs to say so rather than disappear from the row.
                        aria-current={entry === page ? "page" : undefined}
                        aria-label={`Page ${entry}`}
                        className={buttonVariants({
                            variant: entry === page ? "secondary" : "ghost",
                            size: "icon",
                        })}
                    >
                        {entry}
                    </Link>
                ),
            )}

            {page < pageCount ? (
                <Link
                    href={pageHref(basePath, page + 1)}
                    rel="next"
                    aria-label="Next page"
                    className={stepClass}
                >
                    <ChevronRight aria-hidden="true" />
                </Link>
            ) : (
                <span aria-hidden="true" className={disabledStepClass}>
                    <ChevronRight />
                </span>
            )}
        </nav>
    );
}
