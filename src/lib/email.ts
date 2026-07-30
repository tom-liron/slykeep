import "server-only";

import { Resend } from "resend";

/**
 * Transactional email via Resend.
 *
 * Constructed lazily rather than at module scope so importing this file does not require the key.
 * `next build` evaluates server modules while collecting page data, and a top-level `new Resend()`
 * with no key would fail the build on a machine that only has the public config.
 */
let client: Resend | null = null;

function resend(): Resend {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) throw new Error("RESEND_API_KEY is not set.");

    client ??= new Resend(apiKey);

    return client;
}

/**
 * Origin for links that will be opened from an email client.
 *
 * Cannot be derived from the sending request: the person clicking arrives in a different session,
 * often on a different device, and a relative path is meaningless in an inbox. `AUTH_URL` is already
 * the value NextAuth uses for its own callbacks, so reusing it keeps one source of truth for
 * "where this deployment lives".
 */
function origin(): string {
    const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

    if (!url) throw new Error("AUTH_URL is not set; verification links cannot be built.");

    return url.replace(/\/$/, "");
}

/**
 * Sender address.
 *
 * Defaults to `onboarding@resend.dev` because no domain is available yet. Be aware of what that
 * means: on this Resend account that sender does not deliver. `POST /emails` answers `200` with an
 * id and the SDK's `error` is null, then the send fails asynchronously with "Domain is not
 * verified" — observable only on the dashboard's Emails page or via the email's `last_event`.
 * Verified by sending `onboarding@resend.dev` -> `delivered@resend.dev` as a bare request with no
 * application code in the path; it failed like every other send the account has made.
 *
 * So this default makes the feature *runnable*, not *working*. Swapping `EMAIL_FROM` to an address
 * on a verified domain is the whole fix — no code here changes.
 */
const FROM = process.env.EMAIL_FROM ?? "DevStash <onboarding@resend.dev>";

/**
 * Escapes interpolation into the HTML body. `name` is user-supplied at registration and goes into
 * markup, so it is the one value here that could carry a tag.
 */
function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Sends the "confirm your address" email.
 *
 * Throws rather than swallowing a failure. The caller decides what to tell the user, and a
 * registration whose email silently never sent would leave an account nobody can sign in to — with
 * no signal anywhere that anything went wrong.
 */
export async function sendVerificationEmail({
    to,
    name,
    token,
}: {
    to: string;
    name: string | null;
    token: string;
}) {
    const link = `${origin()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";

    const { error } = await resend().emails.send({
        from: FROM,
        to,
        subject: "Confirm your DevStash email",
        // Plain text alongside the HTML: some clients render it instead, and its presence measurably
        // lowers the odds of the whole message being scored as spam.
        text: `${name ? `Hi ${name},` : "Hi,"}\n\nConfirm your email address to finish setting up your DevStash account:\n\n${link}\n\nThis link expires in 24 hours and can only be used once.\n\nIf you did not sign up for DevStash, you can ignore this email.`,
        html: `
            <div style="font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.6; color: #18181b;">
                <h1 style="font-size: 20px; margin: 0 0 16px;">Confirm your email</h1>
                <p style="margin: 0 0 12px;">${greeting}</p>
                <p style="margin: 0 0 20px;">Confirm your email address to finish setting up your DevStash account.</p>
                <p style="margin: 0 0 20px;">
                    <a href="${link}" style="display: inline-block; background: #18181b; color: #fafafa; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 500;">Confirm email</a>
                </p>
                <p style="margin: 0 0 12px; font-size: 14px; color: #52525b;">This link expires in 24 hours and can only be used once.</p>
                <p style="margin: 0; font-size: 14px; color: #52525b;">If you did not sign up for DevStash, you can ignore this email.</p>
            </div>
        `,
    });

    // Catches only a *synchronous* refusal — a bad key, a malformed payload, a recipient Resend
    // rejects outright. The SDK reports these in the response rather than by throwing, so an
    // unchecked call would look like it succeeded.
    //
    // It does not, and cannot, catch a delivery failure — including the unverified-sender case this
    // deployment currently hits. Resend answers `200` as soon as the request is queued and settles
    // the outcome afterwards, with `error` still null. Treat a clean return as "accepted", never as
    // "delivered"; proving the latter needs the `email.failed` / `email.delivered` webhooks.
    if (error) throw new Error(`Resend refused the verification email: ${error.message}`);
}
