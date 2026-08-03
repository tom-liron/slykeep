"use client";

import {
    CircleCheckIcon,
    InfoIcon,
    Loader2Icon,
    OctagonXIcon,
    TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast host, mounted once in the root layout.
 *
 * Pinned to `dark` rather than reading a theme provider: this app sets `dark` as a fixed class on
 * `<html>` and has no provider to read from. shadcn ships this file wired to `next-themes`, whose
 * `useTheme()` would fall back to `"system"` here and render light toasts over a dark app whenever
 * the OS is set to light. Swap this for the real theme value when the light-mode toggle lands.
 *
 * `richColors` tints success and error toasts by outcome — a dark green/red surface with bright
 * text of the same hue — instead of rendering every toast on the same neutral popover surface. It is
 * sonner's own prop rather than hand-written CSS, so the palette stays consistent with the library
 * and follows the theme. Neutral (`--normal-*` below) still covers plain, info, and loading toasts,
 * which have no outcome to signal.
 */
const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="dark"
            richColors
            className="toaster group"
            position="top-center"
            icons={{
                success: <CircleCheckIcon className="size-4" />,
                info: <InfoIcon className="size-4" />,
                warning: <TriangleAlertIcon className="size-4" />,
                error: <OctagonXIcon className="size-4" />,
                loading: <Loader2Icon className="size-4 animate-spin" />,
            }}
            style={
                {
                    "--normal-bg": "var(--popover)",
                    "--normal-text": "var(--popover-foreground)",
                    "--normal-border": "var(--border)",
                    "--border-radius": "var(--radius)",
                } as React.CSSProperties
            }
            toastOptions={{ classNames: { toast: "cn-toast" } }}
            {...props}
        />
    );
};

export { Toaster };
