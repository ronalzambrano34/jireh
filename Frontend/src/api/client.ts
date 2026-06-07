import type {
  AuthMeResponse,
  AuthResponse,
  CalculoOperacionResponse,
  Cliente,
  Configuracion,
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

const DEFAULT_API_URL = typeof window !== 'undefined' ? window.location.protocol + '//' + window.location.hostname + ':8000' : 'http://127.0.0.1:8000';
const CONFIGURED_API_URL = import.meta.env.VITE_API_URL || '';
const USING_REMOTE_HOST = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
const CONFIGURED_API_IS_LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(CONFIGURED_API_URL);
const API_URL = (USING_REMOTE_HOST && CONFIGURED_API_IS_LOOPBACK ? DEFAULT_API_URL : CONFIGURED_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
const TOKEN_KEY = 'jireh.auth.token';

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

export async function login(telefono: string, password: string) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 45000);

  try {
    return await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ telefono, password }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
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

export function getMe() {
  return request<AuthMeResponse>('/auth/me').then((data) => data.operador);
}

export function actualizarMiPerfil(payload: PerfilUpdatePayload) {
  return request<AuthMeResponse>('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then((data) => data.operador);
}

export function subirMiFotoPerfil(file: File) {
  const formData = new FormData();
  formData.append('archivo', file);

  return request<AuthMeResponse>('/auth/me/foto', {
    method: 'POST',
    body: formData,
  }).then((data) => data.operador);
}

export function cambiarMiPassword(payload: PasswordChangePayload) {
  return request<{ message: string }>('/auth/me/password', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function obtenerTasasOperativas() {
  return request<TasaOperativaResponse>('/tasas-operativas/');
}

export function calcularOperacion(payload: { servicio: string; moneda_pago: string; monto_pago: number; bonificacion_manual?: number }) {
  return request<CalculoOperacionResponse>('/calculadora/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listarOperadores(incluirInactivos = false) {
  const query = new URLSearchParams();
  query.set('limit', '100');
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  return request<Operador[]>(`/operador/?${query.toString()}`);
}

export function listarOperadoresActivos() {
  return request<Operador[]>('/operador/activos');
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

export function listarPedidos(params: {
  estado?: string;
  servicio?: string;
  limit?: number;
  alcance?: 'mis' | 'todas';
  fecha_desde?: string;
  fecha_hasta?: string;
} = {}) {
  const query = new URLSearchParams();
  if (params.estado) query.set('estado', params.estado);
  if (params.servicio) query.set('servicio', params.servicio);
  if (params.alcance) query.set('alcance', params.alcance);
  if (params.fecha_desde) query.set('fecha_desde', params.fecha_desde);
  if (params.fecha_hasta) query.set('fecha_hasta', params.fecha_hasta);
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

export function redirigirOperacion(codigo: string, payload: { operador_destino_id: number | null; mensaje?: string }) {
  return request<PedidoDetalle>(`/pedido/${codigo}/redirigir`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
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

export function crearOtros(payload: CrearOtrosPayload) {
  return request<PedidoDetalle>('/pedido/', {
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
  return request<PedidoDetalle>(`/pedido/${codigo}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado, observaciones, ...options }),
  });
}

export function subirArchivo(codigo: string, formData: FormData) {
  return request(`/pedido/${codigo}/upload`, {
    method: 'POST',
    body: formData,
  });
}


export function obtenerReporte(params: { fecha_desde?: string; fecha_hasta?: string; estado?: string; servicio?: string; moneda_pago?: string; operador_id?: string; metodo_pago_id?: string; cuenta_pago_id?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return request<ReporteGeneral>(`/reportes/resumen?${query.toString()}`);
}


export function descargarReporteCsv(params: { fecha_desde?: string; fecha_hasta?: string; estado?: string; servicio?: string; moneda_pago?: string; operador_id?: string; metodo_pago_id?: string; cuenta_pago_id?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return requestBlob(`/reportes/resumen.csv?${query.toString()}`);
}

export function listarSaldosCuenta(params: { metodo_pago_id?: string; cuenta_pago_id?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return request<import('../types/api').SaldoCuenta[]>(`/reportes/cuentas/saldos?${query.toString()}`);
}

export function crearExtraccionCuenta(payload: { cuenta_pago_id: number; monto: number; motivo: string }) {
  return request<import('../types/api').ExtraccionCuenta>('/reportes/extracciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listarExtraccionesCuenta(cuentaPagoId?: string) {
  const query = new URLSearchParams();
  if (cuentaPagoId) query.set('cuenta_pago_id', cuentaPagoId);
  return request<import('../types/api').ExtraccionCuenta[]>(`/reportes/extracciones?${query.toString()}`);
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


export function listarCuentasMetodoPago(metodoId: number, incluirInactivas = true) {
  const query = new URLSearchParams();
  query.set('incluir_inactivas', incluirInactivas ? 'true' : 'false');
  return request<MetodoPagoCuenta[]>(`/metodos-pago/${metodoId}/cuentas?${query.toString()}`);
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

export function subirImagenMetodoPago(id: number, file: File) {
  const formData = new FormData();
  formData.append('archivo', file);

  return request<MetodoPago>(`/metodos-pago/${id}/imagen`, {
    method: 'POST',
    body: formData,
  });
}

export function listarProvinciasServicio(incluirInactivas = true) {
  const query = new URLSearchParams();
  query.set('incluir_inactivas', incluirInactivas ? 'true' : 'false');
  return request<ProvinciaServicio[]>(`/provincias-servicio/?${query.toString()}`);
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


export function listarPromociones(incluirInactivas = false) {
  const query = new URLSearchParams();
  query.set('limit', '100');
  if (incluirInactivas) query.set('incluir_inactivas', 'true');
  return request<Promocion[]>(`/promociones/?${query.toString()}`);
}

export function crearPromocion(payload: { descripcion: string; fecha_desde: string; fecha_hasta: string; imagen_url?: string; activa?: boolean }) {
  return request<Promocion>('/promociones/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarPromocion(id: number, payload: { descripcion?: string; fecha_desde?: string; fecha_hasta?: string; imagen_url?: string | null; activa?: boolean }) {
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

export function subirImagenPromocion(id: number, file: File) {
  const formData = new FormData();
  formData.append('archivo', file);

  return request<Promocion>(`/promociones/${id}/imagen`, {
    method: 'POST',
    body: formData,
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
  if (incluirInactivos) query.set('incluir_inactivos', 'true');
  const suffix = query.toString();

  if (clienteId) {
    return request<Contacto[]>(`/clientes/${clienteId}/contactos${suffix ? `?${suffix}` : ''}`);
  }

  return request<Contacto[]>(`/contactos/${suffix ? `?${suffix}` : ''}`);
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
