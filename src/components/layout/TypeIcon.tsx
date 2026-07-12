import {
  Code,
  File,
  Image,
  Link,
  Sparkles,
  StickyNote,
  Terminal,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Maps the icon names stored on item types (see mock-data) to their
 * lucide-react components. Falls back to `File` for unknown names.
 */
const ICONS: Record<string, LucideIcon> = {
  Code,
  Sparkles,
  Terminal,
  StickyNote,
  File,
  Image,
  Link,
};

export function TypeIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name] ?? File;
  return <Icon {...props} />;
}
