"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The shadcn/ui alert-dialog primitive: a modal that interrupts to confirm a destructive action.
 *
 * Used for delete-account, delete-item, and similar confirmations. Distinct from `Dialog` in
 * `ui/dialog.tsx`: it is announced as `alertdialog`, traps focus on the confirm/cancel pair, and
 * cannot be dismissed by an overlay click, so a stray click can neither confirm nor cancel an
 * irreversible action.
 */

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
    return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
    return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogOverlay({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
    return (
        <AlertDialogPrimitive.Overlay
            data-slot="alert-dialog-overlay"
            className={cn(
                "fixed inset-0 z-50 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
                className,
            )}
            {...props}
        />
    );
}

function AlertDialogContent({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
    return (
        <AlertDialogPrimitive.Portal>
            <AlertDialogOverlay />
            {/* `w-[calc(100%-2rem)] max-w-lg` matches `DialogContent` — the 2rem gutter and the
                size cap are separate properties so they compose instead of taking turns at a
                breakpoint, keeping width monotonic in the viewport. `max-h-[calc(100dvh-2rem)]`
                with `overflow-y-auto` is the vertical half: centred by `-translate-y-1/2`, a
                dialog taller than the window would hang off both ends with its footer. See the
                fuller note in `ui/dialog.tsx`. */}
            <AlertDialogPrimitive.Content
                data-slot="alert-dialog-content"
                className={cn(
                    "@container fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                    className,
                )}
                {...props}
            />
        </AlertDialogPrimitive.Portal>
    );
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-dialog-header"
            className={cn("flex flex-col gap-2 text-left", className)}
            {...props}
        />
    );
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-dialog-footer"
            // `@sm` against `AlertDialogContent`'s `@container`, not the viewport — same reasoning
            // as `DialogFooter`.
            className={cn("flex flex-col-reverse gap-2 @sm:flex-row @sm:justify-end", className)}
            {...props}
        />
    );
}

function AlertDialogTitle({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
    return (
        <AlertDialogPrimitive.Title
            data-slot="alert-dialog-title"
            className={cn("text-lg font-semibold", className)}
            {...props}
        />
    );
}

function AlertDialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
    return (
        <AlertDialogPrimitive.Description
            data-slot="alert-dialog-description"
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

function AlertDialogAction({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
    return (
        <AlertDialogPrimitive.Action
            className={cn(buttonVariants({ size: "lg" }), className)}
            {...props}
        />
    );
}

function AlertDialogCancel({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
    return (
        <AlertDialogPrimitive.Cancel
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), className)}
            {...props}
        />
    );
}

export {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    AlertDialogTitle,
    AlertDialogTrigger,
};
