/**
 * The four brand marks (Notion, GitHub, Slack, VS Code) that drift in `ChaosField`'s hero
 * animation.
 *
 * Inline SVG because these are brand logos and lucide has no equivalent — everything else in the
 * field is a lucide icon. Each keeps its own brand colours as fixed fills, not `currentColor`.
 */

type MarkProps = { className?: string };

export function NotionMark({ className }: MarkProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#fff" />
            <path
                d="M8 17V7l8 10V7"
                stroke="#0d0d0d"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function GitHubMark({ className }: MarkProps) {
    return (
        <svg viewBox="0 0 24 24" fill="#e6e6e6" className={className} aria-hidden="true">
            <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.9 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.2 4.9 18.2 5.2 18.2 5.2c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
        </svg>
    );
}

export function SlackMark({ className }: MarkProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <rect x="3" y="8" width="18" height="3" rx="1.5" fill="#36C5F0" />
            <rect x="3" y="13" width="18" height="3" rx="1.5" fill="#2EB67D" />
            <rect x="8" y="3" width="3" height="18" rx="1.5" fill="#E01E5A" />
            <rect x="13" y="3" width="3" height="18" rx="1.5" fill="#ECB22E" />
        </svg>
    );
}

export function VsCodeMark({ className }: MarkProps) {
    return (
        <svg viewBox="0 0 24 24" fill="#22a6f2" className={className} aria-hidden="true">
            <path d="M23.15 2.59 18.21.21a1.5 1.5 0 0 0-1.71.29l-9.46 8.63-4.12-3.13a1 1 0 0 0-1.27.06L.33 7.26a1 1 0 0 0 0 1.48L3.9 12 .33 15.26a1 1 0 0 0 0 1.48l1.32 1.2a1 1 0 0 0 1.27.06l4.12-3.13 9.46 8.63a1.5 1.5 0 0 0 1.71.29l4.94-2.38a1.5 1.5 0 0 0 .85-1.35V3.94a1.5 1.5 0 0 0-.85-1.35ZM18 17.45 10.83 12 18 6.55v10.9Z" />
        </svg>
    );
}
