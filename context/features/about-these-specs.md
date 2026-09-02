# About `context/features/`

Every `.md` file in this folder is a **record**, not a description of the current code.

Each one is the spec for a single feature, written *before* that feature was built and not revised
afterwards. They are kept for their reasoning — what the options were, what was rejected, and why —
which is the part the code itself cannot carry. Nothing checks them against `src/`, and where a spec
disagrees with the code, the code wins.

This one note exists so that the 35 specs do not each need their own "not maintained" header.

`context/current-feature.md` is the exception, and it is deliberately **not** in this folder: it is
the live working file for whatever is being built right now.

## If you wanted something current

| Question | File |
|---|---|
| What does the product do, and what is still undecided? | `context/project-overview.md` |
| What shipped, in what order? | `context/feature-history.md` |
| What is being built right now? | `context/current-feature.md` |
| How is this code written? | `context/coding-standards.md` |
