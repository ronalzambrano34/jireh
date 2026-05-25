import { ClipboardPaste } from 'lucide-react';

type PasteButtonProps = {
  onPaste: (value: string) => void;
  title?: string;
};

export function PasteButton({ onPaste, title = 'Pegar' }: PasteButtonProps) {
  async function handlePaste() {
    let value = '';

    try {
      if (!navigator.clipboard?.readText) {
        throw new Error('Clipboard API no disponible');
      }
      value = await navigator.clipboard.readText();
    } catch {
      value = window.prompt('Pega el dato aqui') ?? '';
    }

    const cleanValue = value.trim();
    if (cleanValue) onPaste(cleanValue);
  }

  return (
    <button type="button" className="icon-button field-action-button paste-button" onClick={handlePaste} title={title} aria-label={title}>
      <ClipboardPaste size={18} />
    </button>
  );
}
