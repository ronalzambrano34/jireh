export function normalizarNumeroTarjeta(value?: string | null) {
  return (value ?? '').replace(/\D/g, '');
}

export function formatearNumeroTarjeta(value?: string | null, separator = '-') {
  const digits = normalizarNumeroTarjeta(value);
  return digits.replace(/(.{4})/g, `$1${separator}`).replace(new RegExp(`\\${separator}$`), '');
}
