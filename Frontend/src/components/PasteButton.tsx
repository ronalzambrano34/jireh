import { ClipboardPaste, Check } from 'lucide-react';
import { useRef, useState, type MouseEvent } from 'react';

type PasteButtonProps = {
  onPaste: (value: string) => void;
  title?: string;
};

function readClipboardFromHiddenPaste() {
  return new Promise<string>((resolve) => {
    const textarea = document.createElement("textarea");
    let settled = false;

    function finish(value = "") {
      if (settled) return;
      settled = true;
      textarea.removeEventListener("paste", handlePaste);
      textarea.remove();
      resolve(value);
    }

    function handlePaste(event: ClipboardEvent) {
      event.preventDefault();
      finish(event.clipboardData?.getData("text") ?? textarea.value);
    }

    textarea.setAttribute("aria-hidden", "true");
    textarea.tabIndex = -1;
    textarea.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;";
    textarea.addEventListener("paste", handlePaste, { once: true });
    document.body.appendChild(textarea);
    textarea.focus();

    try {
      document.execCommand("paste");
    } catch {
    }

    window.setTimeout(() => finish(textarea.value), 80);
  });
}

export function PasteButton({ onPaste, title = 'Pegar' }: PasteButtonProps) {
  const [state, setState] = useState<'idle' | 'success' | 'error'>('idle');
  const resetTimer = useRef<number | null>(null);

  function mark(nextState: 'success' | 'error') {
    setState(nextState);
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setState('idle'), 1100);
  }

  async function handlePaste(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    let value = '';

    try {
      if (!window.isSecureContext || !navigator.clipboard?.readText) {
        throw new Error('Clipboard API no disponible');
      }
      value = await navigator.clipboard.readText();
    } catch {
      value = window.prompt('El navegador bloqueo el portapapeles automatico. Pega el dato aqui:') ?? '';
    }

    const cleanValue = value.trim();
    if (!cleanValue) {
      mark('error');
      return;
    }

    onPaste(cleanValue);
    navigator.vibrate?.(12);
    mark('success');
  }

  const isSuccess = state === 'success';
  const isError = state === 'error';
  const buttonClassName = ['icon-button field-action-button paste-button', isSuccess ? 'paste-button-done' : '', isError ? 'paste-button-error' : ''].filter(Boolean).join(' ');

  return (
    <button type="button" className={buttonClassName} onClick={handlePaste} title={isSuccess ? 'Pegado' : title} aria-label={isSuccess ? 'Pegado' : title}>
      {isSuccess ? <Check size={18} /> : <ClipboardPaste size={18} />}
    </button>
  );
}
