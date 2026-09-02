# Current Feature

## Status

Not Started — nothing queued.

## Goals

> **Read `context/portfolio-direction.md` first.** Recorded 2026-09-02: DevStash is a portfolio
> project, not a real SaaS. It holds the agreed sequence and the backlog items formally **dropped**
> rather than deferred, and it outranks the §11 backlog.

Nothing queued. Next in the agreed sequence is the **documentation overhaul** — a real feature with
a written spec, not a cleanup pass — and it should land *before* the `devstash` branch is cut, so
that snapshot is the tidy version.

## Notes

**Things Tom needs to do, not Claude:**

- **Set `CRON_SECRET` in Vercel** (Settings → Environment Variables → Production), then redeploy.
  Generate with `openssl rand -base64 32`. Until then the nightly sweep answers 503 and does
  nothing. `vercel.json` schedules it for 03:17 daily.
- **Confirm `AUTH_URL` is set in Vercel.** It is in the local `.env` but not in
  `.env.production.example`, so the record does not say whether production has it.
- The next production deploy runs `prisma migrate deploy` — the tag migration is DDL plus a
  row-rewriting backfill.

**Known, and waiting for the documentation feature rather than a patch:**

- `context/feature-history.md` has **two entries numbered 113**. Left alone deliberately: renumbering
  is an edit to the record, and it belongs in the docs pass with everything else.
- `project-overview.md` §7 still reads `Search | Basic | Basic` and still promises
  `Export (JSON / ZIP)`, a row deliberately pulled from the shipped pricing card. The card itself is
  correct; only the spec table drifted. See `portfolio-direction.md` §5.
- `docs/stripe-integration-plan.md` cites a research file that does not exist, and markdown line
  anchors (`file.ts#L42`) rot silently with nothing checking them.

## History

Completed features are logged in `context/feature-history.md`.
