import { NextResponse } from "next/server";

import { isInlineDisposition } from "@/lib/file-preview";
import { getObject } from "@/server/infra/r2";
import { getItemFile } from "@/server/items";

/**
 * Serves the object behind a file or image item — both the drawer's inline preview and its download
 * button, which differ only by `?download=1`.
 *
 * The bucket is private, so this is the only way to read one. Authorization is a lookup of the
 * *item*, scoped to the signed-in user, and the R2 key is taken from the row that comes back — the
 * key is never accepted from the URL. That is the difference between this and a proxy that checks a
 * path prefix: there is no string for a `..` segment to defeat, because the caller never names the
 * object at all.
 *
 * The body is piped through rather than buffered, so a 10 MB download is not 10 MB of function
 * memory. `Cache-Control: private` because the response is authorized: a shared cache holding it
 * would be able to hand one user's file to the next request that asked.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const file = await getItemFile(id);

    if (!file) {
        return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    let object;

    try {
        object = await getObject(file.key);
    } catch (error) {
        // The row says there is an object and R2 disagrees — a delete that half-failed, or a bucket
        // restored without its contents. A 404 is the honest answer: nothing is retryable here.
        console.error(`R2 read failed for item ${id}:`, error);

        return NextResponse.json({ error: "This file is no longer available." }, { status: 404 });
    }

    const download = new URL(request.url).searchParams.has("download");

    // Images, PDFs, and most text formats are shown rather than downloaded — `isInlineDisposition`
    // owns that list, and the drawer reads the same module to decide which viewer to open. SVG and
    // XML are its exceptions: both are documents that can carry script, so both are served as
    // attachments rather than rendered on this origin.
    const inline = !download && isInlineDisposition(file.name);

    return new NextResponse(object.body, {
        headers: {
            "Content-Type": object.contentType,
            ...(object.contentLength ? { "Content-Length": String(object.contentLength) } : {}),
            "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFilename(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            // Responses are rendered, not only downloaded, so the declared type has to be the last
            // word: without `nosniff` a browser may inspect the bytes, decide a `.txt` full of
            // markup is HTML, and run it on this origin.
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=3600",
        },
    });
}

/**
 * The fallback filename for clients that do not read `filename*`.
 *
 * Quotes and backslashes would end the quoted string early — a filename is user input, and this
 * header is the one place it is echoed back into a protocol. Anything non-ASCII is dropped here and
 * carried by the RFC 5987 `filename*` parameter beside it, which every current browser prefers.
 */
function asciiFilename(name: string): string {
    const stripped = name.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "");

    return stripped || "download";
}
