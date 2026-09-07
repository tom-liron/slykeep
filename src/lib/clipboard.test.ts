import { afterEach, describe, expect, it, vi } from "vitest";

import { writeClipboardText } from "./clipboard";

/**
 * Which clipboard API a copy goes through, which is the whole of this module's logic.
 *
 * The choice is not cosmetic: `writeText` is implemented everywhere, while a `ClipboardItem` built
 * around a pending promise is not, and reaching for the second where the first would do is what
 * stopped the drawer's Copy control working on a phone.
 */

/**
 * A stand-in `navigator.clipboard`, recording which of the two methods was reached.
 *
 * `ClipboardItem` is stubbed alongside it because Node has no such global, and the branch under
 * test is guarded by its presence — without it every case would fall through to `writeText` and
 * the test would pass for the wrong reason.
 */
function stubClipboard({ hasClipboardItem = true } = {}) {
    const clipboard = {
        writeText: vi.fn(async () => {}),
        write: vi.fn(async () => {}),
    };

    vi.stubGlobal("navigator", { clipboard });
    vi.stubGlobal("ClipboardItem", hasClipboardItem ? class {} : undefined);

    return clipboard;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("writeClipboardText", () => {
    it("uses writeText for text the caller already holds", async () => {
        const clipboard = stubClipboard();

        await writeClipboardText("const x = 1;");

        expect(clipboard.writeText).toHaveBeenCalledWith("const x = 1;");
        expect(clipboard.write).not.toHaveBeenCalled();
    });

    it("uses a ClipboardItem for text still in flight, so the gesture survives the fetch", async () => {
        const clipboard = stubClipboard();

        await writeClipboardText(Promise.resolve("fetched"));

        expect(clipboard.write).toHaveBeenCalledOnce();
        expect(clipboard.writeText).not.toHaveBeenCalled();
    });

    it("falls back to writeText when the engine refuses a promise-valued ClipboardItem", async () => {
        const clipboard = stubClipboard();
        clipboard.write.mockRejectedValueOnce(new Error("not implemented"));

        await writeClipboardText(Promise.resolve("fetched"));

        expect(clipboard.write).toHaveBeenCalledOnce();
        expect(clipboard.writeText).toHaveBeenCalledWith("fetched");
    });

    it("propagates a refused write, so the caller can report it", async () => {
        const clipboard = stubClipboard();
        clipboard.writeText.mockRejectedValueOnce(new Error("NotAllowedError"));

        await expect(writeClipboardText("plain")).rejects.toThrow("NotAllowedError");
    });

    it("uses writeText where ClipboardItem does not exist at all", async () => {
        const clipboard = stubClipboard({ hasClipboardItem: false });

        await writeClipboardText(Promise.resolve("fetched"));

        expect(clipboard.writeText).toHaveBeenCalledWith("fetched");
        expect(clipboard.write).not.toHaveBeenCalled();
    });
});
