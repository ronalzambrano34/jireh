import { useEffect } from 'react';

export type NuevoPedidoServicio = 'transferencia' | 'efectivo' | 'saldo' | 'divisa' | 'otros';

export type NuevoPedidoDraft = {
  [key: string]: string | undefined;
  monto_pago?: string;
  moneda_pago?: string;
  monto_divisa?: string;
  tipo_pago_id?: string;
  cuenta_pago_id?: string;
  paquete_saldo_id?: string;
  punto_recogida_id?: string;
  tipo_tarjeta?: string;
  numero_tarjeta?: string;
  telefono_destinatario?: string;
  documento_identidad_url?: string;
  cliente_id?: string;
  nombre_cliente?: string;
  numero_telefono_cliente?: string;
  bonificacion_manual?: string;
  observaciones?: string;
  idempotency_key?: string;
};

export type BorradorNuevoPedidoGuardado = {
  version: 1;
  operadorId: number;
  servicio: NuevoPedidoServicio;
  updatedAt: string;
  data: NuevoPedidoDraft;
};

const BORRADOR_PEDIDO_PREFIX = 'jireh.nuevo-pedido.borrador';
const VALORES_SOLO_ARCHIVO = new Set(['Documento adjunto en evidencias']);
const CAMPOS_AUTOMATICOS = new Set([
  'moneda_pago',
  'punto_recogida_id',
  'paquete_saldo_id',
  'idempotency_key',
]);

export function crearIdempotencyKey(servicio: NuevoPedidoServicio, operadorId: number) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `pedido:${servicio}:${operadorId}:${random}`;
}

function storageDisponible() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function claveBorradorNuevoPedido(operadorId: number, servicio: NuevoPedidoServicio) {
  return `${BORRADOR_PEDIDO_PREFIX}:${operadorId}:${servicio}`;
}

export function normalizarBorradorNuevoPedido(draft?: NuevoPedidoDraft | null): NuevoPedidoDraft {
  const normalizado: NuevoPedidoDraft = {};
  if (!draft || typeof draft !== 'object') return normalizado;

  for (const [key, rawValue] of Object.entries(draft)) {
    if (typeof rawValue !== 'string') continue;
    if (!rawValue.trim()) continue;
    if (VALORES_SOLO_ARCHIVO.has(rawValue.trim())) continue;
    normalizado[key] = rawValue;
  }

  return normalizado;
}

export function mezclarBorradoresNuevoPedido(...drafts: Array<NuevoPedidoDraft | null | undefined>): NuevoPedidoDraft {
  return drafts.reduce<NuevoPedidoDraft>((merged, draft) => ({
    ...merged,
    ...normalizarBorradorNuevoPedido(draft),
  }), {});
}

function telefonoTieneDato(value: string) {
  return value.replace(/\D/g, '').length > 3;
}

function valorTieneContenidoDePedido(key: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (CAMPOS_AUTOMATICOS.has(key)) return false;
  if (key === 'tipo_tarjeta') return trimmed.toUpperCase() !== 'MLC';
  if (key === 'telefono_destinatario' || key === 'numero_telefono_cliente') return telefonoTieneDato(trimmed);
  return true;
}

export function borradorNuevoPedidoTieneContenido(draft?: NuevoPedidoDraft | null) {
  return Object.entries(normalizarBorradorNuevoPedido(draft))
    .some(([key, value]) => Boolean(value && valorTieneContenidoDePedido(key, value)));
}

export function leerBorradorNuevoPedido(operadorId: number, servicio: NuevoPedidoServicio): NuevoPedidoDraft | null {
  return leerBorradorNuevoPedidoGuardado(operadorId, servicio)?.data ?? null;
}

export function leerBorradorNuevoPedidoGuardado(operadorId: number, servicio: NuevoPedidoServicio): BorradorNuevoPedidoGuardado | null {
  if (!storageDisponible()) return null;

  try {
    const raw = window.localStorage.getItem(claveBorradorNuevoPedido(operadorId, servicio));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BorradorNuevoPedidoGuardado>;
    if (parsed.version !== 1 || parsed.operadorId !== operadorId || parsed.servicio !== servicio) return null;
    const data = normalizarBorradorNuevoPedido(parsed.data);
    if (!borradorNuevoPedidoTieneContenido(data)) return null;
    return {
      version: 1,
      operadorId,
      servicio,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      data,
    };
  } catch {
    return null;
  }
}

export function borrarBorradorNuevoPedido(operadorId: number, servicio: NuevoPedidoServicio) {
  if (!storageDisponible()) return;

  try {
    window.localStorage.removeItem(claveBorradorNuevoPedido(operadorId, servicio));
  } catch {
    return;
  }
}

export function guardarBorradorNuevoPedido(
  operadorId: number,
  servicio: NuevoPedidoServicio,
  draft: NuevoPedidoDraft,
) {
  const data = normalizarBorradorNuevoPedido(draft);
  const tieneContenido = borradorNuevoPedidoTieneContenido(data);
  if (!tieneContenido) {
    borrarBorradorNuevoPedido(operadorId, servicio);
    return false;
  }

  if (!storageDisponible()) return false;

  const payload: BorradorNuevoPedidoGuardado = {
    version: 1,
    operadorId,
    servicio,
    updatedAt: new Date().toISOString(),
    data,
  };

  try {
    window.localStorage.setItem(claveBorradorNuevoPedido(operadorId, servicio), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function useAutosaveBorradorNuevoPedido(
  operadorId: number,
  servicio: NuevoPedidoServicio,
  draft: NuevoPedidoDraft,
  onSavedChange?: (saved: boolean) => void,
) {
  useEffect(() => {
    onSavedChange?.(guardarBorradorNuevoPedido(operadorId, servicio, draft));
  }, [draft, onSavedChange, operadorId, servicio]);
}
