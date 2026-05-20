import type {
  AuthMeResponse,
  AuthResponse,
  CrearTransferenciaPayload,
  PedidoDetalle,
  PedidoResumen,
} from '../types/api';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
const TOKEN_KEY = 'jireh.auth.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail ?? message;
    } catch {
      // Preserve HTTP fallback message.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function login(telefono: string, password: string) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ telefono, password }),
  });
}

export function getMe() {
  return request<AuthMeResponse>('/auth/me').then((data) => data.operador);
}

export function listarPedidos(params: { estado?: string; servicio?: string } = {}) {
  const query = new URLSearchParams();
  if (params.estado) query.set('estado', params.estado);
  if (params.servicio) query.set('servicio', params.servicio);
  query.set('limit', '50');
  return request<PedidoResumen[]>(`/pedido/?${query.toString()}`);
}

export function obtenerPedido(codigo: string) {
  return request<PedidoDetalle>(`/pedido/${codigo}`);
}

export function crearTransferencia(payload: CrearTransferenciaPayload) {
  return request<PedidoDetalle>('/pedido/transferencia', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarEstado(codigo: string, estado: string, observaciones?: string) {
  return request<PedidoDetalle>(`/pedido/${codigo}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado, observaciones }),
  });
}

export function subirArchivo(codigo: string, formData: FormData) {
  return request(`/pedido/${codigo}/upload`, {
    method: 'POST',
    body: formData,
  });
}
