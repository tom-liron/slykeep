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
 * Toast host, mounted once in the root layout and driven by `toast()` calls from anywhere in the
 * app.
 *
 * shadcn ships this wired to `next-themes`; the `theme` prop is pinned to `dark` instead, because
 * the app sets `dark` as a fixed class on `<html>` and has no theme provider to read. The
 * light-mode toggle, when it lands, replaces this literal with the real theme value.
 *
 * @remarks
 * `richColors` is sonner's own prop for tinting success and error toasts by outcome (a green/red
 * surface with matching bright text), keeping that palette in step with the library and the theme
 * rather than styling toasts per call site. The `--normal-*` variables cover plain, info, and
 * loading toasts, which have no outcome to signal. `coding-standards.md` § Styling requires this
 * prop rather than per-call styling.
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
