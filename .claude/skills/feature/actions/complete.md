# Complete Action

Do the bookkeeping *before* the commit, so a feature is one commit and not two. Appending the
history entry and resetting `current-feature.md` after the merge is what used to force a second
`chore: reset current-feature.md` commit onto main every single time — there was nothing left for
those changes to ride along with. Nothing needs that order: the summary describes work that is
already finished by step 3.

1. Append the feature summary to the END of `context/feature-history.md` (not current-feature.md —
   the history lives in its own file so it stays out of every session's auto-loaded context).
   Keep it to a short readable paragraph, numbered one past the last entry.
2. Reset current-feature.md:
   - Change H1 back to `# Current Feature`
   - Clear Goals and Notes sections (keep placeholder comments)
   - Leave the `## History` pointer as-is
3. Stage all changes and commit with a descriptive message
4. Switch to main and merge the feature branch (no push yet)
5. Delete the local feature branch
6. Push main to origin ONCE (single push with all changes)
7. If feature branch was previously pushed, delete it from origin
8. Display files changed in this feature, directly in the chat:
   - Run: `git diff HEAD~1 --name-status` (shows A/M/D for each file)
   - Run: `git diff HEAD~1 --stat` (shows line changes per file)
   - Combine outputs into a markdown table formatted like:
     ```
     ✅ Feature Complete!
     
     📁 Files Changed:
     
     | File | Status | Changes |
     |------|--------|---------|
     | src/components/Header.tsx | M | +45 lines |
     | src/utils/newHelper.ts | A | +128 lines |
     | prisma/schema.prisma | M | +12 lines |
     | old-file.js | D | -50 lines |
     
     **Total:** 4 files changed, 185 insertions(+), 50 deletions(-)
     ```
   - Display this table in the chat so you see it immediately without opening terminal

The plain-words summary and the "what to look for in the browser" list are **not** here — they moved
to `/feature start`, which is where they can still be acted on. A list of things to check that
arrives after the branch has been merged, deleted and pushed is a list nobody can do anything with.
By the time this action runs, the checking is already done and this table is the receipt.