/**
 * Shape of what an account Server Action hands back to its form.
 *
 * Lives here rather than beside the actions for the same reason `AuthActionState` does: a
 * `"use server"` module may only export async functions, so the empty-state constant cannot sit
 * next to the action that uses it.
 */
export type AccountActionState = {
    error: string | null;
    /** Per-field messages. Unlike sign-in, naming the wrong field is safe — the caller is already
     * authenticated as this account, so nothing here reveals anything they have not proven. */
    fields?: Partial<
        Record<"currentPassword" | "password" | "confirmPassword" | "confirmation", string>
    >;
    /** Set once the password has actually been written, so the form can report success and reset. */
    success?: boolean;
};

export const EMPTY_ACCOUNT_STATE: AccountActionState = { error: null };
