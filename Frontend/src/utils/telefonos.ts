export function telefonoClienteCompleto(value?: string | null) {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 7;
}
