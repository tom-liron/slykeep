import { toast } from "sonner";

/**
 * Put text on the clipboard and report the outcome, for every copy control in the app.
 *
 * The toasts live here rather than at each call site because "copy" is one action with one pair of
 * outcomes, and the card's icon and the drawer's button are the same action reached two ways. Two
 * copies of the wording is how they start saying different things.
 *
 * `text` may be a promise, and that is the whole reason this is not a one-line `writeText` call —
 * see `writeClipboardText`.
 *
 * Returns whether the write succeeded, for callers that need to know; the toast is already handled.
 */
export async function copyToClipboard(text: string | Promise<string>): Promise<boolean> {
    try {
        await writeClipboardText(text);
        toast.success("Copied to clipboard");
        return true;
    } catch {
        // One message for both halves — a failed fetch and a refused clipboard are the same fact to
        // the person who clicked: it is not on the clipboard.
        toast.error("Could not copy to clipboard");
        return false;
    }
}

/**
 * The clipboard write itself, accepting text that has not arrived yet.
 *
 * Safari permits a clipboard write only while the gesture that triggered it is still active, and an
 * awaited `fetch` ends it — so `writeText(await response.text())` is refused there even though
 * Chrome allows it. `ClipboardItem` takes the *pending* promise for exactly this case: the write is
 * registered inside the gesture and settles when the text lands. That is what lets a copy control
 * fetch the body it is copying, which the item cards have to do because list queries never load one.
 *
 * `writeText` remains the fallback for anywhere `ClipboardItem` is missing, and is what a caller
 * passing a plain string effectively gets either way.
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
