# Current Feature

## Status

Step 1 of 3 — in progress, `fix/monaco-production-assets`.
Plan and progress: `context/features/verification-hardening-plan.md`.

## Goals

Get monaco served on production. Every `/monaco/vs/*` asset 404s on the live site while
`/favicon.ico` returns 200, so the editor never mounts and read-only code renders as an empty
box — on every device, and on every deploy since the first.

- Move `monaco-editor` from `devDependencies` to `dependencies`.
- Name `monaco:sync` in an explicit `buildCommand` in `vercel.json`, rather than relying on npm's
  `prebuild` hook, which never fired on Vercel.
- Fall back to plain unhighlighted text when monaco cannot load, so a missing asset can never again
  be indistinguishable from a slow one.

## Notes

`public/monaco` is gitignored build output, 24 MB, produced by `npm run monaco:sync`. Verify after
deploy by requesting `/monaco/vs/loader.js` from the live site.

## History

Completed features are logged in `context/feature-history.md`.
