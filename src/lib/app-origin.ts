import "server-only";

/**
 * This deployment's own origin, with no trailing slash.
 *
 * Two copies of this existed — `origin()` in `email.ts` for verification and reset links, and
 * `billingOrigin()` in `stripe.ts` for Stripe's return URLs — identical but for the noun in the
 * error message. They are not two questions: "where does this app live" has one answer, and a
 * deployment where the reset link and the Stripe return URL disagreed about it would be broken in a
 * way neither module could detect on its own.
 *
 * Throws rather than falling back to a default. Every caller is building an absolute URL that gets
 * *sent somewhere* — into an email, or to Stripe — where a wrong origin is not a rendering bug but a
 * link that takes a user to someone else's deployment. Failing the send is the safer outcome.
 *
 * `NEXTAUTH_URL` is read as a fallback because Auth.js accepts both names; `.env.example` documents
 * `AUTH_URL`.
 *
 * In `lib/` under `server-only` rather than in `server/`, following the five modules that already do
 * exactly this — `stripe.ts`, `r2.ts`, `openai.ts`, `rate-limit.ts` and `email.ts` all read
 * `process.env` in `lib/` under that directive. `server/` is the read-side query layer, and this is
 * neither a query nor a view model.
 */
export function appOrigin(): string {
    const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

    if (!url) throw new Error("AUTH_URL is not set; absolute URLs cannot be built.");

    return url.replace(/\/$/, "");
}
