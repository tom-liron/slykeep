# Current Feature: AI Explain Code

## Status

In Progress

## Goals

- Add an `explainCode` Server Action in `src/actions/ai.ts`, alongside `suggestTags` and
  `suggestDescription`: auth via `getCurrentUser()`, Pro gating via `canUseAi()`, Zod validation of
  the draft, and its own `aiExplain` rate-limit bucket in `src/lib/rate-limit.ts`.
- Put the prompt building and response parsing in `src/lib/ai-explain.ts`, matching `ai-tags.ts` /
  `ai-description.ts` — instructions, payload limit, max output tokens, input builder, parser.
- Add an "Explain" button (Sparkles icon) to the code editor's window-controls header, next to the
  Copy button.
- Show it only for `snippet` and `command` items, and only in the item drawer's read view — never in
  the create dialog or the edit form.
- Once an explanation exists, render Code / Explain tabs in the editor header that toggle the same
  container between the editor and the explanation.
- Render the explanation as markdown, ~200–300 words, covering what the code does and its key
  concepts.
- Loading state: a `Loader2` spinner while the request is in flight.
- Free accounts see a `Crown` icon with the tooltip "AI features require Pro subscription", matching
  how the other AI buttons gate.
- Errors (Pro gate, rate limit, AI service failure) surface as toasts.
- Unit tests for the Server Action and the prompt/parse helpers.

## Notes

- **Nothing is persisted.** The explanation is regenerated on every click; no schema change, no
  migration, no new column.
- `isPro` has to reach the code editor — thread it from the drawer down as a prop, the way the
  existing AI buttons receive it.
- Two AI features already shipped (`suggestTags`, `suggestDescription`), so the shape to follow is
  settled: `lib/ai-*.ts` for the prompt, `actions/ai.ts` for the gated action, `types/ai.ts` for the
  result type, a dedicated `LIMITS` entry keyed by user. Rate limiting **fails open** here by
  design — see the comment in `rate-limit.ts`.
- Model is `AI_MODEL` from `src/lib/openai.ts` (`gpt-5-nano`), not a hard-coded string.
- `docs/ai-integration-plan.md` holds the wider architectural context.
- Spec loaded as-is: every path it names (`src/actions/ai.ts`, `src/components/items/CodeEditor.tsx`,
  `ItemDrawer.tsx`, `docs/ai-integration-plan.md`) exists in this repo, so no path translation was
  needed and `project-sync` was skipped at your instruction.

## History

Moved to `context/feature-history.md`, which is **not** `@`-imported — this file is loaded into
every session and the history is not needed in most of them. `/feature complete` appends there.
