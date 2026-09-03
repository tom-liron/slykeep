# Code Documentation Overhaul

**Scope: the 197 source files under `src/`.** Every `.ts` and `.tsx` file in `actions/`, `app/`,
`components/`, `config/`, `hooks/`, `lib/`, `server/`, `types/`, plus `auth.ts`, `auth.config.ts` and
`proxy.ts`.

Out of scope, and deliberately: the 48 `*.test.ts` suites, `scripts/`, `prisma/`, the root
configuration files, and `prototypes/`. The planning prose — `README.md`, `context/`, `docs/` — was a
separate feature and is already done.

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

`config/` is split out as **1a** because it ran first, alone, to calibrate the standard against real
files. Everything after it runs in passes of ten to twenty files.

**Why the later passes are larger, and safely so.** One folder at a time was the rule while the
standard was still being settled; a pass could be wrong in a way only reading it would reveal. That
is no longer the risk. Three checks now make a pass's correctness mechanical rather than a reading
job — `npm run docs:comments-only` proves no code moved, `npm run docs:links` proves no cross-reference is
dead, and `npm test`, `lint` and `build` prove nothing broke. What review is left is judgement on
the prose, which is spot-checking two or three headers per commit and costs the same whether the
commit holds eight files or twenty.

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
  after every feature; the rationale is in `project-overview.md` §10, Phase 4.
- `actions/items.ts` calls `Tag` rows "global and shared across users". Tags have carried `userId`
  and `@@unique([userId, normalized])` since the tag-scoping migration.
- `lib/rate-limit.ts` describes itself as throttling "the auth endpoints" and refers to "the five
  budgets". There are 11, covering uploads, checkout and the four AI actions.
