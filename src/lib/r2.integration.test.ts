import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

import { buildObjectKey, deleteUserObjects, putObject } from "./r2";

/**
 * The one thing the unit tests cannot answer: whether Cloudflare actually accepts the two commands
 * the sweep is built out of. `r2.test.ts` fakes the S3 client, so it proves the pagination and the
 * ordering and nothing about the wire — and `ListObjectsV2` and `DeleteObjects` are sent from
 * nowhere else in the app, unlike `PutObject` and `DeleteObject` which normal use exercises daily.
 * A rejected call shape would leave every unit test green and fail only at deletion time, logged.
 *
 * It runs against the real bucket under a synthetic user id that no account can share, and it
 * verifies the emptiness with its own client rather than trusting the return value.
 */

const REQUIRED = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
] as const;

// Not a `cuid`, so it cannot collide with a real `User.id` however this is run.
const USER = `integration-${randomUUID()}`;
const PREFIX = `users/${USER}/`;

let probe: S3Client;

function listPrefix() {
    return probe.send(
        new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME!, Prefix: PREFIX }),
    );
}

beforeAll(() => {
    const missing = REQUIRED.filter((name) => !process.env[name]);

    // Thrown rather than skipped: a green run that quietly tested nothing is the outcome this file
    // exists to avoid.
    if (missing.length > 0) {
        throw new Error(`Missing R2 credentials: ${missing.join(", ")}`);
    }

    probe = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
    });
});

afterAll(async () => {
    // Belt and braces: if an assertion failed mid-way, do not leave objects behind.
    await deleteUserObjects(USER).catch(() => {});
});

describe("deleteUserObjects against the real bucket", () => {
    it("deletes every object under the account's prefix", async () => {
        const keys = await Promise.all(
            ["a.txt", "b.txt", "c.txt"].map(async (name) => {
                const key = buildObjectKey(USER, name);
                await putObject(
                    key,
                    Buffer.from(`devstash integration test: ${name}`),
                    "text/plain",
                );
                return key;
            }),
        );

        const before = await listPrefix();
        expect(before.Contents?.map((o) => o.Key).sort()).toEqual([...keys].sort());

        // The assertion that matters: R2 accepted `ListObjectsV2` and `DeleteObjects` as sent.
        await expect(deleteUserObjects(USER)).resolves.toBe(3);

        const after = await listPrefix();
        expect(after.Contents ?? []).toEqual([]);
    });

    it("sends no delete, and does not throw, for a prefix with nothing under it", async () => {
        await expect(deleteUserObjects(`integration-${randomUUID()}`)).resolves.toBe(0);
    });
});
