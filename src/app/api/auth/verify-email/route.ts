import { NextResponse } from "next/server";
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

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { name: true, emailVerified: true, password: true },
        });

        // Send only to an unverified credentials account. An OAuth-only account (null password) has
        // nothing to verify by email — it cannot sign in that way regardless.
        if (!user || user.emailVerified || user.password === null) return ok;

        await sendVerificationEmail({
            to: email,
            name: user.name,
            token: await createVerificationToken(email),
        });
    } catch (error) {
        // Logged, not reported. The user is told the same thing either way; only we need to know
        // that Resend refused.
        console.error("Resending the verification email failed:", error);
    }

    return ok;
}
