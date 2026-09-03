import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";

/**
 * The remark/rehype plugin set every markdown surface renders with.
 *
 * `MarkdownEditor`, the file preview, and the AI explanation output all pass
 * {@link MARKDOWN_PLUGINS} to their renderer. One shared list rather than `remarkPlugins={[remarkGfm]}`
 * at each call site, because the option below is a correctness setting: a surface that omits it
 * renders some stored content wrong, silently, for any text that contains a tilde.
 */

/**
 * GitHub-flavoured markdown with single-tilde strikethrough disabled.
 *
 * @remarks
 * GFM accepts both `~~struck~~` and `~struck~`. A `~` with non-whitespace on both sides opens a
 * one-tilde strikethrough, so `HEAD~1 is the predecessor of HEAD~2` renders with its middle struck
 * out and the tildes gone — prose that says the opposite of what was written. `main~2`, `~/.config`
 * and `HEAD~~2` are the same shape, and this app stores exactly that: git revisions and home paths
 * in snippets, commands, and AI explanations of git commands. `~~double~~` still works, so nothing
 * meant as strikethrough is lost.
 */
export const MARKDOWN_PLUGINS: PluggableList = [[remarkGfm, { singleTilde: false }]];
