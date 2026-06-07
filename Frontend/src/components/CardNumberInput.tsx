import { PasteButton } from './PasteButton';
import { formatearNumeroTarjeta, normalizarNumeroTarjeta } from '../utils/tarjetas';

type CardNumberInputProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  pasteTitle?: string;
  placeholder?: string;
  showPaste?: boolean;
};

export function CardNumberInput({ value, onChange, required = false, pasteTitle = 'Pegar tarjeta', placeholder = '1234-5678-9012-3456', showPaste = true }: CardNumberInputProps) {
  return (
    <span className={showPaste ? 'input-action-row' : undefined}>
      <input
        value={formatearNumeroTarjeta(value)}
        onChange={(event) => onChange(normalizarNumeroTarjeta(event.target.value))}
        required={required}
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder={placeholder}
      />
      {showPaste && <PasteButton onPaste={(pasted) => onChange(normalizarNumeroTarjeta(pasted))} title={pasteTitle} />}
    </span>
  );
}
