import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
            {/* h-full, not min-h-full: the app shell is a fixed-height frame that scrolls its own
                main pane. A growable body would scroll too, giving two nested scrollbars. */}
            <body className="h-full overflow-hidden">{children}</body>
        </html>
    );
}
