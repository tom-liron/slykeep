"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The shadcn `Command` primitive: cmdk's command-menu components under this app's styling.
 *
 * The building blocks of the ⌘K command palette (`layout/CommandPalette.tsx`). The class names
 * over cmdk's primitives are reproduced here directly, against this project's `dialog.tsx`, so the
 * only dependency is `cmdk` itself. {@link CommandDialog} wraps the list in a {@link Dialog}.
 */
function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
    return (
        <CommandPrimitive
            data-slot="command"
            className={cn(
                "flex size-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground",
                className,
            )}
            {...props}
        />
    );
}

/**
 * The palette's shell. The title and description are present but visually hidden: Radix requires
 * both for an accessible dialog, and the palette names itself with its input placeholder.
 */
function CommandDialog({
    title = "Search",
    description = "Search your items and collections",
    children,
    className,
    ...props
}: React.ComponentProps<typeof Dialog> & {
    title?: string;
    description?: string;
    className?: string;
}) {
    return (
        <Dialog {...props}>
            <DialogContent
                // Sits high rather than centred: a palette grows downward as you type. The base
                // content class's `w-[calc(100%-2rem)]` is left in place so it still insets on a
                // phone.
                //
                // `[scrollbar-gutter:auto]` overrides `DialogContent`'s `stable`. This palette is
                // `overflow-hidden` and never scrolls, so the reserved 10px gutter would just be a
                // blank strip down the right edge under `p-0`.
                className={cn(
                    "top-[20%] max-w-lg translate-y-0 overflow-hidden p-0 [scrollbar-gutter:auto]",
                    className,
                )}
                showCloseButton={false}
            >
                <DialogTitle className="sr-only">{title}</DialogTitle>
                <DialogDescription className="sr-only">{description}</DialogDescription>
                {children}
            </DialogContent>
        </Dialog>
    );
}

function CommandInput({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
    return (
        <div data-slot="command-input-wrapper" className="flex items-center gap-2 border-b px-3">
            <SearchIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
            <CommandPrimitive.Input
                data-slot="command-input"
                className={cn(
                    "flex h-11 w-full bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
                    className,
                )}
                {...props}
            />
        </div>
    );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
    return (
        <CommandPrimitive.List
            data-slot="command-list"
            className={cn(
                "max-h-80 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
                className,
            )}
            {...props}
        />
    );
}

function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
    return (
        <CommandPrimitive.Empty
            data-slot="command-empty"
            className="py-8 text-center text-sm text-muted-foreground"
            {...props}
        />
    );
}

function CommandGroup({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
    return (
        <CommandPrimitive.Group
            data-slot="command-group"
            className={cn(
                "overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground",
                className,
            )}
            {...props}
        />
    );
}

function CommandSeparator({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
    return (
        <CommandPrimitive.Separator
            data-slot="command-separator"
            className={cn("-mx-1 h-px bg-border", className)}
            {...props}
        />
    );
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
    return (
        <CommandPrimitive.Item
            data-slot="command-item"
            className={cn(
                "relative flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        />
    );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="command-shortcut"
            className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
            {...props}
        />
    );
}

export {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
};
