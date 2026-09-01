"use client";

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
 * The image is a plain `<img>`, not `next/image`. The source is an authorized route that answers
 * from the session cookie, and Next's optimizer fetches the URL itself, without one — so the
 * optimized variant would 404 while the direct request succeeds. There is nothing to optimize
 * either: the object is already sized, and it sits behind a private route no CDN can cache.
 */
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

            {preview.kind === "pdf" && (
                // The browser's own viewer, scrolling and paging the document itself. `#toolbar=0`
                // hides its chrome: the overflow menu offers "two page view", "annotations", and
                // "document properties", none of which do anything useful for a single embedded
                // file, and its download and print buttons duplicate ours — with the difference that
                // ours names the file correctly. `title` is what a screen reader announces.
                <iframe
                    src={`${src}#toolbar=0`}
                    title={name}
                    className="h-96 w-full rounded-lg border border-border bg-muted/40"
                />
            )}

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
