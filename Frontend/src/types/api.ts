export type Operador = {
  id: number;
  nombre: string;
  telefono: string;
  foto_url?: string | null;
  codigo_operador: string;
  rol: string;
  permisos: string[];
  activo: boolean;
};


export type OperadorCreatePayload = {
  nombre: string;
  telefono: string;
  password?: string;
  rol: string;
  permisos?: string[];
};

export type OperadorUpdatePayload = {
  nombre?: string;
  telefono?: string;
  password?: string;
  rol?: string;
  activo?: boolean;
  permisos?: string[];
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  operador: Operador;
};

export type AuthMeResponse = {
  operador: Operador;
};

export type PerfilUpdatePayload = {
  nombre: string;
};

export type PasswordChangePayload = {
  password_actual: string;
  password_nueva: string;
};


export type CalculoOperacionResponse = {
  oferta_id?: number;
  paquete_id?: number;
  tasa?: number;
  bonificacion?: number;
  tasa_final?: number;
  monto_resultado: number;
  ganancia?: number;
  saldo_cup?: number;
};

export type DatosPagoPedido = {
  metodo_pago?: string | null;
  cuenta_pago?: string | null;
  titular_pago?: string | null;
  qr_pago_url?: string | null;
};

export type PedidoResumen = {
  id?: number;
  pedido_id?: number;
  codigo_operacion: string;
  servicio: string;
  estado: string;
  monto_pago: number;
  moneda_pago: string;
  monto_resultado: number;
  tasa_final: number;
  operador_id?: number | null;
  observaciones?: string | null;
  created_at?: string;
  updated_at?: string;
  fecha_pago_confirmado?: string | null;
  fecha_en_operacion?: string | null;
  fecha_completado?: string | null;
  operador_asignado_id?: number | null;
  operador_asignado_nombre?: string | null;
  asignado_en?: string | null;
  lock_expires_at?: string | null;
  lock_activo?: boolean;
  redirigido_a_operador_id?: number | null;
  redirigido_a_operador_nombre?: string | null;
  redirigido_por_operador_id?: number | null;
  redirigido_por_operador_nombre?: string | null;
  redirigido_en?: string | null;
  redireccion_mensaje?: string | null;
  detalle?: Record<string, unknown> | null;
};

export type PedidoDetalle = PedidoResumen & {
  tasa_usada?: number;
  bonificacion?: number;
  ganancia?: number;
  updated_at?: string;
  fecha_pago_confirmado?: string | null;
  fecha_en_operacion?: string | null;
  fecha_completado?: string | null;
  cliente?: Record<string, unknown> | null;
  detalle?: Record<string, unknown> | null;
  archivos?: ArchivoPedido[];
  historial?: PedidoHistorial[];
  mensaje_operacion?: string;
  whatsapp_url?: string;
  mensaje_pago_cliente?: string;
  whatsapp_pago_url?: string | null;
  datos_pago?: DatosPagoPedido | null;
  mensaje_grupo_pedidos?: string;
  whatsapp_grupo_pedidos_url?: string | null;
  mensaje_cliente_estado?: string | null;
  whatsapp_estado_url?: string | null;
  mensaje_grupo_finalizado?: string | null;
  whatsapp_grupo_finalizado_url?: string | null;
  comprobante_pago?: string | null;
  mensaje_finalizacion_sin_comprobante?: string | null;
};

export type PedidoHistorial = {
  id: number;
  estado_anterior?: string | null;
  estado_nuevo: string;
  usuario?: string | null;
  comentario?: string | null;
  created_at?: string;
};

export type ArchivoPedido = {
  id: number;
  pedido_id: number;
  tipo: string;
  ruta_archivo: string;
  nombre_archivo?: string | null;
  mime_type?: string | null;
  notas?: string | null;
  usuario?: string | null;
  created_at?: string;
};

export type CrearTransferenciaPayload = {
  monto_pago: number;
  moneda_pago: string;
  numero_tarjeta: string;
  telefono_destinatario?: string;
  tipo_pago_id: number;
  cuenta_pago_id?: number | null;
  operador_id: number;
  cliente_id?: number | null;
  nombre_cliente?: string;
  numero_telefono_cliente?: string;
  bonificacion_manual?: number;
};


export type MetodoPago = {
  id: number;
  nombre: string;
  moneda: string;
  activo: boolean;
  imagen_url?: string | null;
};



export type MetodoPagoCuenta = {
  id: number;
  metodo_pago_id: number;
  alias: string;
  cuenta: string;
  titular: string;
  qr_url?: string | null;
  predeterminada: boolean;
  activa: boolean;
};

export type ProvinciaServicio = {
  id: number;
  nombre: string;
  activo: boolean;
};

export type PuntoRecogida = {
  id: number;
  nombre: string;
  direccion: string;
  telefono?: string | null;
  provincia_id?: number | null;
  provincia_nombre?: string | null;
  activo: boolean;
};

export type CrearEfectivoPayload = {
  monto_pago: number;
  moneda_pago: string;
  tipo_pago_id: number;
  cuenta_pago_id?: number | null;
  operador_id: number;
  cliente_id?: number | null;
  nombre_cliente?: string;
  numero_telefono_cliente?: string;
  telefono_destinatario?: string;
  documento_identidad_url?: string;
  contacto_id?: number | null;
  punto_recogida_id?: number | null;
  bonificacion_manual?: number;
  observaciones?: string;
};


export type PaqueteSaldo = {
  id: number;
  nombre: string;
  monto_pago: number | string;
  moneda_pago?: string | null;
  origen?: string | null;
  saldo_cup: number;
  activo: boolean;
};

export type CrearSaldoPayload = {
  telefono_destinatario?: string;
  contacto_id?: number | null;
  tipo_pago_id: number;
  cuenta_pago_id?: number | null;
  operador_id: number;
  cliente_id?: number | null;
  nombre_cliente?: string;
  numero_telefono_cliente?: string;
  paquete_saldo_id?: number | null;
  monto_pago?: number | null;
  saldo_cup?: number | null;
  moneda_pago: string;
  bonificacion_manual?: number;
  observaciones?: string;
};


export type CrearOtrosPayload = {
  servicio: 'otros';
  monto_pago: number;
  moneda_pago: string;
  tipo_pago_id: number;
  cuenta_pago_id?: number | null;
  operador_id: number;
  cliente_id?: number | null;
  nombre_cliente?: string;
  numero_telefono_cliente?: string;
  numero_tarjeta?: string;
  telefono_destinatario?: string;
  documento_identidad_url?: string;
  punto_recogida_id?: number | null;
  observaciones: string;
};


export type CrearDivisaPayload = {
  monto_pago: number;
  moneda_pago: string;
  tipo_tarjeta?: string;
  numero_tarjeta?: string;
  telefono_destinatario?: string;
  contacto_id?: number | null;
  monto_divisa?: number;
  tipo_pago_id: number;
  cuenta_pago_id?: number | null;
  operador_id: number;
  cliente_id?: number | null;
  nombre_cliente?: string;
  numero_telefono_cliente?: string;
  bonificacion_manual?: number;
  observaciones?: string;
};


export type Cliente = {
  id: number;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  pais?: string | null;
  moneda_preferida?: string | null;
  codigo_referido?: string | null;
  perfil_completo: boolean;
  activo: boolean;
};

export type ReporteResumen = {
  total_pedidos: number;
  monto_pago_total: number;
  monto_resultado_total: number;
  ganancia_total: number;
};

export type ReporteGrupo = {
  clave: string | number | null;
  cantidad: number;
  monto_pago: number;
  ganancia: number;
};

export type ReporteGeneral = {
  resumen: ReporteResumen;
  por_estado: ReporteGrupo[];
  por_servicio: ReporteGrupo[];
  por_moneda: ReporteGrupo[];
  por_operador: ReporteGrupo[];
  por_metodo_pago: ReporteGrupo[];
  por_cuenta_pago: ReporteGrupo[];
  por_dia: ReporteGrupo[];
};

export type SaldoCuenta = {
  cuenta_pago_id: number;
  metodo_pago_id: number;
  metodo_pago: string;
  alias: string;
  cuenta: string;
  moneda: string;
  ingresos: number;
  extracciones: number;
  saldo: number;
};

export type ExtraccionCuenta = {
  id: number;
  cuenta_pago_id: number;
  operador_id: number;
  monto: number;
  motivo: string;
  created_at: string;
};


export type Oferta = {
  id: number;
  servicio: string;
  nombre?: string | null;
  tasa: number;
  minimo_pago?: number | null;
  moneda_pago?: string | null;
  origen?: string | null;
  activa: boolean;
};

export type Promocion = {
  id: number;
  tipo: 'promocion' | 'precios' | 'marca';
  titulo: string;
  subtitulo: string;
  imagen_url: string;
  descripcion: string;
  orden: number;
  fecha_desde: string;
  fecha_hasta: string;
  activa: boolean;
  vigente: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};



export type SyncOfertaItem = {
  minimo: number;
  tasa: number;
  moneda: string;
  fila?: number;
};

export type SyncSaldoItem = {
  monto_pago: number;
  cup: number;
  moneda: string;
  fila?: number;
};

export type SyncOfertasResponse = {
  transferencia: SyncOfertaItem[];
  efectivo: SyncOfertaItem[];
  mlc: SyncOfertaItem[];
  usd: SyncOfertaItem[];
  clasica: SyncOfertaItem[];
  saldo: SyncSaldoItem[];
  meta?: Record<string, unknown>;
};


export type TasaOperativaSyncStatus = {
  interval_hours: number;
  last_success_at?: string | null;
  last_attempt_at?: string | null;
  next_sync_at?: string | null;
  stale: boolean;
  running: boolean;
  last_error?: string | null;
};

export type OfertaOperativa = Oferta;

export type PaqueteSaldoOperativo = PaqueteSaldo;

export type TasaOperativaResponse = {
  generated_at: string;
  ofertas: OfertaOperativa[];
  ofertas_divisa: OfertaOperativa[];
  paquetes_saldo: PaqueteSaldoOperativo[];
  promociones: Promocion[];
  sync?: TasaOperativaSyncStatus;
};

export type Configuracion = {
  id: number;
  clave: string;
  valor: string;
  editable: boolean;
  descripcion?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TemplateConfig = {
  clave: string;
  valor: string;
};

export type ConfiguracionInicialEstado = {
  completada: boolean;
  metodos: number;
  cuentas: number;
  ofertas: number;
  puntos: number;
  paquetes: number;
};


export type Contacto = {
  id: number;
  cliente_id?: number | null;
  nombre: string;
  telefono?: string | null;
  numero_tarjeta?: string | null;
  tipo_tarjeta?: string | null;
  documento_identidad_url?: string | null;
  pais?: string | null;
  notas?: string | null;
  activo: boolean;
};
