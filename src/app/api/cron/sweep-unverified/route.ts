import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { sweepUnverifiedAccounts } from "@/server/unverified";

/**
 * The nightly sweep of registrations that were never confirmed.
 *
 * A route handler rather than a script because Vercel Cron invokes a URL — there is nowhere to run a
 * `scripts/*.ts` from on a schedule. The rule it deletes by lives in `src/server/unverified.ts`, so
 * `npm run users:sweep` can run the same thing by hand without going through HTTP.
 *
 * ⚠️ This path MUST stay excluded from `src/proxy.ts`'s matcher, for the reason the Stripe webhook
 * records: the proxy denies by default, the cron request carries no session cookie, and a 302 to
 * `/sign-in` is a *success* as far as Vercel is concerned. The job would report green every night
 * while this handler never ran once — the quietest possible failure.
 *
 * Authenticated by `CRON_SECRET`, which Vercel sends as a bearer token on every cron invocation when
 * the variable is set. Unset means unauthenticated, and this refuses rather than defaulting to open:
 * a public endpoint that deletes user rows is not something to leave to a missing variable.
 *
 * Node runtime and `force-dynamic`: it writes, and it is never cacheable.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const secret = process.env.CRON_SECRET;

    if (!secret) {
        console.error("CRON_SECRET is not set; refusing to run the unverified-account sweep.");

        return NextResponse.json({ error: "Not configured." }, { status: 503 });
    }

    if ((await headers()).get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    try {
        const deleted = await sweepUnverifiedAccounts();

        // Logged even at zero, which is the normal outcome: the value of this line is a nightly
        // record that the job ran at all, and silence would be indistinguishable from the cron
        // being misconfigured.
        console.log(`Unverified-account sweep: deleted ${deleted}.`);

        return NextResponse.json({ deleted });
    } catch (error) {
        console.error("Unverified-account sweep failed:", error);

        return NextResponse.json({ error: "Sweep failed." }, { status: 500 });
    }
}
