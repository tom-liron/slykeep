import type { Metadata } from "next";

import { ProsePage, ProseSection } from "@/components/marketing/ProsePage";

/**
 * The Terms of Service at `/terms`.
 *
 * States what the service is, what an account holder may and may not do with it, and what is
 * promised about availability — which, for a project run by one person, is deliberately little.
 *
 * @remarks
 * Reachable without a session only because `/terms` is listed in `OPEN_ROUTES` in
 * `lib/auth-redirects.ts`; the proxy is deny-by-default.
 *
 * The billing section must stay truthful about Stripe's mode. It currently says no real payment is
 * taken, which matches the test keys the app is configured with and matches
 * `DemoBillingNotice`; configuring live keys means changing all three together.
 *
 * There is no governing-law clause. Nothing requires one, and default conflict-of-laws rules already
 * point at the reader's own jurisdiction for a consumer service. Add one here if SlyKeep ever stops
 * being a personal project.
 */
export const metadata: Metadata = {
    title: "Terms of Service · SlyKeep",
    description:
        "The terms that apply to a SlyKeep account, including use, plans and availability.",
};

export default function TermsPage() {
    return (
        <ProsePage
            title="Terms of Service"
            lastUpdated="21 September 2026"
            lead={
                <>
                    These terms apply to SlyKeep at slykeep.com. Creating an account means accepting
                    them. If you do not, please do not use the service.
                </>
            }
        >
            <ProseSection id="service" title="What SlyKeep is">
                <p>
                    SlyKeep is a personal knowledge hub for developers: somewhere to save code
                    snippets, terminal commands, AI prompts, notes, files and links, organize them
                    into collections and search across all of them.
                </p>
                <p>
                    It is a <strong>portfolio project</strong> built and run by an independent
                    developer, not a company and not a commercial service. That shapes everything
                    below, particularly the sections on payment and availability.
                </p>
            </ProseSection>

            <ProseSection id="accounts" title="Your account">
                <p>
                    An account needs a working email address, which you confirm by following a link
                    sent to it, or a GitHub account if you sign in that way. You are responsible for
                    keeping your credentials secure and for what happens under your account.
                    Accounts are for one person; do not share them. You may delete yours at any time
                    from the Settings page, which removes your content permanently.
                </p>
            </ProseSection>

            <ProseSection id="your-content" title="What you save stays yours">
                <p>
                    You keep every right you already had in what you save. SlyKeep claims no
                    ownership of it and does not use it to train anything. The only permission you
                    grant is the one the service needs to work: to store your content and display it
                    back to you. Nothing you save is published, shared with other users or made
                    publicly accessible.
                </p>
            </ProseSection>

            <ProseSection id="acceptable-use" title="Acceptable use">
                <p>Do not use SlyKeep to:</p>
                <ul>
                    <li>
                        store or distribute anything unlawful, or anything you have no right to;
                    </li>
                    <li>
                        store malware, or material meant to damage someone else&rsquo;s systems;
                    </li>
                    <li>
                        attack, overload, probe or attempt to reach any account that is not yours;
                    </li>
                    <li>
                        resell the service, or run automated traffic at a volume that degrades it.
                    </li>
                </ul>
                <p>
                    Requests are rate limited to keep the service usable. An account clearly abusing
                    it may be suspended.
                </p>
            </ProseSection>

            <ProseSection id="plans" title="Plans, and why nothing is charged">
                <p>
                    The Free plan covers up to 50 items and 3 collections. A Pro plan is shown
                    alongside it, removing those limits and adding file uploads and the AI features,
                    with prices displayed monthly and yearly.
                </p>
                <p>
                    <strong>
                        No money changes hands. Stripe is configured in test mode, so no real
                        payment is processed and no card is ever charged.
                    </strong>{" "}
                    The pricing and checkout exist to demonstrate a working subscription
                    integration, which is part of what this project is for. Treat every price on the
                    site as illustrative. If SlyKeep ever begins charging, these terms will be
                    updated and existing accounts told before it happens.
                </p>
            </ProseSection>

            <ProseSection id="availability" title="Availability, and keeping your own copy">
                <p>
                    SlyKeep is provided as is, with no guarantee of uptime and no promise that it
                    will remain available indefinitely. It is one person&rsquo;s project rather than
                    a business with a support team, and it may be interrupted, changed or
                    discontinued. Where practical, notice will be given by email before any planned
                    shutdown.
                </p>
                <p>
                    <strong>Keep your own copy of anything you cannot afford to lose.</strong>{" "}
                    SlyKeep is a convenient place to find things again; it is not a backup system.
                </p>
                <p>
                    To the fullest extent the law allows, there is no liability for any loss arising
                    from use of the service. Nothing here limits liability that cannot lawfully be
                    limited.
                </p>
            </ProseSection>

            <ProseSection id="termination" title="Ending the agreement">
                <p>
                    You may stop using SlyKeep and delete your account whenever you like. Access may
                    be suspended or ended for a serious or repeated breach of the acceptable-use
                    section; where circumstances allow, you will be told why and given a chance to
                    retrieve your content first.
                </p>
            </ProseSection>

            <ProseSection id="changes" title="Changes to these terms">
                <p>
                    These terms may change as the service does. When they change, the date at the
                    top changes with them, and where practical, significant changes affecting
                    existing accounts are also announced by email. What SlyKeep stores and which
                    services process it is described in the <a href="/privacy">Privacy Policy</a>,
                    which forms part of these terms.
                </p>
            </ProseSection>
        </ProsePage>
    );
}
