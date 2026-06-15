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

export function nombreMoneda(moneda?: string | null) {
  const normalizada = (moneda || '').trim().toUpperCase();
  const nombres: Record<string, string> = {
    BRL: 'Real brasileño',
    UYU: 'Peso uruguayo',
    USD: 'Dolar estadounidense',
    EUR: 'Euro',
  };
  return nombres[normalizada] || normalizada;
}
