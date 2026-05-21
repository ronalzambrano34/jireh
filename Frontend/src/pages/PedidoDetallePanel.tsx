import { ChangeEvent, useEffect, useState } from 'react';
import { Copy, ExternalLink, Upload } from 'lucide-react';
import { Modal } from '../components/Modal';
import { actualizarEstado, obtenerPedido, subirArchivo } from '../api/client';
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

export function PedidoDetallePanel({ codigo, onChanged, onClose }: { codigo: string | null; onChanged: () => void; onClose: () => void }) {
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!codigo) {
      setPedido(null);
      return;
    }
    setLoading(true);
    obtenerPedido(codigo)
      .then((data) => {
        setPedido(data);
        setEstado(data.estado);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el pedido'))
      .finally(() => setLoading(false));
  }, [codigo]);

  async function guardarEstado() {
    if (!pedido) return;
    const actualizado = await actualizarEstado(pedido.codigo_operacion, estado);
    setPedido(actualizado);
    onChanged();
    onClose();
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!pedido || !event.target.files?.[0]) return;
    const form = new FormData();
    form.set('tipo', 'comprobante_cliente');
    form.set('archivo', event.target.files[0]);
    await subirArchivo(pedido.codigo_operacion, form);
    setPedido(await obtenerPedido(pedido.codigo_operacion));
  }

  if (!codigo) return null;

  return (
    <Modal title={pedido?.codigo_operacion ?? codigo} subtitle={pedido ? `${pedido.servicio} · ${pedido.moneda_pago}` : undefined} onClose={onClose} wide>
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
      <dl className="metrics">
        <div><dt>Enviado</dt><dd>{pedido.monto_pago} {pedido.moneda_pago}</dd></div>
        <div><dt>Tasa</dt><dd>{pedido.tasa_final}</dd></div>
        <div><dt>Recibe</dt><dd>{pedido.monto_resultado}</dd></div>
      </dl>
      <div className="state-row">
        <select value={estado} onChange={(event) => setEstado(event.target.value)}>
          {estados.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className="primary-button" onClick={guardarEstado}>Guardar</button>
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
      <label className="upload-button">
        <Upload size={16} /> Subir comprobante
        <input type="file" onChange={handleUpload} />
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
