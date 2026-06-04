import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Copy, ExternalLink, FileText, History, Lock, MessageCircle, RefreshCw, Send, ShieldAlert, Unlock, Upload, X } from 'lucide-react';
import { PageLoader } from '../components/PageLoader';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { actualizarEstado, apiAssetUrl, liberarOperacion, listarOperadoresActivos, obtenerPedido, redirigirOperacion, subirArchivo, tomarOperacion } from '../api/client';
import type { ArchivoPedido, Operador, PedidoDetalle } from '../types/api';
import { abrirWhatsAppUrls } from '../utils/whatsapp';
import { FloatingSelect } from '../components/FloatingSelect';
import { formatearNumeroTarjeta } from '../utils/tarjetas';
import { copiarAlPortapapeles } from '../utils/clipboard';

const estados = [
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pago_confirmado', label: 'Pago confirmado' },
  { value: 'en_operacion', label: 'En operacion' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const detalleOrden: Record<string, string[]> = {
  transferencia: ['numero_tarjeta', 'telefono_destinatario', 'monto_cup'],
  efectivo: ['documento_identidad_url', 'telefono_destinatario', 'monto_cup', 'punto_recogida_id'],
  saldo: ['telefono_destinatario', 'saldo_cup'],
  divisa: ['tipo_tarjeta', 'numero_tarjeta', 'telefono_destinatario', 'monto_divisa'],
  otros: ['informacion_operacion'],
};

const detalleMontoKeys = ['monto_cup', 'monto_divisa', 'saldo_cup'];
const detallePrioridadOperativa = ['numero_tarjeta', 'telefono_destinatario', ...detalleMontoKeys];

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
  'documento_identidad_url',
]);
const COPY_FEEDBACK_DURATION_MS = 2600;
const ERROR_TOAST_DURATION_MS = 5200;

function estadoLabel(value: string) {
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

function archivoEsPdf(archivo: ArchivoPedido) {
  return archivo.mime_type === 'application/pdf' || /\.pdf$/i.test(archivo.ruta_archivo);
}

function archivoTipoLabel(tipo: string) {
  if (tipo === 'documento_identidad') return 'Documento';
  if (tipo === 'comprobante_cliente') return 'Comprobante';
  if (tipo === 'comprobante_final') return 'Comprobante final';
  if (tipo === 'captura_operador') return 'Captura';
  return tipo.replaceAll('_', ' ');
}

export function PedidoDetallePanel({ codigo, operadorId, onChanged, onClose }: { codigo: string | null; operadorId: number; onChanged: () => void; onClose: () => void }) {
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
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
  const [mensajeAbierto, setMensajeAbierto] = useState(false);
  const [evidenciasAbiertas, setEvidenciasAbiertas] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [ownLockNoticeHidden, setOwnLockNoticeHidden] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [cancelCountdown, setCancelCountdown] = useState(0);
  const comprobantePagoInputRef = useRef<HTMLInputElement | null>(null);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);

  const bloqueoPropio = Boolean(pedido?.lock_activo && pedido.operador_asignado_id === operadorId);
  const bloqueadoPorOtro = Boolean(pedido?.lock_activo && pedido.operador_asignado_id && pedido.operador_asignado_id !== operadorId);
  const detalle = useMemo(() => (pedido ? detalleEntries(pedido) : []), [pedido]);
  const monedaEntrega = pedido ? monedaEntregaPedido(pedido) : 'CUP';
  const tieneComprobantePago = Boolean(
    pedido?.comprobante_pago
    || pedido?.archivos?.some((archivo) => archivo.tipo === 'comprobante_cliente')
  );

  const proximoEstadoPrincipal = useMemo(() => {
    if (!pedido) return 'pago_confirmado';
    if (pedido.estado === 'pendiente_pago') return 'pago_confirmado';
    if (pedido.estado === 'pago_confirmado') return 'en_operacion';
    if (pedido.estado === 'en_operacion') return 'completado';
    return 'completado';
  }, [pedido]);

  const accionPrincipalLabel = useMemo(() => {
    if (!pedido) return 'Confirmar pago';
    if (pedido.estado === 'pendiente_pago') return 'Confirmar pago';
    if (pedido.estado === 'pago_confirmado') return 'Iniciar operacion';
    if (pedido.estado === 'en_operacion') return 'Finalizar';
    if (pedido.estado === 'completado') return 'Finalizado';
    return 'Confirmar';
  }, [pedido]);

  useEffect(() => {
    if (!codigo) {
      setPedido(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setMensajeAbierto(false);
    setEvidenciasAbiertas(false);
    setHistorialAbierto(false);
    setConfirmarPagoAbierto(false);
    setOwnLockNoticeHidden(false);
    tomarOperacion(codigo)
      .then((data) => {
        if (!active) return;
        setPedido(data);
      })
      .catch(async (err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'No se pudo tomar la operacion');
        try {
          const data = await obtenerPedido(codigo);
          if (!active) return;
          setPedido(data);
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

  async function cambiarEstadoRapido(nuevoEstado: string, observaciones?: string) {
    if (!pedido || bloqueadoPorOtro || saving || pedido.estado === nuevoEstado) return;
    if (nuevoEstado === 'pago_confirmado' && !tieneComprobantePago) {
      setError(null);
      setConfirmarPagoAbierto(true);
      setEvidenciasAbiertas(true);
      window.setTimeout(() => comprobantePagoInputRef.current?.click(), 0);
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
      abrirWhatsAppUrls(
        actualizado.whatsapp_grupo_pedidos_url,
        actualizado.whatsapp_grupo_finalizado_url,
        actualizado.whatsapp_estado_url,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado');
    } finally {
      setSaving(false);
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
      abrirWhatsAppUrls(
        actualizado.whatsapp_grupo_pedidos_url,
        actualizado.whatsapp_grupo_finalizado_url,
        actualizado.whatsapp_estado_url,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el comprobante y confirmar el pago');
    } finally {
      event.target.value = '';
      setUploading(false);
      setSaving(false);
    }
  }

  if (!codigo) return null;

  return (
    <section className="order-detail-page" aria-label="Detalle de pedido">
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
      <header className="order-detail-page-header">
        <button type="button" className="ghost-button order-detail-back" onClick={cerrarDetalle}>
          <X size={18} /> Volver
        </button>
        <div>
          <h2>{pedido?.codigo_operacion ?? codigo}</h2>
          {pedido && <p>{servicioLabel(pedido.servicio)} · {pedido.moneda_pago}</p>}
        </div>
      </header>
      <div className="order-detail-page-body">
        {loading && <PageLoader label="Cargando detalle" inline />}
        {!loading && !pedido && <div className="detail-panel empty">Sin detalle disponible</div>}
        {!loading && pedido && (
          <div className="detail-panel order-detail-surface">
          <section className="order-control-head">
            <div className="order-control-meta">
              <span className={`order-state-dot ${pedido.estado}`} />
              <span>{servicioLabel(pedido.servicio)} · {pedido.moneda_pago} · {formatoFecha(pedido.created_at) ?? 'sin fecha'}</span>
            </div>
            <div className="order-control-badges">
              <span className={`status ${pedido.estado}`}>{estadoLabel(pedido.estado)}</span>
              {bloqueoPropio && <span className="lock-chip own"><Lock size={14} /> Tomado por ti</span>}
              {bloqueadoPorOtro && <span className="lock-chip blocked"><ShieldAlert size={14} /> En uso</span>}
            </div>
            {bloqueoPropio && (
              <div className="order-management-actions" aria-label="Acciones de gestion del pedido">
                <button className="release-order-button" type="button" onClick={() => void liberarPedidoActual()} disabled={saving}>
                  <Unlock size={15} /> Liberar pedido
                </button>
              </div>
            )}
          </section>

          {copyFeedback && (
            <div className="copy-toast" role="status">
              <span>{copyFeedback}</span>
              <button type="button" onClick={cerrarCopyFeedback} title="Cerrar notificacion" aria-label="Cerrar notificacion">
                <X size={16} />
              </button>
            </div>
          )}
          {bloqueoPropio && !ownLockNoticeHidden && (
            <div className="notice success compact-notice dismissible-notice">
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

          <section className="liquidation-card" aria-label="Liquidacion de la orden">
            <div className="liquidation-cell">
              <span>Envia</span>
              <button className={copiaActiva('Pagado') ? 'liquidation-copy copied' : 'liquidation-copy'} type="button" onClick={() => copiarCampo(pedido.monto_pago + ' ' + pedido.moneda_pago, 'Pagado')}>
                <strong>{pedido.monto_pago}</strong>
                <small>{pedido.moneda_pago}</small>
              </button>
            </div>
            <div className="liquidation-rate">
              <span>x</span>
              <strong>{pedido.tasa_final}</strong>
            </div>
            <div className="liquidation-cell output">
              <span>Entrega</span>
              <button className={copiaActiva('Entrega') ? 'liquidation-copy copied' : 'liquidation-copy'} type="button" onClick={() => copiarCampo(pedido.monto_resultado + ' ' + monedaEntrega, 'Entrega')}>
                <strong>{pedido.monto_resultado}</strong>
                <small>{monedaEntrega}</small>
                <Copy size={15} />
              </button>
            </div>
          </section>

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
                    return <div key={key} className="operation-detail-placeholder" aria-hidden="true" />;
                  }

                  const copyable = camposCopiables.has(key);
                  const label = detalleLabel(key);
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

          <section className={redireccionAbierta ? 'order-detail-section order-redirect-section open' : 'order-detail-section order-redirect-section collapsed'}>
            <button className="secondary-action-toggle" type="button" onClick={() => setRedireccionAbierta((current) => !current)} aria-expanded={redireccionAbierta}>
              <span><Send size={17} /> Transferir a...</span>
              <ChevronDown size={17} />
            </button>
            {redireccionAbierta && (
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
            )}
          </section>

          {pedido.mensaje_operacion && (
            <section className={mensajeAbierto ? 'order-detail-section message-box order-message-box open' : 'order-detail-section message-box order-message-box collapsed'}>
              <button className="secondary-action-toggle" type="button" onClick={() => setMensajeAbierto((current) => !current)} aria-expanded={mensajeAbierto}>
                <span><MessageCircle size={17} /> Mensaje operativo</span>
                <ChevronDown size={17} />
              </button>
              {mensajeAbierto && (
                <>
                  <div className="message-actions">
                    <button className="ghost-button" type="button" onClick={() => copiarCampo(pedido.mensaje_operacion ?? '', 'Mensaje')}>
                      <Copy size={16} /> Copiar mensaje
                    </button>
                  </div>
                  <pre>{pedido.mensaje_operacion}</pre>
                </>
              )}
            </section>
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

          <section className={evidenciasAbiertas ? 'order-detail-section order-evidence-section open' : 'order-detail-section order-evidence-section collapsed'}>
            <button className="secondary-action-toggle" type="button" onClick={() => setEvidenciasAbiertas((current) => !current)} aria-expanded={evidenciasAbiertas}>
              <span><Upload size={17} /> Evidencias · {(pedido.archivos ?? []).length}</span>
              <ChevronDown size={17} />
            </button>
            {evidenciasAbiertas && (
              <>
                <label className={bloqueadoPorOtro ? 'upload-button disabled-upload' : 'upload-button'}>
                  <Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir comprobante'}
                  <input type="file" accept="image/*,application/pdf,.pdf,.doc,.docx" onChange={handleUpload} disabled={bloqueadoPorOtro || uploading} />
                </label>
                <div className="archivo-list order-file-list">
                  {(pedido.archivos ?? []).length === 0 && <div className="order-empty-line">Sin evidencias todavia</div>}
                  {(pedido.archivos ?? []).map((archivo) => (
                    <a key={archivo.id} className="archivo-row file-preview-card" href={archivoUrl(archivo)} target="_blank" rel="noreferrer">
                      <span className="file-preview-media">
                        {archivoEsImagen(archivo) ? (
                          <img src={archivoUrl(archivo)} alt="" loading="lazy" decoding="async" />
                        ) : archivoEsPdf(archivo) ? (
                          <FileText size={28} />
                        ) : (
                          <FileText size={28} />
                        )}
                      </span>
                      <span className="file-preview-copy">
                        <strong>{archivoTipoLabel(archivo.tipo)}</strong>
                        <span>{archivo.nombre_archivo ?? 'Archivo adjunto'}</span>
                        {archivo.created_at && <small>{formatoFecha(archivo.created_at)}</small>}
                      </span>
                      <ExternalLink size={16} />
                    </a>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className={historialAbierto ? 'order-detail-section order-history-section open' : 'order-detail-section order-history-section collapsed'}>
            <button className="secondary-action-toggle" type="button" onClick={() => setHistorialAbierto((current) => !current)} aria-expanded={historialAbierto}>
              <span><History size={17} /> Historial · {(pedido.historial ?? []).length}</span>
              <ChevronDown size={17} />
            </button>
            {historialAbierto && (
              <div className="order-history-list">
                {(pedido.historial ?? []).length === 0 && <div className="order-empty-line">Sin cambios de estado registrados</div>}
                {(pedido.historial ?? []).map((item) => (
                  <div key={item.id} className="order-history-row">
                    <span className={`order-state-dot ${item.estado_nuevo}`} />
                    <div>
                      <strong>{estadoLabel(item.estado_nuevo)}</strong>
                      <small>{item.usuario ?? 'Sistema'} · {formatoFecha(item.created_at) ?? 'sin fecha'}</small>
                      {item.estado_anterior && <small>Antes: {estadoLabel(item.estado_anterior)}</small>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

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
