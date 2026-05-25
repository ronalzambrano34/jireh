import { useMemo, type ReactNode } from 'react';
import { PasteButton } from './PasteButton';

const COUNTRY_CODES = [
  { code: '+53', flag: '🇨🇺', label: 'Cuba' },
  { code: '+55', flag: '🇧🇷', label: 'Brasil' },
  { code: '+598', flag: '🇺🇾', label: 'Uruguay' },
  { code: '+1', flag: '🇺🇸', label: 'EE.UU.' },
  { code: '+34', flag: '🇪🇸', label: 'España' },
];

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  defaultCode?: string;
  required?: boolean;
  pasteTitle?: string;
  autoComplete?: string;
  actions?: ReactNode;
};

function splitPhone(value: string, defaultCode: string) {
  const clean = value.trim();
  const match = COUNTRY_CODES.find((item) => clean.startsWith(item.code));
  const selected = match?.code ?? defaultCode;
  const local = match ? clean.slice(match.code.length).trimStart() : clean.replace(/^\+/, '');
  return { selected, local };
}

function joinPhone(code: string, local: string) {
  const cleanLocal = local.trimStart();
  return cleanLocal ? `${code}${cleanLocal}` : code;
}

export function PhoneInput({ value, onChange, defaultCode = '+53', required = false, pasteTitle = 'Pegar telefono', autoComplete = 'tel', actions }: PhoneInputProps) {
  const { selected, local } = useMemo(() => splitPhone(value, defaultCode), [defaultCode, value]);

  return (
    <span className={actions ? "phone-input-row phone-input-row-with-actions" : "phone-input-row"}>
      <select className="phone-code-select" value={selected} onChange={(event) => onChange(joinPhone(event.target.value, local))} aria-label="Codigo de pais">
        {COUNTRY_CODES.map((item) => (
          <option key={item.code} value={item.code}>{item.flag} {item.code} - {item.label}</option>
        ))}
      </select>
      <input value={local} onChange={(event) => onChange(joinPhone(selected, event.target.value))} required={required} inputMode="tel" autoComplete={autoComplete} />
      <PasteButton onPaste={(pasted) => onChange(pasted.startsWith('+') ? pasted : joinPhone(selected, pasted))} title={pasteTitle} />
      {actions}
    </span>
  );
}
