import { after, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import type { VerificationOutcome } from "@/lib/verification-outcomes";
import { sendVerificationEmail } from "@/server/infra/email";
import { prisma } from "@/server/infra/prisma";
import { checkRateLimit, clientIp, tooManyRequests } from "@/server/infra/rate-limit";
import { createVerificationToken, verifyEmailToken } from "@/server/verification";

/**
 * Email verification: `GET` consumes a link, `POST` reissues one.
 *
 * Under `api/auth` so it wins over the `[...nextauth]` catch-all and sits outside `src/proxy.ts`'s
 * matcher. That exclusion is load-bearing: the token travels in the URL, and a protected path would
 * bounce a visitor with no session to `/sign-in` and drop it.
 */

/**
 * Consumes the token in the link and hands the outcome to `/verify-email` to explain.
 *
 * @remarks
 * The result page rather than the sign-in form, because this click can arrive in a browser that
 * already has a session. `/sign-in` is a signed-out route, so a signed-in visitor would be bounced
 * to `/` and the outcome would vanish with the query string; `/verify-email` is in `OPEN_ROUTES`
 * for exactly that reason.
 */
export async function GET(request: Request) {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const result = await verifyEmailToken(token);

    // Typed through the shared union so a status added to `VerificationResult` cannot reach the page
    // as a name it has no message for.
    const status: VerificationOutcome = result.status;

    // Built from `request.url` rather than `AUTH_URL`: this request *is* the click, so its origin is
    // the one the user is actually on, and a mismatch would bounce them to another host mid-flow.
    const target = new URL(`/verify-email?status=${status}`, request.url);

    // A link opened on a shared machine, or on a second account, confirms one address while the
    // browser is signed in as another. The page can read its own session but not the address the
    // token was issued for, so the comparison happens here and only its answer travels — which keeps
    // the confirmed address out of the URL, the browser history and the referrer.
    if ("email" in result) {
        const session = await auth();
        const signedInAs = session?.user?.email?.toLowerCase();

        if (signedInAs && signedInAs !== result.email.toLowerCase()) {
            target.searchParams.set("mismatch", "1");
        }
    }

    return NextResponse.redirect(target);
}

const resendSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
});

/**
 * Reissues a verification email in response to a "resend the link" request.
 *
 * @remarks
 * Answers 200 for every input — unknown address, already verified, GitHub-only account, malformed
 * body, a Resend failure — because a varying response is an account-enumeration oracle, the one
 * `authorize` in `src/auth.ts` works to deny. Response timing discloses the same thing: the lookup
 * and send run in `after`, once the response is on its way, so every caller gets the same reply
 * after the same parse and schema check. `ABSENT_USER_HASH` closes the equivalent leak for sign-in.
 * `after` rather than a floating promise because a serverless instance may freeze once the response
 * flushes. The 429 is the one answer allowed to differ — it depends on how often this caller has
 * posted this address here, not on whether the address exists or is confirmed.
 */
export async function POST(request: Request) {
    const ok = NextResponse.json({ ok: true });

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return ok;
    }

    const parsed = resendSchema.safeParse(body);

    if (!parsed.success) return ok;

    const { email } = parsed.data;

    // After the parse rather than before it, because the key needs the address — unlike
    // `forgot-password`, this limit is per (caller, address), which is what makes three resends of
    // one's own link generous while still capping a script working through a list. A request too
    // malformed to name an address never reaches here and costs a token to nobody; it also cannot
    // trigger a send, so there is nothing to spend.
    const limit = await checkRateLimit("resendVerification", await clientIp(), email);

    if (!limit.success) return tooManyRequests(limit);

    // The lookup is deferred along with the send. It is one indexed read and would be hard to time
    // on its own, but keeping the whole branch on one side of the response means there is no
    // account-dependent work left in front of it to measure.
    after(async () => {
        try {
            const user = await prisma.user.findUnique({
                where: { email },
                select: { name: true, emailVerified: true, password: true },
            });

            // Send only to an unverified credentials account. An OAuth-only account (null password)
            // has nothing to verify by email — it cannot sign in that way regardless.
            if (!user || user.emailVerified || user.password === null) return;

            await sendVerificationEmail({
                to: email,
                name: user.name,
                token: await createVerificationToken(email),
            });
        } catch (error) {
            // Logged, not reported: the response is long gone and every caller is told the same
            // thing. Only the server logs record that Resend refused.
            console.error("Resending the verification email failed:", error);
        }
    });

    return ok;
}
