import "server-only";

import { Resend } from "resend";

import { appOrigin } from "./app-origin";

/**
 * Transactional email via Resend.
 *
 * The verification, password-reset and GitHub-account-reset flows in `actions/` and `app/api/auth`
 * call the `send*` functions below to mail a link. Each builds its absolute URL from
 * {@link appOrigin}, renders through the shared {@link renderHtml} shell, and throws on a
 * synchronous refusal so the caller can tell the user.
 *
 * @remarks
 * `import "server-only"` so `RESEND_API_KEY` can never reach a browser bundle; every module in
 * `server/infra/` carries the directive. The client is built on first use so `next build` can
 * evaluate this module without the key present.
 */
let client: Resend | null = null;

function resend(): Resend {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) throw new Error("RESEND_API_KEY is not set.");

    client ??= new Resend(apiKey);

    return client;
}

/**
 * Sender address.
 *
 * @remarks
 * The `onboarding@resend.dev` default sends without a verified domain but reaches only the Resend
 * account owner's own address — every other recipient is refused with a `403`. It makes the feature
 * testable in development, not shippable. Pointing `EMAIL_FROM` at an address on a verified domain
 * is the whole fix, and no code here changes with it (`project-overview.md` §10, Phase 7).
 * `npm run email:test` is the check when sends fail.
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
 * The one HTML shell every message shares: a heading, a greeting, a paragraph or two of body, a
 * call-to-action button, the destination repeated as paste-able text, and small print.
 *
 * The destination appears twice because a button is a styled anchor, and enough mail clients strip
 * the styling or block the link that the raw address has to be in the body as well — otherwise a
 * broken button is a dead end in an email whose whole purpose is one click.
 *
 * `heading`, `body` and `footnotes` are trusted literals from this module. `name` is the only
 * user-supplied value that reaches markup, and {@link escapeHtml} is applied to it below.
 */
function renderHtml({
    heading,
    greeting,
    body,
    action,
    footnotes,
}: {
    heading: string;
    greeting: string;
    body: string[];
    action: { label: string; href: string };
    footnotes: string[];
}) {
    const paragraphs = body.map((text) => `<p style="margin: 0 0 12px;">${text}</p>`).join("");
    const small = footnotes
        .map((text) => `<p style="margin: 0 0 12px; font-size: 14px; color: #52525b;">${text}</p>`)
        .join("");

    return `
        <div style="font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.6; color: #18181b;">
            <h1 style="font-size: 20px; margin: 0 0 16px;">${heading}</h1>
            <p style="margin: 0 0 12px;">${greeting}</p>
            ${paragraphs}
            <p style="margin: 24px 0;">
                <a href="${action.href}" style="display: inline-block; background: #18181b; color: #fafafa; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 500;">${action.label}</a>
            </p>
            <p style="margin: 0 0 20px; font-size: 14px; color: #52525b;">
                Or paste this link into your browser:<br />
                <a href="${action.href}" style="color: #52525b; word-break: break-all;">${action.href}</a>
            </p>
            ${small}
        </div>
    `;
}

/**
 * Sends one message and raises a synchronous refusal — a bad key, a malformed payload, a recipient
 * Resend rejects outright. The SDK reports these in the response rather than by throwing, so an
 * unchecked call would look like it succeeded.
 *
 * @remarks
 * A delivery failure cannot be caught here: Resend answers `200` once the request is queued and
 * settles the outcome afterwards with `error` still null. A clean return means "accepted", not
 * "delivered" — the `email.failed` / `email.delivered` webhooks prove the latter. It throws rather
 * than swallowing so the caller decides what to tell the user; a registration whose email silently
 * never sent leaves an account nobody can sign in to.
 */
async function send(what: string, message: Parameters<Resend["emails"]["send"]>[0]) {
    const { error } = await resend().emails.send(message);

    if (error) throw new Error(`Resend refused the ${what} email: ${error.message}`);
}

/** Sends the "confirm your address" email. */
export async function sendVerificationEmail({
    to,
    name,
    token,
}: {
    to: string;
    name: string | null;
    token: string;
}) {
    const link = `${appOrigin()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

    await send("verification", {
        from: FROM,
        to,
        subject: "Confirm your DevStash email",
        // Plain text alongside the HTML: some clients render it instead, and its presence measurably
        // lowers the odds of the whole message being scored as spam.
        text: `${name ? `Hi ${name},` : "Hi,"}\n\nYou're almost done setting up your DevStash account. Confirm your email address using the link below:\n\n${link}\n\nThis link expires in 24 hours and can only be used once.\n\nIf you did not sign up for DevStash, you can ignore this email.`,
        html: renderHtml({
            heading: "Confirm your email",
            greeting: name ? `Hi ${escapeHtml(name)},` : "Hi,",
            body: [
                "You're almost done setting up your DevStash account. Use the button below to confirm your email address.",
            ],
            action: { label: "Confirm email", href: link },
            footnotes: [
                "This link expires in 24 hours and can only be used once.",
                "If you did not sign up for DevStash, you can ignore this email.",
            ],
        }),
    });
}

/**
 * Sends the "choose a new password" email.
 *
 * The link lands on the `/reset-password` page, not a route handler: a reset needs the person to
 * type a new password, where confirming an address completes the moment its link is opened.
 */
export async function sendPasswordResetEmail({
    to,
    name,
    token,
}: {
    to: string;
    name: string | null;
    token: string;
}) {
    const link = `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`;

    await send("password reset", {
        from: FROM,
        to,
        subject: "Reset your DevStash password",
        text: `${name ? `Hi ${name},` : "Hi,"}\n\nWe received a request to reset the password for your DevStash account. Use the link below to choose a new one:\n\n${link}\n\nThis link expires in 1 hour and can only be used once.\n\nIf you did not ask to reset your password, you can ignore this email — your current password still works and nothing has changed.`,
        html: renderHtml({
            heading: "Reset your password",
            greeting: name ? `Hi ${escapeHtml(name)},` : "Hi,",
            // The body says why the mail arrived and points at the button; the button carries the
            // verb, so the body must not repeat it.
            body: [
                "We received a request to reset the password for your DevStash account. Use the button below to choose a new one.",
            ],
            action: { label: "Reset password", href: link },
            footnotes: [
                "This link expires in 1 hour and can only be used once.",
                "If you did not ask to reset your password, you can ignore this email — your current password still works and nothing has changed.",
            ],
        }),
    });
}

/**
 * Answers a reset request for an account that has no password to reset.
 *
 * A GitHub account has a null `User.password`, so there is nothing for a reset link to replace. This
 * mail tells someone who has forgotten how they signed up to use GitHub instead, and discloses
 * nothing to anyone else — it only ever arrives at the address that was entered.
 */
export async function sendPasswordResetGitHubEmail({
    to,
    name,
}: {
    to: string;
    name: string | null;
}) {
    const link = `${appOrigin()}/sign-in`;

    await send("GitHub reset", {
        from: FROM,
        to,
        subject: "Reset your DevStash password",
        text: `${name ? `Hi ${name},` : "Hi,"}\n\nSomeone asked to reset the password for the DevStash account with this email address.\n\nThat account signs in with GitHub and has no password to reset. Use "Sign in with GitHub" instead:\n\n${link}\n\nIf you did not ask for this, you can ignore this email — nothing has changed.`,
        html: renderHtml({
            heading: "Your account uses GitHub",
            greeting: name ? `Hi ${escapeHtml(name)},` : "Hi,",
            body: [
                "Someone asked to reset the password for the DevStash account with this email address.",
                "That account signs in with GitHub, so there is no password to reset.",
            ],
            action: { label: "Sign in with GitHub", href: link },
            footnotes: [
                "If you did not ask for this, you can ignore this email — nothing has changed.",
            ],
        }),
    });
}
