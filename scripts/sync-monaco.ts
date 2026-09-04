import { createRequire } from "node:module";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Copies the installed monaco build into `public/` so the editor is served from this origin.
 *
 * Runs from `predev` and `prebuild`, so both the dev server and a production build have it — npm
 * runs those automatically, and there is nothing to remember. `public/monaco/` is build output:
 * gitignored, never edited, rewritten whenever the installed version moves.
 *
 * Serving monaco from this origin, rather than a CDN, keeps a compromise of that CDN or of the
 * package it serves from ever running as third-party script inside an authenticated session — the
 * editor sits on the page where snippets are read and written.
 *
 * The editor's runtime and its option types come from the same installed `node_modules/monaco-editor`,
 * so the two cannot drift out of step; see `CodeEditor`'s loader for how it points there.
 */

const require = createRequire(import.meta.url);

/**
 * The package root, walked up from its entry point.
 *
 * `require.resolve("monaco-editor/package.json")` is the obvious way to find this and does not work:
 * monaco's `exports` map rewrites every subpath to `./esm/vs/*.js`, so the manifest is not reachable
 * by name. Its entry point is, and the root is the directory the entry point lives under.
 */
function packageRoot(): string {
    let directory = path.dirname(require.resolve("monaco-editor"));

    while (path.basename(directory) !== "monaco-editor") {
        const parent = path.dirname(directory);

        if (parent === directory) {
            throw new Error("Resolved monaco-editor to a path outside its own package directory.");
        }

        directory = parent;
    }

    return directory;
}

const ROOT = packageRoot();
const PACKAGE_JSON = path.join(ROOT, "package.json");
const SOURCE = path.join(ROOT, "min", "vs");
const DESTINATION = path.join(process.cwd(), "public", "monaco");
const VERSION_MARKER = path.join(DESTINATION, ".version");

/**
 * The copy is 24 MB, and `predev` runs on every dev server start. So it is skipped when the marker
 * already names the installed version — the only thing that can invalidate a copy of a pinned,
 * immutable package is the pin moving.
 */
async function isCurrent(version: string): Promise<boolean> {
    try {
        return (await readFile(VERSION_MARKER, "utf8")).trim() === version;
    } catch {
        return false;
    }
}

async function main() {
    const { version } = JSON.parse(await readFile(PACKAGE_JSON, "utf8")) as { version: string };

    if (await isCurrent(version)) {
        console.log(`monaco ${version} already in public/monaco`);
        return;
    }

    // Removed rather than copied over: a version bump can drop files, and a stale chunk left behind
    // is the kind of thing that only fails at runtime.
    await rm(DESTINATION, { recursive: true, force: true });
    await mkdir(DESTINATION, { recursive: true });
    await cp(SOURCE, path.join(DESTINATION, "vs"), { recursive: true });
    await writeFile(VERSION_MARKER, `${version}\n`);

    console.log(`copied monaco ${version} to public/monaco`);
}

main().catch((error) => {
    console.error("Could not copy the monaco build into public/monaco.");
    console.error(error);
    process.exit(1);
});
