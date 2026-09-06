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

Every source file opens with a header, and every significant exported symbol carries a block. The
full standard — header shape, voice, depth by kind of code, `{@link}` cross-reference rules, and the
governing rule that a comment states the surviving conclusion rather than the investigation that
found it — lives in the `docs-style` skill. Invoke it before writing or revising any comment.

`npm run docs:links` checks that every `{@link}` in `src/` resolves; `tsc`, ESLint and the build all
accept a dead link, so it is the only thing that catches one. Run it after any documentation pass.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible
- Add focused unit tests for non-trivial business rules and data transformations
