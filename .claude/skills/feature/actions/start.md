# Start Action

This action ends where the manual testing begins. It does not commit, merge, or push — it stops at a
working, verified branch and hands over, so the browser check happens *before* anything is locked
down. `/feature complete` is a separate decision, made after that check.

1. Read current-feature.md - verify Goals are populated
2. If empty, error: "Run /feature load first"
3. Set Status to "In Progress"
4. Create and checkout the feature branch (derive name from H1 heading)
5. List the goals, then implement them one by one.

   **Most features need no new tests, and that is the expected outcome — not a corner cut.** Write
   one only where there is a rule that could be wrong in a way the compiler cannot catch: a
   comparator, a parser, an ownership `where`, a data transformation, an ordering key, a limit. Do
   not write one for a component that renders its props, a query with no logic in it, a config
   value, a rename, a copy change, or a style. A test that restates the implementation costs a file
   and catches nothing, and `coding-standards.md` asks for *focused* tests on non-trivial business
   rules and data transformations — not coverage for its own sake.

   When a test is warranted, write it beside the code rather than afterwards: written next to the
   implementation it shapes the implementation. `/feature test` is the repair for when that did not
   happen, not the stage that does it.

   If the feature warrants none, say so in one line and move on. Do not invent tests to fill the
   step.
6. Run the gate, in this order, and fix what fails before moving on:
   - `npm test` — runs whether or not this feature added tests; the suite has to stay green either
     way, and a rename that breaks an existing fixture is exactly what this catches
   - `npm run lint`
   - `npm run build`

   Do not report a feature as ready with a failing build. If something cannot be fixed in two or
   three attempts, stop and explain rather than trying more things.
7. List the files this feature touched, from `git status --short`. Paths only — no table and no line
   counts, which `/feature complete` prints once the commit exists. The point here is narrower: it is
   the last chance to notice a file that had no business being in this feature.
8. Summarize the feature in plain words. The file list says what moved; this says what the user will
   actually *see*, so they know what to click. Keep it short enough to act on without scrolling. It
   does not replace `/feature explain`, which is asked for on demand and goes deeper — this is the
   two-minute version that ships with every implementation.

   Three parts, in this order:

   - **One or two sentences on what the app does differently.** What it did before, what it does
     now. No file names, no type names, no rationale — the commit message and the history entry
     carry those later, and they are what makes this unreadable.
   - **A numbered "What to look for in the browser" list.** Each line is one thing to click and the
     result to expect, phrased as an instruction: "Star an old item. It should not move." Prefer the
     cases that would look *wrong* if the change had silently failed. Mark any line that is a
     deliberate behaviour change the user approved, so it is not mistaken for a bug on sight.
   - **Whether anything looks different on first load.** Say so explicitly when it does not — a
     migration that backfilled existing rows, a rule that only shows up on the next write, a path
     that needs a particular state to reach. Otherwise the first reaction to a working feature is
     that nothing happened.

   Skip the browser list when there is nothing to see — schema-only work, a server query, a pure
   function, a test. Say that plainly rather than inventing steps to pad it.
9. Stop. Do not commit and do not run `/feature complete` off your own bat: the browser check is the
   user's, and it is the reason this action ends here.
