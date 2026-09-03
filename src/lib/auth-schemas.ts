import { z } from "zod";

/**
 * Zod contracts for the credential entry points — sign-in, registration, and the two password-reset
 * steps.
 *
 * The register route and the Credentials `authorize` callback both parse against these, so they
 * agree on what a valid email and password are: if registration accepted something `authorize`
 * later rejected, the account would be unusable. The reset form and the reset endpoint share
 * {@link newPasswordSchema} and {@link resetPasswordSchema} for the same reason.
 */

/**
 * A normalized email: trimmed and lowercased, then checked.
 *
 * @remarks
 * The trim and lowercase are piped ahead of the check. `z.email().trim()` runs its transform on the
 * parsed output, by which point the anchored pattern has already rejected `" you@example.com "`, so
 * a pasted address with a trailing space would be reported as malformed.
 */
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

/**
 * A new password: at least 8 characters, at most 72 bytes.
 *
 * @remarks
 * The upper bound is the one that matters: bcrypt truncates at 72 bytes, so a longer password is
 * silently shortened during hashing and the user could sign in with a prefix of what they chose.
 * Rejecting is honest where truncating is not.
 */
const password = z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .refine((value) => new TextEncoder().encode(value).length <= 72, {
        message: "Password must be at most 72 bytes.",
    });

/**
 * The password-and-confirmation pair, shared by registration and reset.
 *
 * A plain shape rather than a finished schema because both users add fields *and* the cross-field
 * refinement below, and a refinement cannot be extended after the fact.
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

/** Requesting a reset link — the address alone, well-formed enough to look up. */
export const forgotPasswordSchema = z.object({ email });

/**
 * What the reset *form* validates: the two password fields. The token is not something the user
 * typed, and not something they could fix if it were wrong.
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
 * `currentPassword` is checked for presence only, matching {@link signInSchema}: it is an existing
 * credential, and applying today's rules to it would reject an account whose password predates them
 * — locking a user out of the form that would fix it.
 */
export const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, "Enter your current password."),
        ...newPasswordFields,
    })
    .refine(passwordsMatch, mismatchError);

/**
 * Sign-in: the fields present and well-formed enough to query with, and no more. Applying the
 * password rules here would reject valid legacy credentials the moment those rules change.
 */
export const signInSchema = z.object({
    email,
    password: z.string().min(1, "Enter your password."),
});
