import { Search, X } from 'lucide-react';
import { buscarClientePorTelefono } from '../api/client';
import type { Cliente } from '../types/api';
import { PasteButton } from './PasteButton';

type ClienteLookupProps = {
  telefono: string;
  nombre: string;
  clienteId: string;
  onChange: (data: { telefono?: string; nombre?: string; clienteId?: string }) => void;
  onError?: (message: string | null) => void;
};

export function ClienteLookup({ telefono, nombre, clienteId, onChange, onError }: ClienteLookupProps) {
  const resumen = clienteId
    ? `Historial vinculado #${clienteId}`
    : nombre || telefono
      ? `${nombre || 'Cliente sin nombre'}${telefono ? ` · ${telefono}` : ''}`
      : 'Se crea automaticamente si es nuevo';

  async function buscar() {
    onError?.(null);
    if (!telefono.trim()) {
      onError?.('Escribe el telefono o WhatsApp del cliente para buscarlo');
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
      onError?.('Cliente nuevo: se registrara al crear el pedido sin interrumpir la orden');
    }
  }

  function limpiar() {
    onChange({ clienteId: '', nombre: '', telefono: '' });
    onError?.(null);
  }

  return (
    <section className="client-section wide compact-client-section">
      <div className="client-section-heading">
        <strong>Buscar o registrar cliente</strong>
        <small>{resumen}</small>
      </div>
      <div className="client-lookup">
        <label>
          Telefono / WhatsApp del cliente
          <div className="lookup-row lookup-row-with-paste">
            <input value={telefono} onChange={(event) => onChange({ telefono: event.target.value, clienteId: '' })} />
            <PasteButton onPaste={(value) => onChange({ telefono: value, clienteId: '' })} title="Pegar telefono del cliente" />
            <button type="button" className="icon-button field-action-button" onClick={buscar} title="Buscar cliente" aria-label="Buscar cliente">
              <Search size={18} />
            </button>
            <button type="button" className="icon-button field-action-button" onClick={limpiar} title="Limpiar cliente" aria-label="Limpiar cliente">
              <X size={18} />
            </button>
          </div>
        </label>
        <label>
          Nombre cliente
          <input value={nombre} onChange={(event) => onChange({ nombre: event.target.value })} />
        </label>
        {clienteId && <div className="lookup-hit">Cliente encontrado. El historial y contactos quedan disponibles.</div>}
      </div>
    </section>
  );
}
