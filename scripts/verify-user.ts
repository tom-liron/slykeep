import "dotenv/config";

import { createInterface } from "node:readline/promises";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma-client/client";

/**
 * Marks an account's email verified by hand. Run with `npm run user:verify -- you@example.com`.
 *
 * A development stand-in for clicking the link, needed while Resend cannot deliver from this
 * account: registration creates users with `emailVerified` null, `authorize` refuses those, and
 * with no email arriving there is otherwise no way to reach the app with a fresh account.
 *
 * Deliberately a *script* rather than anything the application can reach. A fallback inside
 * `sendVerificationEmail` — printing the link, auto-verifying in development — makes the app itself
 * dishonest: the feature reports success while the transport is broken, which is precisely how the
 * first attempt at this feature reached "done" without ever delivering an email. A developer
 * running a script against a dev database cannot cause that; nothing in the product changes.
 *
 * Guarding this properly matters more than it looks: the script bypasses email verification
 * entirely, so pointed at the wrong database it *is* a remote-verification vulnerability.
 *
 * `NODE_ENV` alone is not that guard, which was the flaw in the first version. The risk is not the
 * environment variable — it is `DATABASE_URL`. Running locally, where `NODE_ENV` is unset, with
 * production credentials in `.env` sails straight past an env check and verifies a production
 * account. So the target host is printed and confirmed interactively instead; `--yes` skips the
 * prompt for repeated local use, and the environment checks below still short-circuit the obvious
 * cases outright.
 */

if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    console.error("Refusing to run: this script must never execute in a production environment.");
    process.exit(1);
}

const args = process.argv.slice(2);
const skipPrompt = args.includes("--yes");
const email = args
    .find((arg) => !arg.startsWith("--"))
    ?.trim()
    .toLowerCase();

if (!email || !email.includes("@")) {
    console.error("Usage: npm run user:verify -- someone@example.com [--yes]");
    process.exit(1);
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env and fill in the Neon URLs.");
    process.exit(1);
}

/** Host only — the connection string carries the password, which must never reach a terminal. */
function targetHost(url: string) {
    try {
        return new URL(url).host;
    } catch {
        return "(unparseable DATABASE_URL)";
    }
}

/**
 * Shows which database is about to be written to and waits for agreement.
 *
 * The host is the part that distinguishes dev from production, so it is the part put in front of
 * the person running this. A prompt they have to answer while looking at the hostname is worth more
 * than any check on an environment variable that production does not necessarily set.
 */
async function confirmTarget(host: string) {
    if (skipPrompt) return true;

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
        `\nAbout to mark ${email} verified on:\n  ${host}\n\nIs that the development database? [y/N] `,
    );

    rl.close();

    return answer.trim().toLowerCase() === "y";
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
    if (!(await confirmTarget(targetHost(connectionString!)))) {
        console.log("Aborted. Nothing was changed.");
        return;
    }

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, emailVerified: true, password: true },
    });

    if (!user) {
        console.error(`No account with the email ${email}.`);
        process.exit(1);
    }

    if (user.emailVerified) {
        console.log(`${email} was already verified at ${user.emailVerified.toISOString()}.`);
        console.log("Nothing to do — this account can already sign in.");
        return;
    }

    // Worth saying out loud rather than silently verifying: an OAuth-only account has a null
    // password hash, so `authorize` rejects it whatever this column says. Verifying it would look
    // like it fixed something and change nothing about whether they can sign in.
    if (user.password === null) {
        console.log(`⚠ ${email} has no password — it is a GitHub-only account.`);
        console.log("  Verifying it will not enable password sign-in. Use GitHub instead.");
    }

    const verifiedAt = new Date();

    await prisma.$transaction([
        prisma.user.update({ where: { email }, data: { emailVerified: verifiedAt } }),
        // Any outstanding link for this address is now pointless, and leaving it usable would keep
        // a live token in the table long after it stopped meaning anything. Clicking it afterwards
        // reports "already verified", which is accurate either way.
        prisma.verificationToken.deleteMany({ where: { identifier: email } }),
    ]);

    console.log(`✓ ${email} verified at ${verifiedAt.toISOString()}.`);
    console.log(`  ${user.name ?? "This account"} can now sign in with their password.`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
