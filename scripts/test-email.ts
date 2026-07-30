import "dotenv/config";

import { Resend } from "resend";

/**
 * Resend transport smoke test. Run with `npm run email:test -- you@example.com`.
 *
 * Exists because `POST /emails` does not tell you whether an email will arrive. It answers `200`
 * with an id, the SDK's `error` comes back null, and the dashboard's API-log page shows a green
 * `200` — then the send can fail asynchronously with nothing in the response having hinted at it.
 * That gap is what made "email verification doesn't work" expensive to diagnose: the application
 * code looked correct because it *was* correct.
 *
 * So this sends one email and then polls `GET /emails/:id` until `last_event` settles, turning an
 * asynchronous outcome into a synchronous verdict. Use it to prove the transport works *before*
 * trusting the registration flow, and again after changing `EMAIL_FROM`.
 *
 * Deliberately does not touch the database or the verification-token code. This tests one thing:
 * whether Resend can deliver mail from this account. Keeping it narrow is the point — a failure
 * here is never ambiguous about which layer broke.
 */

const FROM = process.env.EMAIL_FROM ?? "DevStash <onboarding@resend.dev>";
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 60_000;

/**
 * Terminal states. `delivered` is the only success — `sent` means Resend handed it to its upstream
 * and is not yet proof of anything, which is exactly the distinction this script exists to draw.
 */
const SETTLED = new Set(["delivered", "bounced", "complained", "failed", "canceled"]);

function requireArg(): string {
    const to = process.argv[2];

    if (!to || !to.includes("@")) {
        console.error("Usage: npm run email:test -- recipient@example.com");
        console.error("\nTip: `delivered@resend.dev` is Resend's simulator — it always accepts.");
        process.exit(1);
    }

    return to;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const to = requireArg();
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        console.error("RESEND_API_KEY is not set. Add it to .env (see .env.example).");
        process.exit(1);
    }

    const resend = new Resend(apiKey);

    // Printed before sending, because an empty domain list is the single best predictor of the
    // failure below and it costs one request to check.
    const { data: domains } = await resend.domains.list();
    const verified = (domains?.data ?? []).filter((domain) => domain.status === "verified");

    console.log(`from:     ${FROM}`);
    console.log(`to:       ${to}`);
    console.log(
        `domains:  ${verified.length} verified of ${domains?.data?.length ?? 0} configured`,
    );

    if (verified.length === 0) {
        console.log(
            "\n⚠ No verified domain. Sends will be accepted and then fail with\n" +
                "  'Domain is not verified' — including from onboarding@resend.dev, and\n" +
                "  including to Resend's own delivered@resend.dev simulator.\n" +
                "  Add one at https://resend.com/domains and set EMAIL_FROM to an address on it.\n",
        );
    }

    const { data, error } = await resend.emails.send({
        from: FROM,
        to,
        subject: "DevStash transport test",
        text: "If this arrived, Resend can deliver mail from this account.",
    });

    // A synchronous refusal — bad key, malformed payload, unauthorized recipient. Distinct from the
    // asynchronous failure this script is really hunting, and worth labelling as such.
    if (error || !data) {
        console.error(
            `\n✗ Rejected outright: ${error?.name ?? "unknown"} — ${error?.message ?? ""}`,
        );
        process.exit(1);
    }

    console.log(`\nqueued:   ${data.id}`);
    console.log("polling for the real outcome…\n");

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let lastSeen = "";

    while (Date.now() < deadline) {
        const { data: email } = await resend.emails.get(data.id);
        const event = email?.last_event ?? "unknown";

        if (event !== lastSeen) {
            console.log(`  ${new Date().toISOString().slice(11, 19)}  ${event}`);
            lastSeen = event;
        }

        if (SETTLED.has(event)) {
            const ok = event === "delivered";

            console.log(
                ok
                    ? `\n✓ Delivered. Check ${to}.`
                    : `\n✗ Did not deliver — last event was '${event}'.\n` +
                          `  The reason is not exposed by the API. Open\n` +
                          `  https://resend.com/emails/${data.id}\n` +
                          `  and read the banner under EMAIL EVENTS.`,
            );

            process.exit(ok ? 0 : 1);
        }

        await sleep(POLL_INTERVAL_MS);
    }

    // Neither success nor failure — Resend accepted it and has not settled it yet. Reporting this
    // as a pass would be the same lie the registration flow was telling.
    console.log(
        `\n? Still '${lastSeen}' after ${POLL_TIMEOUT_MS / 1000}s. Not settled, so not proven.\n` +
            `  Check https://resend.com/emails/${data.id} in a minute.`,
    );
    process.exit(2);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
