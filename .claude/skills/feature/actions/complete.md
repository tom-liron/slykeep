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
