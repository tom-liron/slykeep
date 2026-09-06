import { Skeleton } from "@/components/ui/Skeleton";
import { CARD_GRID } from "@/config/dashboard";

/**
 * The placeholder every signed-in route shows while its server component resolves.
 *
 * It sits at the group's own segment, so Next suspends the pages beneath this layout rather than
 * the shell around them: the sidebar and top bar stay put and only the main pane changes, which is
 * what makes a navigation feel immediate. Nothing between here and a page declares a closer
 * boundary, so this one shape covers all of them — a heading, a card grid and a short list, the
 * arrangement the dashboard, `/collections`, `/favorites` and the item-type listings share.
 */
const CARDS = [0, 1, 2, 3, 4, 5];
const ROWS = [0, 1, 2, 3, 4];

export default function DashboardLoading() {
    return (
        // `status` rather than `alert`: a wait is a polite announcement, and the label is what a
        // screen reader gets in place of a pane full of decorative blocks.
        <div
            role="status"
            aria-label="Loading"
            aria-busy="true"
            className="mx-auto max-w-6xl space-y-8"
        >
            <div className="space-y-2">
                <Skeleton className="h-7 w-52" />
                <Skeleton className="h-4 w-72" />
            </div>

            {/* The same grid the real cards land in, so the placeholders do not reflow into a
                different column count the moment the content arrives. */}
            <div className={CARD_GRID}>
                {CARDS.map((card) => (
                    <Skeleton key={card} className="h-28 rounded-xl" />
                ))}
            </div>

            <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                {ROWS.map((row) => (
                    <Skeleton key={row} className="h-14 rounded-xl" />
                ))}
            </div>
        </div>
    );
}
