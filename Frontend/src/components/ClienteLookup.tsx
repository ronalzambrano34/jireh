import { useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { buscarClientePorTelefono } from '../api/client';
import type { Cliente } from '../types/api';

type ClienteLookupProps = {
  telefono: string;
  nombre: string;
  clienteId: string;
  onChange: (data: { telefono?: string; nombre?: string; clienteId?: string }) => void;
  onError?: (message: string | null) => void;
};

export function ClienteLookup({ telefono, nombre, clienteId, onChange, onError }: ClienteLookupProps) {
  const [open, setOpen] = useState(false);
  const resumen = clienteId
    ? `Cliente existente #${clienteId}`
    : nombre || telefono
      ? `${nombre || 'Cliente sin nombre'}${telefono ? ` · ${telefono}` : ''}`
      : 'Opcional para operarios';

  async function buscar() {
    onError?.(null);
    if (!telefono.trim()) {
      onError?.('Escribe el telefono del cliente para buscarlo');
      setOpen(true);
      return;
    }

    try {
      const cliente: Cliente = await buscarClientePorTelefono(telefono);
      onChange({
        clienteId: String(cliente.id),
        telefono: cliente.telefono ?? telefono,
        nombre: cliente.nombre,
      });
    } catch {
      onChange({ clienteId: '', nombre });
      onError?.('Cliente no encontrado; se creara al generar el pedido');
    }
  }

  function limpiar() {
    onChange({ clienteId: '', nombre: '', telefono: '' });
    onError?.(null);
  }

  return (
    <section className="client-section wide">
      <button type="button" className="client-section-toggle" onClick={() => setOpen((current) => !current)}>
        <span>
          <strong>Cliente</strong>
          <small>{resumen}</small>
        </span>
        <ChevronDown className={open ? 'rotated' : ''} size={18} />
      </button>

      {open && (
        <div className="client-lookup">
          <label>
            Telefono cliente
            <div className="lookup-row">
              <input value={telefono} onChange={(event) => onChange({ telefono: event.target.value, clienteId: '' })} />
              <button type="button" className="icon-button" onClick={buscar} title="Buscar cliente">
                <Search size={18} />
              </button>
              <button type="button" className="icon-button" onClick={limpiar} title="Limpiar cliente">
                <X size={18} />
              </button>
            </div>
          </label>
          <label>
            Nombre cliente
            <input value={nombre} onChange={(event) => onChange({ nombre: event.target.value })} />
          </label>
          {clienteId && <div className="lookup-hit">Cliente existente #{clienteId}</div>}
        </div>
      )}
    </section>
  );
}
