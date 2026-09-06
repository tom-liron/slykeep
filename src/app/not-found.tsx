import Link from "next/link";
import { Compass } from "lucide-react";

import { Brand } from "@/components/layout/Brand";
import { Button } from "@/components/ui/button";
import { RouteNotice } from "@/components/ui/RouteNotice";

/**
 * The 404 for a URL that matches no route in the application.
 *
 * Next renders this inside the root layout alone, with none of the group shells around it, so it
 * carries its own bar and its own way back. `(dashboard)/not-found.tsx` is the other half: a
 * `notFound()` thrown by a page that *does* exist keeps the signed-in chrome.
 */
export const metadata = {
    title: "Page not found · DevStash",
};

export default function NotFound() {
    return (
        <div className="flex min-h-dvh flex-col bg-background md:h-dvh md:overflow-y-auto">
            <header className="flex items-center border-b border-border px-4 py-3 sm:px-6">
                <Brand href="/" />
            </header>

            <RouteNotice
                icon={Compass}
                code="404"
                title="This page doesn't exist"
                description="The address doesn't match anything here. It may have been renamed, or the link that brought you was already out of date."
            >
                <Button asChild>
                    <Link href="/">Go to the dashboard</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/welcome">Back to the homepage</Link>
                </Button>
            </RouteNotice>
        </div>
    );
}
