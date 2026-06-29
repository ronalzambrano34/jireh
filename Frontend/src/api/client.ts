import type {
  AuthMeResponse,
  AuthResponse,
  CalculoOperacionResponse,
  Cliente,
  Configuracion,
  ConfiguracionInicialEstado,
  Contacto,
  CrearDivisaPayload,
  CrearEfectivoPayload,
  CrearSaldoPayload,
  CrearOtrosPayload,
  CrearTransferenciaPayload,
  MetodoPago,
  MetodoPagoCuenta,
  Oferta,
  Operador,
  OperadorCreatePayload,
  OperadorRol,
  OperadorRolCreatePayload,
  OperadorRolUpdatePayload,
  OperadorUpdatePayload,
  PedidoDetalle,
  PaqueteSaldo,
  PasswordChangePayload,
  PedidoResumen,
  PerfilUpdatePayload,
  Promocion,
  ProvinciaServicio,
  PuntoRecogida,
  ReporteGeneral,
  TemplateConfig,
  TasaOperativaResponse,
  SyncOfertasResponse,
} from '../types/api';
import { compressImage, compressImagesInFormData } from '../utils/imageCompression';

const DEFAULT_API_URL = typeof window !== 'undefined' ? window.location.protocol + '//' + window.location.hostname + ':8000' : 'http://127.0.0.1:8000';
const CONFIGURED_API_URL = import.meta.env.VITE_API_URL || '';
const USING_REMOTE_HOST = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
const CONFIGURED_API_IS_LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(CONFIGURED_API_URL);
const API_URL = (USING_REMOTE_HOST && CONFIGURED_API_IS_LOOPBACK ? DEFAULT_API_URL : CONFIGURED_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
const TOKEN_KEY = 'jireh.auth.token';

export type ApiRequestOptions = {
  signal?: AbortSignal;
};

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export type UploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
  dedupeKey?: string;
};

type ApiRequestInit = RequestInit & {
  offlinePolicy?: 'auto' | 'allow';
  retryReads?: boolean;
};

const SAFE_READ_RETRY_DELAYS_MS = [700, 1600];
const RECENT_UPLOAD_DEDUPE_MS = 15000;
const RECENT_MUTATION_DEDUPE_MS = 15000;
const RECENT_ORDER_CREATE_DEDUPE_MS = 120000;
const DEFAULT_REQUEST_TIMEOUT_MS = 45000;
const DEFAULT_UPLOAD_TIMEOUT_MS = 90000;
const MAX_UPLOAD_BYTES = Number(import.meta.env.VITE_UPLOAD_MAX_BYTES || 5 * 1024 * 1024);
const CLIENT_SLOW_REQUEST_MS = Number(import.meta.env.VITE_CLIENT_SLOW_REQUEST_MS || 8000);
const CLIENT_TRACE_ENABLED = import.meta.env.DEV || import.meta.env.VITE_CLIENT_TRACES === 'true';
const ORDER_CREATE_DEDUPE_STORAGE_KEY = 'jireh.order-create-dedupe.v1';
const uploadInFlight = new Map<string, Promise<unknown>>();
const recentUploadSuccess = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();
const mutationInFlight = new Map<string, Promise<unknown>>();
const recentMutationSuccess = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

type ClientTraceLevel = 'info' | 'warn' | 'error';

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function createClientRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function traceDuration(startedAt: number) {
  return Math.round(nowMs() - startedAt);
}

function traceClient(level: ClientTraceLevel, event: string, details: Record<string, unknown>) {
  if (!CLIENT_TRACE_ENABLED && level === 'info') return;
  const payload = {
    ...details,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
  };
  if (level === 'error') {
    console.error(`[jireh] ${event}`, payload);
  } else if (level === 'warn') {
    console.warn(`[jireh] ${event}`, payload);
  } else {
    console.info(`[jireh] ${event}`, payload);
  }
}

function addTraceHeaders(headers: Headers, requestId: string) {
  headers.set('X-Request-ID', requestId);
}

function traceKey(value: string) {
  return value.length > 96 ? `${value.slice(0, 96)}...` : value;
}

export function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError';
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${bytes} bytes`;
}

function offlineMessage() {
  return 'Sin internet. Revisa la conexion y vuelve a intentarlo.';
}

function serverUnavailableMessage() {
  return `Servidor apagado o inaccesible (${API_URL}). Verifica que el backend este encendido.`;
}

function timeoutMessage() {
  return 'Tiempo de espera agotado. La conexion esta muy lenta o el servidor no respondio.';
}

function tokenExpiredMessage() {
  return 'Sesion vencida. Vuelve a iniciar sesion.';
}

function fileTooLargeMessage() {
  return `Archivo muy grande. Maximo permitido: ${formatBytes(MAX_UPLOAD_BYTES)}.`;
}

function normalizeApiMessage(status: number, detail?: unknown, path = '') {
  const raw = typeof detail === 'string'
    ? detail
    : Array.isArray(detail)
      ? detail.map((item) => item?.msg ?? item).join(', ')
      : detail && typeof detail === 'object' && 'message' in detail
        ? String((detail as { message?: unknown }).message)
        : '';
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (status === 401) {
    if (path.includes('/auth/login')) return 'Telefono o contrasena incorrectos.';
    clearToken();
    return tokenExpiredMessage();
  }
  if (status === 403) return text || 'No tienes permiso para realizar esta accion.';
  if (status === 404) return text || 'No se encontro el recurso solicitado.';
  if (status === 408 || status === 504) return timeoutMessage();
  if (status === 413 || lower.includes('excede') || lower.includes('too large') || lower.includes('tamano maximo')) {
    return fileTooLargeMessage();
  }
  if (status === 0) return isOffline() ? offlineMessage() : serverUnavailableMessage();
  if (status >= 500) return 'El servidor tuvo un error interno. Intenta nuevamente en unos segundos.';

  return text || `Error ${status}`;
}

function networkErrorMessage(err?: unknown) {
  if (isOffline()) return offlineMessage();
  if (isAbortError(err)) return timeoutMessage();
  return serverUnavailableMessage();
}

function createTimeoutSignal(source?: AbortSignal, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  function abortFromSource() {
    controller.abort();
  }

  if (source) {
    if (source.aborted) controller.abort();
    else source.addEventListener('abort', abortFromSource, { once: true });
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      window.clearTimeout(timeoutId);
      source?.removeEventListener('abort', abortFromSource);
    },
  };
}

function isUnsafeRequest(method?: string) {
  const normalized = (method ?? 'GET').toUpperCase();
  return normalized !== 'GET' && normalized !== 'HEAD';
}

function shouldRetryRead(options: ApiRequestInit) {
  return options.retryReads !== false && !isUnsafeRequest(options.method) && !isOffline();
}

function shouldRetryResponse(response: Response) {
  return response.status === 408 || response.status === 429 || response.status >= 500;
}

function waitForRetry(ms: number, signal?: AbortSignal) {
  if (!signal) return new Promise((resolve) => window.setTimeout(resolve, ms));
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));

  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);

    function handleAbort() {
      window.clearTimeout(timeoutId);
      reject(new DOMException('Aborted', 'AbortError'));
    }

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

async function fetchWithReadRetries(url: string, options: ApiRequestInit = {}) {
  const canRetry = shouldRetryRead(options);
  const maxAttempts = canRetry ? SAFE_READ_RETRY_DELAYS_MS.length + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (canRetry && shouldRetryResponse(response) && attempt < maxAttempts - 1) {
        await waitForRetry(SAFE_READ_RETRY_DELAYS_MS[attempt], options.signal ?? undefined);
        continue;
      }
      return response;
    } catch (err) {
      if (isAbortError(err) || !canRetry || attempt >= maxAttempts - 1) throw err;
      await waitForRetry(SAFE_READ_RETRY_DELAYS_MS[attempt], options.signal ?? undefined);
    }
  }

  throw new Error(networkErrorMessage());
}

function uploadEntrySignature(value: FormDataEntryValue | File | null | undefined) {
  if (value instanceof File) {
    return [
      value.name,
      value.size,
      value.lastModified,
      value.type,
    ].join(':');
  }
  if (typeof value === 'string') return value;
  return 'sin-archivo';
}

function uploadDedupeKey(path: string, file: File, scope = 'archivo') {
  return `${path}|${scope}|${uploadEntrySignature(file)}`;
}

function uploadFormDedupeKey(path: string, formData: FormData) {
  return [
    path,
    uploadEntrySignature(formData.get('tipo')),
    uploadEntrySignature(formData.get('archivo')),
  ].join('|');
}

function stablePayloadSignature(value: unknown): string {
  if (typeof value === 'undefined') return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value);
  if (Array.isArray(value)) return `[${value.map(stablePayloadSignature).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stablePayloadSignature(record[key])}`)
    .join(',')}}`;
}

function hashSignature(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function mutationDedupeKey(path: string, payload: unknown) {
  return `${path}|${hashSignature(stablePayloadSignature(payload))}`;
}

function readOrderCreateDedupeCache() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const saved = localStorage.getItem(ORDER_CREATE_DEDUPE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, { expiresAt: number; data: unknown }>
      : {};
  } catch {
    return {};
  }
}

function writeOrderCreateDedupeCache(cache: Record<string, { expiresAt: number; data: unknown }>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ORDER_CREATE_DEDUPE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    return;
  }
}

function readRecentOrderCreate<T>(dedupeKey: string) {
  const cache = readOrderCreateDedupeCache();
  const entry = cache[dedupeKey];
  const now = Date.now();

  if (!entry) return null;
  if (entry.expiresAt <= now) {
    delete cache[dedupeKey];
    writeOrderCreateDedupeCache(cache);
    return null;
  }

  return entry.data as T;
}

function writeRecentOrderCreate(dedupeKey: string, data: unknown) {
  const cache = readOrderCreateDedupeCache();
  const now = Date.now();
  const next = Object.fromEntries(
    Object.entries(cache).filter(([, entry]) => entry.expiresAt > now),
  ) as Record<string, { expiresAt: number; data: unknown }>;

  next[dedupeKey] = {
    expiresAt: now + RECENT_ORDER_CREATE_DEDUPE_MS,
    data,
  };
  writeOrderCreateDedupeCache(next);
}

function validateUploadBodySize(body: XMLHttpRequestBodyInit) {
  if (!(body instanceof FormData)) return;

  for (const value of body.values()) {
    if (value instanceof File && value.size > MAX_UPLOAD_BYTES) {
      throw new Error(fileTooLargeMessage());
    }
  }
}

export function offlineCriticalActionMessage() {
  return 'Sin internet. Esta accion modifica datos y queda bloqueada para evitar duplicados o estados inconsistentes. Vuelve a intentarlo cuando vuelva la conexion.';
}

function addTunnelHeaders(headers: Headers) {
  if (/^https:\/\/[^/]+\.loca\.lt$/i.test(API_URL)) {
    headers.set('bypass-tunnel-reminder', 'true');
  }
}

export function apiAssetUrl(path: string | null | undefined) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function requestBlob(path: string, options: ApiRequestInit = {}): Promise<Blob> {
  const headers = new Headers(options.headers);
  const token = getToken();
  const requestId = createClientRequestId();
  const startedAt = nowMs();
  const method = (options.method ?? 'GET').toUpperCase();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  addTraceHeaders(headers, requestId);
  addTunnelHeaders(headers);

  const timeout = createTimeoutSignal(options.signal ?? undefined, DEFAULT_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchWithReadRetries(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: timeout.signal,
    });
  } catch (err) {
    if (isAbortError(err) && !timeout.timedOut()) throw err;
    const message = networkErrorMessage(err);
    traceClient(timeout.timedOut() ? 'warn' : 'error', 'api.network_error', {
      requestId,
      method,
      path,
      durationMs: traceDuration(startedAt),
      message,
    });
    throw new Error(message);
  } finally {
    timeout.cleanup();
  }

  if (!response.ok) {
    const message = normalizeApiMessage(response.status, undefined, path);
    traceClient(response.status >= 500 ? 'error' : 'warn', 'api.http_error', {
      requestId,
      method,
      path,
      status: response.status,
      durationMs: traceDuration(startedAt),
      serverRequestId: response.headers.get('X-Request-ID'),
      message,
    });
    throw new Error(message);
  }

  const durationMs = traceDuration(startedAt);
  if (durationMs >= CLIENT_SLOW_REQUEST_MS) {
    traceClient('warn', 'api.slow', {
      requestId,
      method,
      path,
      status: response.status,
      durationMs,
      serverRequestId: response.headers.get('X-Request-ID'),
    });
  }
  return response.blob();
}

export async function obtenerAssetBlob(path: string, options: ApiRequestOptions = {}): Promise<Blob> {
  if (/^(data:|blob:)/i.test(path)) {
    const timeout = createTimeoutSignal(options.signal, DEFAULT_REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchWithReadRetries(path, { signal: timeout.signal });
    } catch (err) {
      if (isAbortError(err) && !timeout.timedOut()) throw err;
      throw new Error(networkErrorMessage(err));
    } finally {
      timeout.cleanup();
    }
    return response.blob();
  }

  const url = /^https?:/i.test(path)
    ? path
    : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers();
  const token = getToken();
  const requestId = createClientRequestId();
  const startedAt = nowMs();

  if (token) headers.set('Authorization', `Bearer ${token}`);
  addTraceHeaders(headers, requestId);
  addTunnelHeaders(headers);

  const timeout = createTimeoutSignal(options.signal, DEFAULT_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchWithReadRetries(url, { headers, signal: timeout.signal });
  } catch (err) {
    if (isAbortError(err) && !timeout.timedOut()) throw err;
    const message = networkErrorMessage(err);
    traceClient(timeout.timedOut() ? 'warn' : 'error', 'api.asset_network_error', {
      requestId,
      path,
      durationMs: traceDuration(startedAt),
      message,
    });
    throw new Error(message);
  } finally {
    timeout.cleanup();
  }
  if (!response.ok) {
    const message = normalizeApiMessage(response.status, undefined, path);
    traceClient(response.status >= 500 ? 'error' : 'warn', 'api.asset_http_error', {
      requestId,
      path,
      status: response.status,
      durationMs: traceDuration(startedAt),
      serverRequestId: response.headers.get('X-Request-ID'),
      message,
    });
    throw new Error(message);
  }
  const durationMs = traceDuration(startedAt);
  if (durationMs >= CLIENT_SLOW_REQUEST_MS) {
    traceClient('warn', 'api.asset_slow', {
      requestId,
      path,
      status: response.status,
      durationMs,
      serverRequestId: response.headers.get('X-Request-ID'),
    });
  }
  return response.blob();
}

async function request<T>(path: string, options: ApiRequestInit = {}): Promise<T> {
  const { offlinePolicy = 'auto', ...requestOptions } = options;
  const headers = new Headers(options.headers);
  const token = getToken();
  const requestId = createClientRequestId();
  const startedAt = nowMs();
  const method = (options.method ?? 'GET').toUpperCase();

  if (offlinePolicy !== 'allow' && isUnsafeRequest(options.method) && isOffline()) {
    traceClient('warn', 'api.offline_action_blocked', {
      requestId,
      method,
      path,
    });
    throw new Error(offlineCriticalActionMessage());
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  addTraceHeaders(headers, requestId);
  addTunnelHeaders(headers);

  const timeout = createTimeoutSignal(requestOptions.signal ?? undefined, DEFAULT_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchWithReadRetries(`${API_URL}${path}`, {
      ...requestOptions,
      headers,
      signal: timeout.signal,
    });
  } catch (err) {
    if (isAbortError(err) && !timeout.timedOut()) throw err;
    const message = networkErrorMessage(err);
    traceClient(timeout.timedOut() ? 'warn' : 'error', 'api.network_error', {
      requestId,
      method,
      path,
      durationMs: traceDuration(startedAt),
      message,
    });
    throw new Error(message);
  } finally {
    timeout.cleanup();
  }

  if (!response.ok) {
    let detail: unknown;
    try {
      const data = await response.json();
      detail = data.detail ?? data;
    } catch {
      // Preserve HTTP fallback message.
    }
    const message = normalizeApiMessage(response.status, detail, path);
    traceClient(response.status >= 500 ? 'error' : 'warn', 'api.http_error', {
      requestId,
      method,
      path,
      status: response.status,
      durationMs: traceDuration(startedAt),
      serverRequestId: response.headers.get('X-Request-ID'),
      message,
    });
    throw new Error(message);
  }

  const durationMs = traceDuration(startedAt);
  if (durationMs >= CLIENT_SLOW_REQUEST_MS) {
    traceClient('warn', 'api.slow', {
      requestId,
      method,
      path,
      status: response.status,
      durationMs,
      serverRequestId: response.headers.get('X-Request-ID'),
    });
  }
  return response.json() as Promise<T>;
}

function requestMutation<T>(path: string, payload: unknown, options: ApiRequestInit): Promise<T> {
  const dedupeKey = mutationDedupeKey(path, payload);
  const recent = recentMutationSuccess.get(dedupeKey);

  if (recent && recent.expiresAt > Date.now()) {
    traceClient('warn', 'api.mutation_recent_reused', {
      path,
      dedupeKey: traceKey(dedupeKey),
    });
    return recent.promise as Promise<T>;
  }
  if (recent) recentMutationSuccess.delete(dedupeKey);

  const current = mutationInFlight.get(dedupeKey);
  if (current) {
    traceClient('warn', 'api.mutation_in_flight_reused', {
      path,
      dedupeKey: traceKey(dedupeKey),
    });
    return current as Promise<T>;
  }

  const promise = request<T>(path, options);
  mutationInFlight.set(dedupeKey, promise);
  promise.then(
    (data) => {
      if (mutationInFlight.get(dedupeKey) === promise) mutationInFlight.delete(dedupeKey);
      recentMutationSuccess.set(dedupeKey, {
        expiresAt: Date.now() + RECENT_MUTATION_DEDUPE_MS,
        promise: Promise.resolve(data),
      });
    },
    () => {
      if (mutationInFlight.get(dedupeKey) === promise) mutationInFlight.delete(dedupeKey);
    },
  );

  return promise;
}

function requestCreateOrder<T>(path: string, payload: unknown, options: ApiRequestInit): Promise<T> {
  const dedupeKey = mutationDedupeKey(path, payload);
  const recent = readRecentOrderCreate<T>(dedupeKey);

  if (recent) {
    traceClient('warn', 'api.order_create_recent_reused', {
      path,
      dedupeKey: traceKey(dedupeKey),
    });
    return Promise.resolve(recent);
  }

  return requestMutation<T>(path, payload, options).then((data) => {
    writeRecentOrderCreate(dedupeKey, data);
    return data;
  });
}

function requestUpload<T>(path: string, body: XMLHttpRequestBodyInit, options: UploadOptions = {}): Promise<T> {
  if (isOffline()) {
    traceClient('warn', 'api.upload_offline_blocked', {
      path,
    });
    return Promise.reject(new Error(offlineCriticalActionMessage()));
  }

  try {
    validateUploadBodySize(body);
  } catch (err) {
    return Promise.reject(err);
  }

  if (options.dedupeKey) {
    const recent = recentUploadSuccess.get(options.dedupeKey);
    if (recent && recent.expiresAt > Date.now()) {
      traceClient('warn', 'api.upload_recent_reused', {
        path,
        dedupeKey: traceKey(options.dedupeKey),
      });
      options.onProgress?.({ loaded: 1, total: 1, percent: 100 });
      return recent.promise as Promise<T>;
    }
    if (recent) recentUploadSuccess.delete(options.dedupeKey);

    const current = uploadInFlight.get(options.dedupeKey);
    if (current) {
      traceClient('warn', 'api.upload_in_flight_reused', {
        path,
        dedupeKey: traceKey(options.dedupeKey),
      });
      return current as Promise<T>;
    }
  }

  const promise = new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const requestId = createClientRequestId();
    const startedAt = nowMs();
    xhr.open('POST', `${API_URL}${path}`);
    xhr.timeout = DEFAULT_UPLOAD_TIMEOUT_MS;

    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('X-Request-ID', requestId);
    if (/^https:\/\/[^/]+\.loca\.lt$/i.test(API_URL)) {
      xhr.setRequestHeader('bypass-tunnel-reminder', 'true');
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const total = event.total || 0;
      const loaded = event.loaded || 0;
      options.onProgress?.({
        loaded,
        total,
        percent: total ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const durationMs = traceDuration(startedAt);
        if (durationMs >= CLIENT_SLOW_REQUEST_MS) {
          traceClient('warn', 'api.upload_slow', {
            requestId,
            path,
            status: xhr.status,
            durationMs,
            serverRequestId: xhr.getResponseHeader('X-Request-ID'),
          });
        }
        options.onProgress?.({ loaded: 1, total: 1, percent: 100 });
        try {
          resolve(JSON.parse(xhr.responseText || 'null') as T);
        } catch {
          resolve(null as T);
        }
        return;
      }

      let message = `Error ${xhr.status}`;
      try {
        const data = JSON.parse(xhr.responseText);
        message = normalizeApiMessage(xhr.status, data.detail ?? data, path);
      } catch {
        message = normalizeApiMessage(xhr.status, undefined, path);
      }
      traceClient(xhr.status >= 500 ? 'error' : 'warn', 'api.upload_http_error', {
        requestId,
        path,
        status: xhr.status,
        durationMs: traceDuration(startedAt),
        serverRequestId: xhr.getResponseHeader('X-Request-ID'),
        message,
      });
      reject(new Error(message));
    };

    xhr.onerror = () => {
      const message = networkErrorMessage();
      traceClient('error', 'api.upload_network_error', {
        requestId,
        path,
        durationMs: traceDuration(startedAt),
        message,
      });
      reject(new Error(message));
    };
    xhr.ontimeout = () => {
      const message = timeoutMessage();
      traceClient('warn', 'api.upload_timeout', {
        requestId,
        path,
        durationMs: traceDuration(startedAt),
        message,
      });
      reject(new Error(message));
    };
    xhr.onabort = () => {
      traceClient('info', 'api.upload_aborted', {
        requestId,
        path,
        durationMs: traceDuration(startedAt),
      });
      reject(new DOMException('Aborted', 'AbortError'));
    };
    xhr.send(body);
  });

  if (options.dedupeKey) {
    const dedupeKey = options.dedupeKey;
    uploadInFlight.set(dedupeKey, promise);
    promise.then(
      (data) => {
        if (uploadInFlight.get(dedupeKey) === promise) uploadInFlight.delete(dedupeKey);
        recentUploadSuccess.set(dedupeKey, {
          expiresAt: Date.now() + RECENT_UPLOAD_DEDUPE_MS,
          promise: Promise.resolve(data),
        });
      },
      () => {
        if (uploadInFlight.get(dedupeKey) === promise) uploadInFlight.delete(dedupeKey);
      },
    );
  }

  return promise;
}

export async function login(telefono: string, password: string) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 45000);

  try {
    return await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ telefono, password }),
      signal: controller.signal,
      offlinePolicy: 'allow',
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error('La conexion sigue muy lenta. Revisa la senal e intenta entrar otra vez.');
    }
    if (err instanceof TypeError) {
      throw new Error('No se pudo conectar con el servidor. Revisa la red local o la senal.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getMe(options: ApiRequestOptions = {}) {
  return request<AuthMeResponse>('/auth/me', { signal: options.signal }).then((data) => data.operador);
}

export function actualizarMiPerfil(payload: PerfilUpdatePayload) {
  return request<AuthMeResponse>('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then((data) => data.operador);
}

export async function subirMiFotoPerfil(file: File, options: UploadOptions = {}) {
  if (isOffline()) throw new Error(offlineCriticalActionMessage());

  const path = '/auth/me/foto';
  const formData = new FormData();
  formData.append('archivo', await compressImage(file));

  return requestUpload<AuthMeResponse>(path, formData, {
    ...options,
    dedupeKey: options.dedupeKey ?? uploadDedupeKey(path, file, 'foto-perfil'),
  }).then((data) => data.operador);
}

export function cambiarMiPassword(payload: PasswordChangePayload) {
  return request<{ message: string }>('/auth/me/password', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function obtenerTasasOperativas(options: ApiRequestOptions = {}) {
  return request<TasaOperativaResponse>('/tasas-operativas/', { signal: options.signal });
}

export function calcularOperacion(payload: { servicio: string; moneda_pago: string; monto_pago: number; bonificacion_manual?: number }, options: ApiRequestOptions = {}) {
  return request<CalculoOperacionResponse>('/calculadora/', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: options.signal,
    offlinePolicy: 'allow',
  });
}

export function listarOperadores(incluirInactivos = false, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  query.set('limit', '100');
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<Operador[]>(`/operador/?${query.toString()}`, { signal: options.signal });
}

export function listarOperadoresActivos(options: ApiRequestOptions = {}) {
  return request<Operador[]>('/operador/activos', { signal: options.signal });
}

export function crearOperador(payload: OperadorCreatePayload) {
  return request<Operador>('/operador/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarOperador(id: number, payload: OperadorUpdatePayload) {
  return request<Operador>(`/operador/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function eliminarOperador(id: number) {
  return request<Operador>(`/operador/${id}`, {
    method: 'DELETE',
  });
}

export function listarRolesOperador(incluirInactivos = false, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<OperadorRol[]>(`/operador-roles/?${query.toString()}`, { signal: options.signal });
}

export function crearRolOperador(payload: OperadorRolCreatePayload) {
  return request<OperadorRol>('/operador-roles/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarRolOperador(id: number, payload: OperadorRolUpdatePayload) {
  return request<OperadorRol>(`/operador-roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function eliminarRolOperador(id: number) {
  return request<OperadorRol>(`/operador-roles/${id}`, {
    method: 'DELETE',
  });
}


export function sincronizarOfertas() {
  return request<SyncOfertasResponse>('/sync/ofertas', {
    method: 'POST',
  });
}

export function listarPaquetesSaldo(monedaPago?: string, incluirInactivos = false, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  if (monedaPago) query.set('moneda_pago', monedaPago);
  query.set('limit', '100');
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<PaqueteSaldo[]>(`/paquetes-saldo/?${query.toString()}`, { signal: options.signal });
}

export function listarPuntosRecogida(incluirInactivos = false, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  query.set('limit', '100');
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<PuntoRecogida[]>(`/puntos-recogida/?${query.toString()}`, { signal: options.signal });
}

export function listarMetodosPago(moneda?: string, incluirInactivos = false, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  if (moneda) query.set('moneda', moneda);
  query.set('limit', '100');
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<MetodoPago[]>(`/metodos-pago/?${query.toString()}`, { signal: options.signal });
}

export function buscarClientePorTelefono(telefono: string, pais = 'br') {
  const query = new URLSearchParams({ telefono, pais });
  return request<Cliente>(`/clientes/buscar?${query.toString()}`);
}

export function listarPedidos(params: {
  estado?: string;
  servicio?: string;
  limit?: number;
  alcance?: 'mis' | 'todas';
  fecha_desde?: string;
  fecha_hasta?: string;
} = {}, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  if (params.estado) query.set('estado', params.estado);
  if (params.servicio) query.set('servicio', params.servicio);
  query.set('alcance', params.alcance ?? 'todas');
  if (params.fecha_desde) query.set('fecha_desde', params.fecha_desde);
  if (params.fecha_hasta) query.set('fecha_hasta', params.fecha_hasta);
  query.set('limit', String(params.limit ?? 200));
  return request<PedidoResumen[]>(`/pedido/?${query.toString()}`, { signal: options.signal });
}

export function obtenerPedido(codigo: string, options: ApiRequestOptions = {}) {
  return request<PedidoDetalle>(`/pedido/${codigo}`, { signal: options.signal });
}

export function rastrearPedidosPorCliente(clienteId: number) {
  return request<PedidoResumen[]>(`/pedido/rastrear/cliente/${clienteId}`);
}

export function tomarOperacion(codigo: string) {
  const path = `/pedido/${codigo}/tomar`;
  return requestMutation<PedidoDetalle>(path, null, {
    method: 'POST',
  });
}

export function renovarOperacion(codigo: string) {
  return request<PedidoDetalle>(`/pedido/${codigo}/renovar`, {
    method: 'POST',
  });
}

export function liberarOperacion(codigo: string) {
  const path = `/pedido/${codigo}/liberar`;
  return requestMutation<PedidoDetalle>(path, null, {
    method: 'POST',
  });
}

export function redirigirOperacion(codigo: string, payload: { operador_destino_id: number | null; mensaje?: string }) {
  const path = `/pedido/${codigo}/redirigir`;
  return requestMutation<PedidoDetalle>(path, payload, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function crearTransferencia(payload: CrearTransferenciaPayload) {
  const path = '/pedido/transferencia';
  return requestCreateOrder<PedidoDetalle>(path, payload, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function crearEfectivo(payload: CrearEfectivoPayload) {
  const path = '/pedido/efectivo';
  return requestCreateOrder<PedidoDetalle>(path, payload, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function crearSaldo(payload: CrearSaldoPayload) {
  const path = '/pedido/saldo';
  return requestCreateOrder<PedidoDetalle>(path, payload, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function crearDivisa(payload: CrearDivisaPayload) {
  const path = '/pedido/divisa';
  return requestCreateOrder<PedidoDetalle>(path, payload, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function crearOtros(payload: CrearOtrosPayload) {
  const path = '/pedido/';
  return requestCreateOrder<PedidoDetalle>(path, payload, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarEstado(
  codigo: string,
  estado: string,
  observaciones?: string,
  options: { finalizar_sin_comprobante?: boolean; motivo_sin_comprobante?: string } = {},
) {
  const path = `/pedido/${codigo}/estado`;
  const payload = { estado, observaciones, ...options };
  return requestMutation<PedidoDetalle>(path, payload, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function subirArchivo(codigo: string, formData: FormData, options: UploadOptions = {}) {
  if (isOffline()) throw new Error(offlineCriticalActionMessage());

  const path = `/pedido/${codigo}/upload`;
  return requestUpload(path, await compressImagesInFormData(formData), {
    ...options,
    dedupeKey: options.dedupeKey ?? uploadFormDedupeKey(path, formData),
  });
}


export function obtenerReporte(params: { fecha_desde?: string; fecha_hasta?: string; estado?: string; servicio?: string; moneda_pago?: string; operador_id?: string; metodo_pago_id?: string; cuenta_pago_id?: string } = {}, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return request<ReporteGeneral>(`/reportes/resumen?${query.toString()}`, { signal: options.signal });
}


export function descargarOperacionesExcel(params: { fecha_desde?: string; fecha_hasta?: string; estado?: string; servicio?: string; moneda_pago?: string; operador_id?: string; metodo_pago_id?: string; cuenta_pago_id?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return requestBlob(`/reportes/operaciones.xlsx?${query.toString()}`);
}

export function descargarReporteCsv(params: { fecha_desde?: string; fecha_hasta?: string; estado?: string; servicio?: string; moneda_pago?: string; operador_id?: string; metodo_pago_id?: string; cuenta_pago_id?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return requestBlob(`/reportes/resumen.csv?${query.toString()}`);
}

export function listarSaldosCuenta(params: { metodo_pago_id?: string; cuenta_pago_id?: string } = {}, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return request<import('../types/api').SaldoCuenta[]>(`/reportes/cuentas/saldos?${query.toString()}`, { signal: options.signal });
}

export function crearExtraccionCuenta(payload: { cuenta_pago_id: number; monto: number; motivo: string }) {
  return request<import('../types/api').ExtraccionCuenta>('/reportes/extracciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listarExtraccionesCuenta(cuentaPagoId?: string, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  if (cuentaPagoId) query.set('cuenta_pago_id', cuentaPagoId);
  return request<import('../types/api').ExtraccionCuenta[]>(`/reportes/extracciones?${query.toString()}`, { signal: options.signal });
}

export function crearMetodoPago(payload: { nombre: string; moneda: string; imagen_url?: string }) {
  return request<MetodoPago>('/metodos-pago/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarMetodoPago(id: number, payload: { nombre?: string; moneda?: string; activo?: boolean; imagen_url?: string | null }) {
  return request<MetodoPago>(`/metodos-pago/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}


export function listarCuentasMetodoPago(metodoId: number, incluirInactivas = true, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  query.set('incluir_inactivas', incluirInactivas ? 'true' : 'false');
  return request<MetodoPagoCuenta[]>(`/metodos-pago/${metodoId}/cuentas?${query.toString()}`, { signal: options.signal });
}

export function crearCuentaMetodoPago(metodoId: number, payload: { alias: string; cuenta: string; titular: string; qr_url?: string | null; predeterminada?: boolean; activa?: boolean }) {
  return request<MetodoPagoCuenta>(`/metodos-pago/${metodoId}/cuentas`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarCuentaMetodoPago(metodoId: number, cuentaId: number, payload: { alias?: string; cuenta?: string; titular?: string; qr_url?: string | null; predeterminada?: boolean; activa?: boolean }) {
  return request<MetodoPagoCuenta>(`/metodos-pago/${metodoId}/cuentas/${cuentaId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function eliminarCuentaMetodoPago(metodoId: number, cuentaId: number) {
  return request<MetodoPagoCuenta>(`/metodos-pago/${metodoId}/cuentas/${cuentaId}`, {
    method: 'DELETE',
  });
}

export function eliminarMetodoPago(id: number) {
  return request<MetodoPago>(`/metodos-pago/${id}`, {
    method: 'DELETE',
  });
}

export async function subirImagenMetodoPago(id: number, file: File, options: UploadOptions = {}) {
  if (isOffline()) throw new Error(offlineCriticalActionMessage());

  const path = `/metodos-pago/${id}/imagen`;
  const formData = new FormData();
  formData.append('archivo', await compressImage(file));

  return requestUpload<MetodoPago>(path, formData, {
    ...options,
    dedupeKey: options.dedupeKey ?? uploadDedupeKey(path, file, 'metodo-pago'),
  });
}

export function listarProvinciasServicio(incluirInactivas = true, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  query.set('incluir_inactivas', incluirInactivas ? 'true' : 'false');
  return request<ProvinciaServicio[]>(`/provincias-servicio/?${query.toString()}`, { signal: options.signal });
}

export function crearProvinciaServicio(payload: { nombre: string; activo?: boolean }) {
  return request<ProvinciaServicio>('/provincias-servicio/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarProvinciaServicio(id: number, payload: { nombre?: string; activo?: boolean }) {
  return request<ProvinciaServicio>(`/provincias-servicio/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function crearPuntoRecogida(payload: { nombre: string; direccion: string; telefono?: string; provincia_id?: number | null }) {
  return request<PuntoRecogida>('/puntos-recogida/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarPuntoRecogida(id: number, payload: { nombre?: string; direccion?: string; telefono?: string; provincia_id?: number | null; activo?: boolean }) {
  return request<PuntoRecogida>(`/puntos-recogida/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function eliminarPuntoRecogida(id: number) {
  return request<PuntoRecogida>(`/puntos-recogida/${id}`, {
    method: 'DELETE',
  });
}

export function listarOfertas(incluirInactivas = false, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  query.set('limit', '100');
  if (incluirInactivas) query.set('incluir_inactivas', 'true');
  return request<Oferta[]>(`/ofertas/?${query.toString()}`, { signal: options.signal });
}

export function crearOferta(payload: { servicio: string; nombre?: string; tasa: number; minimo_pago: number; moneda_pago: string; origen?: string; activa?: boolean }) {
  return request<Oferta>('/ofertas/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarOferta(id: number, payload: { activa?: boolean }) {
  return request<Oferta>(`/ofertas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function eliminarOferta(id: number) {
  return request<Oferta>(`/ofertas/${id}`, {
    method: 'DELETE',
  });
}

export function crearPaqueteSaldo(payload: { nombre: string; monto_pago: number; moneda_pago: string; saldo_cup: number; origen?: string; activo?: boolean }) {
  return request<PaqueteSaldo>('/paquetes-saldo/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarPaqueteSaldo(id: number, payload: { activo?: boolean }) {
  return request<PaqueteSaldo>(`/paquetes-saldo/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function eliminarPaqueteSaldo(id: number) {
  return request<PaqueteSaldo>(`/paquetes-saldo/${id}`, {
    method: 'DELETE',
  });
}


export function listarPromociones(incluirInactivas = false, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  query.set('limit', '100');
  if (incluirInactivas) query.set('incluir_inactivas', 'true');
  return request<Promocion[]>(`/promociones/?${query.toString()}`, { signal: options.signal });
}

export function crearPromocion(payload: { tipo: Promocion['tipo']; titulo: string; subtitulo?: string; descripcion: string; orden?: number; fecha_desde: string; fecha_hasta: string; imagen_url?: string; activa?: boolean }) {
  return request<Promocion>('/promociones/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarPromocion(id: number, payload: { tipo?: Promocion['tipo']; titulo?: string; subtitulo?: string; descripcion?: string; orden?: number; fecha_desde?: string; fecha_hasta?: string; imagen_url?: string | null; activa?: boolean }) {
  return request<Promocion>(`/promociones/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function eliminarPromocion(id: number) {
  return request<Promocion>(`/promociones/${id}`, {
    method: 'DELETE',
  });
}

export async function subirImagenPromocion(id: number, file: File, options: UploadOptions = {}) {
  if (isOffline()) throw new Error(offlineCriticalActionMessage());

  const path = `/promociones/${id}/imagen`;
  const formData = new FormData();
  formData.append('archivo', await compressImage(file));

  return requestUpload<Promocion>(path, formData, {
    ...options,
    dedupeKey: options.dedupeKey ?? uploadDedupeKey(path, file, 'promocion'),
  });
}

export function listarConfiguraciones(options: ApiRequestOptions = {}) {
  return request<Configuracion[]>('/configuracion/', { signal: options.signal });
}

export function guardarConfiguracion(payload: { clave: string; valor: string }) {
  return request<Configuracion>('/configuracion/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function obtenerEstadoConfiguracionInicial(options: ApiRequestOptions = {}): Promise<ConfiguracionInicialEstado> {
  const [configuraciones, metodos, ofertas, puntos, paquetes, provincias, operadores] = await Promise.all([
    listarConfiguraciones(options),
    listarMetodosPago(undefined, true, options),
    listarOfertas(true, options),
    listarPuntosRecogida(true, options),
    listarPaquetesSaldo(undefined, true, options),
    listarProvinciasServicio(true, options),
    listarOperadores(true, options),
  ]);
  const metodosActivos = metodos.filter((item) => item.activo);
  const cuentas = (
    await Promise.all(
      metodosActivos
        .map((metodo) => listarCuentasMetodoPago(metodo.id, false, options)),
    )
  ).flat();
  const marcada = configuraciones.some(
    (item) => item.clave === 'setup_inicial_completado' && item.valor === 'true',
  );
  const provinciasActivas = provincias.filter((item) => item.activo);
  const puntosActivos = puntos.filter((item) => item.activo);
  const operadoresActivos = operadores.filter((item) => item.activo);
  const ofertasActivas = ofertas.filter((item) => item.activa);
  const paquetesActivos = paquetes.filter((item) => item.activo);
  const instalacionExistente =
    provinciasActivas.length > 0 &&
    puntosActivos.length > 0 &&
    metodosActivos.length > 0 &&
    cuentas.length > 0 &&
    operadoresActivos.length > 0;

  return {
    completada: marcada || instalacionExistente,
    provincias: provinciasActivas.length,
    metodos: metodosActivos.length,
    cuentas: cuentas.length,
    operadores: operadoresActivos.length,
    ofertas: ofertasActivas.length,
    puntos: puntosActivos.length,
    paquetes: paquetesActivos.length,
  };
}

export function listarTemplates(options: ApiRequestOptions = {}) {
  return request<TemplateConfig[]>('/templates/', { signal: options.signal });
}

export function guardarTemplate(clave: string, valor: string) {
  return request<{ message: string; clave: string }>(`/templates/${clave}`, {
    method: 'PUT',
    body: JSON.stringify({ valor }),
  });
}

export function listarClientes(busqueda?: string, incluirInactivos = false, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  query.set('limit', '100');
  if (busqueda) query.set('busqueda', busqueda);
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<Cliente[]>(`/clientes/?${query.toString()}`, { signal: options.signal });
}

export function crearCliente(payload: { nombre: string; email?: string; telefono?: string; pais?: string; moneda_preferida?: string }) {
  return request<Cliente>('/clientes/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listarContactos(clienteId?: string, incluirInactivos = false, options: ApiRequestOptions = {}) {
  const query = new URLSearchParams();
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  const suffix = query.toString();

  if (clienteId) {
    return request<Contacto[]>(`/clientes/${clienteId}/contactos${suffix ? `?${suffix}` : ''}`, { signal: options.signal });
  }

  return request<Contacto[]>(`/contactos/${suffix ? `?${suffix}` : ''}`, { signal: options.signal });
}

export function crearContacto(payload: { cliente_id?: number | null; nombre: string; telefono?: string; numero_tarjeta?: string; tipo_tarjeta?: string; documento_identidad_url?: string; pais?: string; notas?: string }) {
  return request<Contacto>('/contactos/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function eliminarContacto(id: number) {
  return request<Contacto>(`/contactos/${id}`, {
    method: 'DELETE',
  });
}
