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

/**
 * Choosing a password and confirming it — shared by registration and reset, which have to agree.
 *
 * Kept as a plain shape rather than a finished schema because both users of it add fields *and* the
 * cross-field refinement below, and a refinement cannot be extended after the fact.
 */
const newPasswordFields = { password, confirmPassword: z.string() };

const passwordsMatch = (data: { password: string; confirmPassword: string }) =>
    data.password === data.confirmPassword;

const mismatchError = { message: "Passwords do not match.", path: ["confirmPassword"] };

export const registerSchema = z
    .object({
        name: z.string().trim().min(1, "Name is required.").max(100),
        email,
        ...newPasswordFields,
    })
    .refine(passwordsMatch, mismatchError);

export type RegisterInput = z.infer<typeof registerSchema>;

/** Asking for a reset link. Only the address, and only well-formed enough to look up. */
export const forgotPasswordSchema = z.object({ email });

/**
 * What the reset *form* validates: the two password fields, since the token is not something the
 * user typed and nothing they could fix if it were wrong.
 */
export const newPasswordSchema = z.object(newPasswordFields).refine(passwordsMatch, mismatchError);

/**
 * What the reset *endpoint* validates. The token joins the payload here because the server has no
 * other way to know which account is being reset; the form carries it over from the link.
 */
export const resetPasswordSchema = z
    .object({ token: z.string().min(1, "The reset link is incomplete."), ...newPasswordFields })
    .refine(passwordsMatch, mismatchError);

/**
 * Changing a password from the profile page, where the account is already signed in.
 *
 * `currentPassword` is only checked for presence, for the same reason `signInSchema` is loose: it
 * is an existing credential, and applying today's rules to it would reject an account whose
 * password predates them — locking a user out of the very form that would fix it.
 */
export const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, "Enter your current password."),
        ...newPasswordFields,
    })
    .refine(passwordsMatch, mismatchError);

/**
 * Deliberately looser than `registerSchema`: sign-in only needs the fields to be present and
 * well-formed enough to query with. Applying the password rules here would reject valid legacy
 * credentials the moment those rules change.
 */
export const signInSchema = z.object({
    email,
    password: z.string().min(1, "Enter your password."),
});
