// OS-aware key labels. The keyboard handler already accepts both Meta and Ctrl;
// this only controls how shortcuts are *displayed*.
const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
const plat = typeof navigator !== "undefined" ? navigator.platform || "" : "";

export const isMac = /Mac|iPhone|iPad|iPod/.test(plat) || /Mac OS X/.test(ua);

/** Primary modifier: ⌘ on macOS, Ctrl elsewhere. */
export const MOD = isMac ? "⌘" : "Ctrl";
/** Secondary modifier: ⌥ on macOS, Alt elsewhere. */
export const ALT = isMac ? "⌥" : "Alt";
export const SHIFT = isMac ? "⇧" : "Shift";
export const ENTER = "↵";
export const BACKSPACE = isMac ? "⌫" : "Backspace";
