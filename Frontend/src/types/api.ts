export type Operador = {
  id: number;
  nombre: string;
  telefono: string;
  codigo_operador: string;
  rol: string;
  permisos: string[];
  activo: boolean;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  operador: Operador;
};

export type AuthMeResponse = {
  operador: Operador;
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
  created_at?: string;
  operador_asignado_id?: number | null;
  operador_asignado_nombre?: string | null;
  asignado_en?: string | null;
  lock_expires_at?: string | null;
  lock_activo?: boolean;
  detalle?: Record<string, unknown> | null;
};

export type PedidoDetalle = PedidoResumen & {
  cliente?: Record<string, unknown> | null;
  detalle?: Record<string, unknown> | null;
  archivos?: ArchivoPedido[];
  mensaje_operacion?: string;
  whatsapp_url?: string;
  comprobante_pago?: string | null;
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
  operador_id: number;
  cliente_id?: number | null;
  nombre_cliente?: string;
  numero_telefono_cliente?: string;
};


export type MetodoPago = {
  id: number;
  nombre: string;
  moneda: string;
  activo: boolean;
};


export type PuntoRecogida = {
  id: number;
  nombre: string;
  direccion: string;
  telefono?: string | null;
  activo: boolean;
};

export type CrearEfectivoPayload = {
  monto_pago: number;
  moneda_pago: string;
  tipo_pago_id: number;
  operador_id: number;
  cliente_id?: number | null;
  nombre_cliente?: string;
  numero_telefono_cliente?: string;
  telefono_destinatario?: string;
  documento_identidad_url?: string;
  contacto_id?: number | null;
  punto_recogida_id?: number | null;
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
  operador_id: number;
  cliente_id?: number | null;
  nombre_cliente?: string;
  numero_telefono_cliente?: string;
  paquete_saldo_id?: number | null;
  monto_pago?: number | null;
  saldo_cup?: number | null;
  moneda_pago: string;
  observaciones?: string;
};


export type CrearDivisaPayload = {
  monto_pago: number;
  moneda_pago: string;
  tipo_tarjeta?: string;
  numero_tarjeta?: string;
  telefono_destinatario?: string;
  contacto_id?: number | null;
  monto_divisa: number;
  tipo_pago_id: number;
  operador_id: number;
  cliente_id?: number | null;
  nombre_cliente?: string;
  numero_telefono_cliente?: string;
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
  por_dia: ReporteGrupo[];
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



export type OfertaOperativa = Oferta;

export type PaqueteSaldoOperativo = PaqueteSaldo;

export type TasaOperativaResponse = {
  generated_at: string;
  ofertas: OfertaOperativa[];
  ofertas_divisa: OfertaOperativa[];
  paquetes_saldo: PaqueteSaldoOperativo[];
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
