"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Folder, Settings, Star } from "lucide-react";

import {
  collections,
  currentUser,
  itemTypes,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { TypeIcon } from "./TypeIcon";

/** How many non-favorite collections to surface under "Recent". */
const RECENT_LIMIT = 5;

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      aria-expanded={open}
    >
      <span>{label}</span>
      <ChevronDown
        className={cn(
          "size-4 transition-transform",
          open ? "rotate-0" : "-rotate-90",
        )}
      />
    </button>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [typesOpen, setTypesOpen] = useState(true);
  const [collectionsOpen, setCollectionsOpen] = useState(true);

  const favoriteCollections = collections.filter((c) => c.isFavorite);
  const recentCollections = collections
    .filter((c) => !c.isFavorite)
    .slice(0, RECENT_LIMIT);

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        {/* Types */}
        <SectionHeader
          label="Types"
          open={typesOpen}
          onToggle={() => setTypesOpen((v) => !v)}
        />
        {typesOpen && (
          <ul className="mb-2 mt-1 space-y-0.5">
            {itemTypes.map((type) => {
              const href = `/items/${type.slug}`;
              const active = pathname === href;
              return (
                <li key={type.id}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                      active && "bg-sidebar-accent font-medium",
                    )}
                  >
                    <TypeIcon
                      name={type.icon}
                      className="size-4 shrink-0"
                      style={{ color: type.color }}
                    />
                    <span className="flex-1 truncate">{type.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {type.count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="my-2 border-t border-border" />

        {/* Collections */}
        <SectionHeader
          label="Collections"
          open={collectionsOpen}
          onToggle={() => setCollectionsOpen((v) => !v)}
        />
        {collectionsOpen && (
          <div className="mt-1 space-y-3">
            {favoriteCollections.length > 0 && (
              <div>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Favorites
                </p>
                <ul className="space-y-0.5">
                  {favoriteCollections.map((collection) => (
                    <CollectionLink
                      key={collection.id}
                      href={`/collections/${collection.id}`}
                      name={collection.name}
                      active={pathname === `/collections/${collection.id}`}
                      onNavigate={onNavigate}
                      trailing={
                        <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                      }
                    />
                  ))}
                </ul>
              </div>
            )}

            {recentCollections.length > 0 && (
              <div>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent
                </p>
                <ul className="space-y-0.5">
                  {recentCollections.map((collection) => (
                    <CollectionLink
                      key={collection.id}
                      href={`/collections/${collection.id}`}
                      name={collection.name}
                      active={pathname === `/collections/${collection.id}`}
                      onNavigate={onNavigate}
                      trailing={
                        <span className="text-xs text-muted-foreground">
                          {collection.itemCount}
                        </span>
                      }
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User area */}
      <div className="flex shrink-0 items-center gap-3 border-t border-border p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
          {currentUser.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUser.image}
              alt={currentUser.name}
              className="size-9 rounded-full object-cover"
            />
          ) : (
            currentUser.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{currentUser.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {currentUser.email}
          </p>
        </div>
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-label="Settings"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <Settings className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function CollectionLink({
  href,
  name,
  active,
  trailing,
  onNavigate,
}: {
  href: string;
  name: string;
  active: boolean;
  trailing: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
          active && "bg-sidebar-accent font-medium",
        )}
      >
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{name}</span>
        {trailing}
      </Link>
    </li>
  );
}
