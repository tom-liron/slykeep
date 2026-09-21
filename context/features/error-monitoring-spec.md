# Error Monitoring — Sentry Spec

Queued, not built. Phase 7 in `context/project-overview.md` §10 has carried "error monitoring" as a
launch-prep line since the roadmap was written; this is what that line means.

Written 2026-09-21, after the outage in `feature-history.md` entry 164. That incident is the whole
argument for this file, so it is stated first.

---

## 1. Why

On 2026-09-16 every signed-in page in production returned a 500 for several hours. The cause is in
entry 164 and is now fixed. What is *not* fixed is how it was found: a friend tried to sign in,
failed, and mentioned it. Nothing in the system said anything.

Three separate gaps, only the first of which this spec closes:

| Gap | Closed by |
|---|---|
| Nobody is told when production breaks | **This spec** |
| Code and data could ship apart | `prisma migrate deploy` in `vercel.json` (entry 164) |
| One bad column value took down every page | The icon fallback in `toItemTypeViewModel` (entry 164) |

Sentry is a **detection and triage** tool. It would not have prevented that outage and must not be
written up as though it would. What it buys is the minutes between a deploy going bad and someone
noticing.

### The blind spot that is still open

Vercel logs server errors only. A client component that throws in a visitor's browser is invisible
here — no log line, no alert, no count. `src/app/error.tsx` catches it and shows a 500 with no
digest (React hashes only what failed while rendering on the server), and that is the entire trace
it leaves. Roughly half the app is client components, so this is the larger half of the gap, not
the smaller.

---

## 2. Decisions (locked before starting)

| # | Decision | Value |
|---|---|---|
| D1 | Vendor | **Sentry**, `@sentry/nextjs`. Free tier |
| D2 | Scope | Server **and** client. The client half is the point — see §1 |
| D3 | Source maps | **Uploaded.** Without them a stack reads `src_0x4hlcs._.js:1:2727`, which is what the entry-164 log actually said |
| D4 | Release tagging | Tag each release with the commit SHA, so "first seen in `ce0b886`" is answerable |
| D5 | The 500 page | `ErrorReference` **stays**. Sentry's event id does not replace it — see §5 |
| D6 | Session replay | **Off** at first. It burns the free quota and carries a privacy question this project has not answered |
| D7 | Silent failures | Out of scope for the install. Listed in §6 as follow-up work, because it is code changes, not configuration |

---

## 3. What to install

`@sentry/nextjs`. Its wizard writes more than this project wants, so take these and review the rest:

- **`instrumentation.ts`** — does not exist yet. Next's own `onRequestError` hook lives here and is
  what the SDK hooks into. Worth understanding before installing the SDK: the hook is free, is five
  lines, and gives every server error with its request context. If Sentry is ever dropped, this is
  what remains.
- **`sentry.client.config.ts`** / **`sentry.server.config.ts`** / **`sentry.edge.config.ts`** — the
  edge one matters here. `src/proxy.ts` runs on the edge runtime and is the first authorization
  boundary in the app; an error thrown there is invisible to the other two.
- **`withSentryConfig`** in `next.config.ts`, for source-map upload.

### Environment variables

`SENTRY_DSN` and `SENTRY_AUTH_TOKEN` (upload only, build-time). Set them in Vercel **Production and
Preview**, and add the names — never the values — to `.env.example`. The DSN is not a secret in the
sense the others are, but keep it out of the repo for consistency with every other key here.

### Two things this repo will trip on

1. **The proxy matcher.** `src/proxy.ts` is deny-by-default with an inverted matcher, so any route
   the SDK adds (its tunnel route, if tunnelling is enabled to dodge ad blockers) is protected the
   moment it exists and will be answered with a 302 to `/sign-in`. It needs naming in the matcher's
   exclusion list, in full rather than by prefix, for the reason the proxy's own docblock gives.
2. **`server-only`.** The server config imports Node built-ins. It sits at the repo root, outside
   `src/`, so the `src/lib/**` ESLint override does not reach it — but do not import anything from
   `@/server/*` into the client or edge config.

---

## 4. Alerting — the part that matters

An install with no alert rule is a dashboard nobody opens. Configure, at minimum:

- **A new issue in production** → email. This is the rule that would have fired on 2026-09-16.
- **An error-rate spike** → email. Catches a regression that is not a *new* issue, which is what a
  reverted migration looks like.

Leave the defaults otherwise. A portfolio project with one maintainer needs two rules, not twelve.

---

## 5. What happens to `ErrorReference`

It stays as it is. The two identifiers answer different questions and the distinction is easy to get
wrong:

- **Next's `digest`** — `stringHash(err.message + (componentStack || err.stack))`. A *fingerprint of
  the error*. Deterministic, so every user hitting one bug sees the same number. It identifies
  **which bug**, never **whose request**.
- **Sentry's `eventId`** — one captured occurrence. Identifies **this person's** failure, with their
  breadcrumbs and context attached.

Sentry's `<ErrorBoundary>` and its user-feedback dialog surface the event id, and swapping the
digest for it would be a real improvement to a support conversation. It is deliberately **not** part
of this work: the pill shipped in entry 164, it works, and changing it is a separate decision from
turning monitoring on. Revisit once there is a support path to feed.

---

## 6. Explicitly out of scope

Each of these is a real gap that installing Sentry does **not** close. They are listed so that
"we have error monitoring" is never mistaken for "we would know."

- **Caught errors.** Every Server Action in `src/actions/` wraps its work in `try/catch` and returns
  `{ success, error }`. None of those throw, so Sentry sees nothing unless each catch calls
  `captureException` by hand. That is a pass over `src/actions/`, and it is the single highest-value
  follow-up.
- **Wrong but not broken.** The colour migrations sat unapplied for eight days and production
  rendered stale item-type colours the whole time. No exception, no event, no alert. Only the
  `migrate deploy` step in the build catches that class.
- **Things that never run.** A cron answered with a 302 that Vercel records as success — the exact
  failure `proxy.ts` documents for `api/cron/sweep-unverified`. Nothing throws, so nothing is sent.
- **Third-party state.** An unverified Resend domain refusing every recipient, a Stripe webhook
  secret that no longer matches. These surface as handled failures, not exceptions.
- **A post-deploy smoke check.** Cheaper than all of the above and not part of this: assert
  `prisma migrate status` is clean, or that one authenticated route returns 200. Worth doing
  whether or not Sentry is ever installed.

---

## 7. Definition of done

1. A deliberate throw from a **server** component reaches Sentry with a readable stack — real file
   and line, not a chunk hash.
2. A deliberate throw from a **client** component reaches Sentry. This is the one that is
   untestable through Vercel logs today, so it is the one to verify first.
3. An error in `src/proxy.ts` reaches Sentry, proving the edge config is wired.
4. The issue is tagged with the release SHA.
5. The "new issue in production" alert actually arrives in an inbox. Not assumed — triggered.
6. `npm test`, `npm run lint`, `npm run build` and `npm run docs:links` green.
