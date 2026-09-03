import "server-only";

/**
 * This deployment's own origin, for building absolute URLs that get sent elsewhere.
 *
 * `email.ts` uses it for verification and reset links; `stripe.ts` uses it for checkout and portal
 * return URLs. One function so those two cannot disagree about where the app lives — a deployment
 * where the reset link and the Stripe return URL pointed at different origins would be broken in a
 * way neither module could detect alone.
 *
 * @remarks
 * Throws rather than falling back to a default: every caller is building a URL that is sent into an
 * email or handed to Stripe, where a wrong origin sends a user to someone else's deployment, so
 * failing the send is the safer outcome. `NEXTAUTH_URL` is read as a fallback because Auth.js
 * accepts both names; `.env.example` documents `AUTH_URL`. It lives in `lib/` under `server-only`
 * alongside `stripe.ts`, `r2.ts`, `openai.ts`, `rate-limit.ts` and `email.ts`, which also read
 * `process.env` there; `server/` is the read-side query layer, and this is neither a query nor a
 * view model.
 */
export function appOrigin(): string {
    const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

    if (!url) throw new Error("AUTH_URL is not set; absolute URLs cannot be built.");

    return url.replace(/\/$/, "");
}
