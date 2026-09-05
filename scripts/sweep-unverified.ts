import "dotenv/config";

import { sweepUnverifiedAccounts, UNVERIFIED_ACCOUNT_TTL_DAYS } from "../src/server/unverified";

/**
 * Manual runner for the unverified-account cleanup operation.
 *
 * `npm run users:sweep` invokes the same {@link sweepUnverifiedAccounts} operation as the nightly
 * cron route and prints its result for development or supervised maintenance. It loads
 * `DATABASE_URL` from `.env`; `CRON_SECRET` authenticates only the HTTP route and is unused here.
 *
 * @remarks
 * The package script supplies the React server condition required to import the server-only module.
 * Deletion safeguards belong to {@link sweepUnverifiedAccounts}; this runner adds no confirmation
 * prompt or deletion rule of its own.
 */
async function main() {
    const deleted = await sweepUnverifiedAccounts();

    console.log(
        `Deleted ${deleted} unconfirmed account${deleted === 1 ? "" : "s"} ` +
            `older than ${UNVERIFIED_ACCOUNT_TTL_DAYS} days.`,
    );
}

main().catch((error) => {
    console.error("The sweep failed:", error);
    process.exit(1);
});
