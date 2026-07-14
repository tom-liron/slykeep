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
4. **Test** - Run focused unit tests, verify it works in the browser, then run `npm run lint` and `npm run build`
5. **Iterate** - Iterate and change things if needed
6. **Commit** - Format the changed files (see Formatting), then commit — only after build passes and everything works
7. **Merge** - Merge to main
8. **Delete Branch** - Delete branch after merge
9. **Review** - Review AI-generated code periodically and on demand.
10. Mark as completed in @context/current-feature.md and add to history

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
