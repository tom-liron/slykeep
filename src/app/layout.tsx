import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "DevStash",
    description: "One fast, searchable, AI-enhanced hub for all developer knowledge.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            {/* Two scroll models, split at `md`.

                From `md` up the body is pinned to the viewport and hides its overflow, because the
                app shell is a fixed-height frame that scrolls its own main pane; a growable body
                would scroll too, giving two nested scrollbars.

                Below `md` that pin comes off and the *document* scrolls. A phone's browser chrome
                only collapses while the document is scrolling, so pinning the body costs the URL bar
                its auto-hide for the whole session — permanently spending the vertical space the
                pin was meant to manage. Pull-to-refresh goes the same way, and Next's scroll
                restoration on navigation targets a document that never moves, so every route change
                arrives at whatever offset the last one was left at. `min-h-full` rather than
                nothing, so a short page still fills the screen and the background reaches the
                bottom. */}
            <body className="min-h-full md:h-full md:overflow-hidden">
                {children}
                {/* Mounted at the root so a toast survives the client-side navigation that a
                    successful sign-in triggers — a Toaster inside a route would unmount with it. */}
                <Toaster />
            </body>
        </html>
    );
}
