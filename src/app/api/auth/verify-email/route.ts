import { after, NextResponse } from "next/server";
import { z } from "zod";

import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { createVerificationToken, verifyEmailToken } from "@/server/verification";

/**
 * Email verification: `GET` consumes a link, `POST` issues a new one.
 *
 * Lives under `api/auth` for the same two reasons `register` does — a static segment beside the
 * `[...nextauth]` catch-all wins over it, and `src/proxy.ts` excludes `api/auth` from the
 * deny-by-default matcher. That exclusion is load-bearing here: someone clicking a verification link
 * is by definition signed out, and any protected path would bounce them to `/sign-in` and discard
 * the token on the way.
 */

/**
 * Where each outcome lands. Everything returns to the sign-in form, because signing in is what the
 * user was trying to do — and the form already knows how to render `?error=` (see `lib/auth-errors.ts`).
 */
const OUTCOME_PARAMS: Record<string, string> = {
    verified: "verified=1",
    "already-verified": "verified=already",
    expired: "error=VerificationExpired",
    invalid: "error=VerificationInvalid",
};

export async function GET(request: Request) {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const result = await verifyEmailToken(token);

    // Built from `request.url` rather than `AUTH_URL`: this request *is* the click, so its origin is
    // the one the user is actually on, and a mismatch would bounce them to another host mid-flow.
    const target = new URL(`/sign-in?${OUTCOME_PARAMS[result.status]}`, request.url);

    return NextResponse.redirect(target);
}

const resendSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
});

/**
 * Reissues a verification email.
 *
 * Answers 200 no matter what — unknown address, already verified, GitHub-only account, malformed
 * input, a Resend failure. This endpoint is reachable by anyone, and a response that varied would
 * turn it into the account-enumeration oracle that `authorize` in `src/auth.ts` goes to some length
 * to deny. The caller learns only that something was sent if it needed to be.
 *
 * A matching body is not enough on its own, because *how long* the answer takes discloses the same
 * thing. Issuing a token is a write and sending is a network round trip to Resend, so the one path
 * that does both would answer several hundred milliseconds later than every path that does neither
 * — sorting a wordlist by latency would pick out exactly the unverified credentials accounts. So
 * the work happens in `after`, once the response is already on its way: every caller now gets the
 * same reply after the same JSON parse and schema check, and nothing observable depends on which
 * branch the deferred half takes. That is the same leak `ABSENT_USER_HASH` closes for sign-in.
 *
 * `after` rather than a floating promise because this runs serverless: the platform may freeze the
 * instance once the response is flushed, and `after` is what keeps the runtime alive for work that
 * was deliberately deferred.
 *
 * Not rate limited, which it should be — this is an email bomb aimed at any address someone cares
 * to name. Tracked in `context/current-feature.md`; it needs a shared throttle rather than a
 * one-off here.
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
            // Logged, not reported — the response is long gone, and the caller is told the same
            // thing either way. Only we need to know that Resend refused.
            console.error("Resending the verification email failed:", error);
        }
    });

    return ok;
}
