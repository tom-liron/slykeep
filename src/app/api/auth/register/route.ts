import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { registerSchema } from "@/lib/auth-schemas";
import { prisma } from "@/lib/prisma";

/**
 * Account creation for the Credentials provider.
 *
 * A route handler rather than a Server Action because the client needs the status code: the form
 * has to tell "this email is taken" (409) apart from "your input is invalid" (400), and actions
 * return a body with a 200 either way.
 *
 * The path is a static segment under `api/auth`, so it wins over the `[...nextauth]` catch-all
 * beside it, and `src/proxy.ts` already excludes `api/auth` from the deny-by-default matcher —
 * which it must, since the whole point is to be reachable while signed out.
 */
/**
 * Cost factor for new password hashes. `ABSENT_USER_HASH` in `src/auth.ts` is precomputed at this
 * same factor so a failed sign-in costs the same whether or not the account exists — raising this
 * without regenerating that hash reintroduces the timing leak.
 */
const PASSWORD_HASH_ROUNDS = 12;

export async function POST(request: Request) {
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
        if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
            return NextResponse.json(
                { error: "An account with that email already exists." },
                { status: 409 },
            );
        }

        const user = await prisma.user.create({
            data: { name, email, password: await bcrypt.hash(password, PASSWORD_HASH_ROUNDS) },
            select: { id: true, name: true, email: true },
        });

        return NextResponse.json({ user }, { status: 201 });
    } catch (error) {
        // Includes the unique-constraint race the check above cannot close: two requests for the
        // same email can both pass it, and the second create is the one that fails.
        console.error("Registration failed:", error);

        return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
    }
}
