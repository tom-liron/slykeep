"use client";

import { useRef, useState } from "react";
import { FileUp, ImageIcon, ImageUp, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFileUpload, type UploadedFile } from "@/hooks/use-file-upload";
import { acceptAttribute, FILE_CONSTRAINTS, type FileItemTypeName } from "@/lib/file-constraints";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The file picker behind a `file` or `image` item form: a drop zone, an in-progress upload, and the
 * uploaded-file row.
 *
 * The transfer itself is `useFileUpload` (an `XMLHttpRequest`, for the progress events `fetch`
 * cannot give). This component owns only the presentational state: whether the pointer is dragging
 * over the zone, and the hidden file input the zone stands in for. The parent form holds the
 * resulting {@link UploadedFile} and submits it.
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
    const [isDragging, setIsDragging] = useState(false);

    const { progress, upload } = useFileUpload({ itemType, onUploaded, onError });

    const isUploading = progress !== null;
    const { maxSize } = FILE_CONSTRAINTS[itemType];

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
            <UploadedFileRow
                file={value}
                itemType={itemType}
                onRemove={clear}
                disabled={disabled}
            />
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
                        {/* `whitespace-nowrap` so the link wraps as a unit rather than splitting
                            across two lines at narrow widths. */}
                        <span className="font-medium whitespace-nowrap text-primary underline-offset-4 group-hover:underline">
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

/**
 * The field's state once a file is on the server: the object's name and size, and a Remove button.
 *
 * Replaces the drop zone rather than sitting below it — there is one file per item, so a new upload
 * is a replacement.
 */
function UploadedFileRow({
    file,
    itemType,
    onRemove,
    disabled,
}: {
    file: UploadedFile;
    itemType: FileItemTypeName;
    onRemove: () => void;
    disabled?: boolean;
}) {
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
                <p className="truncate text-sm font-medium">{file.fileName}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</p>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                disabled={disabled}
                aria-label={`Remove ${file.fileName}`}
            >
                <X aria-hidden="true" />
            </Button>
        </div>
    );
}
