/**
 * Shape of what an auth Server Action hands back to its form.
 *
 * Lives here rather than beside the actions because a `"use server"` module may only export async
 * functions — a plain constant in there is a build error, not a lint nit.
 */
export type AuthActionState = {
    error: string | null;
    /**
     * Per-field messages, set only for *format* problems — a malformed address, a missing field.
     * A rejected credential never populates this: which of the two was wrong is exactly what the
     * sign-in path refuses to reveal.
     */
    fields?: { email?: string; password?: string };
    /**
     * Echoed back so the form can repopulate the email field. React resets an uncontrolled form
     * once its action resolves, so without this a mistyped password costs the user their address
     * as well as their password.
     */
    email: string;
    /**
     * Set when the credentials were correct but the address is unconfirmed. Distinct from `error`
     * because the form does more than show a message in this case — it offers to resend the link,
     * which needs a positive signal rather than a string comparison against the copy.
     */
    unverified?: boolean;
};

export const EMPTY_AUTH_STATE: AuthActionState = { error: null, email: "" };
