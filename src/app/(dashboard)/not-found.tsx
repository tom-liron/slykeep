import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RouteNotice } from "@/components/ui/RouteNotice";

/**
 * The 404 for a signed-in route whose content is gone: the `notFound()` thrown by
 * `items/[slug]` for an unknown type slug, and by `collections/[id]` for a collection this account
 * does not own — which is where a visitor lands the moment after deleting one.
 *
 * It exists so that case keeps the sidebar and top bar. Without it the nearest boundary is the root
 * `not-found.tsx`, which renders outside this group's layout and would drop the app chrome for a
 * reader who is still signed in.
 */
export const metadata = {
    title: "Not found · SlyKeep",
};

export default function DashboardNotFound() {
    return (
        <RouteNotice
            icon={SearchX}
            code="404"
            title="Not found"
            description="This item or collection no longer exists. It may have been deleted, or it belongs to another account."
        >
            <Button asChild>
                <Link href="/">Back to the dashboard</Link>
            </Button>
            <Button asChild variant="outline">
                <Link href="/collections">Browse collections</Link>
            </Button>
        </RouteNotice>
    );
}
