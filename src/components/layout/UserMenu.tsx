"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserViewModel } from "@/types/view-models";

/**
 * The signed-in user at the foot of the sidebar, and the account menu behind them.
 *
 * The whole row is the trigger rather than the avatar alone — a 36px circle is a small target on
 * touch, and the name and email next to it look clickable whether or not they are.
 */
export function UserMenu({ user }: { user: UserViewModel }) {
    return (
        <div className="shrink-0 border-t border-border p-3">
            <DropdownMenu>
                <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-expanded:bg-muted">
                    <UserAvatar name={user.name} image={user.image} />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" side="top" className="w-56">
                    <DropdownMenuItem asChild>
                        <Link href="/profile">
                            <User className="size-4" aria-hidden="true" />
                            Profile
                        </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* A form, not an onClick: signing out is a mutation, and routing it through the
                        server action means it still works if the client bundle has not hydrated. */}
                    <form action={signOutAction}>
                        <DropdownMenuItem asChild>
                            <button type="submit" className="w-full">
                                <LogOut className="size-4" aria-hidden="true" />
                                Sign out
                            </button>
                        </DropdownMenuItem>
                    </form>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
