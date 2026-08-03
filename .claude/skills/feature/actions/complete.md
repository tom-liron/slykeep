# Complete Action

1. Stage all changes and commit with a descriptive message
2. Switch to main and merge the feature branch (no push yet)
3. Delete the local feature branch
4. Append the feature summary to the END of `context/feature-history.md` (not current-feature.md —
   the history lives in its own file so it stays out of every session's auto-loaded context).
   Keep it to a short readable paragraph, numbered one past the last entry.
5. Reset current-feature.md:
   - Change H1 back to `# Current Feature`
   - Clear Goals and Notes sections (keep placeholder comments)
   - Leave the `## History` pointer as-is
6. Commit the reset: `chore: reset current-feature.md after completing [feature]`
7. Push main to origin ONCE (single push with all changes)
8. If feature branch was previously pushed, delete it from origin