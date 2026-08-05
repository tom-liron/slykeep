import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownEditor } from "./MarkdownEditor";

/**
 * Rendered rather than asserted on props, because "does the markdown become markup" is the whole
 * job of this component and the only part of it that can silently stop working — a missing
 * `remark-gfm` still compiles, still type-checks, and just quietly stops making tables.
 *
 * Read-only, so the Preview panel is the one that mounts; the Write half is a textarea and has
 * nothing to verify.
 */
const render = (markdown: string) =>
    renderToStaticMarkup(<MarkdownEditor value={markdown} readOnly label="Content" />);

describe("MarkdownEditor preview", () => {
    it("renders CommonMark block and inline elements", () => {
        const html = render(
            ["# Title", "", "Some **bold** text with `code`.", "", "- one", "- two"].join("\n"),
        );

        expect(html).toContain("<h1>Title</h1>");
        expect(html).toContain("<strong>bold</strong>");
        expect(html).toContain("<code>code</code>");
        expect(html).toContain("<ul>");
        expect(html).toContain("<li>one</li>");
    });

    it("renders fenced code blocks and blockquotes", () => {
        const html = render(["```ts", "const x = 1;", "```", "", "> quoted"].join("\n"));

        expect(html).toContain("<pre>");
        expect(html).toContain("const x = 1;");
        expect(html).toContain("<blockquote>");
    });

    it("keeps the fence's declared language on the element", () => {
        // Nothing consumes this today — code blocks render monochrome on purpose. It is the hook a
        // highlighter would attach to, so losing it would be a silent regression.
        expect(render(["```ts", "const x = 1;", "```"].join("\n"))).toContain("language-ts");
    });

    it("renders links with their href", () => {
        expect(render("[docs](https://example.com)")).toContain('<a href="https://example.com">');
    });

    // The four below are GFM, not CommonMark: each one fails if `remark-gfm` is ever dropped.
    it("renders GFM tables", () => {
        const html = render(["| a | b |", "| - | - |", "| 1 | 2 |"].join("\n"));

        expect(html).toContain("<table>");
        expect(html).toContain("<th>a</th>");
        expect(html).toContain("<td>1</td>");
    });

    it("renders GFM task lists as checkboxes", () => {
        const html = render(["- [x] done", "- [ ] todo"].join("\n"));

        expect(html).toContain('type="checkbox"');
        expect(html).toContain("checked");
    });

    it("renders GFM strikethrough", () => {
        expect(render("~~gone~~")).toContain("<del>gone</del>");
    });

    it("autolinks bare URLs", () => {
        expect(render("see https://example.com now")).toContain('<a href="https://example.com">');
    });

    it("escapes raw HTML rather than rendering it", () => {
        const html = render("<img src=x onerror=alert(1)>");

        expect(html).not.toContain("<img");
        expect(html).toContain("&lt;img");
    });

    it("shows a placeholder instead of an empty preview", () => {
        expect(render("   \n  ")).toContain("Nothing to preview.");
    });

    it("offers no Write tab when read-only", () => {
        const html = render("# Title");

        expect(html).toContain("Preview");
        expect(html).not.toContain("Write");
    });
});
