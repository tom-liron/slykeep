/**
 * The result contract between the account Server Actions and the settings dialogs that call them.
 *
 * `ChangePasswordDialog` and `DeleteAccountDialog` drive `changePassword` and `deleteAccount`
 * through `useActionState`, and both read this one shape. It lives here rather than beside the
 * actions because a `"use server"` module may export only async functions, which leaves
 * {@link EMPTY_ACCOUNT_STATE} nowhere to sit.
 */
export type AccountActionState = {
    error: string | null;
    /**
     * Per-field messages.
     *
     * @remarks
     * Unlike sign-in, naming the wrong field is safe here: the caller is already authenticated as
     * this account, so nothing in a field message reveals anything they have not proven.
     */
    fields?: Partial<
        Record<"currentPassword" | "password" | "confirmPassword" | "confirmation", string>
    >;
    /** Set once the password has been written, so the form can report success and reset. */
    success?: boolean;
};

/** The state a dialog starts in, before its action has run. */
export const EMPTY_ACCOUNT_STATE: AccountActionState = { error: null };
