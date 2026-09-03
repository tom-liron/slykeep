import { toast } from "sonner";

/**
 * The clipboard write behind every copy control, with its success and failure toasts.
 *
 * `CopyItemButton` and the drawer toolbar both call {@link copyToClipboard}: one action reached two
 * ways, so the wording lives here rather than at each call site. The text may still be in flight —
 * item cards copy a body that list queries never load — so {@link writeClipboardText} accepts a
 * promise.
 */

/**
 * Writes text to the clipboard and shows the outcome toast.
 *
 * Resolves `text` (which may be a promise), writes it, and reports success or failure through
 * sonner. Returns whether the write succeeded, for a caller that needs to branch; the toast is
 * already shown.
 */
export async function copyToClipboard(text: string | Promise<string>): Promise<boolean> {
    try {
        await writeClipboardText(text);
        toast.success("Copied to clipboard");
        return true;
    } catch {
        // A failed fetch and a refused clipboard are one fact to the person who clicked: the text is
        // not on the clipboard. One message covers both.
        toast.error("Could not copy to clipboard");
        return false;
    }
}

/**
 * The clipboard write itself, accepting text that has not resolved yet.
 *
 * @remarks
 * Safari allows a clipboard write only while the triggering user gesture is still on the stack, and
 * an awaited `fetch` ends it — so `writeText(await response.text())` is refused there though Chrome
 * allows it. Passing the pending promise to `ClipboardItem` registers the write inside the gesture
 * and lets it settle when the text arrives, which is what lets a copy control fetch the body it is
 * copying. `writeText` is the fallback where `ClipboardItem` is absent, and is effectively what a
 * caller passing a plain string gets either way.
 */
async function writeClipboardText(text: string | Promise<string>): Promise<void> {
    if (typeof ClipboardItem === "function") {
        const blob = Promise.resolve(text).then(
            (value) => new Blob([value], { type: "text/plain" }),
        );

        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
        return;
    }

    await navigator.clipboard.writeText(await text);
}
