/**
 * The result contract between the sign-in Server Action and the form that calls it.
 *
 * `SignInForm` drives `signInAction` through `useActionState`, so this type is both what the form
 * renders from and what the action must return on every path. It lives here rather than beside the
 * action because a `"use server"` module may export only async functions, which leaves
 * {@link EMPTY_AUTH_STATE} nowhere to sit.
 */
export type AuthActionState = {
    error: string | null;
    /**
     * Per-field messages, set only for *format* problems — a malformed address, a missing field.
     *
     * @remarks
     * A rejected credential never populates this: which of the two was wrong is what the sign-in
     * path refuses to reveal.
     */
    fields?: { email?: string; password?: string };
    /**
     * The submitted address, echoed back so the form can repopulate its email field.
     *
     * @remarks
     * React resets an uncontrolled form once its action resolves, so a mistyped password costs the
     * user their address as well without this.
     */
    email: string;
};

/** The state the form starts in, before the action has run. */
export const EMPTY_AUTH_STATE: AuthActionState = { error: null, email: "" };
