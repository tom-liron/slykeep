# Coding Standards

## TypeScript

- Strict mode enabled
- No `any` types - use proper typing or `unknown`
- Define interfaces for API responses and reusable data models
- Inline prop types are preferred for small components whose props are not reused
- Use type inference where obvious, explicit types where helpful

## React

- Functional components only (no class components)
- Use hooks for state and side effects
- Keep components focused - one job per component
- Extract reusable logic into custom hooks

## Next.js

- Server components by default
- Only use `'use client'` when needed (interactivity, hooks, browser APIs)
- Use Server Actions from `src/actions/` for form submissions and simple mutations
- Use API routes when you need:
    - Webhooks (Stripe, GitHub, etc.)
    - File uploads with progress tracking
    - Long-running operations
    - Specific HTTP status codes or headers
    - Endpoints for future mobile/CLI clients
    - Third-party integrations
- Otherwise, fetch data directly in server components
- Dynamic routes for item/collection pages

## Tailwind CSS v4

**CRITICAL**: We are using Tailwind CSS v4, which uses CSS-based configuration.

- **DO NOT** create `tailwind.config.ts` or `tailwind.config.js` files (those are for v3)
- All theme configuration must be done in CSS using the `@theme` directive in `src/app/globals.css`
- Use CSS custom properties for colors, spacing, etc.
- No JavaScript-based config allowed

Example v4 configuration:

```css
@import "tailwindcss";

@theme {
    --color-primary: oklch(50% 0.2 250);
}
```

## File Organization

- Components: `src/components/[feature]/ComponentName.tsx`
- Pages: `src/app/[route]/page.tsx`
- Server Actions (mutations): `src/actions/[feature].ts`
- Server-only queries, repositories, and data preparation: `src/server/[feature].ts`
- Types: `src/types/[feature].ts`
- Static product configuration: `src/config/[feature].ts`
- Lib/Utils: `src/lib/[utility].ts`

Type files define compile-time contracts only. Configuration files contain runtime values that satisfy those contracts.

## Naming

- Components: PascalCase (`ItemCard.tsx`)
- React modules: Match the primary exported component/provider (`SidebarContext.tsx`)
- Non-component files: kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Styling

- Tailwind CSS for all styling
- Use shadcn/ui components where applicable
- Avoid inline styles except for runtime values that Tailwind cannot generate, such as user-configured type colors
- Dark mode first, light mode as option
- Toasts are colored by outcome: success and error render on a tinted surface with matching bright text, via sonner's `richColors` on the single `<Toaster>` in `src/components/ui/sonner.tsx`. Use that prop rather than styling toasts per call site, and keep plain/info/loading toasts neutral — they have no outcome to signal.

## Database

- Use Prisma ORM for all database operations
- Always use `prisma migrate dev` for schema changes (not `db push`)
- Run `prisma migrate status` before committing to verify migrations are in sync
- Production deployments must run `prisma migrate deploy` before the app starts

## Data Fetching

- Server components fetch through focused server-only query modules
- Server query modules prepare view models so client and presentation components do not depend on Prisma records
- Client components use Server Actions
- Validate all inputs with Zod

## Error Handling

- Use try/catch in Server Actions
- Return `{ success, data, error }` pattern from actions
- Display user-friendly error messages via toast

## Documentation

Source documentation here has two jobs.

The first is **production maintenance**: what this is, what constrains it, what breaks if it
changes. The second is **onboarding** a developer new to this repository — fluent in TypeScript,
React, Next.js and the web, with no idea how *this* application is assembled. They learn the
codebase by reading it, so documentation explains a file's role in the application rather than
translating its identifiers into English.

Neither reader wants a lab notebook. Documentation never recounts how the code came to be.

### Voice

Third person, present tense, declarative. State a rule; do not defend it.

Never write, in any comment:

- History — what a value used to be, what was tried, what was abandoned, what a previous version did.
- Symptoms — the visual bug, the error text, or the measurement that prompted a decision.
- Argument against alternatives that were not built.
- First person, including the collective "we" and "our".
- Words that argue rather than state: *deliberately*, *on purpose*, *the whole point*, *worth noting*,
  *it turns out*. If a rule needs enforcing, state the rule.
- Anything the next line already says plainly.

### File headers

**Every source file opens with a header, without exception.** Headers are how this repository is
learned, so a header that restates the filename is a wasted one.

**Orient the reader before explaining the implementation.** A header moves from broad context toward
detail, in this order — most files need the first three, not all five:

1. **Identity** — what kind of module is this?
2. **Purpose** — what job does it do in this application?
3. **Connections** — who uses it, what does it talk to, where does it sit in the flow?
4. **Constraints** — what has to stay true.
5. **Implementation detail** — only where it is needed to make a constraint understandable.

Never open with architecture or mechanism while the reader still does not know what kind of file
they have opened.

#### The first line identifies the module

The opening sentence answers **"what is this module?"** — a short noun phrase, not a restatement of
the filename.

| Weak | Prefer |
|---|---|
| "Configuration values." | "Shared authenticated-page layout and summary configuration." |
| "ItemCard component." | "Reusable item-summary card component." |
| "Rate limit module." | "Redis-backed request-rate limiting utilities." |
| "Server Action for item mutations." | "Server-side item mutation actions." |
| "Creates presigned R2 URLs." | "Cloudflare R2 file-access utilities." |
| "Auth config." | "Shared NextAuth configuration." |

#### Then say why the application needs it

Identity alone still does not explain existence. Follow it with the job the module does here, and
with the relationship a newcomer cannot infer — which layer consumes it, which boundary it sits on.

```ts
/**
 * Shared authenticated-page layout and summary configuration.
 *
 * Centralizes the dashboard summary limits and the reusable grid layouts used across the signed-in
 * area. Server-side queries take the numeric limits when loading dashboard summaries; pages take
 * the grid constants so collection, item and file layouts stay consistent.
 */
```

```ts
/**
 * Server-side item mutation actions.
 *
 * The boundary between the item UI and Prisma: item forms and controls call these actions, which
 * authenticate the user, validate the submitted input and perform the corresponding writes.
 */
```

```ts
/**
 * Cloudflare R2 file-access utilities.
 *
 * The server-side access layer for files stored privately in R2. Uploaded files are never public,
 * so authenticated preview and download flows use these helpers to create the temporary access
 * needed to read them.
 */
```

```ts
/**
 * Shared NextAuth configuration.
 *
 * Reused by the route-protection proxy and by the full server-side authentication setup. This layer
 * stays free of database-dependent initialization so the proxy can apply the same authorization
 * rules on the edge.
 */
```

**Boundary modules** — where this application meets something else — name what sits on each side:
UI → Server Action → Prisma; application → Stripe; application → R2; proxy → authentication;
form → validation; Redis → rate limiting.

#### Architecture before mechanics

Explain the project's use of a technology, not the technology itself. A header is not the place to
teach CSS, Prisma, React or NextAuth. Keep the load-bearing rule; drop the tutorial around it.

Avoid a header whose bulk is grid-track semantics. Prefer:

```ts
/**
 * Shared responsive card-grid configuration.
 *
 * Dashboard, collection and item-type pages use this grid so card layouts respond consistently to
 * the width of the main content area.
 *
 * @remarks
 * Uses container queries rather than viewport breakpoints: the collapsible sidebar changes the
 * space available to the content.
 *
 * Keep `grid-cols-1` — it stops wide card content forcing the grid past its container.
 */
```

#### Write for someone new to this repository

Assume the reader knows React components, hooks, databases, APIs and server-side code. Do **not**
assume they know this repository's feature boundaries, which layer owns a responsibility, why two
similar-looking modules both exist, how UI code reaches the database, how authentication flows
through the application, or where Stripe, R2 and Redis fit into the product. Where one sentence
makes such a relationship explicit, include it. Make architecture explicit without simplifying the
technical content.

#### When would a maintainer come here?

Where it materially improves the mental model, say what kind of change leads to this file —
*"changes to dashboard summary sizes or shared signed-in page layouts usually belong here"*. Not a
mechanical sentence on every file.

#### The shape of a header

Most headers land on this shape. Paragraphs are filled where they carry something, never
mechanically:

```ts
/**
 * [What job the file performs in this application.]
 *
 * [How it connects to its main consumers, dependencies or place in the application flow.]
 *
 * [What kind of change belongs here — only where it helps.]
 *
 * @remarks
 * [Important constraints and invariants, if any.]
 */
```

A tiny module needs two lines, a normal one three to six, an architectural one more. The amount of
documentation follows the amount of non-obvious responsibility, not the length of the file.

### Exported symbols

Document every **significant** exported symbol: anything with a responsibility, a side effect, an
architectural role, or a constraint. Give it the same shape as a header — what kind of operation it
is, what it is responsible for, what it does beyond returning a value, and where it sits in the
flow. A reader should not have to trace the implementation to learn that it writes to the database,
calls a third party, redirects, or throws.

Documentation whose only value is translating a symbol name into English is not documentation:

```ts
/** Gets the current user. */        // adds nothing
/** Props for ItemCard. */           // adds nothing
/** The ItemCard component. */       // adds nothing
```

```ts
/**
 * Resolves the authenticated application user for server-side operations.
 *
 * Returns the database-backed user rather than the NextAuth session alone, so callers can read
 * account and subscription state the session does not carry.
 */
export async function getCurrentUser()
```

Tags are used **only where they carry information the signature does not**. Never restate a type:
`@param items - An array of items` documents nothing and is worse than no tag.

| Tag | Use it when |
|-----|-------------|
| `@param` | The name and type leave something open: units, accepted forms, what a flag switches on, which of several meanings applies. |
| `@returns` | The return type does not say what the value *means*. Never for `void` or `Promise<void>`. |
| `@throws` | A caller has to handle a throw — or has to know that none occurs. |
| `@remarks` | A constraint or invariant that a later change could break. |
| `@see` | Another symbol or module that this one must stay in step with. |
| `@defaultValue` | An optional parameter or property whose default is not obvious. |

### Cross-references

Documentation names other modules and symbols constantly, and a reference the reader cannot follow
sends them to the search box. Make references navigable where the language can, and honest where it
cannot. The choice between the two forms is not stylistic — it is whether the symbol is in scope.

- **In scope** — the symbol is imported into this file or declared in it: `{@link Symbol}`.
  Go-to-definition follows it from the comment itself, so it is a real link. This holds everywhere a
  comment can go — inside `@remarks` and `@see`, and in a module header floating above the imports.
  **Link every in-scope symbol the prose names**, not one per block: a header that names six
  constants and links one is the problem this rule exists to fix.
- **Not in scope** — a symbol in a module this file does not import: `{@link}` does **not** resolve,
  and neither does `{@link import("…").Symbol}` or `{@link ../path#Symbol}`. It silently renders as
  plain text, promising a link that is not there. Name the symbol and its module in prose instead —
  "`syncSubscriptionState` in `server/billing.ts`" — which is one file-switcher step away and
  greppable.

Configuration modules are the hard case and are not an excuse: `config/` imports almost nothing and
is imported by everything, so most of what its documentation names — the queries and pages that
consume it — can only be prose. Its own exports still link each other.

A module header that describes the file goes **above the imports**. Left directly above the first
declaration it silently becomes that declaration's documentation, so hovering an unrelated type
shows the whole module description.

Never cite a line number. `items.ts#L42` is wrong after the next edit above it, and nothing checks
it.

`npm run docs:links` enforces this: it asks the language service for a definition at each link, the
same question a cmd-click asks, and fails on any that leads nowhere. Nothing else does — `tsc`,
ESLint and the build all accept a dead link.

Prefer linking a **symbol** over naming a file: a symbol survives a rename the compiler can follow,
and it lands the reader on the declaration rather than at the top of a 300-line module.

Where a reference is load-bearing — the other half of a rule written twice, a module that must stay
in step — put it under `@see` so it reads as an obligation rather than an aside.

### Depth

Match the depth to the complexity. Two to five useful lines beat fifteen exhaustive ones, and no
block exists to satisfy a coverage metric.

| Kind of code | Depth |
|---|---|
| Trivial — constants, obvious prop types, aliases, tiny helpers | Nothing where the name and type already say it; one line where project context adds something |
| Ordinary application code — functions, hooks, components with a real responsibility | Identity and summary, plus enough application context to place it |
| Architectural and boundary code — auth, Stripe, R2, Redis, the database boundary, the proxy, complex state, security-sensitive paths | Identify the kind of module, place it in the wider flow, name important side effects, and reserve `@remarks` for real invariants |

Never explain syntax, and never explain what the next line plainly says.

### Constraints

Real constraints belong under `@remarks`, written as a rule in the present tense.

```ts
 * @remarks
 * The breakpoint must stay identical to `ActionLabel`'s: labelled buttons cannot go in a grid
 * with no line to wrap onto.
```

Not as an account of how it was found, how many values were tried first, or what it looked like
when it was wrong.

### Inline comments

Comments inside function bodies and JSX are **wanted wherever they make the code clearer**. Preserve
the ones that help, and add them where they are missing — a guard whose purpose is not obvious, a
non-obvious step in an algorithm, a regex, an ordering requirement, the meaning of a branch, a call
whose API behaves unexpectedly.

They follow the same voice: one or two lines saying what the code does or which rule it implements.
Not an argument, not a history, not a restatement of the statement below.

### Writing documentation for an existing file

Documentation is written **top-down from the file's role in the repository**, not bottom-up from its
contents. Existing comments are one piece of evidence; the implementation and its real usages are
the source of truth. A pass that transforms each old comment into a new one reproduces the old
document's blind spots in better formatting.

So before editing any comment in a file, build a mental model of it by answering six questions. The
analysis is working context — it is never written to the repository.

1. **Role.** What job does this file do in the application? Not a category — "utility functions",
   "layout constants", "authentication helpers", "item components" all fail this question. State the
   actual responsibility.
2. **Subsystem.** Which feature or architectural area does it belong to: the authenticated
   dashboard, item management, authentication, billing, uploads and storage, search, collections,
   rate limiting, the application shell, validation.
3. **Consumers.** Read real usages. For a shared module, a config file, a hook, a service or an
   exported component, inspect one to three representative importers or callers first. A file
   exporting `CARD_GRID`, `DASHBOARD_COLLECTIONS_LIMIT` and `FILE_ROW_GRID` is not understood until
   those three names have been searched for.
4. **Connections.** What sits before and after this module in the flow — item form → Server Action →
   validation → Prisma → PostgreSQL; authenticated UI → file-access helper → Cloudflare R2; request →
   proxy → NextAuth authorization → protected route; Server Action → rate-limit helper → Redis →
   expensive operation. The comment carries a sentence, not a diagram.
5. **Change trigger.** What product or engineering change would bring a developer to this file? Most
   valuable for config, integrations, shared hooks, validation, the proxy and shared UI
   infrastructure.
6. **Constraints.** Which non-obvious rules would cause a bug or a regression if changed? Keep those.
   A long explanation is not kept because it is interesting.

Only then read the old comments — to recover constraints and rationale, not to reword them.

**If the first question cannot be answered confidently, stop documenting that file.** Inspect its
consumers and its dependencies, then come back to it. A header guessed from the filename and the
export list is the failure this method exists to prevent.

### The test

A comment is not good because it is accurate or valid TSDoc. The questions are: **do I know what
this file is, do I know why this application has it, and did this comment make the repository easier
to understand?**

After reading a module header — without opening the imports, the filename or the export list — a
developer unfamiliar with the repository should usually be able to say what kind of module they
opened, why it exists, which part of the application it belongs to, roughly who uses it, and how it
connects to the surrounding system.

After reading an important exported function's documentation, they should know what kind of
operation it is, its responsibility, its important side effects, and where it participates in the
application flow — without tracing the implementation.

### Length

A file header runs to about eight lines, a symbol's block to about ten. Past that, the content is
usually rationale that belongs in `@remarks` as a rule — or belongs nowhere.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible
- Add focused unit tests for non-trivial business rules and data transformations
