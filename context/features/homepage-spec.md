# Marketing Homepage

## Overview

Turn the static mockup in `prototypes/homepage/` into the real marketing homepage, built as Next.js
server components with Tailwind + shadcn/ui. The prototype stays where it is as the visual
reference — this feature does not delete or edit it.

The page keeps the mockup's structure exactly: nav, hero (headline + chaos → order visual),
features, AI section, pricing, closing CTA, footer.

## Routing

`/` is already the dashboard (`src/app/(dashboard)/page.tsx`), and today `proxy.ts` bounces
signed-out visitors from it to `/sign-in`. A landing page has to live at the root domain, so:

- New route `src/app/(marketing)/welcome/page.tsx`, in its own route group with its own layout (no
  sidebar shell).
- `proxy.ts`: when there is **no** session and `pathname === "/"`, `NextResponse.rewrite()` to
  `/welcome` instead of redirecting to `/sign-in`. Every other protected path still redirects as it
  does now, and a signed-in visitor at `/` still gets the dashboard — that branch is untouched.
- Add `/welcome` to `SIGNED_OUT_ROUTES` in `src/lib/auth-redirects.ts`. That makes a direct visit
  reachable while signed out, sends a signed-in visitor to `/`, and — because `resolveCallbackUrl`
  already rejects that set — stops anyone being returned to the marketing page after signing in.
- Export `metadata` (title + description) from the marketing page, taking the copy from the
  mockup's `<head>`; the root layout's values stay as the app-wide default.

## Scrolling

The root layout sets `body` to `h-full overflow-hidden` — the app shell scrolls its own main pane,
so the window does not scroll. The marketing layout must therefore own a scroll container
(`h-full overflow-y-auto`) rather than change the root body. Two consequences to get right:

- Anchor links (`#features`, `#ai`, `#pricing`) scroll that container, not the window. Use
  `scroll-smooth` on it, and `scroll-mt-*` on the section ids so the fixed nav does not cover the
  heading it just jumped to.
- The nav's on-scroll opacity listens to the **scroll container**, not `window`, or it never fires.

## Components

Server components by default; `"use client"` only where the list below says so. All of it under
`src/components/marketing/`.

| Component | Kind | Notes |
|---|---|---|
| `(marketing)/layout.tsx` | server | Scroll container + `<MarketingNav />` + `<MarketingFooter />` |
| `(marketing)/welcome/page.tsx` | server | Composes the sections and nothing else |
| `MarketingNav` | **client** | Scroll opacity + mobile menu open/close state |
| `Hero` | server | Eyebrow, headline, sub, CTAs, note |
| `ChaosField` | **client** | The animated icon field (see Animation) |
| `AppPreview` | server | The static "…with DevStash" dashboard mock |
| `FeatureGrid` | server | Six cards rendered from a config array |
| `AiSection` | server | Pro badge, checklist, static editor + AI-tags mock |
| `PricingPlans` | **client** | Owns the monthly/yearly state; renders both cards from config |
| `CtaSection` | server | Closing CTA |
| `MarketingFooter` | server | Brand, link columns, copyright year |
| `Reveal` | **client** | Reusable one-shot fade-in-on-scroll wrapper |
| `SectionHeading` | server | Eyebrow + `h2` + sub, shared by features/pricing |

`Reveal` replaces the mockup's `.reveal` class and its observer: one component wrapping children,
used by every section, rather than the same `IntersectionObserver` written per section.

The section copy — six feature cards, four AI bullets, the two pricing plans and their feature
lists — goes in `src/config/marketing.ts` as typed arrays, so the components stay layout only and
nothing is duplicated between the free and Pro cards.

## Styling

- Tailwind utilities and existing shadcn primitives. No new CSS file, no `@theme` additions unless
  a value is genuinely reused across sections.
- Buttons: existing `Button` with `asChild` wrapping a `Link` — `variant="default"` for the white
  primary, `"outline"`, `"ghost"`. The mockup's blue CTA has no matching variant; add one small
  marketing-local wrapper for it rather than growing the shared `buttonVariants` for one page.
- Item-type colours come from `ITEM_TYPE_COLORS` in `src/config/item-type-catalog.ts` — never
  re-typed hexes. Per-card accents are runtime values, so an inline `style` custom property is the
  right tool (this is the exception the coding standards already allow).
- Icons: `lucide-react` in place of the mockup's inline SVGs. The four brand marks (Notion, GitHub,
  Slack, VS Code) have no lucide equivalent — keep those as inline SVGs in a single
  `chaos-icons.tsx`.
- Reuse the existing `Brand` component (`src/components/layout/Brand.tsx`) in the nav and footer
  with `href="/"`; do not rebuild the wordmark.
- Dark only, matching the app. The prototype's CSS variables map onto the existing dark theme
  tokens (`bg-background`, `bg-card`, `border-border`, `text-muted-foreground`); use those instead
  of the prototype's raw greys wherever they line up.

## Links

Every button and link resolves to a real destination:

- "Get Started" / "Get Started Free" (nav, hero, pricing free card, closing CTA) → `/register`
- "Sign In" (nav, mobile menu) → `/sign-in`
- "Go Pro" → `/register`. There is no checkout yet (Phase 6); a signed-out visitor needs an account
  either way.
- "See how it works" → `#features`; nav and footer product links → `#features`, `#ai`, `#pricing`
- Brand (nav + footer) → `/`
- Docs, Changelog, Support, About, Privacy, Terms have no pages. Render them as muted,
  non-interactive text so the footer keeps its three-column shape, with a comment saying they
  become links when the pages exist. Nothing on the page may point at a 404.

## Animation

Port the prototype's `script.js` behaviour; `prefers-reduced-motion` is honoured throughout, as it
is in the prototype.

- **`ChaosField`** — the `requestAnimationFrame` drift, wall bounce, and cursor repel, moved into a
  `useEffect`. Positions are written imperatively to element refs; no per-frame React state. Keep
  the prototype's guards: the loop runs only when the field is on-screen *and* the tab is visible,
  and reduced motion gets the static grid instead.
- **`Reveal`** — `IntersectionObserver`, unobserve after the first intersection so nothing fades
  back out; reduced motion shows everything immediately.
- **Nav** — opacity on scroll, rAF-throttled.
- **Arrow pulse, hover states, transitions** — CSS/Tailwind only.
- The copyright year is computed in the server component (no client hook, no hydration mismatch).

## Testing

Lint and build. There is no meaningful business logic here, so no new unit tests unless a pure
helper falls out of the pricing copy. Visual check is manual — do not drive the browser.

## Out of scope

- Light mode / theme toggle.
- Stripe checkout behind "Go Pro" (Phase 6).
- Docs, Changelog, Support, About, Privacy, Terms pages.
- Changing or removing `prototypes/homepage/` — it stays as the reference.
- Any change to the dashboard's own route or layout.
