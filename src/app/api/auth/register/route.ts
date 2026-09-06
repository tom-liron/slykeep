import { NextResponse } from "next/server";
import { z } from "zod";

import { registerSchema } from "@/lib/auth-schemas";
import { sendVerificationEmail } from "@/server/infra/email";
import { prisma } from "@/server/infra/prisma";
import { checkRateLimit, clientIp, tooManyRequests } from "@/server/infra/rate-limit";
import { seedStarterContent } from "@/server/onboarding";
import { hashPassword } from "@/server/passwords";
import { createVerificationToken } from "@/server/verification";

/**
 * Account creation for the Credentials provider.
 *
 * A route handler rather than a Server Action because the form needs the status code — "this email
 * is taken" (409) apart from "your input is invalid" (400) — where an action returns a 200 either
 * way.
 *
 * A static segment under `api/auth`, so it wins over the `[...nextauth]` catch-all and sits outside
 * `src/proxy.ts`'s matcher, which it must be to work while signed out.
 */
export async function POST(request: Request) {
    // Before the body is read: an account creation costs a row and an outbound email, and this is
    // the endpoint that turns one anonymous caller into an unbounded number of both. Keyed by IP
    // alone — an email in the key would let a script buy a fresh budget for every address it
    // invents.
    const limit = await checkRateLimit("register", await clientIp());

    if (!limit.success) return tooManyRequests(limit);

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Invalid registration details.",
                fields: z.flattenError(parsed.error).fieldErrors,
            },
            { status: 400 },
        );
    }

    const { name, email, password } = parsed.data;

    try {
        // Registration cannot hide whether an email is taken — the user has to be told why they
        // cannot proceed. The signal is confined to this route; the sign-in path stays silent.
        const existing = await prisma.user.findUnique({
            where: { email },
            // Selected to tell the two collisions apart, not to compare: a null hash is an
            // OAuth-only account (see `User.password` in the schema).
            select: { password: true },
        });

        if (existing) {
            // "An account already exists" is true of an OAuth-only account but strands the user:
            // it implies signing in with a password, which can never succeed, and there is no
            // password reset to fall back on. Naming GitHub is the only message that leads
            // anywhere. It discloses the provider on top of the existence this route already
            // reveals above — an accepted widening of that same signal, not a new one.
            return NextResponse.json(
                {
                    error:
                        existing.password === null
                            ? "That email is already registered through GitHub. Use “Sign in with GitHub” to continue."
                            : "An account with that email already exists.",
                },
                { status: 409 },
            );
        }

        // `emailVerified` is left null by default, which is what makes the account unusable until
        // the link is clicked — `authorize` in `src/auth.ts` refuses to sign in without it.
        const user = await prisma.user.create({
            data: { name, email, password: await hashPassword(password) },
            select: { id: true, name: true, email: true },
        });

        // Demo content, so the first dashboard is not five empty sections. Best-effort for the
        // same reason the send below is: the account is what was asked for, and an unpopulated one
        // still works.
        try {
            await seedStarterContent(user.id);
        } catch (error) {
            console.error("Starter content failed to seed:", error);
        }

        // Sending is attempted after the account exists, and its failure does not undo it. Rolling
        // back would be worse than it sounds: the user retries, and a deleted-then-recreated account
        // is indistinguishable to them from one that never worked. Leaving it and reporting the
        // failure lets them resend, which is the one action that can actually fix it.
        //
        // `emailSent` means "Resend accepted the request", which is weaker than it reads: delivery
        // is settled asynchronously, so a send that fails later still arrives here as `true`. With
        // `EMAIL_FROM` still on `onboarding@resend.dev` that is the *expected* case, not an edge
        // one — see `src/server/infra/email.ts`. Closing the gap needs an `email.failed` webhook.
        let emailSent = true;

        try {
            await sendVerificationEmail({
                to: user.email,
                name: user.name,
                token: await createVerificationToken(user.email),
            });
        } catch (error) {
            console.error("Verification email failed to send:", error);
            emailSent = false;
        }

        return NextResponse.json({ user, emailSent }, { status: 201 });
    } catch (error) {
        // Includes the unique-constraint race the check above cannot close: two requests for the
        // same email can both pass it, and the second create is the one that fails.
        console.error("Registration failed:", error);

        return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
    }
}
