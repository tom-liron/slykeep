import { NextResponse } from "next/server";

import { isFileItemTypeName, validateUpload } from "@/lib/file-constraints";
import { canAccessItemType } from "@/lib/limits";
import { buildObjectKey, putObject } from "@/server/infra/r2";
import { checkRateLimit, tooManyRequests } from "@/server/infra/rate-limit";
import { getCurrentUser } from "@/server/current-user";

/**
 * Takes one file for a `file` or `image` item and puts it in R2.
 *
 * A route handler rather than a Server Action, by the standards' rule: this is a file upload with
 * progress tracking, and progress is only observable on an `XMLHttpRequest`, which needs a URL. The
 * item row itself is still written by `createItem` — this route stores the object and hands back the
 * key, and the dialog submits that key with the rest of the form.
 *
 * The key is client input by the time it comes back, so `createItem` re-checks it against the
 * signed-in user (`isOwnedKey`) rather than trusting the round trip; nothing here writes the row,
 * so nothing here can enforce that.
 *
 * @remarks
 * The upload runs before the item row exists. Creating the row first would leave a file item with
 * no file on screen whenever the upload failed; this ordering's failure mode is instead an object
 * in R2 that no row points at. Those orphans are accepted for now — `project-overview.md` §11 tracks
 * the cleanup sweep as an open item.
 */
export async function POST(request: Request) {
    const user = await getCurrentUser();

    // Before the body is read, so a refused caller does not get to stream 10 MB in first. Keyed on
    // the account rather than the IP because this route is behind the session — see `LIMITS`.
    const limit = await checkRateLimit("upload", user.id);

    if (!limit.success) return tooManyRequests(limit);

    const form = await request.formData().catch(() => null);

    if (!form) {
        return NextResponse.json({ error: "Send the file as form data." }, { status: 400 });
    }

    const file = form.get("file");
    const itemType = form.get("itemType");

    if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    if (typeof itemType !== "string" || !isFileItemTypeName(itemType)) {
        return NextResponse.json({ error: "Unknown item type." }, { status: 400 });
    }

    // The same gate the item-type pages read, so an upload cannot be the one way past a limit the
    // rest of the app enforces. `ENFORCE_PRO_LIMITS` is on, so a free account is refused here;
    // turning it off is what would make file and image usable without Pro again.
    if (!canAccessItemType(user.isPro, true)) {
        return NextResponse.json(
            { error: "File uploads require a Pro subscription." },
            { status: 403 },
        );
    }

    // Size, extension, and — when the browser supplied one — media type. This is the authority; the
    // component runs the same check first only to fail fast on an obviously wrong file.
    const validation = validateUpload(file, itemType);

    if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const key = buildObjectKey(user.id, file.name);

    try {
        await putObject(key, Buffer.from(await file.arrayBuffer()), validation.contentType);
    } catch (error) {
        console.error("R2 upload failed:", error);

        return NextResponse.json(
            { error: "Could not upload that file. Try again." },
            { status: 502 },
        );
    }

    return NextResponse.json({ key, fileName: file.name, fileSize: file.size });
}
