import type { Metadata } from "next";
import { Geist_Mono, Rethink_Sans } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * The application root layout: the `<html>`/`<body>` shell every route renders inside.
 *
 * Loads the fonts, applies the permanent `dark` theme (there is no toggle yet), sets the app-wide
 * `<title>`/description, and mounts the single {@link Toaster} at the root so a toast survives the
 * client-side navigation a sign-in triggers. The `(marketing)`, `(auth)` and `(dashboard)` route
 * groups each add their own shell beneath this one.
 */
const rethinkSans = Rethink_Sans({
    variable: "--font-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "SlyKeep",
    description:
        "A personal knowledge hub for developers. Save code snippets, terminal commands, AI prompts, notes, files and links — and search across all of them in one keystroke.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            // Route changes still jump straight to the top on a page that sets smooth scrolling on
            // `html`, as the marketing pages do below `md` — Next only forces that with this flag.
            data-scroll-behavior="smooth"
            className={`dark ${rethinkSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            {/* Two scroll models, split at `md`. From `md` up the body is pinned to the viewport and
                hides its overflow: the app shell is a fixed-height frame that scrolls its own main
                pane, and a growable body would add a second scrollbar. Below `md` the pin comes off
                and the document scrolls — pinning the body there costs a phone its URL-bar
                auto-hide, its pull-to-refresh, and Next's scroll restoration on navigation.
                `min-h-full` keeps a short page filling the screen. */}
            <body className="min-h-full md:h-full md:overflow-hidden">
                {children}
                {/* At the root, so a toast survives the navigation a sign-in triggers; a Toaster
                    inside a route would unmount with it. */}
                <Toaster />
            </body>
        </html>
    );
}
