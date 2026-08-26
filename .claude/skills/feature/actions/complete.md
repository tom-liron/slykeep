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
3. Stage all changes and commit with a descriptive message. Then record the commit's hash —
   `git rev-parse HEAD` — and keep it for step 8. The merge in step 4 moves `HEAD`, so after it
   there is no longer a reliable way to say "the feature's commit".
4. Switch to main and merge the feature branch (no push yet)
5. Delete the local feature branch
6. Push main to origin ONCE (single push with all changes)
7. If feature branch was previously pushed, delete it from origin
8. Display the files this feature changed, directly in the chat. **Invoke the `recap` skill for the
   table — do not build one from `git diff` here.**

   Invoke it with the commit's own range, using the hash recorded in step 3:

   ```
   recap <sha>~1..<sha>
   ```

   Print `✅ Feature Complete!` above what it returns, and take **only its files-changed table**.
   Skip its plain-words summary and its "how to check it" list — see the note below on why those do
   not belong in this action.

   Why the explicit range rather than a bare `recap`: by the time this step runs, `HEAD` is main's
   merge commit, so "the last commit" no longer means the feature. `<sha>~1..<sha>` names the
   feature's own commit whatever shape the merge took.

   Why the skill rather than two git commands written out here — each of these was a real defect in
   the version this replaced:

   - **It pins both ends of the comparison.** `git diff HEAD~1` — with no `..HEAD` — compares that
     commit against the **working tree**, not against the last commit. Any file left uncommitted in
     the folder is then reported as part of the feature. This repo regularly has unrelated files
     dirty, so the old table listed them every time.
   - **It uses `--numstat`, not `--stat`.** `--stat` is display output: it abbreviates long paths to
     `src/.../Thing.tsx` and its width follows the terminal, so a table built from it is wrong in
     ways that are hard to notice. `--numstat` is tab-separated and unabbreviated.
   - **It handles renames and binary files.** A rename is one row reading `old → new`, not a large
     delete plus a large add — and the number after `R` is a similarity percent, not a line count,
     which is an easy thing to print as though it were one. A binary file says `binary` rather than
     a fabricated `+0`. Neither was handled before.

   One job, written once. `recap` is a global skill, so the same table is correct everywhere rather
   than correct in one repo and approximate in the next.

The plain-words summary and the "what to look for in the browser" list are **not** here — they moved
to `/feature start`, which is where they can still be acted on. A list of things to check that
arrives after the branch has been merged, deleted and pushed is a list nobody can do anything with.
By the time this action runs, the checking is already done and this table is the receipt.