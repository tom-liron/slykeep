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
 * Cloudflare R2, reached through the S3 API.
 *
 * `import "server-only"` for the reason `rate-limit.ts` states: `lib/` is client-reachable, and the
 * R2 credentials must never reach a bundle the browser can read. The directive turns a mistaken
 * client import into a build error rather than a leak.
 *
 * The bucket is private. Nothing here builds a public URL, and `R2_PUBLIC_URL` is deliberately
 * unread — objects are served only by `GET /api/files/[id]`, which authorizes the request against
 * the item that owns the object first. See `context/current-feature.md` for why that was chosen over
 * a public bucket.
 */

/**
 * Built lazily rather than at module load, so importing this module cannot throw. A build, a unit
 * test, and every page that merely reaches the same bundle would otherwise need R2 credentials
 * present just to be type-checked — the same reason `redisClient()` defers its construction.
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
        // and the SDK requires *something* here.
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
 * The prefix every object lives under, so a key carries its owner and `isOwnedKey` can reject one
 * that does not belong to the caller before it is ever used in a request.
 */
function prefixFor(userId: string): string {
    return `users/${userId}/`;
}

/**
 * A random key, not a sanitized filename.
 *
 * The original name is persisted in `Item.fileName` instead, which is what a download is named
 * after. Encoding it into the key is what forces the course's implementation to un-parse it later
 * (`replace(/^\d+-/, "")`, which eats a real filename beginning with digits and a hyphen), and a key
 * derived from user input is a key an attacker gets to influence.
 *
 * The extension is kept purely so an object is recognizable in the R2 dashboard; nothing reads it.
 */
export function buildObjectKey(userId: string, fileName: string): string {
    const extension = fileName.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? "";

    return `${prefixFor(userId)}${randomUUID()}${extension}`;
}

/**
 * Whether `key` is one of this user's objects.
 *
 * The upload route hands a key back to the browser, which then submits it with the rest of the new
 * item — so by the time it reaches `createItem` it is client input again, and a payload could name
 * another user's object. `startsWith` alone is not enough: a `..` segment normalizes away once the
 * key reaches a URL, so the shape is pinned to a UUID with an optional extension and nothing else.
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
            // Set here so `GET` hands it back on read: this is why no MIME column exists. The value
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
 * The body is handed on as a stream rather than buffered: a 10 MB download would otherwise be 10 MB
 * of function memory per concurrent request, for no gain — the response is a passthrough.
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
 * Removes an object. R2 answers a delete of a key that is not there as a success, so this is safe to
 * call for an item whose object has already gone.
 */
export async function deleteObject(key: string): Promise<void> {
    await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** What one `DeleteObjects` request accepts. The S3 API's limit, which R2 implements. */
const DELETE_BATCH_SIZE = 1000;

/**
 * Removes every object belonging to `userId`, and answers how many went.
 *
 * This is what makes "delete my account" also delete the account's files. It works off the key
 * prefix rather than off `Item.fileKey`, which is the point: deleting a `User` cascades its items
 * away, so by the time cleanup could run there is no row left holding a key. `buildObjectKey` is the
 * only thing that mints a key and `isOwnedKey` already treats the prefix as proof of ownership, so
 * the prefix is the authority on what belongs to this user — and it also catches the objects
 * `deleteItem` orphans on purpose when its own delete fails, which a `fileKey` read never could.
 *
 * Listed and deleted a page at a time rather than gathering every key first: an account is bounded
 * only by its plan, and one page in memory is enough to delete a page.
 *
 * Partial failures are collected and raised at the end rather than aborting the loop — a single key
 * R2 refuses must not strand the thousand behind it.
 */
export async function deleteUserObjects(userId: string): Promise<number> {
    // A blank id would sweep the prefix `users//`, which matches no real key — so this cannot
    // currently over-delete. It is refused anyway, because reaching here without a user is a bug in
    // the caller, and a bulk delete is the wrong place to find out quietly.
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
        // *listed*, so removing keys already behind it cannot skip one in front of it.
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
