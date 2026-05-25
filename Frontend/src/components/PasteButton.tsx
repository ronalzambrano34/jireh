import { ClipboardPaste } from 'lucide-react';

type PasteButtonProps = {
  onPaste: (value: string) => void;
  title?: string;
};

export function PasteButton({ onPaste, title = 'Pegar' }: PasteButtonProps) {
  async function handlePaste() {
    try {
      const value = await navigator.clipboard.readText();
      if (value) onPaste(value.trim());
    } catch {
      // Clipboard permission can be denied by the browser; manual input remains available.
    }
  }

  return (
    <button type="button" className="icon-button field-action-button paste-button" onClick={handlePaste} title={title} aria-label={title}>
      <ClipboardPaste size={18} />
    </button>
  );
}
