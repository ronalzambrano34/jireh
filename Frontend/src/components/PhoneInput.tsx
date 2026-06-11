import { useMemo, type ReactNode } from 'react';
import { PasteButton } from './PasteButton';
import { FloatingSelect } from './FloatingSelect';
import { COUNTRY_PHONE_CODES, normalizarTelefono, separarTelefono } from '../utils/telefonos';

type PhoneInputProps = {
  value: string;
  inputId?: string;
  onChange: (value: string) => void;
  defaultCode?: string;
  required?: boolean;
  pasteTitle?: string;
  autoComplete?: string;
  actions?: ReactNode;
  codeLocked?: boolean;
  showPaste?: boolean;
};

function joinPhone(code: string, local: string) {
  const digits = local.replace(/\D/g, '');
  return digits ? `${code}${digits}` : code;
}

export function PhoneInput({ value, inputId, onChange, defaultCode = '+53', required = false, pasteTitle = 'Pegar telefono', autoComplete = 'tel', actions, codeLocked = false, showPaste = true }: PhoneInputProps) {
  const { selected, local } = useMemo(() => separarTelefono(value, defaultCode, codeLocked), [codeLocked, defaultCode, value]);
  const updateLocal = (code: string, nextLocal: string) => {
    const joined = joinPhone(code, nextLocal);
    onChange(code === '+598' ? normalizarTelefono(joined, code, true) : joined);
  };
  const className = [
    'phone-input-row',
    actions ? 'phone-input-row-with-actions' : '',
    showPaste ? '' : 'phone-input-row-no-paste',
  ].filter(Boolean).join(' ');

  return (
    <span className={className}>
      <FloatingSelect
        className="phone-code-select-floating"
        value={selected}
        onChange={(next) => updateLocal(next, local)}
        disabled={codeLocked}
        ariaLabel="Codigo de pais"
        options={COUNTRY_PHONE_CODES.map((item) => ({ value: item.code, label: item.code, description: item.label, icon: item.flag }))}
        align="left"
      />
      <input id={inputId} value={local} onChange={(event) => updateLocal(selected, event.target.value)} required={required} inputMode="tel" autoComplete={autoComplete} />
      {showPaste && <PasteButton onPaste={(pasted) => onChange(normalizarTelefono(pasted, selected, codeLocked))} title={pasteTitle} />}
      {actions}
    </span>
  );
}
