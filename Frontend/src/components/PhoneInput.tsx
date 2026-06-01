import { useMemo, type ReactNode } from 'react';
import { PasteButton } from './PasteButton';
import { FloatingSelect } from './FloatingSelect';

const COUNTRY_CODES = [
  { code: '+53', flag: '🇨🇺', label: 'Cuba' },
  { code: '+55', flag: '🇧🇷', label: 'Brasil' },
  { code: '+598', flag: '🇺🇾', label: 'Uruguay' },
  { code: '+1', flag: '🇺🇸', label: 'EE.UU.' },
  { code: '+34', flag: '🇪🇸', label: 'España' },
];

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

function splitPhone(value: string, defaultCode: string, codeLocked: boolean) {
  const clean = value.trim();
  const match = COUNTRY_CODES.find((item) => clean.startsWith(item.code));
  const selected = codeLocked ? defaultCode : match?.code ?? defaultCode;
  const local = match ? clean.slice(match.code.length).trimStart() : clean.replace(/^\+/, '');
  return { selected, local };
}

function joinPhone(code: string, local: string) {
  const cleanLocal = local.trimStart();
  return cleanLocal ? `${code}${cleanLocal}` : code;
}

export function PhoneInput({ value, inputId, onChange, defaultCode = '+53', required = false, pasteTitle = 'Pegar telefono', autoComplete = 'tel', actions, codeLocked = false, showPaste = true }: PhoneInputProps) {
  const { selected, local } = useMemo(() => splitPhone(value, defaultCode, codeLocked), [codeLocked, defaultCode, value]);
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
        onChange={(next) => onChange(joinPhone(next, local))}
        disabled={codeLocked}
        ariaLabel="Codigo de pais"
        options={COUNTRY_CODES.map((item) => ({ value: item.code, label: item.code, description: item.label, icon: item.flag }))}
        align="left"
      />
      <input id={inputId} value={local} onChange={(event) => onChange(joinPhone(selected, event.target.value))} required={required} inputMode="tel" autoComplete={autoComplete} />
      {showPaste && <PasteButton onPaste={(pasted) => onChange(codeLocked ? joinPhone(selected, splitPhone(pasted, selected, true).local) : pasted.startsWith('+') ? pasted : joinPhone(selected, pasted))} title={pasteTitle} />}
      {actions}
    </span>
  );
}
