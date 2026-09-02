# Current Feature

## Status

Not Started — nothing queued.

## Goals

Nothing queued. One documentation feature remains specced and waiting:

1. `/feature load code-docs-overhaul-spec` — the comments and JSDoc inside `src/`, which are a lab
   notebook rather than an operating manual: 8,240 comment lines of 27,860 non-blank, 29.6%, with
   several files over 70%. Runs directory by directory, never as one sweep. Three decisions open.

Also independent of the rebrand, so they can land before the `devstash` branch is cut: **demo
content for a new account** and the missing **`error.tsx` / `not-found.tsx` / `loading.tsx`**.

## Notes

**Things Tom needs to do, not Claude:**

- **Set `CRON_SECRET` in Vercel** (Settings → Environment Variables → Production), then redeploy.
  Generate with `openssl rand -base64 32`. Until then the nightly sweep answers 503 and does
  nothing. `vercel.json` schedules it for 03:17 daily.
- **Confirm `AUTH_URL` is set in Vercel.** It is in the local `.env` and in `.env.example`, but not
  in `.env.production.example`, so the record does not say whether production has it.
- The next production deploy runs `prisma migrate deploy` — the tag migration is DDL plus a
  row-rewriting backfill.

**Left over from the documentation overhaul (#117), deliberately not fixed there:**

- **Line anchors still rot silently.** 17 `file.ts#L42` anchors across two tracked `docs/` files
  are unchecked by anything. They are now covered by each file's "not maintained" banner, which was
  the decision — but a link checker in CI would close it properly.
- **`docs/item-crud-architecture.md` links to `src/components/profile/ChangePasswordForm.tsx`**,
  which no longer exists. Its own banner already names the replacement
  (`src/components/settings/ChangePasswordDialog.tsx`), so the dead link is documented rather than
  repaired — correcting the body of a record falsifies it.

## History

Completed features are logged in `context/feature-history.md`.
