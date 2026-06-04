export async function copiarAlPortapapeles(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  if (!text || typeof window === 'undefined') return false;

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Sigue el fallback para navegadores que bloquean la API moderna.
    }
  }

  if (typeof document === 'undefined' || !document.body) return false;

  const textarea = document.createElement('textarea');
  const selection = document.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (range && selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}
