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
 *
 * {@link TOAST_DURATION_MS} lengthens sonner's default for the same reason: one value here rather
 * than an argument at each of the three dozen call sites.
 */

/**
 * How long a toast stays on screen, against sonner's own default of four seconds.
 *
 * @remarks
 * Set for the error toasts, which carry the longest copy in the application — a refusal has to name
 * what was refused *and* what would fix it, and four seconds is not enough to read one. Sonner has
 * no per-type duration, so the success toasts inherit it; they are short enough that the extra two
 * seconds costs nothing, which is the trade that makes one central value acceptable.
 */
const TOAST_DURATION_MS = 6000;
const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="dark"
            richColors
            duration={TOAST_DURATION_MS}
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
            // `pointer-events-auto` keeps a toast's action button clickable while a Radix modal is
            // open — the item drawer's `Sheet`, the create dialog. The modal sets `pointer-events:
            // none` on `<body>`, the toaster inherits it, and sonner never switches it back on. The
            // Upgrade action on `useAiUpsell`'s Pro refusal is raised from inside such a modal.
            // Sonner's `[data-sonner-toast][data-visible='false']` rule still wins on specificity,
            // so a toast on its way out stays inert.
            toastOptions={{ classNames: { toast: "cn-toast pointer-events-auto" } }}
            {...props}
        />
    );
};

export { Toaster };
