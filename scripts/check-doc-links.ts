import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

/**
 * Checks that every `{@link}` in the source documentation is a link the reader can actually follow.
 * `npm run docs:links`.
 *
 * `coding-standards.md` § Cross-references allows `{@link Symbol}` only where the editor resolves
 * it — the symbol is imported into the file, or declared in it. Anywhere else the syntax silently
 * degrades to plain text, which is worse than prose: it promises navigation that is not there.
 * Nothing in `tsc`, ESLint or the build reports that, which is why this exists.
 *
 * The test is the one the reader performs: for each link, ask the TypeScript language service for a
 * definition at that position in the comment, which is what go-to-definition does on a cmd-click.
 *
 * Run over `src/` by default, or over the paths given as arguments.
 */

const SCAN_ROOT = "src";
const LINK_PATTERN = /\{@link\s+([^}|]+)(\|[^}]*)?\}/g;

/** Source files the documentation standard applies to: `src/` less its tests and build output. */
function collectSourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
            // Prisma Client is generated on every install and carries its own comments.
            return entry === "generated" ? [] : collectSourceFiles(path);
        }
        if (!/\.tsx?$/.test(path) || /\.test\.tsx?$/.test(path)) return [];
        return [path];
    });
}

/**
 * Builds a language service over the project, which is what can answer "does this position in a
 * comment go anywhere" — the compiler API alone reports resolution only for a symbol's own hover.
 */
function createService(fileNames: string[], options: ts.CompilerOptions): ts.LanguageService {
    return ts.createLanguageService({
        getScriptFileNames: () => fileNames,
        getScriptVersion: () => "1",
        getScriptSnapshot: (name) => {
            const text = ts.sys.readFile(name);
            return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
        },
        getCurrentDirectory: () => process.cwd(),
        getCompilationSettings: () => options,
        getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        readDirectory: ts.sys.readDirectory,
        directoryExists: ts.sys.directoryExists,
        getDirectories: ts.sys.getDirectories,
    });
}

/**
 * Reports the links in one file that lead nowhere.
 *
 * @returns One entry per dead link, with the line it sits on.
 */
function deadLinks(file: string, service: ts.LanguageService): { link: string; line: number }[] {
    const text = ts.sys.readFile(file);
    if (text === undefined) return [];

    const dead: { link: string; line: number }[] = [];

    for (const match of text.matchAll(LINK_PATTERN)) {
        const target = match[1].trim();

        // A link may be qualified (`Type.member`) or carry a namespace; go-to-definition is asked
        // about the final identifier, which is the part the editor resolves.
        const identifier = target.split(/[.#]/).filter(Boolean).pop();
        if (!identifier) continue;

        const position = text.indexOf(identifier, match.index);
        if (position < 0) continue;

        const definitions = service.getDefinitionAtPosition(file, position + 1);
        if (!definitions?.length) {
            dead.push({ link: target, line: text.slice(0, match.index).split("\n").length });
        }
    }

    return dead;
}

function main() {
    const requested = process.argv.slice(2);
    const files = requested.length > 0 ? requested : collectSourceFiles(SCAN_ROOT);

    const configPath = ts.findConfigFile(".", ts.sys.fileExists, "tsconfig.json");
    if (!configPath) throw new Error("tsconfig.json not found.");
    const config = ts.readConfigFile(configPath, ts.sys.readFile).config;
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, ".");

    const service = createService(parsed.fileNames, parsed.options);

    let total = 0;
    for (const file of files) {
        for (const { link, line } of deadLinks(file, service)) {
            total++;
            console.error(
                `${file}:${line} — {@link ${link}} resolves to nothing. ` +
                    `The symbol is not imported here; name it and its module in prose instead.`,
            );
        }
    }

    if (total > 0) {
        console.error(`\n${total} dead link(s) across ${files.length} file(s).`);
        process.exit(1);
    }

    console.log(`Every {@link} resolves, across ${files.length} file(s).`);
}

main();
