export const COUNTRY_PHONE_CODES = [
  { code: '+53', flag: '🇨🇺', label: 'Cuba' },
  { code: '+55', flag: '🇧🇷', label: 'Brasil' },
  { code: '+598', flag: '🇺🇾', label: 'Uruguay' },
  { code: '+1', flag: '🇺🇸', label: 'EE.UU.' },
  { code: '+34', flag: '🇪🇸', label: 'España' },
];

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function codeDigits(code: string) {
  return digitsOnly(code);
}

function findCodeByDigits(digits: string) {
  return [...COUNTRY_PHONE_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => digits.startsWith(codeDigits(item.code)));
}

function stripRepeatedCode(digits: string, code: string) {
  const prefix = codeDigits(code);
  return digits.startsWith(prefix) ? digits.slice(prefix.length) : digits;
}

function normalizeLocalByCountry(code: string, local: string) {
  let next = local;

  if (code === '+55') {
    while (next.startsWith('0') && next.length > 10) {
      next = next.slice(1);
    }

    const ddd = next.slice(0, 2);
    const subscriber = next.slice(2);
    if (ddd.length === 2 && subscriber.length === 8 && /^[6-9]/.test(subscriber)) {
      next = `${ddd}9${subscriber}`;
    }
  }

  if (code === '+598' && next.startsWith('0')) {
    next = next.slice(1);
  }

  return next;
}

export function normalizarTelefono(value: string, defaultCode = '+55', codeLocked = false) {
  const compact = value.trim();
  const digits = digitsOnly(compact);
  const hasExplicitInternationalCode = compact.startsWith('+') || digits.startsWith('00');
  const digitsWithoutInternationalPrefix = digits.startsWith('00') ? digits.slice(2) : digits;
  const detected = !codeLocked ? findCodeByDigits(digitsWithoutInternationalPrefix) : undefined;
  const selected = codeLocked ? defaultCode : detected?.code ?? defaultCode;
  const shouldStripCode = hasExplicitInternationalCode || (!codeLocked && Boolean(detected));
  const localDigits = shouldStripCode
    ? stripRepeatedCode(digitsWithoutInternationalPrefix, selected)
    : digitsWithoutInternationalPrefix;
  const local = normalizeLocalByCountry(selected, localDigits);

  return local ? `${selected}${local}` : selected;
}

export function separarTelefono(value: string, defaultCode = '+55', codeLocked = false) {
  const compact = value.trim();
  if (!compact) return { selected: defaultCode, local: '' };

  const detected = !codeLocked ? findCodeByDigits(digitsOnly(compact).startsWith('00') ? digitsOnly(compact).slice(2) : digitsOnly(compact)) : undefined;
  const selectedForSplit = codeLocked ? defaultCode : detected?.code ?? defaultCode;
  const normalized = compact.startsWith('+') || detected || codeLocked ? compact : `${selectedForSplit}${compact}`;
  const match = COUNTRY_PHONE_CODES.find((item) => normalized.startsWith(item.code));
  const selected = codeLocked ? defaultCode : match?.code ?? defaultCode;
  const local = match ? normalized.slice(match.code.length) : normalized.replace(/^\+/, '');

  return { selected, local: digitsOnly(local) };
}

export function telefonoClienteCompleto(value?: string | null) {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 7;
}
