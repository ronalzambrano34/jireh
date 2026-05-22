import type {
  AuthMeResponse,
  AuthResponse,
  Cliente,
  Configuracion,
  Contacto,
  CrearDivisaPayload,
  CrearEfectivoPayload,
  CrearSaldoPayload,
  CrearTransferenciaPayload,
  MetodoPago,
  Oferta,
  Operador,
  PedidoDetalle,
  PaqueteSaldo,
  PedidoResumen,
  PuntoRecogida,
  ReporteGeneral,
  TemplateConfig,
  TasaOperativaResponse,
  SyncOfertasResponse,
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

async function requestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const headers = new Headers(options.headers);
  const token = getToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status}`);
  }

  return response.blob();
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

export function obtenerTasasOperativas() {
  return request<TasaOperativaResponse>('/tasas-operativas/');
}

export function listarOperadores(incluirInactivos = false) {
  const query = new URLSearchParams();
  query.set('limit', '100');
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<Operador[]>(`/operador/?${query.toString()}`);
}


export function sincronizarOfertas() {
  return request<SyncOfertasResponse>('/sync/ofertas', {
    method: 'POST',
  });
}

export function listarPaquetesSaldo(monedaPago?: string, incluirInactivos = false) {
  const query = new URLSearchParams();
  if (monedaPago) query.set('moneda_pago', monedaPago);
  query.set('limit', '100');
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<PaqueteSaldo[]>(`/paquetes-saldo/?${query.toString()}`);
}

export function listarPuntosRecogida(incluirInactivos = false) {
  const query = new URLSearchParams();
  query.set('limit', '100');
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<PuntoRecogida[]>(`/puntos-recogida/?${query.toString()}`);
}

export function listarMetodosPago(moneda?: string, incluirInactivos = false) {
  const query = new URLSearchParams();
  if (moneda) query.set('moneda', moneda);
  query.set('limit', '100');
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<MetodoPago[]>(`/metodos-pago/?${query.toString()}`);
}

export function buscarClientePorTelefono(telefono: string, pais = 'br') {
  const query = new URLSearchParams({ telefono, pais });
  return request<Cliente>(`/clientes/buscar?${query.toString()}`);
}

export function listarPedidos(params: { estado?: string; servicio?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.estado) query.set('estado', params.estado);
  if (params.servicio) query.set('servicio', params.servicio);
  query.set('limit', String(params.limit ?? 200));
  return request<PedidoResumen[]>(`/pedido/?${query.toString()}`);
}

export function obtenerPedido(codigo: string) {
  return request<PedidoDetalle>(`/pedido/${codigo}`);
}

export function tomarOperacion(codigo: string) {
  return request<PedidoDetalle>(`/pedido/${codigo}/tomar`, {
    method: 'POST',
  });
}

export function renovarOperacion(codigo: string) {
  return request<PedidoDetalle>(`/pedido/${codigo}/renovar`, {
    method: 'POST',
  });
}

export function liberarOperacion(codigo: string) {
  return request<PedidoDetalle>(`/pedido/${codigo}/liberar`, {
    method: 'POST',
  });
}

export function crearTransferencia(payload: CrearTransferenciaPayload) {
  return request<PedidoDetalle>('/pedido/transferencia', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function crearEfectivo(payload: CrearEfectivoPayload) {
  return request<PedidoDetalle>('/pedido/efectivo', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function crearSaldo(payload: CrearSaldoPayload) {
  return request<PedidoDetalle>('/pedido/saldo', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function crearDivisa(payload: CrearDivisaPayload) {
  return request<PedidoDetalle>('/pedido/divisa', {
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


export function obtenerReporte(params: { fecha_desde?: string; fecha_hasta?: string; estado?: string; servicio?: string; moneda_pago?: string; operador_id?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return request<ReporteGeneral>(`/reportes/resumen?${query.toString()}`);
}


export function descargarReporteCsv(params: { fecha_desde?: string; fecha_hasta?: string; estado?: string; servicio?: string; moneda_pago?: string; operador_id?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return requestBlob(`/reportes/resumen.csv?${query.toString()}`);
}

export function crearMetodoPago(payload: { nombre: string; moneda: string }) {
  return request<MetodoPago>('/metodos-pago/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarMetodoPago(id: number, payload: { nombre?: string; moneda?: string; activo?: boolean }) {
  return request<MetodoPago>(`/metodos-pago/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function eliminarMetodoPago(id: number) {
  return request<MetodoPago>(`/metodos-pago/${id}`, {
    method: 'DELETE',
  });
}

export function crearPuntoRecogida(payload: { nombre: string; direccion: string; telefono?: string }) {
  return request<PuntoRecogida>('/puntos-recogida/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarPuntoRecogida(id: number, payload: { nombre?: string; direccion?: string; telefono?: string; activo?: boolean }) {
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

export function listarOfertas(incluirInactivas = false) {
  const query = new URLSearchParams();
  query.set('limit', '100');
  if (incluirInactivas) query.set('incluir_inactivas', 'true');
  return request<Oferta[]>(`/ofertas/?${query.toString()}`);
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

export function listarConfiguraciones() {
  return request<Configuracion[]>('/configuracion/');
}

export function guardarConfiguracion(payload: { clave: string; valor: string }) {
  return request<Configuracion>('/configuracion/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listarTemplates() {
  return request<TemplateConfig[]>('/templates/');
}

export function guardarTemplate(clave: string, valor: string) {
  return request<{ message: string; clave: string }>(`/templates/${clave}`, {
    method: 'PUT',
    body: JSON.stringify({ valor }),
  });
}

export function listarClientes(busqueda?: string, incluirInactivos = false) {
  const query = new URLSearchParams();
  query.set('limit', '100');
  if (busqueda) query.set('busqueda', busqueda);
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<Cliente[]>(`/clientes/?${query.toString()}`);
}

export function crearCliente(payload: { nombre: string; email?: string; telefono?: string; pais?: string; moneda_preferida?: string }) {
  return request<Cliente>('/clientes/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listarContactos(clienteId?: string, incluirInactivos = false) {
  const query = new URLSearchParams();
  if (clienteId) query.set('cliente_id', clienteId);
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<Contacto[]>(`/contactos/?${query.toString()}`);
}

export function crearContacto(payload: { cliente_id?: number | null; nombre: string; telefono?: string; numero_tarjeta?: string; tipo_tarjeta?: string; documento_identidad_url?: string; pais?: string; notas?: string }) {
  return request<Contacto>('/contactos/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
