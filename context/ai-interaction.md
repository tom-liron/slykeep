# AI Interaction Guidelines

## Communication

- Be concise and direct
- Explain non-obvious decisions briefly
- Ask before large refactors or architectural changes
- Don't add features not in the project spec
- Never delete files without clarification

## Workflow

This is the common workflow that we will use for every single feature/fix:

1. **Document** - Document the feature in @context/current-feature.md.
2. **Branch** - Create new branch for feature, fix, etc
3. **Implement** - Implement the feature/fix that I create in @context/current-feature.md
4. **Test** - Run focused unit tests, verify in the browser *when the change warrants it* (see
   Browser Verification), then run `npm run lint` and `npm run build`
5. **Iterate** - Iterate and change things if needed
6. **Review** - Review AI-generated code periodically and on demand.
7. **Record** - Mark as completed in @context/current-feature.md and append to
   `context/feature-history.md` — *before* the commit, so it lands in it
8. **Commit** - Format the changed files (see Formatting), then commit — only after build passes and everything works
9. **Merge** - Merge to main
10. **Delete Branch** - Delete branch after merge
11. **Push** - Push `main` to origin, once, after everything above is committed.

Step 11 is part of the workflow, not a decision to raise: **don't ask whether to push — push.** It
was already the last step of `.claude/skills/feature/actions/complete.md`, but this list stopped at
"Delete Branch", and a workflow that ends one step short of the remote is how "shall I push?" became
a recurring question. The two lists now agree. Pushing is the only outward-facing step here, so it
stays last and stays single — everything lands in one push, never a stream of them.

Recording comes **before** committing for the same reason. It used to be step 10, after the merge,
which left the history entry and the `current-feature.md` reset stranded on main with nothing to
ride along with — so every single feature ended with a second `chore: reset current-feature.md`
commit that existed only because of the ordering. The summary describes work that is already
finished by then, so nothing was gained by waiting.

## Browser Verification

**Default: don't drive the browser. Report what you changed and let me look.** Playwright MCP is
expensive — every result stays in context for the rest of the session — and I have the app open. A
five-second glance from me costs nothing and costs you nothing. So the browser is **opt-in**: use it
when I ask for it, and otherwise finish with tests, lint, and build, and say plainly what is worth
eyeballing.

The narrow exception is **multi-step end-to-end territory** — a sequence a human clicks through
where the failure is invisible to unit tests *and* tedious for me to reproduce by hand:

- Auth flows: sign in, register, verification links, password reset
- A full CRUD round trip against the real UI: create, then edit, then delete
- A bug I have reported that you cannot reproduce any other way

Everything else is mine to check. In particular, **"it's visual" is not a reason to open a
browser** — a badge, a colour, a spacing tweak, a new component rendering at all: if a passing build
means the markup is there, I will see the rest myself faster than a screenshot round trip. This
exact case (a `PRO` badge on two sidebar rows) is what rewrote this section: it burned a navigate,
an evaluate, and a screenshot to confirm something I could see instantly.

Skip it entirely when the change is not observable in a browser — schema and migration work,
server-only query modules, Zod schemas, error paths, pure functions, copy in a file nobody renders
yet. A unit test and a passing build are the stronger evidence there, and are cheaper.

Two rules when it *is* warranted:

- **Ask a narrow question.** Prefer `browser_evaluate` returning the one value in question over
  `browser_snapshot`, which dumps the whole accessibility tree to answer something specific.
  Screenshots are for visual questions, not for checking that text rendered.
- **`/compact` once the answer is in hand.** MCP results persist for the rest of the session, so a
  snapshot that has already done its job keeps being re-sent on every later turn.

  Claude cannot run `/compact` — it is a CLI command you type, not a tool Claude can call. So the
  rule *for Claude* is to *say so*, in the same reply that reports the browser result: end with an
  explicit "run `/compact`" line. Phrased as "compact once done" this read like something Claude
  would handle, which is exactly how a whole session's browser output survived to the end of it.
  Repeat the reminder after each separate round of browser work, not once per session.

Do NOT commit without permission and until the build passes. If build fails, fix the issues first.

## Branching

We will create a new branch for every feature/fix. Name branches **feature/[feature]** or **fix/[fix]**. Ask to delete the branch once merged.

## Formatting

Run Prettier once per feature, just before committing, scoped to the files that changed — modified **and** new:

```bash
npx prettier --write $( { git diff --name-only --diff-filter=d HEAD; git ls-files --others --exclude-standard; } | tr '\n' ' ')
```

`git diff` alone lists only tracked files, so a feature's brand-new files would go unformatted; `git ls-files --others` is what picks them up.

Do not run `npm run format` (`prettier --write .`) as part of routine work. It rewrites the whole tree, so unrelated files can land in a focused commit, and its per-file output is wasted context. Reserve the full-tree run for when formatting has actually drifted repo-wide.

## Commits

- Ask before committing (don't auto-commit)
- Use conventional commit messages (feat:, fix:, chore:, etc.)
- Keep commits focused (one feature/fix per commit)
- Never put "Generated With Claude" in the commit messages

## When Stuck

- If something isn't working after 2-3 attempts, stop and explain the issue
- Don't keep trying random fixes
- Ask for clarification if requirements are unclear

## Code Changes

- Make minimal changes to accomplish the task
- Don't refactor unrelated code unless asked
- Don't add "nice to have" features
- Preserve existing patterns in the codebase

## Code Review

Review AI-generated code periodically, especially for:

- Security (auth checks, input validation)
- Performance (unnecessary re-renders, N+1 queries)
- Logic errors (edge cases)
- Patterns (matches existing codebase?)
