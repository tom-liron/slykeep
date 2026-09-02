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
 * A FILE item's body, shown rather than downloaded wherever that is possible.
 *
 * `filePreviewFor` decides which of these applies — an image is a picture, a PDF goes to the
 * browser's own viewer, markdown is rendered as a note is, and every other text format is
 * highlighted in the same editor a snippet gets. The name-and-size card is the floor, always present
 * beneath whatever was rendered, because it is the one thing true of every file.
 *
 * The PDF is the one preview that changes shape with the room available: embedded wherever the panel
 * can hold a page, and a link into the browser's full-screen viewer on a phone, where it cannot.
 *
 * The image is a plain `<img>`, not `next/image`. The source is an authorized route that answers
 * from the session cookie, and Next's optimizer fetches the URL itself, without one — so the
 * optimized variant would 404 while the direct request succeeds. There is nothing to optimize
 * either: the object is already sized, and it sits behind a private route no CDN can cache.
 */

/**
 * Below this viewport width, a PDF is opened rather than embedded.
 *
 * A *width* query and not `useCoarsePointer`, which is what this was first written as and what the
 * editors correctly use. The question those ask is whether the input is a finger; the question here
 * is whether a page fits, and the two disagree on exactly the device that matters — an iPad has a
 * coarse pointer and a panel wide enough to read a PDF in, and it would have lost the embed for no
 * reason. Nothing about a finger makes a document unreadable; 360px of width does.
 *
 * 448px is `28rem`, on Tailwind's own scale, and it sits in a wide gap rather than near anything.
 * The largest phone in portrait is 440px (iPhone Pro Max); the smallest tablet in portrait is 744px
 * (iPad mini). So every phone is below the line, every tablet is above it, and no real device sits
 * close enough for the exact number to be load-bearing.
 *
 * A `max-width`, so the non-matching answer is "embed" — `useMediaQuery` returns `false` on the
 * server, and the safe default is the behaviour every desktop had before this existed.
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
                    // On a phone the document goes to the browser's own full-screen viewer
                    // instead of into the panel.
                    //
                    // The embed below is a fixed 384px box, and on a phone the drawer is roughly the
                    // full viewport width — about 360px. The viewer then lays a page out in a frame
                    // too small to hold one, so the reader gets a fraction of it and has to scroll
                    // both horizontally and vertically to read a single page. Full-screen is not a
                    // consolation prize there; it is the only place a phone can page and pinch a PDF.
                    //
                    // `src` unmodified, with no `?download`, so the route answers
                    // `Content-Disposition: inline` — `isInlineDisposition` allows `.pdf` — and the
                    // phone opens its viewer rather than saving the file. Downloading is still the
                    // toolbar's own control, which is why this one is not named for it.
                    <Button variant="outline" asChild className="w-full">
                        <a href={src} target="_blank" rel="noreferrer">
                            <ExternalLink aria-hidden="true" />
                            Open PDF
                        </a>
                    </Button>
                ) : (
                    // The browser's own viewer, scrolling and paging the document itself.
                    // `#toolbar=0` hides its chrome: the overflow menu offers "two page view",
                    // "annotations", and "document properties", none of which do anything useful for
                    // a single embedded file, and its download and print buttons duplicate ours —
                    // with the difference that ours names the file correctly. `title` is what a
                    // screen reader announces.
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
