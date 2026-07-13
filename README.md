# DevStash

One fast, searchable, AI-enhanced hub for all developer knowledge and resources — snippets, prompts, commands, notes, links, files, and images.

See [`context/project-overview.md`](context/project-overview.md) for the full product spec, data model, and roadmap.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config) + **shadcn/ui**
- **Prisma 7** + **Neon (PostgreSQL)** _(planned)_
- **NextAuth v5** auth, **Cloudflare R2** storage, **Stripe** billing _(planned)_

The dashboard currently runs on mock data (`src/lib/mock-data.ts`) until the database is wired up.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

## Scripts

- `npm run dev` — start the dev server with hot reload
- `npm run build` — production build
- `npm start` — serve the production build (run `build` first)
- `npm run lint` — ESLint over the project
- `npm run format` — format the project with Prettier

## Project Structure

```
src/
├── app/          # Next.js App Router routes (root + /dashboard)
├── components/   # ui/ primitives, and layout/ items/ collections/ dashboard/ features
├── config/       # item-types.ts — source of truth for type colors, icons, routes
├── lib/          # helpers: cn, colors, format, item-types lookup, dashboard selectors, mock-data
└── types/        # domain shapes (Item, ItemType, Collection, User)
```
