# DevStash

One fast, searchable, AI-enhanced hub for all developer knowledge and resources — snippets, prompts, commands, notes, links, files, and images.

See [`context/project-overview.md`](context/project-overview.md) for the full product spec, data model, and roadmap.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config) + **shadcn/ui**
- **Prisma 7** + **Neon (PostgreSQL)** _(planned)_
- **NextAuth v5** auth, **Cloudflare R2** storage, **Stripe** billing _(planned)_

The dashboard currently uses a server-only mock query layer (`src/server/mock-data/`) until the database is wired up.

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
- `npm test` — run unit tests

## Project Structure

```
src/
├── app/          # App Router routes; `(dashboard)` provides the shared app shell
├── components/   # UI primitives and feature-focused presentation components
├── config/       # runtime product and presentation configuration
├── lib/          # small framework-agnostic formatting and styling helpers
├── server/       # server-only records, queries, and view-model preparation
└── types/        # shared contracts and persistence-independent view models
```
