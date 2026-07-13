import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Appends an alpha channel (0–1 opacity) to a 6-digit hex color, e.g. "#3b82f6" → "#3b82f61a". */
export function withAlpha(hexColor: string, opacity = 0.1): string {
    const clamped = Math.max(0, Math.min(1, opacity));
    const alpha = Math.round(clamped * 255)
        .toString(16)
        .padStart(2, "0");
    return `${hexColor}${alpha}`;
}
