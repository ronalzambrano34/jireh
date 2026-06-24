import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { listarClientes } from '../api/client';
import type { Cliente } from '../types/api';
import { DismissibleNotice } from './DismissibleNotice';
import { PhoneInput } from './PhoneInput';
import { PasteButton } from './PasteButton';
import { separarTelefono } from '../utils/telefonos';

type ClienteLookupProps = {
  telefono: string;
  nombre: string;
  clienteId: string;
  onChange: (data: { telefono?: string; nombre?: string; clienteId?: string }) => void;
  onError?: (message: string | null) => void;
  defaultCode?: string;
};

function clienteResumen(cliente: Cliente) {
  const operaciones = cliente.total_operaciones !== undefined
    ? `${cliente.total_operaciones} ${cliente.total_operaciones === 1 ? 'operacion' : 'operaciones'}`
    : null;
  return [cliente.telefono, cliente.email, cliente.moneda_preferida, operaciones].filter(Boolean).join(' · ') || `Cliente #${cliente.id}`;
}

export function ClienteLookup({ telefono, nombre, clienteId, onChange, onError, defaultCode = '+55' }: ClienteLookupProps) {
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [busquedaHecha, setBusquedaHecha] = useState(false);
  const [clienteEncontradoOculto, setClienteEncontradoOculto] = useState(false);
  const [campoBusqueda, setCampoBusqueda] = useState<'telefono' | 'nombre'>(() => nombre.trim() ? 'nombre' : 'telefono');
  const telefonoLocal = useMemo(
    () => separarTelefono(telefono, defaultCode).local.replace(/\D/g, ''),
    [defaultCode, telefono],
  );
  const termino = campoBusqueda === 'nombre' ? nombre.trim() : telefono.trim();
  const terminoValido = campoBusqueda === 'nombre'
    ? termino.length >= 3
    : telefonoLocal.length >= 3;
  const resumen = clienteId
    ? `Historial vinculado #${clienteId}`
    : nombre || telefono
      ? `${nombre || 'Cliente sin nombre'}${telefono ? ` · ${telefono}` : ''}`
      : 'Se crea automaticamente si es nuevo';

  useEffect(() => {
    setClienteEncontradoOculto(false);
  }, [clienteId]);

  useEffect(() => {
    if (clienteId) {
      setResultados([]);
      setBuscando(false);
      setBusquedaHecha(false);
      return;
    }

    if (!terminoValido) {
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
  }, [clienteId, onError, termino, terminoValido]);

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
        <small>{buscando ? `Buscando por ${campoBusqueda}...` : clienteId ? resumen : 'Busca por nombre o telefono; si no existe, se registra al crear el pedido'}</small>
      </div>
      {resultados.length > 0 && (
        <div className="lookup-suggestions lookup-suggestions-above-phone" role="listbox" aria-label="Clientes encontrados">
          {resultados.map((cliente) => (
            <button type="button" key={cliente.id} onClick={() => seleccionar(cliente)} role="option">
              <span className="lookup-suggestion-copy">
                <strong>{cliente.nombre}</strong>
                <span>{clienteResumen(cliente)}</span>
              </span>
              <small>Usar cliente</small>
            </button>
          ))}
        </div>
      )}
      <div className="client-lookup">
        <label>
          Telefono / WhatsApp
          <PhoneInput
            value={telefono}
            onChange={(value) => {
              setCampoBusqueda('telefono');
              onChange({ telefono: value, clienteId: '' });
            }}
            defaultCode={defaultCode}
            pasteTitle="Pegar telefono del cliente"
            actions={(
              <button type="button" className="icon-button field-action-button" onClick={limpiar} title="Limpiar cliente" aria-label="Limpiar cliente">
                <X size={18} />
              </button>
            )}
          />
        </label>
        <label>
          Nombre del cliente
          <span className="input-action-row">
            <input
              value={nombre}
              onChange={(event) => {
                setCampoBusqueda('nombre');
                onChange({ nombre: event.target.value, clienteId: '' });
              }}
              placeholder="Escribe al menos 3 letras para buscar"
            />
            <PasteButton
              onPaste={(value) => {
                setCampoBusqueda('nombre');
                onChange({ nombre: value, clienteId: '' });
              }}
              title="Pegar nombre del cliente"
            />
          </span>
        </label>
        {clienteId && !clienteEncontradoOculto && (
          <div className="lookup-hit lookup-client-found dismissible-notice">
            <CheckCircle2 size={18} />
            <span><strong>Cliente encontrado</strong><small>Historial y contactos vinculados</small></span>
            <button type="button" onClick={() => setClienteEncontradoOculto(true)} title="Cerrar notificacion" aria-label="Cerrar notificacion">
              <X size={15} />
            </button>
          </div>
        )}
        {!clienteId && busquedaHecha && !buscando && terminoValido && resultados.length === 0 && (
          <DismissibleNotice className="lookup-hit lookup-new-client">Cliente nuevo. Se registrara al crear el pedido.</DismissibleNotice>
        )}
      </div>
    </section>
  );
}
