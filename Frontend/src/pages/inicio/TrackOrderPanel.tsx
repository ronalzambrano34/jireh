import { useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardList, Clock3, Search } from 'lucide-react';
import { obtenerPedido, rastrearPedidosPorCliente } from '../../api/client';
import { FloatingToast } from '../../components/FloatingToast';
import type { PedidoResumen } from '../../types/api';

function estadoLabel(value: string) {
  const labels: Record<string, string> = {
    pendiente_pago: 'Pendiente pago',
    pago_confirmado: 'Pago confirmado',
    en_operacion: 'Pago confirmado',
    completado: 'Completado',
    cancelado: 'Cancelado',
  };
  return labels[value] ?? value.replaceAll('_', ' ');
}

function stepIndex(pedido: PedidoResumen) {
  if (pedido.estado === 'completado') return 2;
  if (pedido.estado === 'pendiente_pago') return 0;
  return 1;
}

function stepClass(index: number, activeIndex: number, completado: boolean) {
  if (completado || index < activeIndex) return 'done';
  if (index === activeIndex) return 'active';
  return '';
}

export function TrackOrderPanel({ onTrackPedido }: { onTrackPedido: (codigo: string) => void }) {
  const [termino, setTermino] = useState('');
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terminoLimpio = termino.trim();
  const esNumeroCliente = /^\d+$/.test(terminoLimpio);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!terminoLimpio) return;
    setLoading(true);
    setError(null);
    setPedidos([]);
    try {
      const encontrados = esNumeroCliente
        ? await rastrearPedidosPorCliente(Number(terminoLimpio))
        : [await obtenerPedido(terminoLimpio.toUpperCase())];
      setPedidos(encontrados);
      if (esNumeroCliente && encontrados.length === 0) {
        setError('El cliente no tiene pedidos en curso');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rastrear el pedido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="track-order-panel" aria-label="Rastrear pedido">
      <div className="track-order-head">
        <span className="track-order-icon"><ClipboardList size={22} /></span>
        <span><h3>Rastrear pedido</h3><small>Codigo de operacion o numero de cliente</small></span>
      </div>
      <form className="track-order-form" onSubmit={handleSubmit}>
        <label className="track-order-input">
          <Search size={17} />
          <input value={termino} onChange={(event) => setTermino(event.target.value)} placeholder="Ej. JH-3204-CUBA o 125" autoComplete="off" spellCheck={false} aria-label="Codigo de operacion o numero de cliente" />
        </label>
        <button className="primary-button" type="submit" disabled={!terminoLimpio || loading}>{loading ? 'Buscando...' : 'Rastrear'}</button>
      </form>
      {error && <FloatingToast onDismiss={() => setError(null)}>{error}</FloatingToast>}
      {pedidos.map((pedido) => {
        const activeIndex = stepIndex(pedido);
        const completado = pedido.estado === 'completado';
        return (
          <div className="track-order-match" key={pedido.codigo_operacion}>
            <div className="track-order-steps" aria-hidden="true">
              <span className={stepClass(0, activeIndex, completado)}><CheckCircle2 size={16} /><small>Recibido</small></span>
              <span className={stepClass(1, activeIndex, completado)}><Clock3 size={16} /><small>Procesando</small></span>
              <span className={stepClass(2, activeIndex, completado)}><CheckCircle2 size={16} /><small>Completado</small></span>
            </div>
            <div className={`track-order-result ${pedido.estado}`}>
              <span><small>Estado</small><strong>{estadoLabel(pedido.estado)}</strong></span>
              <span><small>Codigo</small><strong>{pedido.codigo_operacion}</strong></span>
              <button className="ghost-button" type="button" onClick={() => onTrackPedido(pedido.codigo_operacion)}>Abrir detalle</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
