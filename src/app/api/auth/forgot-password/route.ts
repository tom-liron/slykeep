import { after, NextResponse } from "next/server";

import { forgotPasswordSchema } from "@/lib/auth-schemas";
import { sendPasswordResetEmail, sendPasswordResetGitHubEmail } from "@/server/infra/email";
import { prisma } from "@/server/infra/prisma";
import { checkRateLimit, clientIp, tooManyRequests } from "@/server/infra/rate-limit";
import { createPasswordResetToken } from "@/server/verification";

/**
 * Issues a password-reset email in response to a "forgot password" submission.
 *
 * Under `api/auth` so it wins over the `[...nextauth]` catch-all and sits outside `src/proxy.ts`'s
 * matcher — a person who has forgotten their password is signed out, so a protected path would
 * bounce them to `/sign-in`.
 *
 * @remarks
 * Answers 200 for every input — unknown address, GitHub-only account, malformed body, a Resend
 * failure — because the endpoint is public and a varying response is an account-enumeration oracle,
 * the one `authorize` in `src/auth.ts` works to deny. Response *timing* discloses the same thing:
 * issuing a token is a write and sending is a Resend round trip, so the lookup and send run in
 * `after`, once the response is on its way, and every caller gets the same reply after the same
 * parse and schema check. `ABSENT_USER_HASH` closes the equivalent leak for sign-in;
 * `POST /api/auth/verify-email` uses the same `after` pattern. `after` rather than a floating
 * promise because a serverless instance may freeze once the response flushes. The 429 is the one
 * answer allowed to differ — it depends on how often this caller has posted here, not on whether
 * any address exists — and is keyed by IP alone, as `register` is, so a script cannot buy a fresh
 * budget per invented address.
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
            // Logged, not reported: the response is long gone and every caller is told the same
            // thing. Only the server logs record that Resend refused.
            console.error("Sending the password-reset email failed:", error);
        }
    });

    return ok;
}
