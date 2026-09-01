import "dotenv/config";

import { sweepUnverifiedAccounts, UNVERIFIED_ACCOUNT_TTL_DAYS } from "../src/server/unverified";

/**
 * Runs the unverified-account sweep by hand. `npm run users:sweep`.
 *
 * The same function the nightly cron route calls, so this is not a second implementation of the
 * rule — it is the rule, without the HTTP hop. Useful for clearing a development database, and for
 * confirming what the job will do before trusting it to a schedule.
 *
 * Run with `--conditions=react-server`, which is why `package.json` spells the command out rather
 * than plain `tsx`. `src/server/unverified.ts` opens with `import "server-only"`, and that package
 * exists precisely to throw when it is loaded outside a server context — a script is one. Its
 * `exports` map answers the `react-server` condition with an empty module, which is the same escape
 * `vitest.server-only.ts` provides for the tests. Deleting the directive would have been the other
 * way to make this run, and the wrong one.
 *
 * Prints the count and nothing else. It deletes rows that cannot sign in and own nothing, which is
 * why there is no confirmation prompt here where `scripts/clear-users.ts` has one.
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
