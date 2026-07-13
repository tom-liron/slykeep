import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function withAlpha(hexColor: string, alpha = "1a"): string {
    return `${hexColor}${alpha}`;
}
