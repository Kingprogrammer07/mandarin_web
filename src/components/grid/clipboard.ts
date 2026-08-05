/**
 * Copy to clipboard with a fallback, and an honest failure.
 *
 * `navigator.clipboard.writeText` is not always available even when it looks
 * like it is: measured in the embedded preview browser, `permissions.query`
 * reported "granted" while `writeText` threw `NotAllowedError: Write permission
 * denied`. Older Chrome builds on a counter PC and any non-secure origin fail
 * the same way.
 *
 * The first implementation swallowed that in a `.catch(() => {})`, so Ctrl+C
 * silently did nothing while the UI still advertised it. Falling back to
 * `execCommand("copy")` covers the gap — it is deprecated but works from inside
 * a user gesture, which a keydown handler is — and the boolean lets the caller
 * tell the operator when even that failed rather than pretending it worked.
 */
export async function writeClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through: the async API is present but refused.
    }
  }

  try {
    const scratch = document.createElement("textarea");
    scratch.value = text;
    // Kept out of view without `display:none`, which would make it unselectable.
    scratch.setAttribute("readonly", "");
    scratch.style.position = "fixed";
    scratch.style.top = "-1000px";
    scratch.style.opacity = "0";
    document.body.appendChild(scratch);
    scratch.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(scratch);
    return ok;
  } catch {
    return false;
  }
}
