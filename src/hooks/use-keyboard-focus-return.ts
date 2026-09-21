"use client";

import { useRef } from "react";

/**
 * Whether a Radix overlay was last closed from the keyboard, for deciding where focus goes when
 * it closes.
 *
 * Returning focus to the control that opened an overlay is for keyboard users, who would otherwise
 * be dropped at the top of the page. After a tap or a click it only paints that control with
 * `focus-glow`, because Chrome treats the returned focus as `:focus-visible`. So the rule follows
 * the input, not the screen: a finger on a phone or a tablet and a mouse on a laptop all close
 * without returning focus; Enter, Escape or Space bring it back.
 *
 * Spread `contentProps` onto the overlay's `Content` and call `closedByKeyboard()` from its
 * `onCloseAutoFocus`. Nothing recorded counts as the keyboard, so a close with no input behind it
 * keeps Radix's default.
 */
export function useKeyboardFocusReturn() {
    const closedByPointer = useRef(false);

    const markPointer = () => {
        closedByPointer.current = true;
    };

    return {
        contentProps: {
            onPointerDown: markPointer,
            onPointerDownOutside: markPointer,
            onKeyDown: () => {
                closedByPointer.current = false;
            },
        },
        closedByKeyboard: () => {
            const keyboard = !closedByPointer.current;
            closedByPointer.current = false;
            return keyboard;
        },
    };
}
