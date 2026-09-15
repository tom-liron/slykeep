# Redesign — Design System Spec

The complete, decided design system that replaces the stock shadcn `neutral` preset SlyKeep still ships.
It is implemented as **four features, one after another**, each on its own branch through the normal
`/feature load → start → complete` flow. Everything needed to build it is in this file; the mockups
are reference only.

**Reference mockups** (visual truth for anything this file leaves ambiguous):
- Final direction — app and landing page: https://claude.ai/artifact/KE9GGg2vDoyQKCgXSLpRux (tab
  **"Current + Mona titles"**)
- Colour and surface exploration that led here: https://claude.ai/artifact/2Ad8319ZaMK7wPCQ4B7iF9
  (tab **Layered**)

---

## 1. Decisions (locked)

| # | Decision | Value |
|---|---|---|
| D1 | Direction | **Layered** — dark-only, gold brand accent, fox mark |
| D2 | Theme | Dark only. The `.dark` palette is replaced; the unused light `:root` block is left as it is |
| D3 | Layout and components | **Unchanged.** Same app shell, dashboard, cards, drawer and landing sections, same order. This is a palette, type and brand change only |
| D4 | Surfaces | Layered: near-black frame (top bar, sidebar) around a lighter work area, cards a clear step up |
| D5 | Brand accent | Gold `#F2B544` for primary buttons, the logo, favourites and focus |
| D6 | Item-type palette | **Vivid** (§3). Prompts are **orange**, so they never read as the gold favourite star or logo |
| D7 | App typeface | **Rethink Sans** everywhere in the app (replaces Geist) |
| D8 | Monospace | **Geist Mono stays** (item rows, dates, keyboard hints) |
| D9 | Marketing headlines | **Mona Sans**, slightly expanded, on the landing page's headlines only. Body, buttons, cards and pricing text stay Rethink Sans |
| D10 | Brand mark | Gold fox tile (§5) replaces the indigo→purple `Layers` tile everywhere, including the favicon shipped in #146 |
| D11 | Stripe | Checkout and the Customer Portal re-branded to match, via the Stripe Dashboard (§8) |
| D12 | Delivery | Four sequential features (§10), not one large change |

---

## 2. Colour tokens — `src/app/globals.css`, `.dark` block

Hex values replace the current `oklch` ones. Token names are the existing shadcn names, so every
component picks the palette up without edits.

### Surfaces and text

| Token | New value | Role |
|---|---|---|
| `--background` | `#1A1A1D` | Work area behind the dashboard content |
| `--foreground` | `#F4F4F5` | Primary text |
| `--card` / `--popover` | `#26262B` | Cards, stat tiles, menus, dialogs |
| `--card-foreground` / `--popover-foreground` | `#F4F4F5` | |
| `--muted` | `#303036` | Tag chips, subtle fills |
| `--muted-foreground` | `#A6A6AE` | Secondary text, counts, dates |
| `--accent` | `#303036` | Hover fills (shadcn `accent`) |
| `--accent-foreground` | `#F4F4F5` | |
| `--secondary` | `#2B2B30` | Secondary buttons (e.g. marketing "Sign In") |
| `--secondary-foreground` | `#F4F4F5` | |
| `--border` | `#3A3A41` | Card and divider borders |
| `--input` | `#3A3A41` | Input borders |
| `--field` *(new)* | `#141416` | Input and search-field background — darker than the page, as in the mockup |
| `--destructive` | unchanged | |
| `--chart-*` | unchanged | |

### Frame (top bar and sidebar)

| Token | New value |
|---|---|
| `--sidebar` | `#0E0E10` |
| `--sidebar-foreground` | `#F4F4F5` |
| `--sidebar-accent` | `#222226` (active and hover row) |
| `--sidebar-accent-foreground` | `#F4F4F5` |
| `--sidebar-border` | `#1E1E22` |
| `--sidebar-primary` | `#F2B544` |
| `--sidebar-primary-foreground` | `#1D1405` |
| `--sidebar-ring` | `#F2B544` |

The top bar currently paints `bg-background`; it moves to `bg-sidebar` so the frame reads as one
near-black piece around the lighter work area (`TopBar.tsx`).

### Brand and semantic

| Token | New value | Replaces |
|---|---|---|
| `--primary` | `#F2B544` | Greyscale `oklch(0.922 0 0)` — primary buttons become gold |
| `--primary-foreground` | `#1D1405` | Text on gold (contrast ≈ 10:1) |
| `--ring` | `#F2B544` | Focus ring (rendered at `/50` by the base layer) |
| `--favorite` | `#F2B544` | `#fde047` |
| `--pin` *(new)* | `#5B9DFF` | `fill-sky-400 text-sky-400` in `StatusBadges.tsx` |
| `--suggestion` | `#5B9DFF` | `#60a5fa` (AI tag suggestions) |
| `--confirm` | `#3DD68C` | `#4ade80` |
| `--prose-link` *(new)* | `#5B9DFF` | The literal `#60a5fa` in `.markdown-preview a` and its checkbox `accent-color` |

New tokens get a `--color-*` entry in `@theme inline` like the existing ones (`--color-field`,
`--color-pin`, `--color-prose-link`). Inputs and the command-palette trigger take `bg-field` where
they now use `dark:bg-input/30`.

### Icon tile tint
Type-coloured icon tiles (stat band, item cards, file rows, drawer header, profile) tint at **22%**
instead of 10%. Change the `withAlpha` default in `src/lib/utils.ts` from `0.1` to `0.22`, and update
its example comment, which still cites `#3b82f6`.

### Editor
- `EDITOR_SURFACE` in `src/config/editor.ts`: `#171717` → `#141416` (matches `--field`).
- The rest of the SlyKeep Monaco theme in `CodeEditor.tsx` (line numbers, cursor, indent guides,
  scrollbar) stays neutral; it already sits correctly on the new surface.

---

## 3. Item-type palette — Vivid

| Type | Old | **New** |
|---|---|---|
| snippet | `#3b82f6` | **`#FF5C5C`** red |
| prompt | `#8b5cf6` | **`#FF8F40`** orange |
| command | `#f97316` | **`#3DD68C`** green |
| note | `#fde047` | **`#F266B3`** magenta |
| file | `#6b7280` | **`#5B9DFF`** blue |
| image | `#ec4899` | **`#A987FF`** violet |
| link | `#10b981` | **`#2FD0E6`** cyan |

**Where it lives, and why this needs a migration.** `ITEM_TYPE_COLORS` in
`src/config/item-type-catalog.ts` is the source, but the app renders `ItemType.color` **from the
database row** (`server/view-models.ts`, `server/item-types.ts`). The seed is the only thing that
copies the catalogue into rows, and production never runs the seed. So:

1. Update `ITEM_TYPE_COLORS`.
2. Add a Prisma migration (`prisma migrate dev --create-only`, then fill it in) that updates the
   seven **system** rows, so `migrate deploy` carries it to production:
   ```sql
   UPDATE "item_types" SET "color" = '#FF5C5C' WHERE "name" = 'snippet' AND "userId" IS NULL;
   UPDATE "item_types" SET "color" = '#FF8F40' WHERE "name" = 'prompt'  AND "userId" IS NULL;
   UPDATE "item_types" SET "color" = '#3DD68C' WHERE "name" = 'command' AND "userId" IS NULL;
   UPDATE "item_types" SET "color" = '#F266B3' WHERE "name" = 'note'    AND "userId" IS NULL;
   UPDATE "item_types" SET "color" = '#5B9DFF' WHERE "name" = 'file'    AND "userId" IS NULL;
   UPDATE "item_types" SET "color" = '#A987FF' WHERE "name" = 'image'   AND "userId" IS NULL;
   UPDATE "item_types" SET "color" = '#2FD0E6' WHERE "name" = 'link'    AND "userId" IS NULL;
   ```
   Scoped to `userId IS NULL` — custom types do not exist yet, and when they do they own their colour.
   Run against the **development** Neon branch only; production receives it through the Vercel deploy.
3. `DASHBOARD_STAT_COLORS` (`config/dashboard.ts`) and the marketing `--type-*` variables
   (`lib/type-color-vars.ts`) derive from the catalogue and follow automatically.
4. Update test fixtures that hard-code the old hex values: `server/collections.test.ts`,
   `server/items.test.ts`, `server/search.test.ts`, `components/items/CopyItemButton.test.tsx`, and
   `scripts/test-db.ts`.

**Known adjacency:** snippet red `#FF5C5C` sits near `--destructive`. Destructive colour is used only
on delete actions and error toasts, never beside a type icon, so this is accepted.

---

## 4. Typography

| Role | Face | Where |
|---|---|---|
| App UI and body | **Rethink Sans** | Everything; `--font-sans` |
| Monospace | **Geist Mono** (unchanged) | `--font-mono` |
| Marketing headlines | **Mona Sans** (variable, width axis) | Landing headlines only; `--font-display` |

- **Root layout (`src/app/layout.tsx`):** replace `Geist` with `Rethink_Sans` from `next/font/google`
  on `variable: "--font-sans"`. Keep `Geist_Mono` on `--font-mono`. `global-error.tsx` reads the
  same variable and needs no change beyond any comment naming Geist.
- **Marketing only (`src/app/(marketing)/layout.tsx`):** load `Mona_Sans` there (not in the root
  layout, so the app never downloads it) on `variable: "--font-display"`, requesting the `wdth` axis.
  Headline style: `font-family: var(--font-display)`, weight 700, `font-stretch: 112%`,
  `letter-spacing: -0.025em`. If `next/font` rejects the `wdth` axis for Mona Sans, ship weight 700
  at normal width and note it.
- **Which headlines** (exactly these, nothing else):
  - `Hero.tsx` — the `h1` ("Save it once. Find it in seconds.")
  - `SectionHeading.tsx` — its `h2` (Features, Any device, Pricing)
  - `AiSection.tsx` — its `h2` ("Paste it in. AI does the rest.")
  - `CtaSection.tsx` — its `h2` ("Keep the next thing you look up")
- The app screenshots and videos inside the landing page are not affected — they are images.

---

## 5. Brand mark

**Geometry** (the mark every surface uses):

```svg
<svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
  <rect width="30" height="30" rx="8" fill="#F2B544"/>
  <path d="M8 21V9.5l5 4.2h4l5-4.2V21l-7 3.2z" fill="#1D1405"/>
</svg>
```

- **`Brand.tsx`:** the gradient `span` with the `Layers` icon becomes this mark at `size-8`. Keep the
  "SlyKeep" wordmark, its sizing and the `compact` behaviour exactly as they are.
- **Favicon — `src/app/`** (replacing the files from #146, **same filenames**, so the proxy matcher
  that already excludes them needs no change):
  - `icon.svg` — the mark above.
  - `favicon.ico` — 16, 32 and 48px frames. Check the glyph at 16px; if the ears blur, thicken the
    path rather than shrinking the tile's radius.
  - `apple-icon.png` — 180×180, **full-bleed** gold (no rounded corners; iOS masks it), glyph centred
    at roughly 60% of the tile.
- **`public/brand/slykeep-icon-512.png`** *(new)* — 512×512 square, gold tile with the glyph, for
  the Stripe icon upload (§8) and any future social image.

---

## 6. App — hard-coded colours to replace

| File | Today | New |
|---|---|---|
| `components/layout/TopBar.tsx` | `bg-background` header; Upgrade button `text-purple-300 hover:bg-purple-500/15 hover:text-purple-200` | `bg-sidebar`; Upgrade `text-primary hover:bg-primary/15` |
| `components/ui/StatusBadges.tsx` | Pin `fill-sky-400 text-sky-400` | `fill-pin text-pin` |
| `app/globals.css` | `.markdown-preview a` and checkbox `#60a5fa` | `var(--prose-link)` |
| `components/items/ItemDrawerToolbar.tsx` | Comment cites `#3b82f6` as a snippet's accent | Update the comment (snippet is now red) |
| `config/editor.ts` | `EDITOR_SURFACE = "#171717"` | `#141416` |
| `lib/utils.ts` | `withAlpha` default `0.1`, example `#3b82f6` | `0.22`, new example |

Classes such as `dark:` variants in `components/ui/*` stay — they reference tokens, which now
resolve to the new palette.

---

## 7. Marketing page — changes by file

The palette and layout are exactly the app's; the only new typographic element is Mona Sans (§4).

| File | Change |
|---|---|
| `Hero.tsx` | Glow blobs: first `var(--type-snippet)` → `var(--color-primary)` at opacity `.16`; second `var(--type-prompt)` → `var(--type-image)` at `.10`. Headline second line: gradient `bg-clip-text` → solid `text-primary`. Eyebrow dot `--type-link` → `--color-primary`. Fine print `text-zinc-400` → `text-muted-foreground`. Headline font per §4 |
| `CtaButton.tsx` | `--cta` from `ITEM_TYPE_COLORS.snippet` → gold `var(--color-primary)` with `text-primary-foreground`; drop the darkening `color-mix` (gold carries dark text well above AA); shadow tinted gold. Rewrite the doc comment, which reasons about `#3b82f6` contrast |
| `SectionHeading.tsx` | Eyebrow `text-zinc-400` → `text-muted-foreground`; `h2` font per §4 |
| `AiSection.tsx` | Remove the purple radial bloom (the approved mockup has a plain background). "Pro Feature" badge: `--type-prompt` border/fill and `text-purple-300` → gold `--color-primary` at the same mixes, text `#F6C76A`. `h2` font per §4 |
| `AiFeatureShowcase.tsx` | Active highlight `--type-prompt` → `--color-primary` |
| `PricingPlanCard.tsx` | Featured card: `--type-prompt` border, shadow and radial → `--color-primary`. "Most Popular" gradient pill → solid `bg-primary text-primary-foreground`. Featured check circles → gold mixes with `text-[#F6C76A]` (replacing `text-purple-300`). Not-included rose circles unchanged |
| `BillingCycleToggle.tsx` | "Save 25%" badge `--type-link` + `text-emerald-300` → `--color-confirm` (`#3DD68C`) |
| `CtaSection.tsx` | Radial layers from `--type-snippet`/`--type-image` → a single `--color-primary` radial at 12% over `linear-gradient(card → background)`. Fine print `text-zinc-400` → `text-muted-foreground`. `h2` font per §4 |
| `MarketingFooter.tsx`, `ProsePage.tsx` | `text-zinc-400` → `text-muted-foreground` |
| `MarketingNav.tsx` | No visual change; update the comment that explains colours by "blue is the call to action, purple means Pro" |
| `app/(dashboard)/upgrade/page.tsx` | No direct change — inherits gold through `PricingPlanCard` |
| `BrowserFrame.tsx`, `DeviceFrames.tsx` | **Unchanged** — traffic lights and device bezels are product-neutral hardware colours |

---

## 8. Stripe branding

No branding is set in code (`actions/billing.ts` creates Checkout and Portal sessions with no
appearance options); both read the account's branding settings. So this is Dashboard work, done in
**both test mode and live mode** if the Dashboard keeps them separate:

**Stripe Dashboard → Settings → Business → Branding**

| Setting | Value |
|---|---|
| Icon | `public/brand/slykeep-icon-512.png` |
| Logo | Optional; the icon alone is enough |
| Brand color | `#0E0E10` (the frame colour) |
| Accent color | `#F2B544` (gold — buttons and highlights) |

Then open a test Checkout (Settings → Upgrade) and the billing portal (Settings → Manage billing)
and confirm the gold buttons and fox icon. Receipt and invoice emails inherit the same branding.
No code change; `npm run billing:test` is unaffected and does not need to run for this.

---

## 9. Deliberately unchanged

- **Layout and component structure** (D3) — including the collection card and item card left accent
  borders, the stat band, the drawer and every landing section.
- **Light `:root` palette** — unused while the app is dark-only; restyling it belongs to a future
  light-mode feature.
- **Transactional email template** (`server/infra/email.ts`) — neutral greys on white read correctly
  in every mail client; a gold button is a possible later polish, not part of this system.
- **Monaco syntax colours** — inherited from the chosen editor theme, per the existing editor
  settings feature.
- **Toasts** — sonner's `richColors` already tints success and error by outcome.

---

## 10. Delivery plan — four features

Each is its own branch and commit, merged before the next starts. The order matters: media is
recorded last because it captures the finished app.

### Feature 1 — App palette, typeface and brand · `feature/redesign-app-theme`
- §2 tokens (including `--field`, `--pin`, `--prose-link`, `withAlpha` 22%, editor surface)
- §4 Rethink Sans in the root layout
- §5 fox mark in `Brand.tsx`, new favicon set, `public/brand/slykeep-icon-512.png`
- §6 hard-coded app colours
- Update comments that describe replaced colours (invoke `docs-style`; run `npm run docs:links`)
- **Check in the browser (you):** dashboard, sidebar active row, a drawer with code and markdown,
  a dialog, toasts, the favicon in a fresh tab
- **Estimate:** 1–1.5 h

### Feature 2 — Item-type palette · `feature/redesign-type-colors`
- §3 catalogue colours, data migration, test fixtures
- Update the type-colour table in `context/project-overview.md` §8
- Apply the migration to the development Neon branch; production receives it via deploy
- **Check in the browser (you):** sidebar type icons, collection and item card accents, stat icons
- **Estimate:** 45 min – 1 h

### Feature 3 — Marketing page · `feature/redesign-marketing`
- §4 Mona Sans on the marketing headlines
- §7 every marketing file
- **Check in the browser (you):** `/welcome` top to bottom, `/upgrade`, `/privacy` or `/terms`
- **Estimate:** 1 h

### Feature 4 — Media and Stripe · `feature/redesign-media`
- Before recording: change `RECORDER.email` in `scripts/record-marketing.ts` from
  `alex.morgan@example.com` to a `@gmail.com` address, since the sidebar shows it in every clip. Pick
  an unlikely local part rather than a common name, since a real person may own it. Update the
  constant's comment, which justifies the address by `example.com` being reserved. The script creates
  the account directly in the database and sends no email, so the change is safe to make.
- `npm run marketing:record` with `npm run dev` running — re-records the hero walkthrough, the four
  AI clips and the three device screenshots into `public/marketing/` in the new look (creates and
  deletes its own Pro account on the dev database; makes real OpenAI calls)
- Review the new posters and clips, commit the media
- §8 Stripe branding in the Dashboard (manual, test and live)
- Final pass on `context/project-overview.md` §8 "General Direction" so it describes the redesign
- **Estimate:** 45 min – 1 h (the recording itself runs about 15–20 minutes unattended)

**Total: roughly 3.5–4.5 hours**, most of it reviewing and checking in the browser rather than
waiting on code. Comfortably one working day; each feature is also a safe stopping point.

---

## 11. Acceptance

- No `purple`, `indigo`, `violet`, `sky-400`, `emerald-300` or `zinc-400` class remains in `src/`
  outside `BrowserFrame.tsx` and `DeviceFrames.tsx`.
- No old catalogue hex (`#3b82f6`, `#8b5cf6`, `#f97316`, `#fde047`, `#6b7280`, `#ec4899`, `#10b981`)
  remains in `src/`, `prisma/` or `scripts/`, including comments.
- Development and production `item_types` system rows carry the §3 colours.
- The favicon, the `Brand` tile, the landing page and Stripe Checkout all show the gold fox.
- Tests, `npm run lint`, `npm run build` and `npm run docs:links` pass at the end of every feature.
