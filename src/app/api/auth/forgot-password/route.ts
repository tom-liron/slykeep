import { after, NextResponse } from "next/server";

import { forgotPasswordSchema } from "@/lib/auth-schemas";
import { sendPasswordResetEmail, sendPasswordResetGitHubEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";
import { createPasswordResetToken } from "@/server/verification";

/**
 * Issues a password-reset email.
 *
 * Lives under `api/auth` for the same two reasons `register` and `verify-email` do — a static
 * segment beside the `[...nextauth]` catch-all wins over it, and `src/proxy.ts` excludes `api/auth`
 * from the deny-by-default matcher. Someone who has forgotten their password is by definition signed
 * out, so a protected path would bounce them to `/sign-in` instead.
 *
 * Answers 200 no matter what — unknown address, GitHub-only account, malformed input, a Resend
 * failure. This endpoint is reachable by anyone, and a response that varied would turn it into the
 * account-enumeration oracle that `authorize` in `src/auth.ts` goes to some length to deny.
 *
 * A matching body is not enough on its own, because *how long* the answer takes discloses the same
 * thing. Issuing a token is a write and sending is a network round trip to Resend, so a path that
 * does both would answer several hundred milliseconds later than one that does neither — sorting a
 * wordlist by latency would pick out the registered addresses. So the lookup and the send happen in
 * `after`, once the response is already on its way: every caller gets the same reply after the same
 * JSON parse and schema check, and nothing observable depends on which branch the deferred half
 * takes. That is the same leak `ABSENT_USER_HASH` closes for sign-in, and the same fix
 * `POST /api/auth/verify-email` uses.
 *
 * `after` rather than a floating promise because this runs serverless: the platform may freeze the
 * instance once the response is flushed, and `after` is what keeps the runtime alive for work that
 * was deliberately deferred.
 *
 * The 429 is the one answer that is allowed to differ, and it does not reopen the oracle: it depends
 * on how many times *this caller* has posted here, which they already know, and not on whether any
 * address they named exists. Keyed by IP alone for the same reason as `register` — a key that
 * included the email would hand a fresh budget to every address a script cares to type, which is
 * exactly the email bomb this limit exists to stop.
 */
export async function POST(request: Request) {
    const ok = NextResponse.json({ ok: true });

    // Ahead of the parse, so the check costs the same for every caller and adds nothing measurable
    // to one branch over another. The timing care documented above survives it.
    const limit = await checkRateLimit("forgotPassword", await clientIp());

    if (!limit.success) return tooManyRequests(limit);

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return ok;
    }

    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) return ok;

    const { email } = parsed.data;

    after(async () => {
        try {
            const user = await prisma.user.findUnique({
                where: { email },
                select: { name: true, password: true },
            });

            if (!user) return;

            // A null hash is an OAuth-only account (see `User.password` in the schema). There is no
            // password for a link to replace, so it gets the explanation instead of a reset token —
            // silence would leave someone who has forgotten they used GitHub waiting forever.
            if (user.password === null) {
                await sendPasswordResetGitHubEmail({ to: email, name: user.name });
                return;
            }

            await sendPasswordResetEmail({
                to: email,
                name: user.name,
                token: await createPasswordResetToken(email),
            });
        } catch (error) {
            // Logged, not reported — the response is long gone, and the caller is told the same
            // thing either way. Only we need to know that Resend refused.
            console.error("Sending the password-reset email failed:", error);
        }
    });

    return ok;
}
