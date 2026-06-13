import { ChangeEvent, TouchEvent, WheelEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, FileText, Lock, MessageCircle, RefreshCw, Send, ShieldAlert, Upload, X } from 'lucide-react';
import { PageLoader } from '../components/PageLoader';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { Modal } from '../components/Modal';
import { actualizarEstado, apiAssetUrl, liberarOperacion, listarOperadoresActivos, obtenerPedido, redirigirOperacion, subirArchivo, tomarOperacion } from '../api/client';
import type { ArchivoPedido, Operador, PedidoDetalle, PedidoResumen } from '../types/api';
import {
  abrirWhatsAppUrl,
} from '../utils/whatsapp';
import { FloatingSelect } from '../components/FloatingSelect';
import { formatearNumeroTarjeta } from '../utils/tarjetas';
import { copiarAlPortapapeles } from '../utils/clipboard';
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
  efectivo: ['documento_identidad_url', 'telefono_destinatario', 'monto_cup', 'punto_recogida_id'],
  saldo: ['telefono_destinatario', 'saldo_cup'],
  divisa: ['tipo_tarjeta', 'numero_tarjeta', 'telefono_destinatario', 'monto_divisa'],
  otros: ['documento_identidad_url', 'numero_tarjeta', 'telefono_destinatario', 'punto_recogida_id', 'informacion_operacion'],
};

const detalleMontoKeys = ['monto_cup', 'monto_divisa', 'saldo_cup'];

function tasaAplicadaPedido(pedido: PedidoDetalle) {
  if (pedido.servicio === 'saldo') return pedido.monto_pago;
  return pedido.tasa_final;
}
const detallePrioridadOperativa = ['numero_tarjeta', 'telefono_destinatario', ...detalleMontoKeys];

function notificacionWhatsAppEstado(pedido: PedidoDetalle, nuevoEstado: string) {
  if (nuevoEstado === 'completado') {
    const comprobante = pedido.archivos?.find((archivo) => archivo.tipo === 'comprobante_final')
      ?? pedido.archivos?.find((archivo) => archivo.tipo === 'comprobante_cliente')
      ?? null;
    return pedido.whatsapp_grupo_finalizado_url
      ? {
          titulo: 'Operacion completada',
          detalle: 'Mensaje listo para el grupo de operaciones finalizadas.',
          url: pedido.whatsapp_grupo_finalizado_url,
          mensaje: pedido.mensaje_grupo_finalizado ?? '',
          comprobante,
        }
      : null;
  }

  if (nuevoEstado === 'pago_confirmado') {
    return pedido.whatsapp_grupo_pedidos_url
      ? {
          titulo: 'Pago confirmado',
          detalle: 'Mensaje listo para el grupo de Operaciones.',
          url: pedido.whatsapp_grupo_pedidos_url,
          mensaje: pedido.mensaje_grupo_pedidos ?? '',
          comprobante: null,
        }
      : null;
  }

  return null;
}

const detalleLabels: Record<string, string> = {
  numero_tarjeta: 'Tarjeta',
  telefono_destinatario: 'Telefono',
  monto_cup: 'Monto CUP',
  documento_identidad_url: 'Foto documento',
  punto_recogida_id: 'Punto de recogida',
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
const ERROR_TOAST_DURATION_MS = 5200;
const ESTADOS_TERMINALES = new Set(['completado', 'cancelado']);

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
    .filter(([key, value]) => !presentes.has(key) && value !== null && value !== undefined && value !== '');

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

function archivoUrl(archivo: ArchivoPedido) {
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
  onChanged,
  onClose,
  codigosNavegacion,
  onNavigate,
}: {
  codigo: string | null;
  pedidoInicial?: PedidoResumen | null;
  operadorId: number;
  onChanged: () => void;
  onClose: () => void;
  codigosNavegacion?: string[];
  onNavigate?: (codigo: string) => void;
}) {
  const [pedido, setPedido] = useState<PedidoDetalle | null>(
    pedidoInicial as PedidoDetalle | null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [redirigiendo, setRedirigiendo] = useState(false);
  const [operadorDestino, setOperadorDestino] = useState('');
  const [mensajeRedireccion, setMensajeRedireccion] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [redireccionAbierta, setRedireccionAbierta] = useState(false);
  const [cancelacionAbierta, setCancelacionAbierta] = useState(false);
  const [confirmarPagoAbierto, setConfirmarPagoAbierto] = useState(false);
  const [whatsappPendiente, setWhatsappPendiente] = useState<{
    titulo: string;
    detalle: string;
    url: string;
    mensaje: string;
    comprobante: ArchivoPedido | null;
  } | null>(null);
  const [compartiendoComprobante, setCompartiendoComprobante] = useState(false);
  const [finalizacionAbierta, setFinalizacionAbierta] = useState(false);
  const [finalizarSinComprobante, setFinalizarSinComprobante] = useState(false);
  const [motivoSinComprobante, setMotivoSinComprobante] = useState('');
  const [mensajeAbierto, setMensajeAbierto] = useState(false);
  const [evidenciasAbiertas, setEvidenciasAbiertas] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [ownLockNoticeHidden, setOwnLockNoticeHidden] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [cancelCountdown, setCancelCountdown] = useState(0);
  const comprobantePagoInputRef = useRef<HTMLInputElement | null>(null);
  const comprobanteFinalInputRef = useRef<HTMLInputElement | null>(null);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastHorizontalNavigationRef = useRef(0);

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
    && !whatsappPendiente
    && !cancelacionAbierta
    && !redireccionAbierta
  );
  const detalle = useMemo(() => (pedido ? detalleEntries(pedido) : []), [pedido]);
  const evidenciaPrincipal = useMemo(() => {
    const archivos = pedido?.archivos ?? [];
    return archivos.find((archivo) => archivo.tipo === 'comprobante_cliente')
      ?? archivos.find((archivo) => archivo.tipo === 'comprobante_final')
      ?? archivos[0]
      ?? null;
  }, [pedido?.archivos]);
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

  useEffect(() => {
    if (!codigo) {
      setPedido(null);
      return;
    }

    let active = true;
    setPedido(pedidoInicial?.codigo_operacion === codigo ? pedidoInicial as PedidoDetalle : null);
    setLoading(!pedidoInicial || pedidoInicial.codigo_operacion !== codigo);
    setError(null);
    setMensajeAbierto(false);
    setEvidenciasAbiertas(false);
    setHistorialAbierto(false);
    setConfirmarPagoAbierto(false);
    setFinalizacionAbierta(false);
    setFinalizarSinComprobante(false);
    setMotivoSinComprobante('');
    setOwnLockNoticeHidden(false);
    obtenerPedido(codigo)
      .then(async (data) => {
        if (!active) return;
        setPedido(data);
        setLoading(false);
        if (ESTADOS_TERMINALES.has(data.estado)) {
          return;
        }

        const tomado = await tomarOperacion(codigo);
        if (!active) return;
        setPedido(tomado);
        if (!pedidoInicial?.lock_activo || pedidoInicial.operador_asignado_id !== operadorId) {
          onChanged();
        }
      })
      .catch(async (err) => {
        if (!active) return;
        try {
          const data = await obtenerPedido(codigo);
          if (!active) return;
          setPedido(data);
          if (!ESTADOS_TERMINALES.has(data.estado)) {
            setError(err instanceof Error ? err.message : 'No se pudo tomar la operacion');
          }
        } catch (detalleErr) {
          setError(detalleErr instanceof Error ? detalleErr.message : 'No se pudo cargar el pedido');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [codigo]);

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

  useEffect(() => {
    if (!redireccionAbierta || operadores.length > 0) return;

    let active = true;
    listarOperadoresActivos()
      .then((items) => {
        if (active) setOperadores(items.filter((item) => item.id !== operadorId && item.activo));
      })
      .catch(() => {
        if (active) setOperadores([]);
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

  function cerrarFinalizacion() {
    if (saving || uploading) return;
    setFinalizacionAbierta(false);
    setFinalizarSinComprobante(false);
    setMotivoSinComprobante('');
  }

  function alternarFinalizacionSinComprobante() {
    if (saving || uploading) return;
    const checked = !finalizarSinComprobante;
    setFinalizarSinComprobante(checked);
    if (checked && !motivoSinComprobante.trim()) {
      setMotivoSinComprobante(
        pedido?.mensaje_finalizacion_sin_comprobante
        ?? 'Listo, operacion exitosa, pero por factores ajenos a nosotros no es posible enviar el comprobante.',
      );
    }
  }

  async function cambiarEstadoRapido(nuevoEstado: string, observaciones?: string) {
    if (!pedido || bloqueadoPorOtro || saving || pedido.estado === nuevoEstado) return;
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
      setWhatsappPendiente(notificacionWhatsAppEstado(actualizado, nuevoEstado));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado');
    } finally {
      setSaving(false);
    }
  }

  async function enviarWhatsAppPendiente() {
    if (!whatsappPendiente || compartiendoComprobante) return;
    const comprobante = whatsappPendiente.comprobante;

    if (!comprobante) {
      abrirWhatsAppUrl(whatsappPendiente.url);
      setWhatsappPendiente(null);
      if (pedido?.estado === 'completado') onClose();
      return;
    }

    setCompartiendoComprobante(true);
    setError(null);
    try {
      const response = await fetch(archivoUrl(comprobante));
      if (!response.ok) throw new Error('No se pudo descargar el comprobante');

      const blob = await response.blob();
      const nombre = comprobante.nombre_archivo
        || comprobante.ruta_archivo.split('/').pop()
        || 'comprobante';
      const file = new File(
        [blob],
        nombre,
        { type: comprobante.mime_type || blob.type || 'application/octet-stream' },
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
      setWhatsappPendiente(null);
      if (pedido?.estado === 'completado') onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(
        err instanceof Error
          ? `${err.message}. Abre el comprobante y compartelo manualmente por WhatsApp.`
          : 'No se pudo compartir el comprobante por WhatsApp',
      );
    } finally {
      setCompartiendoComprobante(false);
    }
  }

  function abrirCancelacion() {
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
    const motivo = motivoCancelacion.trim();
    void cambiarEstadoRapido('cancelado', motivo || 'Cancelado por operador sin motivo especifico');
  }

  async function liberarPedidoActual() {
    if (!pedido || !bloqueoPropio || saving) return;
    setSaving(true);
    setError(null);
    try {
      await liberarOperacion(pedido.codigo_operacion);
      vibrarFeedback(18);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo liberar el pedido');
    } finally {
      setSaving(false);
    }
  }

  async function guardarRedireccion() {
    if (!pedido) return;
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
      setError(err instanceof Error ? err.message : 'No se pudo redirigir el pedido');
    } finally {
      setRedirigiendo(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!pedido || bloqueadoPorOtro || !event.target.files?.[0]) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.set('tipo', 'comprobante_cliente');
    form.set('archivo', event.target.files[0]);
    try {
      await subirArchivo(pedido.codigo_operacion, form);
      setPedido(await obtenerPedido(pedido.codigo_operacion));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el comprobante');
    } finally {
      event.target.value = '';
      setUploading(false);
    }
  }

  async function handleComprobantePagoConfirmado(event: ChangeEvent<HTMLInputElement>) {
    if (!pedido || bloqueadoPorOtro || !event.target.files?.[0]) return;
    setUploading(true);
    setSaving(true);
    setError(null);
    const form = new FormData();
    form.set('tipo', 'comprobante_cliente');
    form.set('archivo', event.target.files[0]);
    try {
      await subirArchivo(pedido.codigo_operacion, form);
      const actualizado = await actualizarEstado(pedido.codigo_operacion, 'pago_confirmado');
      setPedido(actualizado);
      setConfirmarPagoAbierto(false);
      vibrarFeedback(24);
      onChanged();
      setWhatsappPendiente(notificacionWhatsAppEstado(actualizado, 'pago_confirmado'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el comprobante y confirmar el pago');
    } finally {
      event.target.value = '';
      setUploading(false);
      setSaving(false);
    }
  }

  async function handleComprobanteFinal(event: ChangeEvent<HTMLInputElement>) {
    if (!pedido || bloqueadoPorOtro || !event.target.files?.[0]) return;
    setUploading(true);
    setSaving(true);
    setError(null);
    const form = new FormData();
    form.set('tipo', 'comprobante_final');
    form.set('archivo', event.target.files[0]);
    try {
      await subirArchivo(pedido.codigo_operacion, form);
      const actualizado = await actualizarEstado(
        pedido.codigo_operacion,
        'completado',
        'Operacion finalizada con comprobante de exito.',
      );
      setPedido(actualizado);
      setFinalizacionAbierta(false);
      vibrarFeedback(24);
      onChanged();
      setWhatsappPendiente(notificacionWhatsAppEstado(actualizado, 'completado'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el comprobante final');
    } finally {
      event.target.value = '';
      setUploading(false);
      setSaving(false);
    }
  }

  async function confirmarFinalizacionSinComprobante() {
    if (!pedido || bloqueadoPorOtro || saving) return;
    const motivo = motivoSinComprobante.trim();
    if (motivo.length < 10) {
      setError('Explica brevemente por que no se pudo obtener el comprobante');
      return;
    }

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
      setWhatsappPendiente(notificacionWhatsAppEstado(actualizado, 'completado'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo finalizar la operacion');
    } finally {
      setSaving(false);
    }
  }

  if (!codigo) return null;

  return (
    <section
      className="order-detail-page"
      aria-label="Detalle de pedido"
      onTouchStart={iniciarDeslizamiento}
      onTouchEnd={finalizarDeslizamiento}
      onWheel={desplazarHorizontalmente}
    >
      {error && (
        <div className="app-toast-stack" aria-live="polite">
          <div className="app-toast error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={cerrarError} title="Cerrar notificacion" aria-label="Cerrar notificacion">
              <X size={16} />
            </button>
          </div>
        </div>
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
            onRelease={() => void liberarPedidoActual()}
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
              <Lock size={17} />
              <span>Has tomado este pedido. Seguirá bloqueado para los demás hasta que lo liberes o lo completes.</span>
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

          <CollapsibleOrderSection open={redireccionAbierta} className="order-redirect-section" icon={<Send size={17} />} label="Transferir a..." onToggle={() => setRedireccionAbierta((current) => !current)}>
              <div className="order-redirect-grid">
                <FloatingSelect
                  value={operadorDestino}
                  onChange={setOperadorDestino}
                  options={[{ value: '', label: 'Sin redireccion' }, ...operadores.map((item) => ({ value: String(item.id), label: item.nombre, description: item.rol }))]}
                  ariaLabel="Operador destino"
                  align="left"
                />
                <input
                  value={mensajeRedireccion}
                  onChange={(event) => setMensajeRedireccion(event.target.value)}
                  placeholder="Nota breve"
                  disabled={redirigiendo}
                />
                <button className="ghost-button" type="button" onClick={guardarRedireccion} disabled={redirigiendo || (!operadorDestino && !pedido.redirigido_a_operador_id)}>
                  {redirigiendo ? <RefreshCw size={16} /> : <Send size={16} />}
                  {operadorDestino ? 'Marcar' : 'Transferir'}
                </button>
              </div>
          </CollapsibleOrderSection>

          {pedido.mensaje_operacion && (
            <CollapsibleOrderSection open={mensajeAbierto} className="message-box order-message-box" icon={<MessageCircle size={17} />} label="Mensaje operativo" onToggle={() => setMensajeAbierto((current) => !current)}>
                <>
                  <div className="message-actions">
                    <button className="ghost-button" type="button" onClick={() => copiarCampo(pedido.mensaje_operacion ?? '', 'Mensaje')}>
                      <Copy size={16} /> Copiar mensaje
                    </button>
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
              <label className={bloqueadoPorOtro ? 'upload-button disabled-upload' : 'upload-button'}>
                <Upload size={16} /> {uploading ? 'Subiendo...' : 'Seleccionar comprobante'}
                <input
                  ref={comprobantePagoInputRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf,.doc,.docx"
                  onChange={handleComprobantePagoConfirmado}
                  disabled={bloqueadoPorOtro || uploading || saving}
                />
              </label>
              <button className="ghost-button" type="button" onClick={() => setConfirmarPagoAbierto(false)} disabled={uploading || saving}>
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

              <label className={bloqueadoPorOtro ? 'upload-button disabled-upload' : 'upload-button'}>
                <Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir comprobante de exito'}
                <input
                  ref={comprobanteFinalInputRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf,.doc,.docx"
                  onChange={handleComprobanteFinal}
                  disabled={bloqueadoPorOtro || uploading || saving}
                />
              </label>

              <div className="finalization-alternative"><span>o</span></div>

              <button
                className={finalizarSinComprobante ? 'finalization-exception-switch active' : 'finalization-exception-switch'}
                type="button"
                role="switch"
                aria-checked={finalizarSinComprobante}
                onClick={alternarFinalizacionSinComprobante}
                disabled={saving || uploading}
              >
                <span className="finalization-switch-copy">
                  <strong>Finalizar sin comprobante</strong>
                  <small>Solo cuando la conexion o el proveedor no permiten obtener la confirmacion.</small>
                </span>
                <span className="finalization-switch-control" aria-hidden="true">
                  <span />
                </span>
              </button>

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
                    <CheckCircle2 size={17} /> {saving ? 'Finalizando...' : 'Confirmar sin comprobante'}
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

          {whatsappPendiente && (
            <Modal
              title={whatsappPendiente.titulo}
              subtitle={whatsappPendiente.detalle}
              onClose={() => setWhatsappPendiente(null)}
            >
              <div className="whatsapp-message-preview">
                <label htmlFor="whatsapp-estado-pendiente">Mensaje que se enviara</label>
                <textarea
                  id="whatsapp-estado-pendiente"
                  value={whatsappPendiente.mensaje}
                  rows={8}
                  readOnly
                />
                {whatsappPendiente.comprobante && (
                  <a
                    className="whatsapp-attachment-preview"
                    href={archivoUrl(whatsappPendiente.comprobante)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={17} />
                    <span>
                      <strong>Comprobante adjunto</strong>
                      <small>{whatsappPendiente.comprobante.nombre_archivo ?? 'Ver archivo'}</small>
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
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void enviarWhatsAppPendiente()}
                  disabled={compartiendoComprobante}
                >
                  {compartiendoComprobante
                    ? 'Preparando comprobante...'
                    : whatsappPendiente.comprobante
                      ? 'Compartir mensaje y comprobante'
                      : 'Enviar al grupo por WhatsApp'}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setWhatsappPendiente(null);
                    if (pedido.estado === 'completado') onClose();
                  }}
                >
                  Enviar despues
                </button>
              </div>
            </Modal>
          )}

          <OrderEvidenceSection
            open={evidenciasAbiertas}
            archivos={pedido.archivos ?? []}
            uploading={uploading}
            disabled={bloqueadoPorOtro}
            onToggle={() => setEvidenciasAbiertas((current) => !current)}
            onUpload={handleUpload}
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

          {cancelacionAbierta && (
            <section className="order-cancel-confirm" aria-label="Confirmar cancelacion">
              <div>
                <strong>Cancelar pedido</strong>
                <small>Esta accion cambiara el pedido a cancelado y puede notificar al cliente.</small>
              </div>
              <label>
                Motivo de cancelacion
                <textarea
                  value={motivoCancelacion}
                  onChange={(event) => setMotivoCancelacion(event.target.value)}
                  placeholder="Ejemplo: cliente no completo el pago, datos incorrectos, pedido duplicado..."
                  rows={3}
                  disabled={saving}
                />
              </label>
              <div className="order-cancel-confirm-actions">
                <button className="ghost-button" type="button" onClick={cerrarCancelacion} disabled={saving}>
                  No, volver
                </button>
                <button className="danger-button order-cancel-confirm-button" type="button" onClick={confirmarCancelacion} disabled={saving || cancelCountdown > 0}>
                  {saving ? 'Cancelando...' : cancelCountdown > 0 ? `Si, cancelar (${cancelCountdown})` : 'Si, cancelar'}
                </button>
              </div>
            </section>
          )}

          <div className="order-bottom-actions" role="group" aria-label="Acciones principales de pedido">
            <button className="danger-button order-cancel-action" type="button" onClick={abrirCancelacion} disabled={bloqueadoPorOtro || saving || pedido.estado === 'cancelado' || pedido.estado === 'completado'} title="Cancelar">
              <X size={20} />
              <span>Cancelar</span>
            </button>
            <button className="primary-button order-primary-action" type="button" onClick={() => void cambiarEstadoRapido(proximoEstadoPrincipal)} disabled={bloqueadoPorOtro || saving || pedido.estado === 'completado' || pedido.estado === 'cancelado'}>
              {saving ? <RefreshCw size={18} /> : <CheckCircle2 size={18} />}
              {saving ? 'Procesando...' : accionPrincipalLabel}
            </button>
          </div>
          </div>
        )}
      </div>
    </section>
  );
}
