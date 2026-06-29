import { ChangeEvent, TouchEvent, WheelEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, FileText, Lock, MessageCircle, RefreshCw, Send, ShieldAlert, Upload, WifiOff, X } from 'lucide-react';
import { PageLoader } from '../components/PageLoader';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { Modal } from '../components/Modal';
import { UiSwitch } from '../components/UiSwitch';
import { ERROR_TOAST_DURATION_MS, FloatingToast } from '../components/FloatingToast';
import { UploadStatus } from '../components/UploadStatus';
import { actualizarEstado, apiAssetUrl, liberarOperacion, obtenerPedido, offlineCriticalActionMessage, redirigirOperacion, subirArchivo, tomarOperacion } from '../api/client';
import { listarOperadoresActivosDedup, obtenerAssetBlobDedup, obtenerPedidoDedup } from '../api/dedupedReads';
import type { ArchivoPedido, Operador, PedidoDetalle, PedidoResumen } from '../types/api';
import { isAbortError, useAbortableEffect } from '../hooks/useAbortableEffect';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  abrirWhatsAppUrl,
} from '../utils/whatsapp';
import { FloatingSelect } from '../components/FloatingSelect';
import { formatearNumeroTarjeta } from '../utils/tarjetas';
import { copiarAlPortapapeles } from '../utils/clipboard';
import { enqueueOfflineStateChange } from '../utils/offlineQueue';
import { CollapsibleOrderSection, LiquidationCard, OrderControlHead, OrderEvidenceSection, OrderHistorySection, PedidoDetailHeader } from './pedido/PedidoDetalleView';
import './pedido/PedidoDetallePanel.css';

const estados = [
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pago_confirmado', label: 'Pago confirmado' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const detalleOrden: Record<string, string[]> = {
  transferencia: ['numero_tarjeta', 'telefono_destinatario', 'monto_cup'],
  efectivo: ['documento_identidad_url', 'telefono_destinatario', 'monto_cup', 'punto_recogida'],
  saldo: ['telefono_destinatario', 'saldo_cup'],
  divisa: ['tipo_tarjeta', 'numero_tarjeta', 'telefono_destinatario', 'monto_divisa'],
  otros: ['documento_identidad_url', 'numero_tarjeta', 'telefono_destinatario', 'punto_recogida', 'informacion_operacion'],
};

const detalleMontoKeys = ['monto_cup', 'monto_divisa', 'saldo_cup'];

function tasaAplicadaPedido(pedido: PedidoDetalle) {
  if (pedido.servicio === 'saldo') return pedido.monto_pago;
  return pedido.tasa_final;
}
const detallePrioridadOperativa = ['numero_tarjeta', 'telefono_destinatario', ...detalleMontoKeys];

type WhatsAppAdjuntoTipo = 'comprobante' | 'documento';

type WhatsAppPendiente = {
  titulo: string;
  detalle: string;
  url: string | null;
  clienteUrl: string | null;
  mensaje: string;
  adjunto: ArchivoPedido | null;
  adjuntoTipo: WhatsAppAdjuntoTipo | null;
};

function escaparRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function archivoDocumentoIdentidad(pedido: PedidoDetalle) {
  const documentoDetalle = typeof pedido.detalle?.documento_identidad_url === 'string'
    ? pedido.detalle.documento_identidad_url.trim()
    : '';
  const archivos = pedido.archivos ?? [];

  const archivoRegistrado = archivos.find((archivo) => (
    archivo.tipo === 'documento_identidad'
    && (!documentoDetalle || archivo.ruta_archivo === documentoDetalle)
  ))
    ?? archivos.find((archivo) => archivo.tipo === 'documento_identidad')
    ?? null;

  if (archivoRegistrado) return archivoRegistrado;
  if (!documentoDetalle || documentoDetalle === 'Documento adjunto en evidencias') return null;

  return {
    id: -1,
    pedido_id: pedido.id ?? pedido.pedido_id ?? 0,
    tipo: 'documento_identidad',
    ruta_archivo: documentoDetalle,
    nombre_archivo: 'documento-identidad',
  };
}

function mensajeSinUrlDocumento(mensaje: string, pedido: PedidoDetalle, documento: ArchivoPedido | null) {
  if (!documento) return mensaje;

  const documentoDetalle = typeof pedido.detalle?.documento_identidad_url === 'string'
    ? pedido.detalle.documento_identidad_url.trim()
    : '';
  const rutas = Array.from(new Set([
    documento.ruta_archivo.trim(),
    documentoDetalle,
  ].filter(Boolean).flatMap((ruta) => [ruta, apiAssetUrl(ruta)])));

  return rutas.reduce(
    (texto, ruta) => texto.replace(new RegExp(escaparRegExp(ruta), 'g'), 'Adjunto'),
    mensaje,
  );
}

function notificacionWhatsAppEstado(pedido: PedidoDetalle, nuevoEstado: string): WhatsAppPendiente | null {
  if (nuevoEstado === 'completado') {
    const comprobante = pedido.archivos?.find((archivo) => archivo.tipo === 'comprobante_final')
      ?? null;
    return pedido.whatsapp_grupo_finalizado_url || pedido.whatsapp_estado_url
      ? {
          titulo: 'Operacion completada',
          detalle: 'Mensaje listo para el grupo de operaciones finalizadas.',
          url: pedido.whatsapp_grupo_finalizado_url ?? null,
          clienteUrl: pedido.whatsapp_estado_url ?? null,
          mensaje: pedido.mensaje_grupo_finalizado ?? '',
          adjunto: comprobante,
          adjuntoTipo: comprobante ? 'comprobante' : null,
        }
      : null;
  }

  if (nuevoEstado === 'pago_confirmado') {
    const documento = archivoDocumentoIdentidad(pedido);
    const mensaje = mensajeSinUrlDocumento(
      pedido.mensaje_grupo_pedidos ?? '',
      pedido,
      documento,
    );

    return pedido.whatsapp_grupo_pedidos_url
      ? {
          titulo: 'Pago confirmado',
          detalle: documento
            ? 'Mensaje listo para el grupo de Operaciones con documento adjunto.'
            : 'Mensaje listo para el grupo de Operaciones.',
          url: pedido.whatsapp_grupo_pedidos_url,
          clienteUrl: null,
          mensaje,
          adjunto: documento,
          adjuntoTipo: documento ? 'documento' : null,
        }
      : null;
  }

  return null;
}

function reenvioWhatsAppGrupoPedido(pedido: PedidoDetalle): WhatsAppPendiente | null {
  const url = pedido.whatsapp_grupo_pedidos_url ?? pedido.whatsapp_url ?? null;
  const mensajeBase = pedido.mensaje_grupo_pedidos ?? pedido.mensaje_operacion ?? '';
  if (!url || !mensajeBase) return null;

  const documento = archivoDocumentoIdentidad(pedido);
  const mensaje = mensajeSinUrlDocumento(
    mensajeBase,
    pedido,
    documento,
  );

  return {
    titulo: 'Reenviar WhatsApp',
    detalle: documento
      ? 'Mensaje listo para reenviar al grupo con documento adjunto.'
      : 'Mensaje listo para reenviar por WhatsApp.',
    url,
    clienteUrl: null,
    mensaje,
    adjunto: documento,
    adjuntoTipo: documento ? 'documento' : null,
  };
}

function reenvioWhatsAppCliente(pedido: PedidoDetalle): WhatsAppPendiente | null {
  if (!pedido.whatsapp_estado_url || !pedido.mensaje_cliente_estado) return null;

  return {
    titulo: 'Reenviar al cliente',
    detalle: 'Mensaje de estado listo para reenviar al cliente.',
    url: null,
    clienteUrl: pedido.whatsapp_estado_url,
    mensaje: pedido.mensaje_cliente_estado,
    adjunto: null,
    adjuntoTipo: null,
  };
}

const detalleLabels: Record<string, string> = {
  numero_tarjeta: 'Tarjeta',
  telefono_destinatario: 'Telefono',
  monto_cup: 'Monto CUP',
  documento_identidad_url: 'Foto documento',
  punto_recogida_id: 'Punto de recogida',
  punto_recogida: 'Punto de recogida',
  saldo_cup: 'Saldo CUP',
  tipo_tarjeta: 'Tipo tarjeta',
  monto_divisa: 'Monto divisa',
  informacion_operacion: 'Info operacion',
};

const camposCopiables = new Set([
  'numero_tarjeta',
  'telefono_destinatario',
  'monto_cup',
  'saldo_cup',
  'monto_divisa',
]);
const COPY_FEEDBACK_DURATION_MS = 2600;
const ESTADOS_TERMINALES = new Set(['completado', 'cancelado']);
type UploadScope = 'evidence' | 'payment' | 'final';
type MensajeModalActivo = 'operativo' | 'whatsapp' | null;

function estadoLabel(value: string) {
  if (value === 'en_operacion') return 'Pago confirmado';
  return estados.find((item) => item.value === value)?.label ?? value.replaceAll('_', ' ');
}

function detalleEntries(pedido: PedidoDetalle) {
  const detalle = pedido.detalle;
  if (!detalle) return [];

  const keys = detalleOrden[pedido.servicio] ?? [];
  const presentes = new Set<string>();
  const ordered = keys
    .filter((key) => detalle[key] !== null && detalle[key] !== undefined && detalle[key] !== '')
    .map((key) => {
      presentes.add(key);
      return [key, detalle[key]] as [string, unknown];
    });
  const extras = Object.entries(detalle)
    .filter(([key, value]) => (
      !presentes.has(key)
      && !(key === 'punto_recogida_id' && detalle.punto_recogida)
      && value !== null
      && value !== undefined
      && value !== ''
    ));

  const merged = [...ordered, ...extras];
  const tarjeta = merged.find(([key]) => key === 'numero_tarjeta');
  const telefono = merged.find(([key]) => key === 'telefono_destinatario');
  const monto = merged.find(([key]) => detalleMontoKeys.includes(key));
  const flex = merged.filter(([key]) => !detallePrioridadOperativa.includes(key));
  const result: [string, unknown][] = [];
  const criticalCount = [tarjeta, telefono, monto].filter(Boolean).length;

  function pushSlot(item?: [string, unknown], reserveWhenMissing = false) {
    const next = item ?? flex.shift();
    if (next && !result.some(([key]) => key === next[0])) {
      result.push(next);
      return;
    }

    if (reserveWhenMissing) result.push([`__slot_${result.length}`, '']);
  }

  pushSlot(flex.shift(), criticalCount > 0);
  pushSlot(tarjeta);
  pushSlot(telefono);
  pushSlot(monto);

  return [...result, ...flex];
}

function detalleLabel(key: string) {
  return detalleLabels[key] ?? key.replaceAll('_', ' ');
}

function mostrarValor(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function mostrarDetalleValor(key: string, value: unknown) {
  if (key === 'numero_tarjeta') return formatearNumeroTarjeta(mostrarValor(value));
  if (key === 'punto_recogida' && value && typeof value === 'object') {
    const punto = value as {
      nombre?: string;
      provincia_nombre?: string | null;
      direccion?: string;
    };
    return [
      punto.nombre,
      punto.provincia_nombre,
      punto.direccion,
    ].filter(Boolean).join(' · ');
  }
  return mostrarValor(value);
}

function formatoFecha(value?: string | null) {
  if (!value) return null;
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

function vibrarFeedback(duration = 18) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(duration);
  }
}

async function copiarTexto(value: unknown) {
  const text = mostrarValor(value);
  if (!text) return false;
  const copiado = await copiarAlPortapapeles(text);
  if (copiado) {
    vibrarFeedback(18);
  }
  return copiado;
}

function servicioLabel(value: string) {
  if (value === 'otros') return 'Otros';
  return value.replaceAll('_', ' ');
}

function monedaEntregaPedido(pedido: PedidoDetalle) {
  if (pedido.servicio === 'divisa') {
    const tipoTarjeta = pedido.detalle?.tipo_tarjeta;
    return tipoTarjeta ? mostrarValor(tipoTarjeta) : 'DIVISA';
  }

  if (pedido.servicio === 'otros') return pedido.moneda_pago;

  return 'CUP';
}

function archivoUrlRemota(archivo: ArchivoPedido) {
  return apiAssetUrl(archivo.ruta_archivo);
}

function archivoEsImagen(archivo: ArchivoPedido) {
  return archivo.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(archivo.ruta_archivo);
}

function archivoTipoLabel(tipo: string) {
  if (tipo === 'documento_identidad') return 'Documento';
  if (tipo === 'comprobante_cliente') return 'Comprobante';
  if (tipo === 'comprobante_final') return 'Comprobante final';
  if (tipo === 'captura_operador') return 'Captura';
  return tipo.replaceAll('_', ' ');
}

export function PedidoDetallePanel({
  codigo,
  pedidoInicial,
  operadorId,
  canManage = true,
  onChanged,
  onClose,
  codigosNavegacion,
  onNavigate,
}: {
  codigo: string | null;
  pedidoInicial?: PedidoResumen | null;
  operadorId: number;
  canManage?: boolean;
  onChanged: () => void;
  onClose: () => void;
  codigosNavegacion?: string[];
  onNavigate?: (codigo: string) => void;
}) {
  const [pedido, setPedido] = useState<PedidoDetalle | null>(
    pedidoInicial as PedidoDetalle | null,
  );
  const [archivoBlobUrls, setArchivoBlobUrls] = useState<Record<number, string>>({});
  const archivoBlobUrlsRef = useRef<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadScope, setUploadScope] = useState<UploadScope | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadLabel, setUploadLabel] = useState('Subiendo archivo');
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [redirigiendo, setRedirigiendo] = useState(false);
  const [operadorDestino, setOperadorDestino] = useState('');
  const [mensajeRedireccion, setMensajeRedireccion] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [redireccionAbierta, setRedireccionAbierta] = useState(false);
  const [cancelacionAbierta, setCancelacionAbierta] = useState(false);
  const [confirmarPagoAbierto, setConfirmarPagoAbierto] = useState(false);
  const [whatsappPendiente, setWhatsappPendiente] = useState<WhatsAppPendiente | null>(null);
  const [compartiendoComprobante, setCompartiendoComprobante] = useState(false);
  const [finalizacionAbierta, setFinalizacionAbierta] = useState(false);
  const [finalizarSinComprobante, setFinalizarSinComprobante] = useState(false);
  const [motivoSinComprobante, setMotivoSinComprobante] = useState('');
  const [mensajeAbierto, setMensajeAbierto] = useState(false);
  const [mensajeModalActivo, setMensajeModalActivo] = useState<MensajeModalActivo>(null);
  const [evidenciasAbiertas, setEvidenciasAbiertas] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [ownLockNoticeHidden, setOwnLockNoticeHidden] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [cancelCountdown, setCancelCountdown] = useState(0);
  const comprobantePagoInputRef = useRef<HTMLInputElement | null>(null);
  const comprobanteFinalInputRef = useRef<HTMLInputElement | null>(null);
  const retryUploadRef = useRef<(() => void) | null>(null);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastHorizontalNavigationRef = useRef(0);
  const mutationInFlightRef = useRef(false);
  const online = useOnlineStatus();
  const offlineActionsBlocked = !online;

  const bloqueoPropio = Boolean(pedido?.lock_activo && pedido.operador_asignado_id === operadorId);
  const bloqueadoPorOtro = Boolean(pedido?.lock_activo && pedido.operador_asignado_id && pedido.operador_asignado_id !== operadorId);
  const indiceNavegacion = codigo ? (codigosNavegacion ?? []).indexOf(codigo) : -1;
  const puedeNavegarPedidos = Boolean(
    bloqueoPropio
    && onNavigate
    && indiceNavegacion >= 0
    && (codigosNavegacion?.length ?? 0) > 1
    && !confirmarPagoAbierto
    && !finalizacionAbierta
    && !mensajeModalActivo
    && !cancelacionAbierta
    && !redireccionAbierta
  );
  const accionesRequierenBloqueo = Boolean(canManage && !bloqueoPropio && !ESTADOS_TERMINALES.has(pedido?.estado ?? ''));
  const detalle = useMemo(() => (pedido ? detalleEntries(pedido) : []), [pedido]);
  const evidenciaPrincipal = useMemo(() => {
    const archivos = pedido?.archivos ?? [];
    return archivos.find((archivo) => archivo.tipo === 'comprobante_cliente')
      ?? archivos.find((archivo) => archivo.tipo === 'comprobante_final')
      ?? archivos[0]
      ?? null;
  }, [pedido?.archivos]);
  const archivosFirma = (pedido?.archivos ?? [])
    .map((archivo) => `${archivo.id}:${archivo.ruta_archivo}`)
    .join('|');

  useEffect(() => {
    archivoBlobUrlsRef.current = archivoBlobUrls;
  }, [archivoBlobUrls]);

  useEffect(() => () => {
    Object.values(archivoBlobUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    archivoBlobUrlsRef.current = {};
  }, []);

  useAbortableEffect((signal) => {
    let activo = true;
    let aplicado = false;
    const urlsCreadas: string[] = [];
    const archivos = pedido?.archivos ?? [];
    const archivoIds = new Set(archivos.map((archivo) => archivo.id));

    if (archivos.length === 0) {
      const anteriores = archivoBlobUrlsRef.current;
      if (Object.keys(anteriores).length > 0) {
        archivoBlobUrlsRef.current = {};
        setArchivoBlobUrls({});
        Object.values(anteriores).forEach((url) => URL.revokeObjectURL(url));
      }
      return () => {
        activo = false;
      };
    }

    void Promise.all(archivos.map(async (archivo) => {
      try {
        const blob = await obtenerAssetBlobDedup(archivo.ruta_archivo, { signal });
        const url = URL.createObjectURL(blob);
        urlsCreadas.push(url);
        return [archivo.id, url] as const;
      } catch {
        return null;
      }
    })).then((resultados) => {
      if (!activo) return;
      const siguientes: Record<number, string> = {};
      const anteriores = archivoBlobUrlsRef.current;
      Object.entries(anteriores).forEach(([id, url]) => {
        const idArchivo = Number(id);
        if (archivoIds.has(idArchivo)) siguientes[idArchivo] = url;
      });
      resultados.forEach((item) => {
        if (item) siguientes[item[0]] = item[1];
      });
      archivoBlobUrlsRef.current = siguientes;
      setArchivoBlobUrls(siguientes);
      aplicado = true;
      Object.entries(anteriores).forEach(([id, url]) => {
        const idArchivo = Number(id);
        if (!archivoIds.has(idArchivo) || siguientes[idArchivo] !== url) URL.revokeObjectURL(url);
      });
    });

    return () => {
      activo = false;
      if (!aplicado) urlsCreadas.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [archivosFirma]);

  function archivoUrl(archivo: ArchivoPedido) {
    return archivoBlobUrls[archivo.id] ?? archivoUrlRemota(archivo);
  }
  const monedaEntrega = pedido ? monedaEntregaPedido(pedido) : 'CUP';
  const tieneComprobantePago = Boolean(
    pedido?.comprobante_pago
    || pedido?.archivos?.some((archivo) => archivo.tipo === 'comprobante_cliente')
  );
  const tieneComprobanteFinal = Boolean(
    pedido?.archivos?.some((archivo) => archivo.tipo === 'comprobante_final')
  );

  const proximoEstadoPrincipal = useMemo(() => {
    if (!pedido) return 'pago_confirmado';
    if (pedido.estado === 'pendiente_pago') return 'pago_confirmado';
    if (pedido.estado === 'pago_confirmado' || pedido.estado === 'en_operacion') return 'completado';
    return 'completado';
  }, [pedido]);

  const accionPrincipalLabel = useMemo(() => {
    if (!pedido) return 'Confirmar pago';
    if (pedido.estado === 'pendiente_pago') return 'Confirmar pago';
    if (pedido.estado === 'pago_confirmado' || pedido.estado === 'en_operacion') return 'Finalizar';
    if (pedido.estado === 'completado') return 'Finalizado';
    return 'Confirmar';
  }, [pedido]);
  const accionPrincipalBloqueadaOffline = offlineActionsBlocked && proximoEstadoPrincipal !== 'completado';

  useAbortableEffect((signal) => {
    if (!codigo) {
      setPedido(null);
      return;
    }

    let active = true;
    setPedido(pedidoInicial?.codigo_operacion === codigo ? pedidoInicial as PedidoDetalle : null);
    setLoading(!pedidoInicial || pedidoInicial.codigo_operacion !== codigo);
    setError(null);
    setMensajeAbierto(false);
    cerrarModalWhatsApp();
    setEvidenciasAbiertas(false);
    setHistorialAbierto(false);
    setConfirmarPagoAbierto(false);
    setFinalizacionAbierta(false);
    setFinalizarSinComprobante(false);
    setMotivoSinComprobante('');
    setUploadScope(null);
    setUploadProgress(null);
    setUploadError(null);
    retryUploadRef.current = null;
    setOwnLockNoticeHidden(false);
    obtenerPedidoDedup(codigo, { signal })
      .then(async (data) => {
        if (!active) return;
        setPedido(data);
        setLoading(false);
        if (!canManage || ESTADOS_TERMINALES.has(data.estado)) {
          return;
        }

        setSaving(true);
        try {
          const tomado = await tomarOperacion(codigo);
          if (!active) return;
          setPedido(tomado);
          if (!pedidoInicial?.lock_activo || pedidoInicial.operador_asignado_id !== operadorId) {
            onChanged();
          }
        } finally {
          if (active) setSaving(false);
        }
      })
      .catch(async (err) => {
        if (isAbortError(err)) return;
        if (!active) return;
        try {
          const data = await obtenerPedido(codigo, { signal });
          if (!active) return;
          setPedido(data);
          if (!ESTADOS_TERMINALES.has(data.estado)) {
            setError(err instanceof Error ? err.message : 'No se pudo tomar la operacion');
          }
        } catch (detalleErr) {
          if (isAbortError(detalleErr)) return;
          setError(detalleErr instanceof Error ? detalleErr.message : 'No se pudo cargar el pedido');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canManage, codigo]);

  function navegarPedidoTomado(direccion: -1 | 1) {
    if (!puedeNavegarPedidos || !codigosNavegacion || !onNavigate) return;
    const siguienteIndice = indiceNavegacion + direccion;
    const siguienteCodigo = codigosNavegacion[siguienteIndice];
    if (!siguienteCodigo) return;
    lastHorizontalNavigationRef.current = Date.now();
    onNavigate(siguienteCodigo);
  }

  function iniciarDeslizamiento(event: TouchEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (!puedeNavegarPedidos || target.closest('button, a, input, textarea, select, label')) {
      swipeStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    swipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function finalizarDeslizamiento(event: TouchEvent<HTMLElement>) {
    const inicio = swipeStartRef.current;
    swipeStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!inicio || !touch || Date.now() - lastHorizontalNavigationRef.current < 550) return;
    const deltaX = touch.clientX - inicio.x;
    const deltaY = touch.clientY - inicio.y;
    if (Math.abs(deltaX) < 70 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
    navegarPedidoTomado(deltaX < 0 ? 1 : -1);
  }

  function desplazarHorizontalmente(event: WheelEvent<HTMLElement>) {
    if (
      !puedeNavegarPedidos
      || Math.abs(event.deltaX) < 45
      || Math.abs(event.deltaX) <= Math.abs(event.deltaY)
      || Date.now() - lastHorizontalNavigationRef.current < 700
    ) return;
    navegarPedidoTomado(event.deltaX > 0 ? 1 : -1);
  }

  useEffect(() => {
    setOperadorDestino(pedido?.redirigido_a_operador_id ? String(pedido.redirigido_a_operador_id) : '');
    setMensajeRedireccion(pedido?.redireccion_mensaje ?? '');
    setRedireccionAbierta(Boolean(pedido?.redirigido_a_operador_id));
    setOwnLockNoticeHidden(false);
  }, [pedido?.redirigido_a_operador_id, pedido?.redireccion_mensaje]);

  useAbortableEffect((signal) => {
    if (!redireccionAbierta || operadores.length > 0) return;

    let active = true;
    listarOperadoresActivosDedup({ signal })
      .then((items) => {
        if (active) setOperadores(items.filter((item) => item.id !== operadorId && item.activo));
      })
      .catch((err) => {
        if (active && !isAbortError(err)) setError(err instanceof Error ? err.message : 'No se pudieron cargar los operadores');
      });

    return () => {
      active = false;
    };
  }, [operadorId, operadores.length, redireccionAbierta]);

  useEffect(() => () => {
    if (copyFeedbackTimeoutRef.current) window.clearTimeout(copyFeedbackTimeoutRef.current);
    if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
    if (!error) return undefined;

    errorTimeoutRef.current = window.setTimeout(() => {
      setError(null);
      errorTimeoutRef.current = null;
    }, ERROR_TOAST_DURATION_MS);

    return () => {
      if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    };
  }, [error]);

  useEffect(() => {
    if (!cancelacionAbierta) return undefined;
    setCancelCountdown(3);
    const interval = window.setInterval(() => {
      setCancelCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cancelacionAbierta]);

  function mostrarCopia(label: string) {
    if (copyFeedbackTimeoutRef.current) window.clearTimeout(copyFeedbackTimeoutRef.current);
    setCopyFeedback('¡' + label + ' copiado!');
    copyFeedbackTimeoutRef.current = window.setTimeout(() => setCopyFeedback(null), COPY_FEEDBACK_DURATION_MS);
  }

  function cerrarCopyFeedback() {
    if (copyFeedbackTimeoutRef.current) window.clearTimeout(copyFeedbackTimeoutRef.current);
    copyFeedbackTimeoutRef.current = null;
    setCopyFeedback(null);
  }

  function cerrarError() {
    if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = null;
    setError(null);
  }

  function bloquearAccionSinConexion() {
    setError(offlineCriticalActionMessage());
    return true;
  }

  function motivoFinalizacionPorDefecto() {
    return pedido?.mensaje_finalizacion_sin_comprobante
      ?? 'Listo, operacion exitosa, pero por factores ajenos a nosotros no es posible enviar el comprobante.';
  }

  function guardarFinalizacionOffline(
    observaciones?: string,
    options?: { finalizar_sin_comprobante?: boolean; motivo_sin_comprobante?: string },
  ) {
    if (!pedido) return;
    enqueueOfflineStateChange(pedido.codigo_operacion, 'completado', observaciones, options);
    const fecha = new Date().toISOString();
    setPedido((current) => current
      ? {
          ...current,
          estado: 'completado',
          updated_at: fecha,
          fecha_completado: fecha,
        }
      : current);
    setFinalizacionAbierta(false);
    setFinalizarSinComprobante(false);
    setMotivoSinComprobante('');
    setError('Finalizacion guardada en cola local. Se enviara automaticamente al volver la conexion.');
    vibrarFeedback(24);
    onChanged();
  }

  function copiarCampo(value: unknown, label = 'Dato') {
    void copiarTexto(value).then((copiado) => {
      if (!copiado) {
        setError('No se pudo copiar ' + label.toLowerCase());
        return;
      }
      setError(null);
      mostrarCopia(label);
    });
  }

  function copiaActiva(label: string) {
    return copyFeedback === '¡' + label + ' copiado!';
  }

  function cerrarDetalle() {
    onClose();
  }

  function iniciarMutacionPedido() {
    if (mutationInFlightRef.current) return false;
    mutationInFlightRef.current = true;
    return true;
  }

  function finalizarMutacionPedido() {
    mutationInFlightRef.current = false;
  }

  function limpiarEstadoUpload(scope?: UploadScope) {
    if (scope && uploadScope !== scope) return;
    setUploadScope(null);
    setUploadProgress(null);
    setUploadError(null);
    retryUploadRef.current = null;
  }

  async function ejecutarSubidaPedido({
    file,
    tipo,
    scope,
    label,
    uploadErrorMessage,
    afterUpload,
    afterUploadErrorMessage,
    useSaving = false,
  }: {
    file: File;
    tipo: string;
    scope: UploadScope;
    label: string;
    uploadErrorMessage: string;
    afterUpload?: (codigoOperacion: string) => Promise<void>;
    afterUploadErrorMessage?: string;
    useSaving?: boolean;
  }) {
    if (!canManage || !pedido || bloqueadoPorOtro || uploading || saving) return;
    if (offlineActionsBlocked) {
      bloquearAccionSinConexion();
      return;
    }

    const codigoOperacion = pedido.codigo_operacion;
    retryUploadRef.current = () => void ejecutarSubidaPedido({
      file,
      tipo,
      scope,
      label,
      uploadErrorMessage,
      afterUpload,
      afterUploadErrorMessage,
      useSaving,
    });

    if (!iniciarMutacionPedido()) return;
    const form = new FormData();
    form.set('tipo', tipo);
    form.set('archivo', file);
    setUploadScope(scope);
    setUploadProgress(0);
    setUploadError(null);
    setUploadLabel(label);
    setUploading(true);
    if (useSaving) setSaving(true);
    setError(null);

    try {
      try {
        await subirArchivo(codigoOperacion, form, {
          onProgress: (progress) => setUploadProgress(progress.percent),
        });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : uploadErrorMessage);
        return;
      }

      retryUploadRef.current = null;
      setUploadError(null);
      setUploadProgress(100);

      try {
        if (afterUpload) {
          await afterUpload(codigoOperacion);
        } else {
          setPedido(await obtenerPedido(codigoOperacion));
          onChanged();
        }
        setUploadScope(null);
      } catch (err) {
        setUploadScope(null);
        setError(err instanceof Error ? err.message : afterUploadErrorMessage ?? uploadErrorMessage);
      }
    } finally {
      finalizarMutacionPedido();
      setUploading(false);
      if (useSaving) setSaving(false);
    }
  }

  function abrirMensajeOperativoModal() {
    setWhatsappPendiente(null);
    setMensajeModalActivo('operativo');
  }

  function abrirModalWhatsApp(reenvio: WhatsAppPendiente | null) {
    setWhatsappPendiente(reenvio);
    setMensajeModalActivo(reenvio ? 'whatsapp' : null);
  }

  function cerrarModalWhatsApp() {
    setWhatsappPendiente(null);
    setMensajeModalActivo(null);
  }

  function abrirReenvioGrupoWhatsApp() {
    if (!pedido) return;
    const reenvio = reenvioWhatsAppGrupoPedido(pedido);
    if (!reenvio) {
      setError('No hay enlace de WhatsApp disponible para reenviar este mensaje');
      return;
    }
    abrirModalWhatsApp(reenvio);
  }

  function abrirReenvioClienteWhatsApp() {
    if (!pedido) return;
    const reenvio = reenvioWhatsAppCliente(pedido);
    if (!reenvio) {
      setError('No hay WhatsApp de cliente disponible para este pedido');
      return;
    }
    abrirModalWhatsApp(reenvio);
  }

  function abrirReenvioFinalizadoWhatsApp() {
    if (!pedido) return;
    const reenvio = notificacionWhatsAppEstado(pedido, 'completado');
    if (!reenvio) {
      setError('No hay mensaje de finalizacion disponible para reenviar');
      return;
    }
    abrirModalWhatsApp(reenvio);
  }

  function cerrarFinalizacion() {
    if (saving || uploading) return;
    setFinalizacionAbierta(false);
    setFinalizarSinComprobante(false);
    setMotivoSinComprobante('');
    limpiarEstadoUpload('final');
  }

  function alternarFinalizacionSinComprobante(checked: boolean) {
    if (saving || uploading) return;
    setFinalizarSinComprobante(checked);
    if (checked && !motivoSinComprobante.trim()) {
      setMotivoSinComprobante(motivoFinalizacionPorDefecto());
    }
  }

  async function cambiarEstadoRapido(nuevoEstado: string, observaciones?: string) {
    if (!canManage || !pedido || bloqueadoPorOtro || saving || pedido.estado === nuevoEstado) return;
    if (offlineActionsBlocked) {
      if (nuevoEstado === 'completado') {
        if (!tieneComprobanteFinal) {
          setError(null);
          setFinalizacionAbierta(true);
          setFinalizarSinComprobante(true);
          if (!motivoSinComprobante.trim()) setMotivoSinComprobante(motivoFinalizacionPorDefecto());
          return;
        }
        guardarFinalizacionOffline(observaciones);
        return;
      }
      bloquearAccionSinConexion();
      return;
    }
    if (nuevoEstado === 'pago_confirmado' && !tieneComprobantePago) {
      setError(null);
      setConfirmarPagoAbierto(true);
      setEvidenciasAbiertas(true);
      window.setTimeout(() => comprobantePagoInputRef.current?.click(), 0);
      return;
    }
    if (nuevoEstado === 'completado' && !tieneComprobanteFinal) {
      setError(null);
      setFinalizacionAbierta(true);
      return;
    }
    if (!iniciarMutacionPedido()) return;
    setSaving(true);
    setError(null);
    try {
      const actualizado = await actualizarEstado(pedido.codigo_operacion, nuevoEstado, observaciones);
      setPedido(actualizado);
      if (nuevoEstado === 'cancelado') {
        setCancelacionAbierta(false);
        setMotivoCancelacion('');
      }
      vibrarFeedback(24);
      onChanged();
      abrirModalWhatsApp(notificacionWhatsAppEstado(actualizado, nuevoEstado));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado');
    } finally {
      finalizarMutacionPedido();
      setSaving(false);
    }
  }

  async function enviarWhatsAppPendiente() {
    if (!whatsappPendiente?.url || compartiendoComprobante) return;
    const adjunto = whatsappPendiente.adjunto;

    if (!adjunto) {
      abrirWhatsAppUrl(whatsappPendiente.url);
      cerrarModalWhatsApp();
      if (pedido?.estado === 'completado') onClose();
      return;
    }

    setCompartiendoComprobante(true);
    setError(null);
    try {
      const response = await fetch(archivoUrl(adjunto));
      if (!response.ok) throw new Error('No se pudo descargar el adjunto');

      const blob = await response.blob();
      const nombre = adjunto.nombre_archivo
        || adjunto.ruta_archivo.split('/').pop()
        || (whatsappPendiente.adjuntoTipo === 'documento' ? 'documento' : 'comprobante');
      const file = new File(
        [blob],
        nombre,
        { type: adjunto.mime_type || blob.type || 'application/octet-stream' },
      );
      const shareData: ShareData = {
        title: whatsappPendiente.titulo,
        text: whatsappPendiente.mensaje,
        files: [file],
      };

      if (!navigator.share || (navigator.canShare && !navigator.canShare(shareData))) {
        throw new Error('Este navegador no permite compartir archivos directamente');
      }

      await navigator.share(shareData);
      cerrarModalWhatsApp();
      if (pedido?.estado === 'completado') onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(
        err instanceof Error
          ? `${err.message}. Abre el adjunto y compartelo manualmente por WhatsApp.`
          : 'No se pudo compartir el adjunto por WhatsApp',
      );
    } finally {
      setCompartiendoComprobante(false);
    }
  }

  function abrirCancelacion() {
    if (offlineActionsBlocked) {
      bloquearAccionSinConexion();
      return;
    }
    setError(null);
    setCancelacionAbierta(true);
  }

  function cerrarCancelacion() {
    if (saving) return;
    setCancelacionAbierta(false);
    setMotivoCancelacion('');
    setCancelCountdown(0);
  }

  function confirmarCancelacion() {
    if (offlineActionsBlocked) {
      bloquearAccionSinConexion();
      return;
    }
    const motivo = motivoCancelacion.trim();
    void cambiarEstadoRapido('cancelado', motivo || 'Cancelado por operador sin motivo especifico');
  }

  async function liberarPedidoActual() {
    if (!canManage || !pedido || !bloqueoPropio || saving) return;
    if (offlineActionsBlocked) {
      bloquearAccionSinConexion();
      return;
    }
    if (!iniciarMutacionPedido()) return;
    setSaving(true);
    setError(null);
    try {
      await liberarOperacion(pedido.codigo_operacion);
      vibrarFeedback(18);
      onChanged();
      onClose();
    } catch (err) {
      try {
        setPedido(await obtenerPedido(pedido.codigo_operacion));
        onChanged();
      } catch {
      }
      setError(err instanceof Error ? err.message : 'No se pudo liberar el pedido');
    } finally {
      finalizarMutacionPedido();
      setSaving(false);
    }
  }

  async function guardarRedireccion() {
    if (!canManage || !pedido || redirigiendo || saving) return;
    if (offlineActionsBlocked) {
      bloquearAccionSinConexion();
      return;
    }
    if (!bloqueoPropio) {
      setError(bloqueadoPorOtro ? 'Este pedido ya esta tomado por otro operador' : 'Espera a tomar este pedido antes de transferirlo');
      return;
    }
    if (!iniciarMutacionPedido()) return;
    setRedirigiendo(true);
    setError(null);
    try {
      const actualizado = await redirigirOperacion(pedido.codigo_operacion, {
        operador_destino_id: operadorDestino ? Number(operadorDestino) : null,
        mensaje: mensajeRedireccion,
      });
      setPedido(actualizado);
      vibrarFeedback(16);
      onChanged();
      if (operadorDestino && Number(operadorDestino) !== operadorId) onClose();
    } catch (err) {
      try {
        setPedido(await obtenerPedido(pedido.codigo_operacion));
        onChanged();
      } catch {
      }
      setError(err instanceof Error ? err.message : 'No se pudo redirigir el pedido');
    } finally {
      finalizarMutacionPedido();
      setRedirigiendo(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await ejecutarSubidaPedido({
      file,
      tipo: 'comprobante_cliente',
      scope: 'evidence',
      label: 'Subiendo comprobante',
      uploadErrorMessage: 'No se pudo subir el comprobante',
    });
  }

  async function handleComprobantePagoConfirmado(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await ejecutarSubidaPedido({
      file,
      tipo: 'comprobante_cliente',
      scope: 'payment',
      label: 'Subiendo comprobante',
      uploadErrorMessage: 'No se pudo subir el comprobante',
      afterUploadErrorMessage: 'No se pudo confirmar el pago',
      useSaving: true,
      afterUpload: async (codigoOperacion) => {
        const actualizado = await actualizarEstado(codigoOperacion, 'pago_confirmado');
        setPedido(actualizado);
        setConfirmarPagoAbierto(false);
        vibrarFeedback(24);
        onChanged();
        abrirModalWhatsApp(notificacionWhatsAppEstado(actualizado, 'pago_confirmado'));
      },
    });
  }

  async function handleComprobanteFinal(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await ejecutarSubidaPedido({
      file,
      tipo: 'comprobante_final',
      scope: 'final',
      label: 'Subiendo comprobante final',
      uploadErrorMessage: 'No se pudo subir el comprobante final',
      afterUploadErrorMessage: 'No se pudo finalizar la operacion',
      useSaving: true,
      afterUpload: async (codigoOperacion) => {
        const actualizado = await actualizarEstado(
          codigoOperacion,
          'completado',
          'Operacion finalizada con comprobante de exito.',
        );
        setPedido(actualizado);
        setFinalizacionAbierta(false);
        vibrarFeedback(24);
        onChanged();
        abrirModalWhatsApp(notificacionWhatsAppEstado(actualizado, 'completado'));
      },
    });
  }

  async function confirmarFinalizacionSinComprobante() {
    if (!canManage || !pedido || bloqueadoPorOtro || saving) return;
    const motivo = motivoSinComprobante.trim();
    if (motivo.length < 10) {
      setError('Explica brevemente por que no se pudo obtener el comprobante');
      return;
    }

    if (offlineActionsBlocked) {
      guardarFinalizacionOffline(undefined, {
        finalizar_sin_comprobante: true,
        motivo_sin_comprobante: motivo,
      });
      return;
    }

    if (!iniciarMutacionPedido()) return;
    setSaving(true);
    setError(null);
    try {
      const actualizado = await actualizarEstado(
        pedido.codigo_operacion,
        'completado',
        undefined,
        {
          finalizar_sin_comprobante: true,
          motivo_sin_comprobante: motivo,
        },
      );
      setPedido(actualizado);
      setFinalizacionAbierta(false);
      vibrarFeedback(24);
      onChanged();
      abrirModalWhatsApp(notificacionWhatsAppEstado(actualizado, 'completado'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo finalizar la operacion');
    } finally {
      finalizarMutacionPedido();
      setSaving(false);
    }
  }

  if (!codigo) return null;

  return (
    <section
      className="order-detail-page app-page-width"
      aria-label="Detalle de pedido"
      onTouchStart={iniciarDeslizamiento}
      onTouchEnd={finalizarDeslizamiento}
      onWheel={desplazarHorizontalmente}
    >
      {error && (
        <FloatingToast kind={error.includes('cola local') ? 'success' : 'error'} onDismiss={cerrarError}>{error}</FloatingToast>
      )}
      <PedidoDetailHeader
        codigo={pedido?.codigo_operacion ?? codigo}
        servicio={pedido ? servicioLabel(pedido.servicio) : undefined}
        moneda={pedido?.moneda_pago}
        onClose={cerrarDetalle}
      />
      {puedeNavegarPedidos && (
        <div className="order-swipe-navigation" role="status">
          <span>{indiceNavegacion + 1} de {codigosNavegacion?.length}</span>
          <small>Desliza horizontalmente para ver tus otros pedidos tomados</small>
        </div>
      )}
      <div className="order-detail-page-body">
        {loading && <PageLoader label="Cargando detalle" inline />}
        {!loading && !pedido && <div className="detail-panel empty">Sin detalle disponible</div>}
        {!loading && pedido && (
          <div className="detail-panel order-detail-surface">
          <OrderControlHead
            pedido={pedido}
            estado={estadoLabel(pedido.estado)}
            fecha={formatoFecha(pedido.created_at) ?? 'sin fecha'}
            bloqueoPropio={bloqueoPropio}
            bloqueadoPorOtro={bloqueadoPorOtro}
            saving={saving}
            offlineActionsBlocked={offlineActionsBlocked}
            hasMensajeOperativo={Boolean(pedido.mensaje_operacion)}
            onOpenMensajeOperativo={abrirMensajeOperativoModal}
            onRelease={canManage ? () => void liberarPedidoActual() : () => undefined}
          />

          {copyFeedback && (
            <div className="copy-toast" role="status">
              <span>{copyFeedback}</span>
              <button type="button" onClick={cerrarCopyFeedback} title="Cerrar notificacion" aria-label="Cerrar notificacion">
                <X size={16} />
              </button>
            </div>
          )}
          {bloqueoPropio && !ownLockNoticeHidden && (
            <div className="notice warning own-lock-notice compact-notice dismissible-notice">
              <span className="dismissible-notice-content">
                <Lock size={17} />
                <span>Has tomado este pedido. Seguirá bloqueado para los demás hasta que lo liberes o lo completes.</span>
              </span>
              <button type="button" onClick={() => setOwnLockNoticeHidden(true)} title="Cerrar notificacion" aria-label="Cerrar notificacion">
                <X size={15} />
              </button>
            </div>
          )}
          {bloqueadoPorOtro && (
            <DismissibleNotice className="notice warning compact-notice" role="alert">
              <><ShieldAlert size={17} /> En uso por {pedido.operador_asignado_nombre ?? 'otro operador'}. Puedes revisar, pero no editar.</>
            </DismissibleNotice>
          )}
          {offlineActionsBlocked && (
            <div className="notice warning compact-notice order-offline-action-notice" role="alert">
              <WifiOff size={17} />
              <span>Sin conexion. Puedes dejar la finalizacion sin comprobante en cola; las demas acciones quedan bloqueadas.</span>
            </div>
          )}
          {pedido.redirigido_a_operador_id && (
            <DismissibleNotice className={pedido.redirigido_a_operador_id === operadorId ? 'notice redirected own compact-notice' : 'notice redirected compact-notice'}>
              <><Send size={17} /> Marcado para {pedido.redirigido_a_operador_nombre ?? 'otro operador'}{pedido.redireccion_mensaje ? `: ${pedido.redireccion_mensaje}` : ''}</>
            </DismissibleNotice>
          )}

          <LiquidationCard
            pedido={pedido}
            tasa={tasaAplicadaPedido(pedido)}
            monedaEntrega={monedaEntrega}
            copied={copiaActiva}
            onCopy={copiarCampo}
          />

          {detalle.length > 0 && (
            <section className="order-detail-section operation-detail">
              <div className="order-section-heading">
                <FileText size={18} />
                <div>
                  <h3>Datos de operacion</h3>
                  <small>Campos principales para ejecutar sin volver a WhatsApp</small>
                </div>
              </div>
              <div className="detail-fields order-detail-fields">
                {detalle.map(([key, value], index) => {
                  if (key.startsWith('__slot_')) {
                    if (!evidenciaPrincipal) {
                      return <div key={key} className="operation-detail-placeholder" aria-hidden="true" />;
                    }

                    return (
                      <div key={key} className="operation-document-detail operation-evidence-detail">
                        <span>Evidencia</span>
                        <a href={archivoUrl(evidenciaPrincipal)} target="_blank" rel="noreferrer" aria-label="Ver evidencia completa">
                          {archivoEsImagen(evidenciaPrincipal) ? (
                            <img src={archivoUrl(evidenciaPrincipal)} alt="Evidencia del pedido" loading="lazy" decoding="async" />
                          ) : (
                            <span className="operation-evidence-file">
                              <FileText size={28} />
                              <strong>{evidenciaPrincipal.nombre_archivo ?? archivoTipoLabel(evidenciaPrincipal.tipo)}</strong>
                            </span>
                          )}
                          <small>Ver evidencia <ExternalLink size={14} /></small>
                        </a>
                      </div>
                    );
                  }

                  const copyable = camposCopiables.has(key);
                  const label = detalleLabel(key);
                  if (key === 'documento_identidad_url') {
                    const fotoUrl = apiAssetUrl(mostrarValor(value));
                    return (
                      <div key={key} className="operation-document-detail">
                        <span>{label}</span>
                        <a href={fotoUrl} target="_blank" rel="noreferrer" aria-label="Ver foto del documento completa">
                          <img src={fotoUrl} alt="Documento de identidad del destinatario" />
                          <small>Ver foto completa <ExternalLink size={14} /></small>
                        </a>
                      </div>
                    );
                  }

                  return (
                    <div key={key} className={[index === 0 ? 'primary-detail' : '', copyable ? 'copyable-detail' : ''].filter(Boolean).join(' ')}>
                      <span>{label}</span>
                      {copyable ? (
                        <button className={copiaActiva(label) ? 'copy-field-button copied' : 'copy-field-button'} type="button" onClick={() => copiarCampo(value, label)} aria-label={'Copiar ' + label}>
                          <strong>{mostrarDetalleValor(key, value)}</strong>
                          <Copy size={16} />
                        </button>
                      ) : (
                        <strong>{mostrarDetalleValor(key, value)}</strong>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {canManage && <CollapsibleOrderSection open={redireccionAbierta} className="order-redirect-section" icon={<Send size={17} />} label="Transferir a..." onToggle={() => setRedireccionAbierta((current) => !current)}>
              <div className="order-redirect-grid">
                <FloatingSelect
                  value={operadorDestino}
                  onChange={setOperadorDestino}
                  options={[{ value: '', label: 'Sin redireccion' }, ...operadores.map((item) => ({ value: String(item.id), label: item.nombre, description: item.rol }))]}
                  ariaLabel="Operador destino"
                  align="left"
                  disabled={redirigiendo || saving || offlineActionsBlocked || accionesRequierenBloqueo}
                />
                <input
                  value={mensajeRedireccion}
                  onChange={(event) => setMensajeRedireccion(event.target.value)}
                  placeholder="Nota breve"
                  disabled={redirigiendo || saving || offlineActionsBlocked || accionesRequierenBloqueo}
                />
                <button className="ghost-button" type="button" onClick={guardarRedireccion} disabled={offlineActionsBlocked || redirigiendo || saving || accionesRequierenBloqueo || (!operadorDestino && !pedido.redirigido_a_operador_id)}>
                  {redirigiendo ? <RefreshCw size={16} /> : <Send size={16} />}
                  {operadorDestino ? 'Marcar' : 'Transferir'}
                </button>
              </div>
          </CollapsibleOrderSection>}

          {pedido.mensaje_operacion && (
            <CollapsibleOrderSection open={mensajeAbierto} className="message-box order-message-box" icon={<MessageCircle size={17} />} label="Mensaje operativo" onToggle={() => setMensajeAbierto((current) => !current)}>
                <>
                  <div className="message-actions">
                    <button className="ghost-button" type="button" onClick={() => copiarCampo(pedido.mensaje_operacion ?? '', 'Mensaje')}>
                      <Copy size={16} /> Copiar mensaje
                    </button>
                    {(pedido.whatsapp_grupo_pedidos_url || pedido.whatsapp_url) && (
                      <button className="primary-button" type="button" onClick={abrirReenvioGrupoWhatsApp}>
                        <MessageCircle size={16} /> Reenviar WhatsApp
                      </button>
                    )}
                    {pedido.whatsapp_estado_url && pedido.mensaje_cliente_estado && (
                      <button className="ghost-button" type="button" onClick={abrirReenvioClienteWhatsApp}>
                        <MessageCircle size={16} /> Reenviar al cliente
                      </button>
                    )}
                    {pedido.estado === 'completado' && pedido.whatsapp_grupo_finalizado_url && (
                      <button className="ghost-button" type="button" onClick={abrirReenvioFinalizadoWhatsApp}>
                        <MessageCircle size={16} /> Reenviar finalizado
                      </button>
                    )}
                  </div>
                  <pre>{pedido.mensaje_operacion}</pre>
                </>
            </CollapsibleOrderSection>
          )}

          {confirmarPagoAbierto && (
            <section className="order-detail-section payment-proof-panel">
              <div className="order-section-heading">
                <Upload size={18} />
                <div>
                  <h3>Comprobante de pago</h3>
                  <small>Sube el comprobante para marcar el pago como recibido.</small>
                </div>
              </div>
              <label className={bloqueadoPorOtro || offlineActionsBlocked ? 'upload-button disabled-upload' : 'upload-button'}>
                <Upload size={16} /> {uploading ? 'Subiendo...' : 'Seleccionar comprobante'}
                <input
                  ref={comprobantePagoInputRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf,.doc,.docx"
                  onChange={handleComprobantePagoConfirmado}
                  disabled={bloqueadoPorOtro || offlineActionsBlocked || uploading || saving}
                />
              </label>
              <UploadStatus
                active={uploading && uploadScope === 'payment'}
                error={uploadScope === 'payment' ? uploadError : null}
                progress={uploadScope === 'payment' ? uploadProgress : null}
                label={uploadLabel}
                onRetry={retryUploadRef.current ?? undefined}
              />
              <button className="ghost-button" type="button" onClick={() => { setConfirmarPagoAbierto(false); limpiarEstadoUpload('payment'); }} disabled={uploading || saving}>
                Cancelar
              </button>
            </section>
          )}

          {finalizacionAbierta && (
            <Modal
              title="Finalizar operacion"
              subtitle={pedido.codigo_operacion}
              onClose={cerrarFinalizacion}
            >
              <div className="finalization-proof-panel finalization-modal-content" aria-label="Requisitos para finalizar">
              <div className="order-section-heading">
                <CheckCircle2 size={18} />
                <div>
                  <h3>Confirma la entrega</h3>
                  <small>Adjunta la confirmacion de que la entrega fue realizada.</small>
                </div>
              </div>

              <label className={bloqueadoPorOtro || offlineActionsBlocked ? 'upload-button disabled-upload' : 'upload-button'}>
                <Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir comprobante de exito'}
                <input
                  ref={comprobanteFinalInputRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf,.doc,.docx"
                  onChange={handleComprobanteFinal}
                  disabled={bloqueadoPorOtro || offlineActionsBlocked || uploading || saving}
                />
              </label>
              <UploadStatus
                active={uploading && uploadScope === 'final'}
                error={uploadScope === 'final' ? uploadError : null}
                progress={uploadScope === 'final' ? uploadProgress : null}
                label={uploadLabel}
                onRetry={retryUploadRef.current ?? undefined}
              />

              <div className="finalization-alternative"><span>o</span></div>

              <label
                className={finalizarSinComprobante ? 'finalization-exception-switch active' : 'finalization-exception-switch'}
              >
                <span className="finalization-switch-copy">
                  <strong>Finalizar sin comprobante</strong>
                  <small>Solo cuando la conexion o el proveedor no permiten obtener la confirmacion.</small>
                </span>
                <UiSwitch
                  checked={finalizarSinComprobante}
                  onChange={alternarFinalizacionSinComprobante}
                  ariaLabel="Finalizar sin comprobante"
                  disabled={saving || uploading}
                />
              </label>

              {finalizarSinComprobante && (
                <div className="finalization-exception-fields">
                  <label>
                    Explicacion para el registro
                    <textarea
                      value={motivoSinComprobante}
                      onChange={(event) => setMotivoSinComprobante(event.target.value)}
                      placeholder="Explicacion que quedara registrada en el historial."
                      rows={3}
                      disabled={saving}
                    />
                  </label>
                  <div className="notice warning compact-notice">
                    <ShieldAlert size={17} />
                    <span>La operacion quedara finalizada sin archivo y esta explicacion se guardara en el historial.</span>
                  </div>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void confirmarFinalizacionSinComprobante()}
                    disabled={saving || motivoSinComprobante.trim().length < 10}
                  >
                    <CheckCircle2 size={17} /> {saving ? 'Finalizando...' : offlineActionsBlocked ? 'Guardar en cola' : 'Confirmar sin comprobante'}
                  </button>
                </div>
              )}

              <button
                className="ghost-button"
                type="button"
                onClick={cerrarFinalizacion}
                disabled={uploading || saving}
              >
                Cancelar
              </button>
              </div>
            </Modal>
          )}

          {cancelacionAbierta && (
            <Modal
              title="Cancelar pedido"
              subtitle={pedido.codigo_operacion}
              onClose={cerrarCancelacion}
              className="order-cancel-modal"
            >
              <div className="order-cancel-confirm" aria-label="Confirmar cancelacion">
                <div className="order-cancel-critical">
                  <ShieldAlert size={18} />
                  <span>
                    Esta accion cambiara el pedido a cancelado y puede notificar al cliente.
                  </span>
                </div>
                <label>
                  Motivo de cancelacion
                  <textarea
                    value={motivoCancelacion}
                    onChange={(event) => setMotivoCancelacion(event.target.value)}
                    placeholder="Ejemplo: cliente no completo el pago, datos incorrectos, pedido duplicado..."
                    rows={3}
                    disabled={saving || offlineActionsBlocked}
                  />
                </label>
                <div className="order-cancel-confirm-actions">
                  <button className="ghost-button" type="button" onClick={cerrarCancelacion} disabled={saving}>
                    No, volver
                  </button>
                  <button className="danger-button order-cancel-confirm-button" type="button" onClick={confirmarCancelacion} disabled={offlineActionsBlocked || saving || cancelCountdown > 0}>
                    {saving ? 'Cancelando...' : cancelCountdown > 0 ? `Si, cancelar (${cancelCountdown})` : 'Si, cancelar'}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {whatsappPendiente && mensajeModalActivo === 'whatsapp' && (
            <Modal
              title={whatsappPendiente.titulo}
              subtitle={whatsappPendiente.detalle}
              onClose={cerrarModalWhatsApp}
            >
              <div className="whatsapp-message-preview">
                <label htmlFor="whatsapp-estado-pendiente">Mensaje que se enviara</label>
                <textarea
                  id="whatsapp-estado-pendiente"
                  value={whatsappPendiente.mensaje}
                  rows={8}
                  readOnly
                />
                {whatsappPendiente.adjunto && (
                  <a
                    className="whatsapp-attachment-preview"
                    href={archivoUrl(whatsappPendiente.adjunto)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={17} />
                    <span>
                      <strong>
                        {whatsappPendiente.adjuntoTipo === 'documento'
                          ? 'Documento adjunto'
                          : 'Comprobante adjunto'}
                      </strong>
                      <small>{whatsappPendiente.adjunto.nombre_archivo ?? 'Ver archivo'}</small>
                    </span>
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
              <div className="message-actions payment-modal-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => copiarCampo(whatsappPendiente.mensaje, 'Mensaje')}
                >
                  <Copy size={16} /> Copiar mensaje
                </button>
                {whatsappPendiente.clienteUrl && (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => abrirWhatsAppUrl(whatsappPendiente.clienteUrl)}
                  >
                    <MessageCircle size={17} /> Enviar al cliente
                  </button>
                )}
                {whatsappPendiente.url && (
                  <button
                    className={whatsappPendiente.clienteUrl ? 'ghost-button' : 'primary-button'}
                    type="button"
                    onClick={() => void enviarWhatsAppPendiente()}
                    disabled={compartiendoComprobante}
                  >
                    {compartiendoComprobante
                      ? 'Preparando adjunto...'
                      : whatsappPendiente.adjunto
                        ? whatsappPendiente.adjuntoTipo === 'documento'
                          ? 'Compartir mensaje y documento'
                          : 'Compartir mensaje y comprobante'
                        : 'Enviar al grupo por WhatsApp'}
                  </button>
                )}
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    cerrarModalWhatsApp();
                    if (pedido.estado === 'completado') onClose();
                  }}
                >
                  Enviar despues
                </button>
              </div>
            </Modal>
          )}

          {pedido.mensaje_operacion && mensajeModalActivo === 'operativo' && (
            <Modal
              title="Mensaje operativo"
              subtitle={pedido.codigo_operacion}
              onClose={() => setMensajeModalActivo(null)}
            >
              <div className="whatsapp-message-preview operational-message-modal">
                <label htmlFor="mensaje-operativo-reenvio">Mensaje operativo</label>
                <textarea
                  id="mensaje-operativo-reenvio"
                  value={pedido.mensaje_operacion}
                  rows={8}
                  readOnly
                />
              </div>
              <div className="message-actions payment-modal-actions">
                <button className="ghost-button" type="button" onClick={() => copiarCampo(pedido.mensaje_operacion ?? '', 'Mensaje')}>
                  <Copy size={16} /> Copiar mensaje
                </button>
                {(pedido.whatsapp_grupo_pedidos_url || pedido.whatsapp_url) && (
                  <button className="primary-button" type="button" onClick={abrirReenvioGrupoWhatsApp}>
                    <MessageCircle size={16} /> Reenviar WhatsApp
                  </button>
                )}
                {pedido.whatsapp_estado_url && pedido.mensaje_cliente_estado && (
                  <button className="ghost-button" type="button" onClick={abrirReenvioClienteWhatsApp}>
                    <MessageCircle size={16} /> Reenviar al cliente
                  </button>
                )}
                {pedido.estado === 'completado' && pedido.whatsapp_grupo_finalizado_url && (
                  <button className="ghost-button" type="button" onClick={abrirReenvioFinalizadoWhatsApp}>
                    <MessageCircle size={16} /> Reenviar finalizado
                  </button>
                )}
              </div>
            </Modal>
          )}

          <OrderEvidenceSection
            open={evidenciasAbiertas}
            archivos={pedido.archivos ?? []}
            uploading={uploading}
            uploadProgress={uploadScope === 'evidence' ? uploadProgress : null}
            uploadError={uploadScope === 'evidence' ? uploadError : null}
            disabled={!canManage || bloqueadoPorOtro || offlineActionsBlocked}
            onToggle={() => setEvidenciasAbiertas((current) => !current)}
            onUpload={handleUpload}
            onRetryUpload={retryUploadRef.current ?? undefined}
            archivoUrl={archivoUrl}
            archivoEsImagen={archivoEsImagen}
            archivoTipoLabel={archivoTipoLabel}
            formatoFecha={formatoFecha}
          />

          <OrderHistorySection
            open={historialAbierto}
            historial={pedido.historial ?? []}
            onToggle={() => setHistorialAbierto((current) => !current)}
            estadoLabel={estadoLabel}
            formatoFecha={formatoFecha}
          />

          {canManage && <div className="order-bottom-actions" role="group" aria-label="Acciones principales de pedido">
            <button className="danger-button order-cancel-action" type="button" onClick={abrirCancelacion} disabled={offlineActionsBlocked || bloqueadoPorOtro || saving || pedido.estado === 'cancelado' || pedido.estado === 'completado'} title={offlineActionsBlocked ? 'Sin conexion' : 'Cancelar'}>
              <X size={20} />
              <span>Cancelar</span>
            </button>
            <button className="primary-button order-primary-action" type="button" onClick={() => void cambiarEstadoRapido(proximoEstadoPrincipal)} disabled={accionPrincipalBloqueadaOffline || bloqueadoPorOtro || saving || pedido.estado === 'completado' || pedido.estado === 'cancelado'} title={accionPrincipalBloqueadaOffline ? 'Sin conexion' : accionPrincipalLabel}>
              {saving ? <RefreshCw size={18} /> : <CheckCircle2 size={18} />}
              {saving ? 'Procesando...' : accionPrincipalLabel}
            </button>
          </div>}
          </div>
        )}
      </div>
    </section>
  );
}
