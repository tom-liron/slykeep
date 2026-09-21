import type { Metadata } from "next";

import { ProsePage, ProseSection } from "@/components/marketing/ProsePage";

/**
 * The Privacy Policy at `/privacy`.
 *
 * Describes what the application stores and which third parties it sends data to. Everything it
 * states is observable in the code: the account fields in `prisma/schema.prisma`, the per-user
 * object prefix in `server/infra/r2.ts`, the four AI actions in `actions/ai.ts`, and the account
 * teardown in `actions/account.ts`.
 *
 * @remarks
 * Reachable without a session only because `/privacy` is listed in `OPEN_ROUTES` in
 * `lib/auth-redirects.ts` — the proxy is deny-by-default and would otherwise redirect every
 * signed-out reader, search engines included, to `/sign-in`.
 *
 * The operator is named as the project, with a contact address and no personal name. When a data
 * practice changes — a new subprocessor, a new field, a change to what the AI actions send — this
 * page and `lastUpdated` change with it.
 */
export const metadata: Metadata = {
    title: "Privacy Policy · SlyKeep",
    description: "What SlyKeep stores, which services process it, and how to have it deleted.",
};

const CONTACT = "privacy@slykeep.com";

export default function PrivacyPage() {
    return (
        <ProsePage
            title="Privacy Policy"
            lastUpdated="21 September 2026"
            lead={
                <>
                    SlyKeep is a personal knowledge hub for developers, built and run as a portfolio
                    project by an independent developer. The accounts and the data are real, so this
                    page says plainly what is stored, who processes it, and how to have it removed.
                </>
            }
        >
            <ProseSection id="what-we-collect" title="What SlyKeep stores">
                <ul>
                    <li>
                        <strong>Your account.</strong> Email address, an optional display name, and
                        either a hashed password or a link to your GitHub account. Passwords are
                        stored only as a bcrypt hash — the original is never written down and cannot
                        be recovered from it.
                    </li>
                    <li>
                        <strong>What you save.</strong> Your items, collections, tags, custom item
                        types and editor preferences. This is the content of the product; it is
                        stored so it can be shown back to you.
                    </li>
                    <li>
                        <strong>Files you upload.</strong> Kept under a prefix belonging to your
                        account in a private bucket. No file has a public address; access is granted
                        through short-lived links issued only after your session has been checked.
                    </li>
                </ul>
                <p>
                    There is no analytics, no advertising, no tracking pixels and no third-party
                    scripts. The only cookies set are the ones needed to sign you in and keep you
                    signed in. Nothing is sold, rented or shared for anyone else&rsquo;s marketing.
                </p>
            </ProseSection>

            <ProseSection id="processors" title="Services that process it">
                <p>Each receives only what its job requires:</p>
                <ul>
                    <li>
                        <strong>Vercel</strong> hosts the app; <strong>Neon</strong> is the
                        PostgreSQL database; <strong>Cloudflare R2</strong> stores uploaded files.
                    </li>
                    <li>
                        <strong>OpenAI</strong> powers the optional AI features;{" "}
                        <strong>Resend</strong> sends account email; <strong>Upstash</strong> holds
                        short-lived counters used to rate limit abusive traffic.
                    </li>
                    <li>
                        <strong>Stripe</strong> handles the subscription flow, in test mode — see
                        below. <strong>GitHub</strong> is involved only if you choose to sign in
                        with it, in which case SlyKeep receives your GitHub email and profile name.
                    </li>
                </ul>
            </ProseSection>

            <ProseSection id="ai" title="The AI features">
                <p>
                    When — and only when — you press one of the AI buttons, the title and content of
                    that single item are sent to OpenAI so a model can suggest tags, a description,
                    an explanation or an improved prompt. Nothing is sent in the background, nothing
                    is sent when you save an item, and the result is written into the item only if
                    you accept it.
                </p>
                <p>
                    OpenAI does not use data sent through its API to train its models. It may keep a
                    request for up to 30 days to monitor for abuse, after which it is deleted.
                </p>
            </ProseSection>

            <ProseSection id="payments" title="Payments">
                <p>
                    SlyKeep is a portfolio project and Stripe is configured in{" "}
                    <strong>test mode</strong>. No real payment is processed and no card is ever
                    charged. Card details are entered on Stripe&rsquo;s own pages and never reach
                    SlyKeep either way; what is stored is a customer reference, a subscription
                    reference, the selected price and the period end, so the app can show which plan
                    an account is on.
                </p>
            </ProseSection>

            <ProseSection id="retention" title="Keeping and deleting data">
                <p>
                    Your data is kept while your account exists. Deleting your account, from the
                    Settings page, removes your account record and every item, collection and tag
                    attached to it, and deletes your uploaded files from storage. It is immediate
                    and cannot be undone. Accounts created but never confirmed are deleted
                    automatically by a nightly job.
                </p>
                <p>
                    Records may persist briefly in routine backups and in the server logs kept by
                    the services above, on their own retention schedules, before they expire.
                </p>
            </ProseSection>

            <ProseSection id="your-rights" title="Your data">
                <p>
                    Everything SlyKeep holds about you is visible in the application: you can read,
                    edit and delete any of it at any time, and delete the whole account in one
                    action. Depending on where you live you may also have statutory rights to
                    access, correct, export or restrict processing — to exercise any of them, use
                    the contact address below.
                </p>
            </ProseSection>

            <ProseSection id="changes" title="Changes">
                <p>
                    If what SlyKeep does with data changes, this page changes with it and the date
                    at the top is updated. Where practical, significant changes affecting existing
                    accounts are also announced by email. SlyKeep is not directed at children under
                    13.
                </p>
            </ProseSection>

            <ProseSection id="contact" title="How to get in touch">
                <p>
                    SlyKeep is operated as an independent portfolio project, not by a registered
                    company. For privacy questions or data requests, write to{" "}
                    <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
                </p>
            </ProseSection>
        </ProsePage>
    );
}
