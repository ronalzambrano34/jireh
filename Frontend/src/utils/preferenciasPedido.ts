import { normalizarMoneda } from './monedas';
import { separarTelefono } from './telefonos';

const MONEDA_PEDIDO_KEY = 'jireh.moneda-pedido';

export function codigoPaisPorMoneda(moneda?: string | null) {
  const normalizada = normalizarMoneda(moneda);
  if (normalizada === 'UYU') return '+598';
  if (normalizada === 'USD') return '+1';
  if (normalizada === 'EUR') return '+34';
  return '+55';
}

export function leerMonedaPedidoPreferida(fallback = 'BRL') {
  if (typeof window === 'undefined') return normalizarMoneda(fallback) || 'BRL';

  try {
    return normalizarMoneda(window.localStorage.getItem(MONEDA_PEDIDO_KEY)) || normalizarMoneda(fallback) || 'BRL';
  } catch {
    return normalizarMoneda(fallback) || 'BRL';
  }
}

export function guardarMonedaPedidoPreferida(moneda?: string | null) {
  const normalizada = normalizarMoneda(moneda);
  if (!normalizada || typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(MONEDA_PEDIDO_KEY, normalizada);
  } catch {
    return;
  }
}

export function telefonoClienteConMoneda(telefono: string, moneda?: string | null) {
  const code = codigoPaisPorMoneda(moneda);
  const { local } = separarTelefono(telefono, code);
  return local ? `${code}${local}` : code;
}
