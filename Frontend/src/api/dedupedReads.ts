import {
  type ApiRequestOptions,
  getMe,
  calcularOperacion,
  listarContactos,
  listarCuentasMetodoPago,
  listarExtraccionesCuenta,
  listarMetodosPago,
  listarOperadores,
  listarOperadoresActivos,
  listarPaquetesSaldo,
  listarProvinciasServicio,
  listarPuntosRecogida,
  listarSaldosCuenta,
  obtenerAssetBlob,
  obtenerEstadoConfiguracionInicial,
  obtenerPedido,
  obtenerReporte,
  obtenerTasasOperativas,
} from './client';

const inFlightReads = new Map<string, Promise<unknown>>();

function dedupeRead<T>(key: string, loader: (options?: ApiRequestOptions) => Promise<T>, options: ApiRequestOptions = {}) {
  if (options.signal) return loader(options);

  const existing = inFlightReads.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const request = loader(options).finally(() => {
    if (inFlightReads.get(key) === request) inFlightReads.delete(key);
  });
  inFlightReads.set(key, request);
  return request;
}

function objectKey(value: Record<string, unknown> | undefined) {
  return JSON.stringify(Object.entries(value ?? {}).filter(([, item]) => item !== undefined && item !== '').sort(([a], [b]) => a.localeCompare(b)));
}

export function getMeDedup(options: ApiRequestOptions = {}) {
  return dedupeRead('auth:me', getMe, options);
}

export function obtenerTasasOperativasDedup(options: ApiRequestOptions = {}) {
  return dedupeRead('tasas:operativas', obtenerTasasOperativas, options);
}

export function obtenerPedidoDedup(codigo: string, options: ApiRequestOptions = {}) {
  return dedupeRead(`pedido:${codigo}`, () => obtenerPedido(codigo, options), options);
}

export function obtenerAssetBlobDedup(path: string, options: ApiRequestOptions = {}) {
  return dedupeRead(`asset:${path}`, () => obtenerAssetBlob(path, options), options);
}

export function calcularOperacionDedup(payload: Parameters<typeof calcularOperacion>[0], options: ApiRequestOptions = {}) {
  return dedupeRead(`calculo:${objectKey(payload)}`, () => calcularOperacion(payload, options), options);
}

export function obtenerReporteDedup(params: Parameters<typeof obtenerReporte>[0] = {}, options: ApiRequestOptions = {}) {
  return dedupeRead(`reporte:${objectKey(params)}`, () => obtenerReporte(params, options), options);
}

export function listarSaldosCuentaDedup(params: Parameters<typeof listarSaldosCuenta>[0] = {}, options: ApiRequestOptions = {}) {
  return dedupeRead(`saldos-cuenta:${objectKey(params)}`, () => listarSaldosCuenta(params, options), options);
}

export function listarExtraccionesCuentaDedup(cuentaPagoId?: string, options: ApiRequestOptions = {}) {
  return dedupeRead(`extracciones-cuenta:${cuentaPagoId ?? ''}`, () => listarExtraccionesCuenta(cuentaPagoId, options), options);
}

export function obtenerEstadoConfiguracionInicialDedup(options: ApiRequestOptions = {}) {
  return dedupeRead('setup:estado', obtenerEstadoConfiguracionInicial, options);
}

export function listarMetodosPagoDedup(moneda?: string, incluirInactivos = false, options: ApiRequestOptions = {}) {
  return dedupeRead(`metodos-pago:${moneda ?? ''}:${incluirInactivos}`, () => listarMetodosPago(moneda, incluirInactivos, options), options);
}

export function listarPuntosRecogidaDedup(incluirInactivos = false, options: ApiRequestOptions = {}) {
  return dedupeRead(`puntos-recogida:${incluirInactivos}`, () => listarPuntosRecogida(incluirInactivos, options), options);
}

export function listarPaquetesSaldoDedup(monedaPago?: string, incluirInactivos = false, options: ApiRequestOptions = {}) {
  return dedupeRead(`paquetes-saldo:${monedaPago ?? ''}:${incluirInactivos}`, () => listarPaquetesSaldo(monedaPago, incluirInactivos, options), options);
}

export function listarProvinciasServicioDedup(incluirInactivas = true, options: ApiRequestOptions = {}) {
  return dedupeRead(`provincias-servicio:${incluirInactivas}`, () => listarProvinciasServicio(incluirInactivas, options), options);
}

export function listarOperadoresDedup(incluirInactivos = false, options: ApiRequestOptions = {}) {
  return dedupeRead(`operadores:${incluirInactivos}`, () => listarOperadores(incluirInactivos, options), options);
}

export function listarOperadoresActivosDedup(options: ApiRequestOptions = {}) {
  return dedupeRead('operadores:activos', listarOperadoresActivos, options);
}

export function listarContactosDedup(clienteId?: string, incluirInactivos = false, options: ApiRequestOptions = {}) {
  return dedupeRead(`contactos:${clienteId ?? ''}:${incluirInactivos}`, () => listarContactos(clienteId, incluirInactivos, options), options);
}

export function listarCuentasMetodoPagoDedup(metodoId: number, incluirInactivas = true, options: ApiRequestOptions = {}) {
  return dedupeRead(`cuentas-metodo:${metodoId}:${incluirInactivas}`, () => listarCuentasMetodoPago(metodoId, incluirInactivas, options), options);
}
