# Current Feature: Code Documentation Overhaul — Part 5 (the re-sweep)

## Status

In Progress

## Goals

Re-read every file Parts 1a–3 touched and bring its documentation up to a professional bar. The
trigger was one file (`ItemDrawerToolbar.tsx`) whose comments were checked and found to be
preserving the *investigation* behind the code rather than the code's current constraints. The same
weakness is expected, more quietly, across the rest of Parts 1a–3.

**Governing principle: understand broadly, document selectively.** The target is not "capture
everything we know" — it is the minimum documentation that gives a new developer the correct mental
model and preserves the constraints they could realistically break. Prefer 5 excellent lines over
40 historically accurate ones.

Distinguish, for every comment:

- **Knowledge required to understand or safely modify the current code** — this belongs in source.
- **Knowledge about how we arrived at the current code** — this does not.

The test for each sentence:

> If a developer had never seen an earlier version of this code, would they need this sentence to
> understand or safely change the version that exists now?

If no, remove it. Concretely, delete:

- what used to be implemented;
- what was tried first; rejected alternatives;
- debugging investigations;
- screenshot measurements;
- visual symptoms that prompted a fix;
- stale-build / stale-CSS diagnoses;
- "for several revisions"; "used to";
- exact measurements whose only purpose was proving an old diagnosis;
- explanations of code that no longer exists.

**Do not delete the actual constraint discovered by that investigation.** Compress the
investigation into the rule that survives — e.g. a paragraph of flex experiments becomes
"Narrow drawers use equal-width grid columns so every action stays evenly distributed and
reachable"; a 320px arithmetic investigation becomes "Keep the 2px narrow-layout gap; it preserves
the minimum touch-target width when all six actions are visible on the narrowest layout". If no
current constraint survives the deletion, it is replaced by nothing.

**Module headers get the same test.** A header states what the module is, what it renders or does,
and how it connects to its consumers (who owns the state and handlers it receives, when it is shown
or omitted). It does not explain that the file used to be part of another file, why it was
extracted, or what the old structure made difficult.

No runtime behavior changes — comments only. The suite stays green as proof.

## Notes

- Branch: `feature/code-docs-resweep`. Folder by folder, one commit each, same batches Parts 1a–3
  used — roughly ten commits. Scope: `config/`, `types/`, `hooks/`, `server/`, `actions/`,
  `auth.ts` / `auth.config.ts` / `proxy.ts`, `lib/`, `app/api`, `app/` pages, all of `components/`.
- Reading pass. The three checkers (`docs:comments-only`, `docs:links`,
  `npm test` / `lint` / `build`) gate every commit but cannot see the defect being fixed — every
  header and inline comment in the folder is read by hand against the test above.
- `feature-history.md` is the home for deleted rationale. Before deleting a substantial block,
  confirm its content is findable there; if not, quote it in the commit body (Decision 6 salvage
  step). No new file.
- Runs before Part 4 (the non-`src/` files).
- Full spec: `context/features/code-docs-overhaul-spec.md` (§ Part 5 — the re-sweep).

## History

Completed features are logged in `context/feature-history.md`.
