export function normalizarMoneda(moneda?: string | null) {
  return (moneda || '').trim().toUpperCase();
}

export function monedasDisponibles(monedas: Array<string | null | undefined>) {
  return [...new Set(monedas.map(normalizarMoneda).filter(Boolean))];
}

export function banderaMoneda(moneda?: string | null) {
  const normalizada = normalizarMoneda(moneda);
  const banderas: Record<string, string> = {
    BRL: '🇧🇷',
    UYU: '🇺🇾',
    USD: '🇺🇸',
    EUR: '🇪🇺',
  };
  return banderas[normalizada] || '💱';
}

export function nombreMoneda(moneda?: string | null) {
  const normalizada = normalizarMoneda(moneda);
  const nombres: Record<string, string> = {
    BRL: 'Real brasileño',
    UYU: 'Peso uruguayo',
    USD: 'Dolar estadounidense',
    EUR: 'Euro',
  };
  return nombres[normalizada] || normalizada;
}
