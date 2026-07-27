import { z } from "zod";

/**
 * Input contracts for the two credential entry points. Both live here because the register route
 * and the Credentials `authorize` callback have to agree on what a valid email and password are —
 * if registration accepted something `authorize` later rejects, the account would be unusable.
 */

/**
 * Normalize *before* validating, not after. `z.email().trim()` reads as though it strips padding,
 * but the transform runs on the parsed output — the anchored email pattern has already rejected
 * " you@example.com " by then, so a pasted address with a trailing space is reported as malformed.
 * Piping puts the trim and the lowercase ahead of the check, where they can still do something.
 */
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

/**
 * Eight characters is the floor, not a policy. The upper bound is what matters: bcrypt truncates
 * at 72 *bytes*, so anything longer is silently ignored during hashing and a user could sign in
 * with a prefix of the password they chose. Rejecting is honest; truncating is not.
 */
const password = z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .refine((value) => new TextEncoder().encode(value).length <= 72, {
        message: "Password must be at most 72 bytes.",
    });

export const registerSchema = z
    .object({
        name: z.string().trim().min(1, "Name is required.").max(100),
        email,
        password,
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match.",
        path: ["confirmPassword"],
    });

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Deliberately looser than `registerSchema`: sign-in only needs the fields to be present and
 * well-formed enough to query with. Applying the password rules here would reject valid legacy
 * credentials the moment those rules change.
 */
export const signInSchema = z.object({
    email,
    password: z.string().min(1),
});
