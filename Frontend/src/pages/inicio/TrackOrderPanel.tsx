import { useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardList, Clock3, Search } from 'lucide-react';
import { obtenerPedido } from '../../api/client';
import type { PedidoDetalle } from '../../types/api';

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

function stepIndex(pedido: PedidoDetalle | null) {
  if (!pedido) return 1;
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
  const [codigo, setCodigo] = useState('');
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codigoLimpio = codigo.trim().toUpperCase();
  const activeIndex = stepIndex(pedido);
  const completado = pedido?.estado === 'completado';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!codigoLimpio) return;
    setLoading(true);
    setError(null);
    setPedido(null);
    try {
      setPedido(await obtenerPedido(codigoLimpio));
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
        <span><h3>Rastrear pedido</h3><small>Codigo de operacion</small></span>
      </div>
      <form className="track-order-form" onSubmit={handleSubmit}>
        <label className="track-order-input">
          <Search size={17} />
          <input value={codigo} onChange={(event) => setCodigo(event.target.value)} placeholder="Ej. JH-3204-CUBA" autoComplete="off" spellCheck={false} aria-label="Codigo de operacion" />
        </label>
        <button className="primary-button" type="submit" disabled={!codigoLimpio || loading}>{loading ? 'Buscando...' : 'Rastrear'}</button>
      </form>
      {pedido && (
        <div className="track-order-steps" aria-hidden="true">
          <span className={stepClass(0, activeIndex, completado)}><CheckCircle2 size={16} /><small>Recibido</small></span>
          <span className={stepClass(1, activeIndex, completado)}><Clock3 size={16} /><small>Procesando</small></span>
          <span className={stepClass(2, activeIndex, completado)}><CheckCircle2 size={16} /><small>Completado</small></span>
        </div>
      )}
      {error && <div className="track-order-result error">{error}</div>}
      {pedido && (
        <div className={`track-order-result ${pedido.estado}`}>
          <span><small>Estado</small><strong>{estadoLabel(pedido.estado)}</strong></span>
          <span><small>Codigo</small><strong>{pedido.codigo_operacion}</strong></span>
          <button className="ghost-button" type="button" onClick={() => onTrackPedido(pedido.codigo_operacion)}>Abrir detalle</button>
        </div>
      )}
    </section>
  );
}
