/**
 * Copies text to the clipboard and says whether it worked.
 *
 * `navigator.clipboard` only exists on secure pages (HTTPS or localhost). A deployment reached by a plain
 * `http://` address has no such API at all, so copying falls back to selecting a hidden field and running the
 * browser's own copy command, which works everywhere.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window !== 'undefined' && window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission refused or the page is not focused: try the older way before giving up.
    }
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selection = document.getSelection();
  const saved = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  // Inside a dialog the field must live in the dialog: its focus trap would otherwise pull the focus back out.
  const host = previous?.closest<HTMLElement>('[role="dialog"]') ?? document.body;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.tabIndex = -1;
  field.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:none';
  host.appendChild(field);
  let ok = false;
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    host.removeChild(field);
    if (saved && selection) {
      selection.removeAllRanges();
      selection.addRange(saved);
    }
    previous?.focus({ preventScroll: true });
  }
  return ok;
}
