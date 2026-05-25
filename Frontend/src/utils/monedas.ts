export function banderaMoneda(moneda?: string | null) {
  const normalizada = (moneda || '').trim().toUpperCase();
  const banderas: Record<string, string> = {
    BRL: '🇧🇷',
    UYU: '🇺🇾',
    USD: '🇺🇸',
    EUR: '🇪🇺',
  };
  return banderas[normalizada] || '💱';
}
