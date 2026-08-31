"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
        <DialogPrimitive.Overlay
            data-slot="dialog-overlay"
            className={cn(
                "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
                className,
            )}
            {...props}
        />
    );
}

function DialogContent({
    className,
    children,
    showCloseButton = true,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
}) {
    return (
        <DialogPortal>
            <DialogOverlay />
            {/* The 2rem gutter lives in `w-`, and the size cap lives in `max-w-`. Two properties,
                both unconditional, so they compose instead of taking turns: the dialog is the
                viewport minus a gutter until it reaches its cap, and the cap after that. Width is
                then monotonic in the viewport, which is the whole point of writing it this way.

                It used to be `w-full max-w-[calc(100%-2rem)] sm:max-w-sm`, with callers overriding
                the `sm:` half. Both halves are `max-width`, so tailwind-merge keeps one — which
                made the gutter and the cap take turns at 640px, and the cap is the *smaller* of
                the two there: a dialog reached 607px at a 639px viewport and snapped back to
                512px at 640px. Widening the window made the dialog narrower, and re-wrapped
                everything inside it on the way.

                `max-h` is the vertical half of the same gutter: centred by `-translate-y-1/2`, a
                dialog taller than the window hangs off both ends with its footer — and therefore
                its submit button — off screen entirely. Phone landscape and a short laptop window
                both land there.

                It is a floor under every dialog rather than the mechanism any of them scrolls by:
                a form that reaches it should scroll its *fields* and leave its header and footer
                where they are, which is what `CreateItemDialog` does with its own scroller. This
                one catches whatever does not.

                `scrollbar-gutter: stable` because `.app-scrollbar` is a classic 10px bar, not an
                overlay one, so it takes width from the content box the moment this scrolls. The
                New item dialog changes height with the selected type — `link` is the only one
                short enough not to overflow — so without the reservation every field in the form
                jumped 11px sideways on each switch to it and back.

                `@container` so `DialogFooter` can lay its buttons out against *this* element's
                width. A viewport breakpoint cannot: the width it would need to test is the cap,
                and the cap is per-dialog.

                `overflow-x-hidden` because `overflow-y: auto` alone computes `overflow-x` to `auto`
                as well, and `DialogFooter` deliberately breaks the padding with `-mx-4` — which is
                inline overflow, and would otherwise put a horizontal scrollbar under a dialog that
                is not too wide for anything. */}
            <DialogPrimitive.Content
                data-slot="dialog-content"
                className={cn(
                    "app-scrollbar @container fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 overflow-x-hidden overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none [scrollbar-gutter:stable] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                    className,
                )}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <DialogPrimitive.Close data-slot="dialog-close" asChild>
                        <Button variant="ghost" className="absolute top-2 right-2" size="icon-sm">
                            <XIcon />
                            <span className="sr-only">Close</span>
                        </Button>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </DialogPortal>
    );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-header"
            // Padded clear of the close button, which is laid over this block's top-right corner
            // and is not one width. It is `size="icon-sm"` — 28px with a mouse, but every button
            // size carries a `pointer-coarse:` floor of 44px, so on a phone it occupies 52px in
            // from the content's right edge and 52px down from its top. The title is short enough
            // in every dialog here to clear it either way; the *description* is not — it is a
            // wrapped sentence starting around 40px down, so its first line ran straight under the
            // ✕ on any touch device. The clearance belongs here rather than on each dialog because
            // the button is `DialogContent`'s and every dialog gets one.
            className={cn("flex flex-col gap-2 pr-8 pointer-coarse:pr-10", className)}
            {...props}
        />
    );
}

function DialogFooter({
    className,
    showCloseButton = false,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    showCloseButton?: boolean;
}) {
    return (
        <div
            data-slot="dialog-footer"
            // `@sm`, not `sm` — a container query against `DialogContent`, which declares
            // `@container` for it. The question here is whether two buttons fit side by side in
            // *this dialog*, and the dialog's width is its own cap, not the window's: on a viewport
            // wide enough for `sm` a 512px dialog and a 384px one want different answers, and one
            // narrow enough to fail it may still be holding a dialog with room for a row.
            className={cn(
                "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 @sm:flex-row @sm:justify-end",
                className,
            )}
            {...props}
        >
            {children}
            {showCloseButton && (
                <DialogPrimitive.Close asChild>
                    <Button variant="outline">Close</Button>
                </DialogPrimitive.Close>
            )}
        </div>
    );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn("font-heading text-base leading-none font-medium", className)}
            {...props}
        />
    );
}

function DialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn(
                "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
                className,
            )}
            {...props}
        />
    );
}

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
};
