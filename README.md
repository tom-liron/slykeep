# DevStash

One fast, searchable, AI-enhanced hub for all developer knowledge and resources — snippets, prompts, commands, notes, links, files, and images.

See [`context/project-overview.md`](context/project-overview.md) for the full product spec, data model, and roadmap.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config) + **shadcn/ui**
- **Prisma 7** + **Neon (PostgreSQL)**
- **NextAuth v5** auth, **Cloudflare R2** storage, **Stripe** billing
- **OpenAI** `gpt-5-nano` for the Pro AI features

Reads go through Prisma end to end, in the server-only query modules under `src/server/`.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server with hot reload
- `npm run build` — production build
- `npm start` — serve the production build (run `build` first)
- `npm run lint` — ESLint over the project
- `npm run format` — format the project with Prettier
- `npm test` — unit tests, offline; the integration suite is excluded
- `npm run billing:test` — drive a real test-mode Stripe subscription through its whole life

Database:

- `npm run db:migrate` — create and apply a migration in development
- `npm run db:deploy` — apply pending migrations (production start)
- `npm run db:status` — check the migration history is in sync
- `npm run db:seed` — seed the system item types and the demo content
- `npm run db:seed:types` — the seven system item types only
- `npm run db:reset` — clear every account but the demo user, then reseed
- `npm run db:studio` — open Prisma Studio
- `npm run db:test` — database smoke test

Development helpers:

- `npm run user:verify -- <email>` — mark a development account email-verified
- `npm run email:test` — send through Resend and poll the real outcome
- `npm run monaco:sync` — copy the pinned monaco build into `public/`; runs automatically
  from `predev` and `prebuild`, so it is rarely invoked by hand

## Project Structure

```
src/
├── app/          # App Router routes; `(dashboard)` provides the shared app shell
├── actions/      # Server Actions for mutations
├── components/   # UI primitives and feature-focused presentation components
├── config/       # runtime product and presentation configuration
├── generated/    # Prisma Client, written by `prisma generate` — never edited
├── hooks/        # shared client hooks
├── lib/          # framework-agnostic helpers, schemas, and service clients
├── server/       # server-only queries and view-model preparation
└── types/        # shared contracts and persistence-independent view models
```
