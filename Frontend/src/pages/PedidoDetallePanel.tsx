import { ChangeEvent, useEffect, useState } from 'react';
import { Copy, Upload } from 'lucide-react';
import { actualizarEstado, obtenerPedido, subirArchivo } from '../api/client';
import type { PedidoDetalle } from '../types/api';

const estados = ['pendiente_pago', 'pago_confirmado', 'en_operacion', 'completado', 'cancelado'];

export function PedidoDetallePanel({ codigo, onChanged }: { codigo: string | null; onChanged: () => void }) {
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
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!pedido || !event.target.files?.[0]) return;
    const form = new FormData();
    form.set('tipo', 'comprobante_cliente');
    form.set('archivo', event.target.files[0]);
    await subirArchivo(pedido.codigo_operacion, form);
    setPedido(await obtenerPedido(pedido.codigo_operacion));
  }

  if (!codigo) return <aside className="detail-panel empty">Selecciona un pedido</aside>;
  if (loading) return <aside className="detail-panel empty">Cargando detalle...</aside>;
  if (!pedido) return <aside className="detail-panel empty">Sin detalle disponible</aside>;

  return (
    <aside className="detail-panel">
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
      {pedido.mensaje_operacion && (
        <section className="message-box">
          <button className="ghost-button" onClick={() => navigator.clipboard.writeText(pedido.mensaje_operacion ?? '')}>
            <Copy size={16} /> Copiar mensaje
          </button>
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
    </aside>
  );
}
