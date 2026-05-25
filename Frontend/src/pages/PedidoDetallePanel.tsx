import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Copy, ExternalLink, FileText, History, Lock, MessageCircle, RefreshCw, ShieldAlert, Upload } from 'lucide-react';
import { Modal } from '../components/Modal';
import { actualizarEstado, liberarOperacion, obtenerPedido, renovarOperacion, subirArchivo, tomarOperacion } from '../api/client';
import type { PedidoDetalle } from '../types/api';

const estados = [
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pago_confirmado', label: 'Pago confirmado' },
  { value: 'en_operacion', label: 'En operacion' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const detalleOrden: Record<string, string[]> = {
  transferencia: ['numero_tarjeta', 'telefono_destinatario', 'monto_cup'],
  efectivo: ['telefono_destinatario', 'documento_identidad_url', 'monto_cup', 'punto_recogida_id'],
  saldo: ['telefono_destinatario', 'saldo_cup'],
  divisa: ['tipo_tarjeta', 'numero_tarjeta', 'telefono_destinatario', 'monto_divisa'],
};

const detalleLabels: Record<string, string> = {
  numero_tarjeta: 'Tarjeta',
  telefono_destinatario: 'Telefono',
  monto_cup: 'Monto CUP',
  documento_identidad_url: 'Documento',
  punto_recogida_id: 'Punto de recogida',
  saldo_cup: 'Saldo CUP',
  tipo_tarjeta: 'Tipo tarjeta',
  monto_divisa: 'Monto divisa',
};

const camposCopiables = new Set([
  'numero_tarjeta',
  'telefono_destinatario',
  'monto_cup',
  'saldo_cup',
  'monto_divisa',
  'documento_identidad_url',
]);

function estadoLabel(value: string) {
  return estados.find((item) => item.value === value)?.label ?? value.replaceAll('_', ' ');
}

function detalleEntries(pedido: PedidoDetalle) {
  const detalle = pedido.detalle;
  if (!detalle) return [];

  const keys = detalleOrden[pedido.servicio] ?? [];
  const ordered = keys
    .filter((key) => detalle[key] !== null && detalle[key] !== undefined && detalle[key] !== '')
    .map((key) => [key, detalle[key]] as [string, unknown]);
  const extras = Object.entries(detalle)
    .filter(([key, value]) => !keys.includes(key) && value !== null && value !== undefined && value !== '');

  return [...ordered, ...extras];
}

function detalleLabel(key: string) {
  return detalleLabels[key] ?? key.replaceAll('_', ' ');
}

function mostrarValor(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
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

function copiarTexto(value: unknown) {
  void navigator.clipboard.writeText(mostrarValor(value));
}

function servicioLabel(value: string) {
  return value.replaceAll('_', ' ');
}

export function PedidoDetallePanel({ codigo, operadorId, onChanged, onClose }: { codigo: string | null; operadorId: number; onChanged: () => void; onClose: () => void }) {
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const bloqueoPropio = Boolean(pedido?.lock_activo && pedido.operador_asignado_id === operadorId);
  const bloqueadoPorOtro = Boolean(pedido?.lock_activo && pedido.operador_asignado_id && pedido.operador_asignado_id !== operadorId);
  const detalle = useMemo(() => (pedido ? detalleEntries(pedido) : []), [pedido]);
  const estadoCambiado = Boolean(pedido && estado && estado !== pedido.estado);

  useEffect(() => {
    if (!codigo) {
      setPedido(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    tomarOperacion(codigo)
      .then((data) => {
        if (!active) return;
        setPedido(data);
        setEstado(data.estado);
      })
      .catch(async (err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'No se pudo tomar la operacion');
        try {
          const data = await obtenerPedido(codigo);
          if (!active) return;
          setPedido(data);
          setEstado(data.estado);
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
    if (!codigo || !bloqueoPropio) return;

    const interval = window.setInterval(() => {
      renovarOperacion(codigo)
        .then((data) => {
          setPedido(data);
          setEstado(data.estado);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo renovar el bloqueo'));
    }, 45000);

    return () => window.clearInterval(interval);
  }, [bloqueoPropio, codigo]);

  async function cerrarDetalle() {
    const codigoActual = pedido?.codigo_operacion;
    const debeLiberar = Boolean(codigoActual && bloqueoPropio);
    onClose();
    if (debeLiberar && codigoActual) {
      try {
        await liberarOperacion(codigoActual);
        onChanged();
      } catch {
        // El bloqueo pudo vencer o pasar a otro operador; cerrar no debe bloquear la UI.
      }
    }
  }

  async function guardarEstado() {
    if (!pedido || bloqueadoPorOtro || !estadoCambiado) return;
    setSaving(true);
    setError(null);
    try {
      const actualizado = await actualizarEstado(pedido.codigo_operacion, estado);
      setPedido(actualizado);
      setEstado(actualizado.estado);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el estado');
    } finally {
      setSaving(false);
    }
  }

  async function finalizarYNotificar() {
    if (!pedido || bloqueadoPorOtro) return;
    setSaving(true);
    setError(null);
    try {
      const actualizado = await actualizarEstado(pedido.codigo_operacion, 'completado');
      setPedido(actualizado);
      setEstado(actualizado.estado);
      onChanged();
      const url = actualizado.whatsapp_url ?? pedido.whatsapp_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo finalizar la operacion');
    } finally {
      setSaving(false);
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

  if (!codigo) return null;

  return (
    <Modal title={pedido?.codigo_operacion ?? codigo} subtitle={pedido ? `${servicioLabel(pedido.servicio)} · ${pedido.moneda_pago}` : undefined} onClose={cerrarDetalle} wide>
      {loading && <div className="detail-panel empty">Cargando detalle...</div>}
      {!loading && !pedido && <div className="detail-panel empty">Sin detalle disponible</div>}
      {!loading && pedido && (
        <div className="detail-panel modal-detail-panel order-detail-surface">
          <section className="order-detail-hero">
            <div className="order-detail-title">
              <span className={`order-state-dot ${pedido.estado}`} />
              <div>
                <h2>{pedido.codigo_operacion}</h2>
                <p>{servicioLabel(pedido.servicio)} · creado {formatoFecha(pedido.created_at) ?? 'sin fecha'}</p>
              </div>
            </div>
            <div className="order-detail-status-stack">
              <span className={`status ${pedido.estado}`}>{estadoLabel(pedido.estado)}</span>
              {bloqueoPropio && <span className="lock-chip own"><Lock size={14} /> Tomado por ti</span>}
              {bloqueadoPorOtro && <span className="lock-chip blocked"><ShieldAlert size={14} /> En uso</span>}
            </div>
          </section>

          {error && <div className="notice error">{error}</div>}
          {bloqueoPropio && <div className="notice success"><CheckCircle2 size={17} /> Operacion reservada mientras mantengas abierto este detalle.</div>}
          {bloqueadoPorOtro && <div className="notice warning"><ShieldAlert size={17} /> En uso por {pedido.operador_asignado_nombre ?? 'otro operador'}. Puedes revisar, pero no editar.</div>}

          <dl className="order-detail-metrics">
            <div>
              <dt>Pagado</dt>
              <dd>{pedido.monto_pago} {pedido.moneda_pago}<button className="inline-copy-button" type="button" onClick={() => copiarTexto(`${pedido.monto_pago} ${pedido.moneda_pago}`)} title="Copiar pagado" aria-label="Copiar pagado"><Copy size={14} /></button></dd>
            </div>
            <div>
              <dt>Tasa final</dt>
              <dd>{pedido.tasa_final}</dd>
            </div>
            <div>
              <dt>Recibe</dt>
              <dd>{pedido.monto_resultado}<button className="inline-copy-button" type="button" onClick={() => copiarTexto(pedido.monto_resultado)} title="Copiar recibe" aria-label="Copiar recibe"><Copy size={14} /></button></dd>
            </div>
          </dl>

          <section className="order-detail-section order-state-section">
            <div className="order-section-heading">
              <Clock3 size={18} />
              <div>
                <h3>Estado operativo</h3>
                <small>{pedido.lock_expires_at && bloqueoPropio ? `Reserva hasta ${formatoFecha(pedido.lock_expires_at)}` : 'Cambios visibles para todo el equipo'}</small>
              </div>
            </div>
            <div className="order-state-grid">
              {estados.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={estado === item.value ? `state-option active ${item.value}` : `state-option ${item.value}`}
                  onClick={() => setEstado(item.value)}
                  disabled={bloqueadoPorOtro || saving}
                >
                  <span className={`order-state-dot ${item.value}`} />
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
            <button className="primary-button order-save-state" onClick={guardarEstado} disabled={bloqueadoPorOtro || !estadoCambiado || saving}>
              {saving ? <RefreshCw size={17} /> : <CheckCircle2 size={17} />}
              {saving ? 'Guardando...' : 'Guardar estado'}
            </button>
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
                {detalle.map(([key, value], index) => (
                  <div key={key} className={index === 0 ? 'primary-detail' : undefined}>
                    <span>{detalleLabel(key)}</span>
                    <strong>
                      {mostrarValor(value)}
                      {camposCopiables.has(key) && (
                        <button className="inline-copy-button" type="button" onClick={() => copiarTexto(value)} title={`Copiar ${detalleLabel(key)}`} aria-label={`Copiar ${detalleLabel(key)}`}>
                          <Copy size={14} />
                        </button>
                      )}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pedido.mensaje_operacion && (
            <section className="order-detail-section message-box order-message-box">
              <div className="order-section-heading">
                <MessageCircle size={18} />
                <div>
                  <h3>Mensaje operativo</h3>
                  <small>Listo para copiar o abrir en WhatsApp</small>
                </div>
              </div>
              <div className="message-actions">
                <button className="ghost-button" type="button" onClick={() => copiarTexto(pedido.mensaje_operacion ?? '')}>
                  <Copy size={16} /> Copiar mensaje
                </button>
                {pedido.whatsapp_url && (
                  <button className="primary-button whatsapp-finish-button" type="button" onClick={() => void finalizarYNotificar()} disabled={bloqueadoPorOtro || saving}>
                    <ExternalLink size={16} /> {saving ? 'Finalizando...' : 'Finalizar y notificar por WhatsApp'}
                  </button>
                )}
              </div>
              <pre>{pedido.mensaje_operacion}</pre>
            </section>
          )}

          <section className="order-detail-section order-evidence-section">
            <div className="order-section-heading">
              <Upload size={18} />
              <div>
                <h3>Evidencias</h3>
                <small>{(pedido.archivos ?? []).length} archivo(s) registrado(s)</small>
              </div>
            </div>
            <label className={bloqueadoPorOtro ? 'upload-button disabled-upload' : 'upload-button'}>
              <Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir comprobante'}
              <input type="file" onChange={handleUpload} disabled={bloqueadoPorOtro || uploading} />
            </label>
            <div className="archivo-list order-file-list">
              {(pedido.archivos ?? []).length === 0 && <div className="order-empty-line">Sin evidencias todavia</div>}
              {(pedido.archivos ?? []).map((archivo) => (
                <div key={archivo.id} className="archivo-row">
                  <strong>{archivo.tipo.replaceAll('_', ' ')}</strong>
                  <span>{archivo.nombre_archivo ?? archivo.ruta_archivo}</span>
                  {archivo.created_at && <small>{formatoFecha(archivo.created_at)}</small>}
                </div>
              ))}
            </div>
          </section>

          <section className="order-detail-section order-history-section">
            <div className="order-section-heading">
              <History size={18} />
              <div>
                <h3>Historial</h3>
                <small>Trazabilidad de cambios de estado</small>
              </div>
            </div>
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
          </section>
        </div>
      )}
    </Modal>
  );
}
