import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { listarClientes } from '../api/client';
import type { Cliente } from '../types/api';
import { PhoneInput } from './PhoneInput';

type ClienteLookupProps = {
  telefono: string;
  nombre: string;
  clienteId: string;
  onChange: (data: { telefono?: string; nombre?: string; clienteId?: string }) => void;
  onError?: (message: string | null) => void;
};

function clienteResumen(cliente: Cliente) {
  return [cliente.telefono, cliente.email, cliente.moneda_preferida].filter(Boolean).join(' · ') || `Cliente #${cliente.id}`;
}

export function ClienteLookup({ telefono, nombre, clienteId, onChange, onError }: ClienteLookupProps) {
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [busquedaHecha, setBusquedaHecha] = useState(false);
  const termino = useMemo(() => (telefono || nombre).trim(), [nombre, telefono]);
  const resumen = clienteId
    ? `Historial vinculado #${clienteId}`
    : nombre || telefono
      ? `${nombre || 'Cliente sin nombre'}${telefono ? ` · ${telefono}` : ''}`
      : 'Se crea automaticamente si es nuevo';

  useEffect(() => {
    if (clienteId) {
      setResultados([]);
      setBuscando(false);
      setBusquedaHecha(false);
      return;
    }

    if (termino.length < 3) {
      setResultados([]);
      setBuscando(false);
      setBusquedaHecha(false);
      onError?.(null);
      return;
    }

    let cancelado = false;
    setBuscando(true);
    const timer = window.setTimeout(async () => {
      try {
        const clientes = await listarClientes(termino, false);
        if (cancelado) return;
        setResultados(clientes.slice(0, 5));
        setBusquedaHecha(true);
        onError?.(clientes.length ? null : 'Cliente nuevo: se registrara al crear el pedido sin interrumpir la orden');
      } catch {
        if (cancelado) return;
        setResultados([]);
        setBusquedaHecha(true);
        onError?.('No se pudo buscar clientes ahora');
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 320);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [clienteId, onError, termino]);

  function seleccionar(cliente: Cliente) {
    onChange({
      clienteId: String(cliente.id),
      telefono: cliente.telefono ?? telefono,
      nombre: cliente.nombre,
    });
    setResultados([]);
    setBusquedaHecha(false);
    onError?.(null);
  }

  function limpiar() {
    setResultados([]);
    setBusquedaHecha(false);
    onChange({ clienteId: '', nombre: '', telefono: '' });
    onError?.(null);
  }

  return (
    <section className="client-section wide compact-client-section">
      <div className="client-section-heading">
        <strong>Buscar o registrar cliente</strong>
        <small>{buscando ? 'Buscando coincidencias...' : resumen}</small>
      </div>
      <div className="client-lookup">
        <label>
          Telefono / WhatsApp del cliente
          <PhoneInput
            value={telefono}
            onChange={(value) => onChange({ telefono: value, clienteId: '' })}
            defaultCode="+55"
            pasteTitle="Pegar telefono del cliente"
            actions={(
              <button type="button" className="icon-button field-action-button" onClick={limpiar} title="Limpiar cliente" aria-label="Limpiar cliente">
                <X size={18} />
              </button>
            )}
          />
        </label>
        <label>
          Nombre cliente
          <input value={nombre} onChange={(event) => onChange({ nombre: event.target.value, clienteId: '' })} />
        </label>
        {resultados.length > 0 && (
          <div className="lookup-suggestions" role="listbox" aria-label="Clientes encontrados">
            {resultados.map((cliente) => (
              <button type="button" key={cliente.id} onClick={() => seleccionar(cliente)} role="option">
                <strong>{cliente.nombre}</strong>
                <span>{clienteResumen(cliente)}</span>
              </button>
            ))}
          </div>
        )}
        {clienteId && <div className="lookup-hit">Cliente encontrado. El historial y contactos quedan disponibles.</div>}
        {!clienteId && busquedaHecha && !buscando && termino.length >= 3 && resultados.length === 0 && <div className="lookup-hit lookup-new-client">Cliente nuevo. Se registrara al crear el pedido.</div>}
      </div>
    </section>
  );
}
