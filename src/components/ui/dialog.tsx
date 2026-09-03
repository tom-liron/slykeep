"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

/**
 * The shadcn/ui dialog primitive: a centred modal, adapted for this app's responsive rules.
 *
 * The base modal behind the create-item and edit-collection dialogs and, via `ui/command.tsx`, the
 * command palette. {@link DialogContent} carries the width, height, and scroll behaviour every
 * dialog inherits; {@link DialogFooter} lays its buttons out with a container query against it.
 */

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
            {/* The 2rem gutter lives in `w-` and the size cap in `max-w-`, so the two compose:
                viewport minus gutter up to the cap, cap beyond. Keep them on different properties
                — two `max-width` values let tailwind-merge drop one.

                `max-h-[calc(100dvh-2rem)]` is the vertical half: a dialog taller than the window
                would carry its footer off screen. It is a floor under every dialog; a long form
                scrolls its own fields instead (see `CreateItemDialog`).

                `[scrollbar-gutter:stable]` reserves the `.app-scrollbar` width so fields do not
                shift sideways when a height-changing dialog starts to overflow.

                `@container` so `DialogFooter` lays its buttons out against this element's per-dialog
                width, not the viewport. `overflow-x-hidden` because `overflow-y: auto` also
                resolves `overflow-x` to `auto`, and `DialogFooter`'s `-mx-4` bleed would draw a
                scrollbar. */}
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
            // Padded clear of the close button laid over the content's top-right corner. It is
            // `size="icon-sm"` (28px with a mouse, 44px on a coarse pointer), and the `pr`
            // clearance covers both so a wrapped description does not run under the ✕. It lives
            // here because the button is `DialogContent`'s and every dialog gets one.
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
            // `@sm` is a container query against `DialogContent`'s `@container`: the question is
            // whether two buttons fit side by side in *this dialog*, whose width is its own
            // per-dialog cap rather than the window's, so a viewport `sm` would give the wrong
            // answer for a narrower or wider dialog on the same screen.
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
