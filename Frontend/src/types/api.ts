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
