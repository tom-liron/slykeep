import { toast } from "sonner";

import { TOAST_IDS } from "@/lib/toast-ids";

/**
 * The clipboard write behind every copy control, with the toast for when it fails.
 *
 * `CopyItemButton` and the drawer toolbar both call {@link copyToClipboard}: one action reached two
 * ways, so the wording lives here rather than at each call site. The text may still be in flight —
 * item cards copy a body that list queries never load — so {@link writeClipboardText} accepts a
 * promise.
 *
 * A successful copy is confirmed on the button that was pressed rather than by a toast, which is
 * `useCopyAction` in `hooks/use-copy-action.ts`; both call sites go through that hook.
 */

/**
 * Writes text to the clipboard, reporting only failure.
 *
 * Resolves `text` (which may be a promise) and writes it. Returns whether the write succeeded, so
 * the calling control can show its own confirmation; a failure is already on screen as a toast by
 * the time this returns.
 */
export async function copyToClipboard(text: string | Promise<string>): Promise<boolean> {
    try {
        await writeClipboardText(text);
        return true;
    } catch {
        // A failed fetch and a refused clipboard are one fact to the person who clicked: the text is
        // not on the clipboard. One message covers both.
        toast.error("Could not copy to clipboard", { id: TOAST_IDS.copy });
        return false;
    }
}

/**
 * The clipboard write itself, accepting text that has not resolved yet.
 *
 * Picks the narrowest API the input allows: a string it already has goes through
 * {@link Clipboard.writeText}, and only text still in flight needs the promise-valued
 * `ClipboardItem`.
 *
 * @remarks
 * The two paths exist because Safari allows a clipboard write only while the triggering user
 * gesture is still on the stack, and an awaited `fetch` ends it — so `writeText(await
 * response.text())` is refused there though Chrome allows it. Handing `ClipboardItem` the pending
 * promise registers the write inside the gesture and lets it settle when the text arrives.
 *
 * That form is the less widely implemented of the two, so it is used only when it is the one thing
 * that would work, and a rejection still falls back to `writeText`. A caller that already holds the
 * text — the drawer's Copy control does — has none of this problem and must not pay for it.
 *
 * @throws When the clipboard is unavailable or the write is refused. {@link copyToClipboard} is
 * what turns that into a toast.
 *
 * Exported for its own unit test; call {@link copyToClipboard} instead.
 */
export async function writeClipboardText(text: string | Promise<string>): Promise<void> {
    if (typeof text === "string") {
        await navigator.clipboard.writeText(text);
        return;
    }

    if (typeof ClipboardItem === "function") {
        const blob = text.then((value) => new Blob([value], { type: "text/plain" }));

        try {
            await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
            return;
        } catch {
            // An engine that does not accept a promise as a `ClipboardItem` value. The retry below
            // has already lost the gesture on Safari and will be refused there too, but everywhere
            // else it is the difference between copying and not.
        }
    }

    await navigator.clipboard.writeText(await text);
}
