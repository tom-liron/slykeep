import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { describe, expect, it } from "vitest";

import { MARKDOWN_PLUGINS } from "./markdown-plugins";

/**
 * Rendered rather than asserted on the option object, deliberately. The property under test is what
 * the reader sees, and `{ singleTilde: false }` only means that by way of a parser this test does
 * not own — an upstream default flipping, or the option being renamed, would keep an assertion on
 * the object green while the text on screen went back to being wrong.
 */
const render = (markdown: string) =>
    renderToStaticMarkup(
        createElement(ReactMarkdown, { remarkPlugins: MARKDOWN_PLUGINS }, markdown),
    );

describe("single-tilde strikethrough", () => {
    it("leaves two git revisions in one sentence alone", () => {
        // The exact case that found this: the middle of the sentence was struck out and both tildes
        // vanished, so the prose read as deleted text nobody deleted.
        const html = render(
            "git reset --soft HEAD~1 moves the branch tip back. HEAD~1 is the predecessor.",
        );

        expect(html).not.toContain("<del>");
        expect(html).toContain("HEAD~1 moves the branch tip back. HEAD~1 is the predecessor.");
    });

    it("leaves two home-directory paths in one sentence alone", () => {
        const html = render("Config is in ~/.config/app and the log is in ~/tmp/app.log.");

        expect(html).not.toContain("<del>");
        expect(html).toContain("~/.config/app");
        expect(html).toContain("~/tmp/app.log");
    });

    it("still renders strikethrough that was actually asked for", () => {
        // The double-tilde form is the one people type on purpose, and it keeps working — this is a
        // narrowing of GFM, not a removal of the feature.
        expect(render("This is ~~wrong~~ right.")).toContain("<del>wrong</del>");
    });

    it("still renders the rest of GFM", () => {
        expect(render("- [x] done")).toContain('type="checkbox"');
        expect(render("| a |\n| - |\n| 1 |")).toContain("<table>");
    });
});
