import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { getPageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { PaginationViewModel } from "@/types/view-models";

/** Page 1 is the bare path — a listing's canonical URL shouldn't carry a param that means "default". */
function pageHref(basePath: string, page: number): string {
    return page === 1 ? basePath : `${basePath}?page=${page}`;
}

/**
 * Numbered page links with prev/next either side, for the listings that read `?page=`.
 *
 * Prev and next render as `<span>` rather than a `<Link>` when there is nowhere to go, because a
 * link that only *looks* disabled is still clickable, focusable, and announced as a link. A greyed
 * anchor is the appearance of the state; not being a link is the state.
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
            className={cn("flex items-center justify-center gap-1", className)}
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
