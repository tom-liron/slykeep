"use client";

import { useRef, useState } from "react";
import { FileUp, ImageIcon, ImageUp, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    acceptAttribute,
    FILE_CONSTRAINTS,
    validateUpload,
    type FileItemTypeName,
} from "@/lib/file-constraints";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/** What an upload leaves behind for the dialog to submit with the rest of the form. */
export type UploadedFile = {
    key: string;
    fileName: string;
    fileSize: number;
};

/**
 * The file picker behind a `file` or `image` item: a drop zone, an upload, and what was uploaded.
 *
 * The upload runs the moment a file is chosen rather than on submit, because that is what makes a
 * progress bar possible at all — and progress is why this uses `XMLHttpRequest` and not `fetch`.
 * `fetch` cannot report how much of a *request* body has gone out; `xhr.upload.onprogress` can, and
 * on a 10 MB file over a slow connection the difference is a real answer versus a spinner.
 *
 * The cost of uploading early is an object in R2 that no item points at if the dialog is then
 * abandoned. That trade is deliberate — see `context/current-feature.md`.
 */
export function FileUpload({
    itemType,
    value,
    onUploaded,
    onError,
    disabled,
    inputId,
}: {
    itemType: FileItemTypeName;
    /** The upload the parent is holding, so this renders what is actually going to be submitted. */
    value: UploadedFile | null;
    onUploaded: (file: UploadedFile | null) => void;
    onError: (message: string) => void;
    disabled?: boolean;
    inputId: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const isUploading = progress !== null;
    const { maxSize } = FILE_CONSTRAINTS[itemType];

    const upload = (file: File) => {
        // The same rules the route enforces, run first only to spare an obviously doomed upload.
        // The route is the authority; this is never the only check.
        const validation = validateUpload(file, itemType);

        if (!validation.valid) {
            onError(validation.error);

            return;
        }

        const body = new FormData();
        body.append("file", file);
        body.append("itemType", itemType);

        const request = new XMLHttpRequest();

        setProgress(0);

        request.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                setProgress(Math.round((event.loaded / event.total) * 100));
            }
        };

        request.onload = () => {
            setProgress(null);

            if (request.status >= 200 && request.status < 300) {
                const uploaded = safeUploadOf(request.responseText);

                if (uploaded) {
                    onUploaded(uploaded);
                } else {
                    // A 2xx that is not our JSON did not come from the route — a proxy, a captive
                    // portal, or a session that expired into a redirect.
                    onError("The upload did not complete. Try again.");
                }

                return;
            }

            // The route answers every refusal as `{ error }`; anything else came from further out.
            const message = safeErrorOf(request.responseText);

            onError(message ?? "Could not upload that file. Try again.");
        };

        request.onerror = () => {
            setProgress(null);
            onError("Could not reach the server. Check your connection and try again.");
        };

        request.open("POST", "/api/upload");
        request.send(body);
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);

        if (disabled || isUploading) return;

        const [file] = event.dataTransfer.files;

        if (file) upload(file);
    };

    const clear = () => {
        onUploaded(null);
        // The input keeps the last selection, so choosing the same file again would fire no `change`
        // event and the drop zone would sit empty.
        if (inputRef.current) inputRef.current.value = "";
    };

    if (value) {
        return (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                    {itemType === "image" ? (
                        <ImageIcon className="size-4" aria-hidden="true" />
                    ) : (
                        <FileUp className="size-4" aria-hidden="true" />
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{value.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                        {formatFileSize(value.fileSize)}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clear}
                    disabled={disabled}
                    aria-label={`Remove ${value.fileName}`}
                >
                    <X aria-hidden="true" />
                </Button>
            </div>
        );
    }

    const isInteractive = !disabled && !isUploading;

    return (
        // A `label` rather than a div, so the whole zone opens the picker — the thing it looks like
        // it should do. That is also what lets the hover state cover the entire target instead of
        // only the words in the middle of it: `group` below tints the icon and underlines the phrase
        // from anywhere inside. The file input stays `sr-only` but focusable, and
        // `has-[:focus-visible]` draws the ring the input itself cannot.
        <label
            htmlFor={inputId}
            onDragOver={(event) => {
                event.preventDefault();
                if (isInteractive) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
                "group block rounded-lg border border-dashed border-border p-6 text-center transition-colors",
                "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                isInteractive && "cursor-pointer hover:border-primary/60 hover:bg-muted/40",
                isDragging && "border-primary bg-primary/5",
                disabled && "opacity-60",
            )}
        >
            <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept={acceptAttribute(itemType)}
                disabled={disabled || isUploading}
                onChange={(event) => {
                    const [file] = event.target.files ?? [];

                    if (file) upload(file);
                }}
                className="sr-only"
            />

            {isUploading ? (
                <div className="space-y-2">
                    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        Uploading… {progress}%
                    </p>
                    {/* `progressbar` rather than `<progress>`: the visual is a filled div, and the
                        role carries the same value to a screen reader without a second element. */}
                    <div
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Upload progress"
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                    >
                        <div
                            className="h-full rounded-full bg-primary transition-[width] duration-150"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {/* The drop zone's only visual cue that it takes a file at all — the border
                        alone reads as an empty box. Type-specific, so an image field looks like one
                        before anything is chosen. */}
                    <span
                        className={cn(
                            "mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors",
                            isInteractive && "group-hover:bg-primary/10 group-hover:text-primary",
                            isDragging && "bg-primary/10 text-primary",
                        )}
                    >
                        {itemType === "image" ? (
                            <ImageUp className="size-5" aria-hidden="true" />
                        ) : (
                            <FileUp className="size-5" aria-hidden="true" />
                        )}
                    </span>
                    {/* Plain text, not a button: the label around it is already the control, and a
                        button inside it would be a second one firing the same picker. */}
                    <p className="text-sm text-muted-foreground">
                        Drag and drop, or{" "}
                        <span className="font-medium text-primary underline-offset-4 group-hover:underline">
                            choose a file
                        </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {FILE_CONSTRAINTS[itemType].extensions.join(", ")} · up to{" "}
                        {formatFileSize(maxSize)}
                    </p>
                </div>
            )}
        </label>
    );
}

/** A JSON body, or undefined when the response was not JSON at all (an HTML error page, say). */
function parseBody(body: string): Record<string, unknown> | undefined {
    try {
        const parsed: unknown = JSON.parse(body);

        return parsed && typeof parsed === "object"
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

/** The `error` a refusal carries, when the response is the shape this route sends. */
function safeErrorOf(body: string): string | undefined {
    const { error } = parseBody(body) ?? {};

    return typeof error === "string" ? error : undefined;
}

/** The upload a success carries, checked field by field rather than asserted. */
function safeUploadOf(body: string): UploadedFile | undefined {
    const { key, fileName, fileSize } = parseBody(body) ?? {};

    if (typeof key !== "string" || typeof fileName !== "string" || typeof fileSize !== "number") {
        return undefined;
    }

    return { key, fileName, fileSize };
}
