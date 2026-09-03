"use client";

import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
// Aliased because the component this file exports already owns the name `FilePreview`.
import { type FilePreview as FilePreviewInfo } from "@/lib/file-preview";
import { formatFileSize } from "@/lib/format";
import { CodeEditor } from "./CodeEditor";
import { MarkdownEditor } from "./MarkdownEditor";

/**
 * A FILE item's body, rendered inline in the drawer wherever that is possible.
 *
 * `filePreviewFor` in `lib/file-preview.ts` decides the `kind`: an image is a picture, a PDF goes
 * to the browser's viewer, markdown renders as a note does, and every other text format is
 * highlighted in the same editor a snippet gets. The name-and-size card is always shown beneath
 * whatever was rendered.
 *
 * @remarks
 * The image is a plain `<img>`, not `next/image`: the source is an authorized route that reads the
 * session cookie, and Next's optimizer fetches the URL without one, so the optimized variant 404s.
 * The object is already sized and sits behind a private route no CDN can cache.
 */

/**
 * Viewport width at or below which a PDF is opened in a new tab instead of embedded.
 *
 * A width query rather than `useCoarsePointer`: the question is whether a page fits, not whether
 * the pointer is a finger. An iPad has a coarse pointer and a panel wide enough to read a PDF in.
 *
 * @remarks
 * 448px is Tailwind's `28rem`, in the gap between the largest portrait phone (440px, iPhone Pro
 * Max) and the smallest portrait tablet (744px, iPad mini), so the exact number is not
 * load-bearing. It is a `max-width` so the non-matching answer — including `useMediaQuery`'s `false`
 * on the server — is "embed".
 */
const PHONE_WIDTH = "(max-width: 448px)";

export function FilePreview({
    name,
    size,
    src,
    preview,
    text,
    error,
}: {
    name: string;
    size: number;
    src: string;
    preview: FilePreviewInfo;
    /** The object's contents, once fetched. Empty for the kinds that are not text. */
    text: string;
    error: string;
}) {
    const phoneWidth = useMediaQuery(PHONE_WIDTH);

    return (
        <div className="space-y-3">
            {preview.kind === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src}
                    alt={name}
                    className="max-h-80 w-full rounded-lg border border-border bg-muted/40 object-contain"
                />
            )}

            {preview.kind === "pdf" &&
                (phoneWidth ? (
                    // On a phone the document opens in the browser's full-screen viewer: the embed
                    // below is a fixed box wider than the drawer on a phone, too small to lay out a
                    // page in.
                    //
                    // `src` unmodified, with no `?download`, so the route answers
                    // `Content-Disposition: inline` (`isInlineDisposition` allows `.pdf`) and the
                    // phone opens its viewer rather than saving. Downloading is the toolbar's own
                    // control.
                    <Button variant="outline" asChild className="w-full">
                        <a href={src} target="_blank" rel="noreferrer">
                            <ExternalLink aria-hidden="true" />
                            Open PDF
                        </a>
                    </Button>
                ) : (
                    // The browser's own viewer, paging the document itself. `#toolbar=0` hides its
                    // chrome, whose download and print buttons duplicate the toolbar's. `title` is
                    // what a screen reader announces.
                    <iframe
                        src={`${src}#toolbar=0`}
                        title={name}
                        className="h-96 w-full rounded-lg border border-border bg-muted/40"
                    />
                ))}

            {(preview.kind === "markdown" || preview.kind === "code") &&
                (error ? (
                    <p className="text-sm text-destructive">{error}</p>
                ) : !text ? (
                    <div className="h-24 animate-pulse rounded-lg bg-muted" />
                ) : preview.kind === "markdown" ? (
                    <MarkdownEditor value={text} readOnly label={`${name} contents`} />
                ) : (
                    <CodeEditor
                        value={text}
                        language={preview.language}
                        readOnly
                        label={`${name} contents`}
                    />
                ))}

            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                        {formatFileSize(size)}
                        {preview.kind === "none" && " · download to open this one"}
                    </p>
                </div>
            </div>
        </div>
    );
}
