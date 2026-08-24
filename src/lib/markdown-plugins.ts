import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

/**
 * How stored text is parsed as markdown, everywhere it is rendered.
 *
 * One list rather than `remarkPlugins={[remarkGfm]}` written at each call site, because the option
 * below is a *correctness* setting and not a preference: a surface that forgets it renders some
 * content wrong, silently, and only for the content that happens to contain a tilde.
 */

/**
 * GitHub-flavoured markdown, with **single-tilde strikethrough turned off**.
 *
 * GFM accepts both `~~struck~~` and `~struck~`. The one-tilde form is the problem: a `~` with
 * non-whitespace on both sides can open a strikethrough, so any text mentioning two git revisions
 * has its middle silently deleted —
 *
 *     git reset --soft HEAD~1 moves the tip back. HEAD~1 is the predecessor.
 *
 * renders as `HEAD` + <del>1 moves the tip back. HEAD</del> + `1 is the predecessor`. The tildes
 * disappear, a strikethrough appears over a sentence nobody struck out, and the reader is looking
 * at prose that says the opposite of what was written. `main~2`, `~/.config`, and `HEAD~~2` are the
 * same shape.
 *
 * That collides squarely with what this app stores. Snippets and commands are where `~` is a
 * revision suffix or a home directory rather than punctuation, and the AI explanation of a git
 * command is nearly a worked example of it — which is how this was found.
 *
 * `~~double~~` still works, so nothing anyone *meant* as strikethrough is lost. The one-tilde form
 * is the one GitHub itself documents as an extension to CommonMark, and giving it up costs a
 * shorthand almost nobody types on purpose to stop mangling text people do type on purpose.
 */
export const MARKDOWN_PLUGINS: PluggableList = [[remarkGfm, { singleTilde: false }]];
