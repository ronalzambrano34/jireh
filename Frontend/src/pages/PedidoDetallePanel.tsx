import { ChangeEvent, useEffect, useState } from 'react';
import { Copy, ExternalLink, Upload } from 'lucide-react';
import { Modal } from '../components/Modal';
import { actualizarEstado, liberarOperacion, obtenerPedido, renovarOperacion, subirArchivo, tomarOperacion } from '../api/client';
import type { PedidoDetalle } from '../types/api';

const estados = ['pendiente_pago', 'pago_confirmado', 'en_operacion', 'completado', 'cancelado'];

const detalleOrden: Record<string, string[]> = {
  transferencia: ['numero_tarjeta', 'telefono_destinatario', 'monto_cup'],
  efectivo: ['telefono_destinatario', 'documento_identidad_url', 'monto_cup', 'punto_recogida_id'],
  saldo: ['telefono_destinatario', 'saldo_cup'],
  divisa: ['tipo_tarjeta', 'numero_tarjeta', 'telefono_destinatario', 'monto_divisa'],
};

const detalleLabels: Record<string, string> = {
  numero_tarjeta: 'Tarjeta',
  telefono_destinatario: 'Telefono destinatario',
  monto_cup: 'Monto CUP',
  documento_identidad_url: 'Documento identidad',
  punto_recogida_id: 'Punto de recogida',
  saldo_cup: 'Saldo CUP',
  tipo_tarjeta: 'Tipo tarjeta',
  monto_divisa: 'Monto divisa',
};

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
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

export function PedidoDetallePanel({ codigo, operadorId, onChanged, onClose }: { codigo: string | null; operadorId: number; onChanged: () => void; onClose: () => void }) {
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const bloqueoPropio = Boolean(
    pedido?.lock_activo && pedido.operador_asignado_id === operadorId
  );
  const bloqueadoPorOtro = Boolean(
    pedido?.lock_activo && pedido.operador_asignado_id && pedido.operador_asignado_id !== operadorId
  );

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
        .then((data) => setPedido(data))
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
    if (!pedido) return;
    if (bloqueadoPorOtro) return;
    setError(null);
    try {
      const actualizado = await actualizarEstado(pedido.codigo_operacion, estado);
      setPedido(actualizado);
      onChanged();
      await cerrarDetalle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el estado');
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!pedido || bloqueadoPorOtro || !event.target.files?.[0]) return;
    setError(null);
    const form = new FormData();
    form.set('tipo', 'comprobante_cliente');
    form.set('archivo', event.target.files[0]);
    try {
      await subirArchivo(pedido.codigo_operacion, form);
      setPedido(await obtenerPedido(pedido.codigo_operacion));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el comprobante');
    }
  }

  if (!codigo) return null;

  return (
    <Modal title={pedido?.codigo_operacion ?? codigo} subtitle={pedido ? `${pedido.servicio} · ${pedido.moneda_pago}` : undefined} onClose={cerrarDetalle} wide>
      {loading && <div className="detail-panel empty">Cargando detalle...</div>}
      {!loading && !pedido && <div className="detail-panel empty">Sin detalle disponible</div>}
      {!loading && pedido && (
        <div className="detail-panel modal-detail-panel">
          <div className="detail-header">
        <div>
          <h2>{pedido.codigo_operacion}</h2>
          <p>{pedido.servicio} · {pedido.moneda_pago}</p>
        </div>
        <span className={`status ${pedido.estado}`}>{pedido.estado}</span>
      </div>
      {error && <div className="notice error">{error}</div>}
      {bloqueoPropio && <div className="notice success">Operacion tomada por ti. Se mantendra reservada mientras este panel siga abierto.</div>}
      {bloqueadoPorOtro && <div className="notice warning">En uso por {pedido.operador_asignado_nombre ?? 'otro operador'}. Puedes revisar, pero no editar.</div>}
      <dl className="metrics">
        <div><dt>Enviado</dt><dd>{pedido.monto_pago} {pedido.moneda_pago}</dd></div>
        <div><dt>Tasa</dt><dd>{pedido.tasa_final}</dd></div>
        <div><dt>Recibe</dt><dd>{pedido.monto_resultado}</dd></div>
      </dl>
      <div className="state-row">
        <select value={estado} onChange={(event) => setEstado(event.target.value)} disabled={bloqueadoPorOtro}>
          {estados.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className="primary-button" onClick={guardarEstado} disabled={bloqueadoPorOtro}>Guardar</button>
      </div>
      {detalleEntries(pedido).length > 0 && (
        <section className="operation-detail">
          <h3>Datos de operacion</h3>
          <div className="detail-fields">
            {detalleEntries(pedido).map(([key, value], index) => (
              <div key={key} className={index === 0 ? 'primary-detail' : undefined}>
                <span>{detalleLabel(key)}</span>
                <strong>{mostrarValor(value)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
      {pedido.mensaje_operacion && (
        <section className="message-box">
          <div className="message-actions">
            <button className="ghost-button" onClick={() => navigator.clipboard.writeText(pedido.mensaje_operacion ?? '')}>
              <Copy size={16} /> Copiar mensaje
            </button>
            {pedido.whatsapp_url && (
              <a className="ghost-button" href={pedido.whatsapp_url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> WhatsApp
              </a>
            )}
          </div>
          <pre>{pedido.mensaje_operacion}</pre>
        </section>
      )}
      <label className={bloqueadoPorOtro ? 'upload-button disabled-upload' : 'upload-button'}>
        <Upload size={16} /> Subir comprobante
        <input type="file" onChange={handleUpload} disabled={bloqueadoPorOtro} />
      </label>
          <div className="archivo-list">
            {(pedido.archivos ?? []).map((archivo) => (
              <div key={archivo.id} className="archivo-row">
                <strong>{archivo.tipo}</strong>
                <span>{archivo.nombre_archivo ?? archivo.ruta_archivo}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
