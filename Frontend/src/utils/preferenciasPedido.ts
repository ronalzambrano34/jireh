import { normalizarMoneda } from './monedas';
import { separarTelefono } from './telefonos';

const MONEDA_PEDIDO_KEY = 'jireh.moneda-pedido';

function monedaPedidoOperadorKey(operadorId?: number | null) {
  return operadorId ? `${MONEDA_PEDIDO_KEY}.${operadorId}` : MONEDA_PEDIDO_KEY;
}

export function codigoPaisPorMoneda(moneda?: string | null) {
  const normalizada = normalizarMoneda(moneda);
  if (normalizada === 'UYU') return '+598';
  if (normalizada === 'USD') return '+1';
  if (normalizada === 'EUR') return '+34';
  return '+55';
}

export function leerMonedaPedidoPreferida(fallback = 'BRL', operadorId?: number | null) {
  if (typeof window === 'undefined') return normalizarMoneda(fallback) || 'BRL';

  try {
    const monedaOperador = operadorId ? window.localStorage.getItem(monedaPedidoOperadorKey(operadorId)) : null;
    return normalizarMoneda(monedaOperador ?? window.localStorage.getItem(MONEDA_PEDIDO_KEY)) || normalizarMoneda(fallback) || 'BRL';
  } catch {
    return normalizarMoneda(fallback) || 'BRL';
  }
}

export function guardarMonedaPedidoPreferida(moneda?: string | null, operadorId?: number | null) {
  const normalizada = normalizarMoneda(moneda);
  if (!normalizada || typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(MONEDA_PEDIDO_KEY, normalizada);
    if (operadorId) window.localStorage.setItem(monedaPedidoOperadorKey(operadorId), normalizada);
  } catch {
    return;
  }
}

export function telefonoClienteConMoneda(telefono: string, moneda?: string | null) {
  const code = codigoPaisPorMoneda(moneda);
  const { local } = separarTelefono(telefono, code);
  return local ? `${code}${local}` : code;
}
