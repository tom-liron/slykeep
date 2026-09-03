import "server-only";

import { randomUUID } from "node:crypto";
import {
    DeleteObjectCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";

/**
 * The server-side access layer for files stored in Cloudflare R2, reached through the S3 API.
 *
 * Uploads land here from `POST /api/upload`; `GET /api/files/[id]` streams them back, authorized per
 * request against the item that owns the object. `deleteItem` and account deletion call the delete
 * helpers. The bucket is private — nothing here builds a public URL and `R2_PUBLIC_URL` is unread —
 * so every read goes through the authorized route; `project-overview.md` §10 (Phase 4) records why
 * that was chosen over a public bucket with presigned URLs.
 *
 * @remarks
 * `import "server-only"` because `lib/` is client-reachable and the R2 credentials must never reach
 * a browser bundle. The directive turns a mistaken client import into a build error.
 */

/**
 * The S3 client, built on first use so importing this module cannot throw. A build, a unit test and
 * any page reaching the same bundle would otherwise need R2 credentials present just to type-check —
 * the same reason `redisClient()` in `lib/rate-limit.ts` defers its construction.
 */
let client: S3Client | null = null;

function r2(): S3Client {
    if (client) return client;

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error(
            "R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
        );
    }

    client = new S3Client({
        // R2 is single-region behind one endpoint; "auto" is what Cloudflare's own S3 examples pass,
        // and the SDK requires something here.
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    });

    return client;
}

function bucket(): string {
    const name = process.env.R2_BUCKET_NAME;

    if (!name) {
        throw new Error("R2 is not configured — set R2_BUCKET_NAME.");
    }

    return name;
}

/**
 * The prefix every object lives under, so a key carries its owner and {@link isOwnedKey} can reject
 * one that does not belong to the caller before it is used in a request.
 */
function prefixFor(userId: string): string {
    return `users/${userId}/`;
}

/**
 * Mints a storage key: the owner prefix, a random UUID, and the original extension.
 *
 * The key is random, not a sanitized filename. The display name is persisted in `Item.fileName` and
 * is what a download is named after; a key derived from user input is a key an attacker can
 * influence. The extension is kept only so an object is recognizable in the R2 dashboard — nothing
 * reads it back.
 */
export function buildObjectKey(userId: string, fileName: string): string {
    const extension = fileName.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? "";

    return `${prefixFor(userId)}${randomUUID()}${extension}`;
}

/**
 * Whether `key` is one of this user's objects.
 *
 * @remarks
 * The upload route hands a key back to the browser, which submits it with the rest of the new item,
 * so by the time it reaches `createItem` it is client input again and a payload could name another
 * user's object. `startsWith` alone is not enough — a `..` segment normalizes away once the key
 * reaches a URL — so the remainder is pinned to a UUID with an optional extension and nothing else.
 */
const KEY_SUFFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]+)?$/;

export function isOwnedKey(key: string, userId: string): boolean {
    const prefix = prefixFor(userId);

    return key.startsWith(prefix) && KEY_SUFFIX.test(key.slice(prefix.length));
}

/** Stores `body` and resolves once R2 has it. */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await r2().send(
        new PutObjectCommand({
            Bucket: bucket(),
            Key: key,
            Body: body,
            // Stored so `GET` hands it back on read, which is why no MIME column exists. The value
            // has already been checked against the type's allowlist by `validateUpload`.
            ContentType: contentType,
        }),
    );
}

/** What `GET /api/files/[id]` needs to stream an object back out. */
export type StoredObject = {
    body: ReadableStream<Uint8Array>;
    contentType: string;
    contentLength?: number;
};

/**
 * Reads an object for the file route.
 *
 * The body is passed on as a stream rather than buffered: the response is a passthrough, so
 * buffering a 10 MB download would cost 10 MB of function memory per concurrent request for no gain.
 */
export async function getObject(key: string): Promise<StoredObject> {
    const result = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));

    if (!result.Body) {
        throw new Error(`R2 returned no body for "${key}"`);
    }

    return {
        body: result.Body.transformToWebStream(),
        contentType: result.ContentType ?? "application/octet-stream",
        contentLength: result.ContentLength,
    };
}

/**
 * Removes an object. R2 answers a delete of an absent key as a success, so this is safe to call for
 * an item whose object has already gone.
 */
export async function deleteObject(key: string): Promise<void> {
    await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** What one `DeleteObjects` request accepts — the S3 API's limit, which R2 implements. */
const DELETE_BATCH_SIZE = 1000;

/**
 * Removes every object belonging to `userId`, and reports how many went. This is what makes "delete
 * my account" also delete the account's files.
 *
 * @remarks
 * It works off the key prefix, not off `Item.fileKey`: deleting a `User` cascades its items away, so
 * by the time cleanup runs no row holds a key. {@link buildObjectKey} is the only thing that mints a
 * key and {@link isOwnedKey} already treats the prefix as proof of ownership, so the prefix is the
 * authority on what belongs to the account — and it also catches the objects `deleteItem` leaves
 * behind when its own object delete fails. Listed and deleted a page at a time, since a Pro account
 * is bounded only by its plan. Partial failures are collected and raised at the end so one key R2
 * refuses cannot strand the rest.
 */
export async function deleteUserObjects(userId: string): Promise<number> {
    // A blank id would sweep `users//`, which matches no real key. It is refused anyway: reaching
    // here without a user is a caller bug, and a bulk delete is the wrong place to learn that
    // quietly.
    if (!userId.trim()) {
        throw new Error("deleteUserObjects requires a user id.");
    }

    const Bucket = bucket();
    const Prefix = prefixFor(userId);

    let deleted = 0;
    let failures = 0;
    let ContinuationToken: string | undefined;

    do {
        const page = await r2().send(
            new ListObjectsV2Command({
                Bucket,
                Prefix,
                MaxKeys: DELETE_BATCH_SIZE,
                ContinuationToken,
            }),
        );

        // Paginating while deleting is safe: the continuation token resumes from the last key
        // listed, so removing keys already behind it cannot skip one in front of it.
        ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;

        const keys = (page.Contents ?? [])
            .map((object) => object.Key)
            .filter((key): key is string => Boolean(key));

        if (keys.length === 0) continue;

        const result = await r2().send(
            new DeleteObjectsCommand({
                Bucket,
                // `Quiet` keeps successes out of the response; `Errors` still comes back.
                Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
            }),
        );

        failures += result.Errors?.length ?? 0;
        deleted += keys.length - (result.Errors?.length ?? 0);
    } while (ContinuationToken);

    if (failures > 0) {
        throw new Error(`R2 refused to delete ${failures} object(s) under "${Prefix}".`);
    }

    return deleted;
}
