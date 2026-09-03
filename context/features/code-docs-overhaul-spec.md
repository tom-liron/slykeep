# Code Documentation Overhaul

**Scope: the 197 source files under `src/`.** Every `.ts` and `.tsx` file in `actions/`, `app/`,
`components/`, `config/`, `hooks/`, `lib/`, `server/`, `types/`, plus `auth.ts`, `auth.config.ts` and
`proxy.ts`.

Out of scope, and deliberately: the 48 `*.test.ts` suites, `scripts/`, `prisma/`, the root
configuration files, and `prototypes/`. The planning prose — `README.md`, `context/`, `docs/` — was a
separate feature and is already done.

> **Extended 2026-09-03, after Part 2.** An audit of the "out of scope" files found the same
> lab-notebook comments in `next.config.ts`, `.env.example`, `prisma/schema.prisma`, `prisma/seed*.ts`
> and most of `scripts/`. **Part 4 — "the rest"** brings those ~14 files up to the standard.
> `prototypes/`, the test suites and the trivial/clean root configs stay out. See
> the **Part 4** section at the end of this spec.
>
> **Extended again 2026-09-03, after Part 3.** A senior review of Part 3's drawer components found
> the passes were preserving *compressed investigation* — rejected layouts, screenshot
> measurements, dead-`className` notes — where they should have kept only the surviving rule.
> `coding-standards.md` gained § *Conclusion, not investigation* in response. **Part 5 — the
> re-sweep** re-reads every file Parts 1a–3 touched against that sharper bar, and runs **before
> Part 4**. Order is now: Parts 1a–3 (done) → **Part 5** → Part 4.

## Why

**This codebase has no documentation convention.** Across all 197 source files there are zero TSDoc
tags — no `@param`, `@returns`, `@throws`, `@see`, `@remarks`. Every comment is free prose, and the
prose is a lab notebook: it records how the code came to be. What was tried, what failed, what was
measured off a screenshot, which diagnosis was wrong before the right one.

That is the wrong genre for source, and it fails two readers at once.

The **maintainer** needs an operating manual: what this is, what constrains it, what breaks if they
change it. The **developer new to the repository** needs something the current comments never
attempt — an explanation of how this application is put together. They know TypeScript, React and
Next.js; they do not know why `server/` exists, what the proxy authorizes, where a file upload
actually goes, or which of these modules talks to Stripe. The documentation is where they find out,
so it has to describe each file's role in the application rather than narrate its past.

Measured 2026-09-02, over the files in scope:

| | |
|---|---|
| Comment lines | **7,421 of 21,354 non-blank — 34.8%** |
| TSDoc tags in the whole codebase | **0** |
| `deliberately` / `on purpose` in comments | 110 / 30 |
| `used to` in comments | 33 |

Two representative cases, both in one file. `components/items/ItemCard.tsx` opens with a twelve-line
JSDoc block on a constant whose value is `2`, of which eight lines argue against an implementation
that was never built. Thirty lines later, a ten-line comment inside the JSX explains why one CSS
class is present, including the visual symptom that prompted it.

## The standard

**`context/coding-standards.md` § Documentation is the rule.** It is written and is the authority;
this spec does not restate it. In summary:

- **Conclusion, not investigation — the rule that governs the rest.** For every sentence of every
  comment, header included: *would a reader who never saw an earlier version need this to
  understand or safely change the code that exists now?* If no, delete it. Delete what used to be
  implemented, what was tried first, rejected alternatives, debugging investigations, screenshot
  measurements, visual symptoms that prompted a fix, stale-build diagnoses, "for several
  revisions", "used to", and any explanation of code that no longer exists. Keep the constraint the
  investigation found — as the surviving rule, one sentence, not the story. A module header never
  explains why a file was extracted or what an old structure made hard. The target is the
  *minimum* documentation that gives the mental model and preserves the breakable constraints —
  five excellent lines over forty accurate ones. See `coding-standards.md` § Conclusion, not
  investigation for the worked before/after table.
- Third person, present tense, declarative. Never history, symptoms, rejected alternatives, first
  person, or words that argue rather than state.
- **Every file opens with a header, without exception.** A header orients before it explains:
  identity first (*what kind of module is this?*), then the job it does in this application, then
  how it connects to its consumers and the surrounding flow, then constraints, and implementation
  detail only where a constraint needs it.
- **The first sentence answers "what is this module?"** — a short noun phrase. "Redis-backed
  request-rate limiting utilities", not "Rate limit module"; "Server-side item mutation actions",
  not "Server Action for item mutations".
- **Then why the application needs it.** Identity alone does not explain existence. Name the
  responsibility the module owns and the relationship a newcomer cannot infer — which layer consumes
  it, which boundary it sits on.
- **Boundary modules name what sits on each side.** UI → Server Action → Prisma; application →
  Stripe; application → R2; proxy → authentication; form → validation; Redis → rate limiting.
- **Architecture before mechanics.** Explain this project's use of a technology, not the technology.
  A header is not a CSS, Prisma or NextAuth tutorial: keep the load-bearing rule as a `@remarks`
  rule and drop the lesson around it.
- **Write for someone new to this repository.** They know React, databases and server-side code.
  They do not know this repository's feature boundaries, which layer owns what, why two
  similar-looking modules both exist, how UI code reaches the database, or where Stripe, R2 and
  Redis fit. One sentence that makes such a relationship explicit earns its place.
- **Where it helps, say what kind of change brings a developer here** — most useful for config,
  integrations, shared hooks, validation and the proxy. Not a mechanical sentence on every file.
- **Significant** exported symbols are documented — kind of operation, responsibility, side effects,
  where they sit in the flow. A comment is not added for coverage, and documentation whose only
  value is translating a symbol name into English is not documentation.
- **Cross-references are navigable or honest.** `{@link Symbol}` for *every* in-scope symbol the
  prose names — imported or declared in the file — since go-to-definition follows those from the
  comment itself. Prose naming the symbol and its module for anything not imported, where `{@link}`
  silently renders as unlinked text. Never a line number. `npm run docs:links` proves it.
- Depth follows non-obvious responsibility, not file size. A tiny module needs two lines, a normal
  one three to six, an architectural one more.
- Constraints survive under `@remarks`, rewritten as rules in the present tense.
- **Inline comments are wanted.** Preserve the ones that help, rewrite them in the documentation
  voice, and *add* them where code is not self-explanatory: a guard, a non-obvious algorithm step, a
  regex, an ordering requirement, the meaning of a branch, an API that behaves unexpectedly.

The shape to aim for, and the shape to avoid:

| Avoid | Prefer |
|---|---|
| "R2 helpers." | "Cloudflare R2 file-access utilities. The server-side access layer for files stored privately in R2. Uploaded files are never public, so authenticated preview and download flows use these helpers to create the temporary access needed to read them." |
| "Item Server Actions." | "Server-side item mutation actions. The boundary between the item UI and Prisma: item forms and controls call these actions, which authenticate the user, validate the submitted input and perform the corresponding writes." |
| "Layout and sizing values shared by signed-in pages." | "Central configuration for the authenticated dashboard and listing pages. Server-side queries take the numeric limits when loading dashboard summaries; pages take the grid constants so collection, item and file layouts stay consistent. Changes to summary sizes or shared signed-in layouts usually belong here." |
| "Returns true while the primary pointer is coarse." | "Detects whether the user's primary input is touch-like. Editor surfaces use this hook when choosing an interaction model by pointer type rather than by available width." |
| "Gets the current user." / "Props for ItemCard." | Nothing at all, or a line that says something the name does not. |

Applying the standard once without adopting it means the next feature recreates the problem, which
is why it lives in `coding-standards.md` rather than here.

## Goals

- Every file in scope opens with a header that explains its role in the application, and every
  significant exported symbol is documented.
- **The success test.** A comment does not pass by being accurate or by being valid TSDoc. The
  questions are: *do I know what this file is, do I know why this application has it, and did this
  comment make the repository easier to understand?*

  Concretely — after reading a module header, and without opening its imports, filename or export
  list, a developer unfamiliar with the repository can usually say what kind of module they opened,
  why it exists, which part of the application it belongs to, roughly who uses it, and how it
  connects to the surrounding system. After reading an important exported function's documentation,
  they know what kind of operation it is, its responsibility, its important side effects, and where
  it participates in the application flow — without tracing the implementation.
- The documentation reads as one convention, applied the same way in `config/` and in `components/`.
- No narrative survives anywhere in `src/`: no history, no symptoms, no argument against roads not
  taken.
- Load-bearing constraints are not lost. They move to `@remarks` and are stated as rules.
- Inline commentary is *better* after this than before — clearer where it existed, present where it
  was missing.
- No comment exists only to satisfy coverage.
- No behaviour changes. This feature edits comments; a code change found necessary is recorded and
  taken separately.
- The suite stays green, which is the proof that nothing but text moved.

Comment density is **not** a target. It will fall in the files that are arguing and rise in the files
that are under-documented, and both are the standard working.

## How to run it

Not as one sweep. 197 files, and the risk is deleting the only record of a real hazard. Directory by
directory, each its own reviewable pass.

### Documenting a file is a repository-analysis task, not a rewriting task

**Documentation is written top-down from the file's role in the repository, not bottom-up from its
contents.** Existing comments are one piece of evidence, not the source of truth; the implementation
and its real usages are. A pass that transforms each old comment into a new one produces prose that
is correctly tagged and still fails the success test, because the old comments answer "how did this
come to be" and the new ones have to answer "what is this file for in this application".

Before editing any comment in a file, build a mental model of it by answering six questions. **This
analysis is working context and is never written to the repository** — no notes file, no scratch
document, no commit.

1. **Role.** What job does this file do in the application? A category — "utility functions",
   "layout constants", "authentication helpers", "item components" — is not an answer. State the
   actual responsibility.
2. **Subsystem.** Which feature or architectural area it belongs to: the authenticated dashboard,
   item management, authentication, billing, uploads and storage, search, collections, rate
   limiting, the application shell, validation.
3. **Consumers.** Inspect one to three representative importers or callers of every shared module,
   config file, hook, service and exported component. Not the filename, not the export list, not the
   old comments. A file exporting `CARD_GRID`, `DASHBOARD_COLLECTIONS_LIMIT` and `FILE_ROW_GRID` is
   not understood until those names have been searched for.
4. **Connections.** What sits before and after the module in the flow — item form → Server Action →
   validation → Prisma → PostgreSQL; authenticated UI → file-access helper → Cloudflare R2; request →
   proxy → NextAuth authorization → protected route; Server Action → rate-limit helper → Redis →
   expensive operation. The header carries a sentence drawn from the flow, not a diagram.
5. **Change trigger.** What product or engineering change would bring a developer to this file?
   Most valuable for config, integrations, shared hooks, validation, the proxy and shared UI
   infrastructure.
6. **Constraints.** Which non-obvious rules would cause a bug or a regression if changed? Those are
   preserved. A long explanation is not preserved because it is technically interesting.

Only then read the old comments — to recover constraints and rationale, not to reword them.

Step 3 is the one that is easy to skip and the one that makes the difference: a module's role is
frequently invisible from inside it. **If the role question cannot be answered confidently, stop
documenting that file**, inspect its consumers and dependencies, and return to it. A header guessed
from the filename and the export list is the failure this method exists to prevent.

### Four features, merged separately

The passes are grouped into **four features**, each its own branch, commits, merge and push. A
197-file diff is too large to approve in one sitting, and a run abandoned partway then costs
everything rather than the current part.

| Part | Passes, one commit each | Files |
|------|--------|-------|
| **1a — calibration** | `config/` 8 | **8** |
| **1b — the server half** | `types/` 10 + `hooks/` 6 · `server/` 13 · `actions/` 7 + `auth.ts`, `auth.config.ts`, `proxy.ts` 3 | **39** |
| **2 — the middle** | `lib/` security and the data boundary 11 · `lib/` domain rules 11 · `lib/` AI and editor 10 · `app/api` 12 · `app/` pages 17 | **61** |
| **3 — the components** | `ui/` 20 · `items/` 18 · `layout/` + `collections/` 15 · `marketing/` + `pricing/` + `billing/` 16 · `auth/` + `settings/` + `favorites/` + `dashboard/` 17 · the drawer trio 3 | **89** |
| **5 — the re-sweep** | every file Parts 1a–3 touched, re-read against *Conclusion, not investigation*, folder by folder | **~183** |

`config/` is split out as **1a** because it ran first, alone, to calibrate the standard against real
files. Everything after it runs in passes of ten to twenty files.

**The mechanical checks do not catch the failure that matters most.** `docs:comments-only` proves
no code moved, `docs:links` proves no dead cross-reference, `npm test` / `lint` / `build` prove
nothing broke — and Part 3 passed all of them while its prose still carried compressed
investigation history: rejected flex layouts, screenshot measurements, "for several revisions",
explanations of `className`s that were no longer in the file. Spot-checking two or three headers
per commit did not find it. **Prose review is not a spot-check.** Every block in a pass — every
header, every inline comment — is run through the *Conclusion, not investigation* test before the
commit: would a reader who never saw an earlier version need this sentence? A pass is not done
until that is true of every line it touched.

Passes group folders that share consumers, so the analysis behind one file serves its neighbours
instead of being re-derived a folder later. `components/` is 45% of the work on its own and goes
last, where a lost layout constraint costs the most and the convention is long settled. The drawer
trio is three files *within* `components/`, held back to the end for the reason below.

### The drawer trio is a reconciliation, not a rewrite

`ItemDrawer.tsx`, `ItemDrawerToolbar.tsx` and `ActionLabel.tsx` come last and are held out of the
`components/` pass, because **their comments no longer describe their code**:

- `ItemDrawerToolbar.tsx` explains a `justify-between`, a container query and an `sm:` floor. None of
  the three appears anywhere in the file, and a second paragraph in the same block states the
  opposite conclusion of the first.
- The panel is given three incompatible sets of measurements across the two files.

Everywhere else the work is a rewrite: read a comment, restate it in the convention. Here every
surviving constraint has to be checked against the actual `className` first, or the pass preserves a
false hazard as a `@remarks` rule. The three share one set of measurements and must agree afterwards.

## Decisions

All settled before implementation.

1. **Scope** — `src/` source files only. Tests, `scripts/`, `prisma/`, root configs and `prototypes/`
   are out.
2. **Depth** — proportional to complexity. Trivial constants and obvious helpers get nothing or one
   line; ordinary functions get a short summary plus the project context that makes them make sense;
   architectural and boundary modules — auth, Stripe, R2, rate limiting, the database boundary, the
   proxy — explain their role in the wider application. Tags only where they add what the signature
   does not carry, never a `@param` per parameter.
3. **Constraints** — kept in the source under `@remarks`, tightened into rules. Not deleted, and not
   exiled to a separate document.
4. **Inline comments** — kept, rewritten in the documentation voice, and added where they are
   missing. Inline documentation is a positive good, not a tolerated leftover.
5. **Coverage** — every file gets a header, without exception, because the headers are the
   codebase-learning aid this feature is for. Exported *symbols* are documented when they carry a
   responsibility, a side effect, an architectural role or a constraint; obvious prop types and
   trivial constants may stay bare rather than take a comment that repeats their name.
6. **Narrative** — deleted from the source, not relocated to a document. `context/feature-history.md`
   is where a feature's rationale lives, and it already holds this one: entry 96 carries the
   `ItemDrawerToolbar` width investigation in full, 88 carries the `ItemCard` tag row and `h-full`,
   105 carries the drawer split. A `docs/decisions/` file was considered and rejected — it makes a
   third copy of prose that #117 de-duplicated, and every tracked file in `docs/` carries a "not
   maintained" banner, so it would begin rotting on the day it was written.

   The log is indexed by feature, not by file, so a rationale that predates it or fell between
   features has nothing to fall back on. **Before deleting a substantial narrative block, confirm its
   content is findable in `feature-history.md`. If it is not, quote it in the body of that pass's
   commit**, so it enters the log rather than disappearing. This is the one salvage step; it does not
   create a file.

## Known corrections to make along the way

Three comments state things that are no longer true. They are documentation defects, so they are
fixed by the pass that touches their file rather than taken separately:

- `lib/r2.ts` cites `context/current-feature.md` for why the bucket is private. That file is reset
  after every feature; the rationale is in `project-overview.md` §10, Phase 4. **Part 2.**
- ~~`actions/items.ts` calls `Tag` rows "global and shared across users".~~ **Done in part 1b.**
- `lib/rate-limit.ts` describes itself as throttling "the auth endpoints" and refers to "the five
  budgets". There are 11, covering uploads, checkout and the four AI actions. **Part 2.**

Expect more of these. Each pass has turned up defects that no list could have predicted, because
they are only visible once a file's real consumers are read: part 1a found a header bound to the
wrong symbol and a comment claiming four stat cards where the page renders two; part 1b found two
orphaned doc blocks, where one symbol's description sat stranded above a different symbol, leaving
the documented function with none. Fix them in the pass that finds them and name them in the commit.

## Part 5 — the re-sweep (added 2026-09-03, after Part 3)

Part 3's first pass over the `items/` drawer components was reviewed by a senior reader and failed
the standard: it understood each component correctly, then preserved the *investigation* —
previous flex attempts, screenshot measurements, dead `className` explanations, stale-stylesheet
diagnoses, "for several revisions", exact historical widths. A compressed lab notebook is still a
lab notebook. `coding-standards.md` was sharpened in response (§ *Conclusion, not investigation*),
and the drawer trio was redone.

**The concern is that Parts 1a, 1b and 2 have the same defect**, applied more quietly. Those passes
removed the largest narrative blocks but frequently *compressed* an investigation into two or three
sentences rather than discarding it and keeping only the surviving rule. Under the sharpened
standard, that is still wrong.

**Part 5 re-reads every file Parts 1a–3 touched — `config/`, `types/`, `hooks/`, `server/`,
`actions/`, `auth.ts` / `auth.config.ts` / `proxy.ts`, `lib/`, `app/api`, `app/` pages, and all of
`components/` — against one question per block:**

> Would a developer who never saw an earlier version of this code need this sentence to understand
> or safely change the version that exists now?

If no, the sentence goes. The constraint it was wrapped around stays, as one present-tense rule.

### How it runs

- **Folder by folder, one commit each**, in the same batches Parts 1a–3 used, on its own branch
  (`feature/code-docs-resweep`). Roughly ten commits.
- **This is a reading pass, not a mechanical one.** The three checkers still gate every commit
  (`docs:comments-only`, `docs:links`, `npm test` / `lint` / `build`), but they cannot see the
  defect being fixed. Every header and every inline comment in the folder is read and tested.
- **Bias hard toward deletion.** The failure mode is keeping too much, so when a sentence is
  borderline — "is this a constraint or the story of a constraint?" — it goes. A genuine hazard
  survives as one sentence; if it needs a paragraph, the paragraph is the tell.
- **Module headers**: strip any account of extraction, of what an old version did, or of what an
  old structure made hard. A header is identity, purpose, connections, and — only where a
  constraint needs it — one `@remarks` rule.
- **`feature-history.md` is the home for the deleted rationale.** Before deleting a substantial
  block, confirm its content is findable there; if not, quote it in the commit body (the same
  salvage step Decision 6 already defines).
- Runs **before Part 4** — the files outside `src/` are written in the same over-preserving voice,
  and it is cheaper to document them once against the final standard than to sweep them twice.

### Done when

Every file Parts 1a–3 touched has been re-read, and a senior reader picking any file at random
finds documentation that reads as *the operating manual for the code that exists*, with no trace
of how it got there.

## Part 4 — the files outside `src/` (added 2026-09-03, after Part 2)

The original scope stopped at `src/` to keep the overhaul finishable. That line held for Parts 1–3.
Part 4 closes the gap it left: the non-`src/` files are written in the same voice as the source
files were, so they carry the same history, symptoms, argument and first person — in
`next.config.ts` (the CSP config) as heavily as anywhere in `src/`.

Same standard, same voice rules, same "comments only, no behaviour change" constraint. Runs **after
Part 3**, as its own branch, commits, merge and push.

### Files in, and why

**~14 files, two commits.**

**Commit 1 — root config and `prisma/` (6):**

| File | State going in |
|------|---------------|
| `next.config.ts` | ~57 comment lines. The worst of the set, and security-critical. "The layer that was missing", "Two findings that reached production without it", "rendered as a broken-document box", "deliberately after the rule above", "Belt and braces", "a real bug fix rather than a relaxation for convenience". History + symptoms + argument throughout. |
| `.env.example` | 153 lines. Not code — a committed, documented file. Same genre: "which is what made it look like a page bug", "the routine hour-long confusion", "which once pointed a local run at the live database", "Deliberate override" / "deliberately so" ×3, "not the trade we want". Also duplicates rationale now living in `src/` headers (the `verify-full` paragraph, Resend async delivery, the R2 private-bucket reasoning). Reduce each var to *what it is · where to get it · required or optional*; drop what the source now carries. `#`-comment file, so `docs:comments-only` cannot verify it — check by hand. |
| `prisma/schema.prisma` | ~82 comment lines, **mixed**. Keep the genuine constraint docs (the partial-index / NULL-`userId` explanation, the prisma#29282 bug note, the `editedAt` vs `updatedAt` rule). Cut only the narrative: "Deliberately not `@updatedAt`", "Deliberately not an `upsert`", "pinning an old item drops it to the bottom". `.prisma` file — verify by hand plus `npx prisma validate`. |
| `prisma/seed.ts` | ~32 comment lines. "Deliberately not an `upsert`: …" — the same paragraph as the schema, duplicated. |
| `prisma/seed-data.ts` | ~20 comment lines. |
| `vitest.integration.config.ts` | ~20 comment lines, mostly declarative and fine — one chatty line to trim. Light touch. |

**Commit 2 — `scripts/` (8):**

`check-doc-links.ts`, `clear-users.ts`, `sweep-unverified.ts`, `sync-monaco.ts`, `test-db.ts`,
`test-email.ts`, `verify-user.ts`, `verify-comments-only.py`.

`verify-user.ts` is the notable one — "precisely how the first attempt at this feature reached
'done'", "which was the flaw in the first version". `verify-comments-only.py` got a good header in
Part 2a and needs little. The rest are un-audited but written in the house style, so expect the
same.

### Files deliberately still out

- `prototypes/homepage/` — a plain HTML/CSS/JS mockup outside the Next app.
- The `*.test.ts` / `*.integration.test.ts` suites.
- `prisma/migrations/**` — applied migrations are immutable.
- Trivial or already-clean root configs: `prisma.config.ts`, `vitest.config.ts`,
  `vitest.server-only.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `.prettierrc`,
  `.prettierignore`, `.gitignore`, `package.json`, `tsconfig.json`, `components.json`.
- `README.md`, `context/`, `docs/` — done in #117.

### Verification

`.ts` files (`next.config.ts`, the vitest config, the seed files) — `npm run docs:comments-only`
covers them. `.env.example`, `.prisma` and `.py` — verify comments-only by hand (every changed line
inside a comment) plus `npm run build`, `npx prisma validate`, `npm test`, `npm run lint`.
`docs:links` only scans `src/`, and TSDoc `{@link}` is not used outside it, so keep every
cross-reference in Part 4 files as prose (symbol + file named in words).

### How to run it, later

**Part 5 first** (the re-sweep of Parts 1a–3), then Part 4 in a fresh session:

```
/clear
/feature load code-docs-overhaul-spec.md part 4
/feature start
```

The spec describes all of Parts 1–4, so the `load` call must say **part 4** — it cannot tell which
part is starting otherwise.
