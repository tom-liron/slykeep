import { after, NextResponse } from "next/server";
import { z } from "zod";

import { sendVerificationEmail } from "@/server/infra/email";
import { prisma } from "@/server/infra/prisma";
import { checkRateLimit, clientIp, tooManyRequests } from "@/server/infra/rate-limit";
import { createVerificationToken, verifyEmailToken } from "@/server/verification";

/**
 * Email verification: `GET` consumes a link, `POST` reissues one.
 *
 * Under `api/auth` so it wins over the `[...nextauth]` catch-all and sits outside `src/proxy.ts`'s
 * matcher. That exclusion is load-bearing: someone clicking a verification link is signed out, and
 * a protected path would bounce them to `/sign-in` and drop the token.
 */

/**
 * Where each `GET` outcome lands. Every branch returns to the sign-in form — signing in is what the
 * user was doing — and the form renders `?error=` through `lib/auth-errors.ts`.
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
