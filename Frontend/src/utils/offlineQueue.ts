import {
  actualizarEstado,
  crearDivisa,
  crearEfectivo,
  crearOtros,
  crearSaldo,
  crearTransferencia,
} from '../api/client';
import type {
  CrearDivisaPayload,
  CrearEfectivoPayload,
  CrearOtrosPayload,
  CrearSaldoPayload,
  CrearTransferenciaPayload,
} from '../types/api';
import type { NuevoPedidoServicio } from './borradoresPedido';

export type OfflineCreateOrderPayload = {
  transferencia: CrearTransferenciaPayload;
  efectivo: CrearEfectivoPayload;
  saldo: CrearSaldoPayload;
  divisa: CrearDivisaPayload;
  otros: CrearOtrosPayload;
};

export type OfflineQueueItem =
  | {
      id: string;
      version: 1;
      kind: 'create-order';
      servicio: NuevoPedidoServicio;
      operadorId: number;
      payload: OfflineCreateOrderPayload[NuevoPedidoServicio];
      signature: string;
      createdAt: string;
      attempts: number;
      lastError?: string;
    }
  | {
      id: string;
      version: 1;
      kind: 'update-order-state';
      codigoOperacion: string;
      estado: string;
      observaciones?: string;
      options?: { finalizar_sin_comprobante?: boolean; motivo_sin_comprobante?: string };
      signature: string;
      createdAt: string;
      attempts: number;
      lastError?: string;
    };

const OFFLINE_QUEUE_KEY = 'jireh.offline-queue.v1';
export const OFFLINE_QUEUE_EVENT = 'jireh:offline-queue-changed';
let syncing = false;

export function appEstaOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function storageDisponible() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function notifyOfflineQueueChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`).join(',')}}`;
}

function createQueueId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readQueue(): OfflineQueueItem[] {
  if (!storageDisponible()) return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is OfflineQueueItem => item?.version === 1 && typeof item.signature === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueueItem[]) {
  if (!storageDisponible()) return;
  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
  notifyOfflineQueueChanged();
}

export function listarOfflineQueue() {
  return readQueue();
}

export function offlineQueueCount() {
  return readQueue().length;
}

function enqueueItem(item: OfflineQueueItem) {
  const items = readQueue();
  const existing = items.find((current) => current.signature === item.signature);
  if (existing) return existing;
  writeQueue([...items, item]);
  return item;
}

export function enqueueOfflineCreateOrder<TServicio extends NuevoPedidoServicio>(
  servicio: TServicio,
  operadorId: number,
  payload: OfflineCreateOrderPayload[TServicio],
) {
  const signature = `create-order:${servicio}:${operadorId}:${stableStringify(payload)}`;
  return enqueueItem({
    id: createQueueId(),
    version: 1,
    kind: 'create-order',
    servicio,
    operadorId,
    payload,
    signature,
    createdAt: new Date().toISOString(),
    attempts: 0,
  } as OfflineQueueItem);
}

export function enqueueOfflineStateChange(
  codigoOperacion: string,
  estado: string,
  observaciones?: string,
  options?: { finalizar_sin_comprobante?: boolean; motivo_sin_comprobante?: string },
) {
  const signature = `update-order-state:${codigoOperacion}:${estado}:${stableStringify({ observaciones, options })}`;
  return enqueueItem({
    id: createQueueId(),
    version: 1,
    kind: 'update-order-state',
    codigoOperacion,
    estado,
    observaciones,
    options,
    signature,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

async function syncCreateOrder(item: Extract<OfflineQueueItem, { kind: 'create-order' }>) {
  if (item.servicio === 'transferencia') return crearTransferencia(item.payload as CrearTransferenciaPayload);
  if (item.servicio === 'efectivo') return crearEfectivo(item.payload as CrearEfectivoPayload);
  if (item.servicio === 'saldo') return crearSaldo(item.payload as CrearSaldoPayload);
  if (item.servicio === 'divisa') return crearDivisa(item.payload as CrearDivisaPayload);
  return crearOtros(item.payload as CrearOtrosPayload);
}

async function syncItem(item: OfflineQueueItem) {
  if (item.kind === 'create-order') {
    await syncCreateOrder(item);
    return;
  }
  await actualizarEstado(item.codigoOperacion, item.estado, item.observaciones, item.options);
}

export async function syncOfflineQueue() {
  if (syncing || appEstaOffline()) return { synced: 0, failed: 0, remaining: offlineQueueCount() };
  syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    let items = readQueue();
    for (const item of items) {
      if (appEstaOffline()) break;
      try {
        await syncItem(item);
        synced += 1;
        items = readQueue().filter((current) => current.id !== item.id);
        writeQueue(items);
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : 'No se pudo sincronizar la accion pendiente';
        items = readQueue().map((current) => current.id === item.id
          ? { ...current, attempts: current.attempts + 1, lastError: message }
          : current);
        writeQueue(items);
        break;
      }
    }
    return { synced, failed, remaining: offlineQueueCount() };
  } finally {
    syncing = false;
  }
}
