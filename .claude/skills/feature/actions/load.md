# Load Action

1. Check $ARGUMENTS (after "load"):
   - If it looks like a filename (single word, no spaces): Look for `context/features/{name}.md` OR `context/fixes/{name}.md`
   - If it's multiple words: Use as inline feature description, generate goals
   - If empty: Error - "load" requires a spec filename or feature description

2. If a spec file was found, sync it before reading it as a plan — run `/project-sync <that path>`,
   scoped to that one file. Specs are often written against the course's structure, and whatever is
   wrong there gets copied into current-feature.md and then into the implementation. Fix the paths,
   names, and commands; leave the feature's substance alone. Skip this for inline descriptions —
   there is no file to sync.

3. Update current-feature.md:
   - Update H1 heading to include feature name (e.g., `# Current Feature: Add Navbar`)
   - Write goals as bullet points under ## Goals
   - Write any additional notes/context under ## Notes
   - Set Status to "Not Started"

4. Confirm spec loaded and show the feature summary, noting any corrections step 2 made to the spec