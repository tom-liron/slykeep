"use client";

import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";

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
 *
 * `onNavigate` closes the mobile drawer this is rendered inside. `SidebarContext` already drops the
 * drawer whenever the path changes, which covers Profile and Settings from anywhere else — this is
 * for the one case that derives from nothing: tapping Profile while already on `/profile`, where the
 * route does not change and the drawer would otherwise sit there over the page it was asked for.
 */
export function UserMenu({ user, onNavigate }: { user: UserViewModel; onNavigate?: () => void }) {
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
                        <Link href="/profile" onClick={onNavigate}>
                            <User className="size-4" aria-hidden="true" />
                            Profile
                        </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                        <Link href="/settings" onClick={onNavigate}>
                            <Settings className="size-4" aria-hidden="true" />
                            Settings
                        </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* A form, not an onClick: signing out is a mutation, and routing it through the
                        server action means it still works if the client bundle has not hydrated. */}
                    <form action={signOutAction} onSubmit={onNavigate}>
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
