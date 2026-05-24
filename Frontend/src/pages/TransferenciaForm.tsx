import { FormEvent, useEffect, useMemo, useState } from 'react';
import { crearTransferencia, listarMetodosPago } from '../api/client';
import { ClienteLookup } from '../components/ClienteLookup';
import type { MetodoPago } from '../types/api';

type TransferenciaInitialData = { monto_pago?: string; moneda_pago?: string };

export function TransferenciaForm({ operadorId, onCreated, initialData }: { operadorId: number; onCreated: (codigo: string) => void; initialData?: TransferenciaInitialData }) {
  const [form, setForm] = useState({
    monto_pago: initialData?.monto_pago ?? '230',
    moneda_pago: initialData?.moneda_pago ?? 'BRL',
    numero_tarjeta: '',
    telefono_destinatario: '',
    tipo_pago_id: '1',
    cliente_id: '',
    nombre_cliente: '',
    numero_telefono_cliente: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [cargandoMetodos, setCargandoMetodos] = useState(false);

  const metodosFiltrados = useMemo(
    () => metodosPago.filter((metodo) => metodo.moneda === form.moneda_pago),
    [form.moneda_pago, metodosPago],
  );

  useEffect(() => {
    setCargandoMetodos(true);
    listarMetodosPago()
      .then((data) => {
        setMetodosPago(data);
        // Buscar Pix para BRL, sino el primero disponible
        const metodoSeleccionado = form.moneda_pago === 'BRL'
          ? data.find((metodo) => metodo.moneda === 'BRL' && metodo.nombre.toLowerCase() === 'pix')
          : data.find((metodo) => metodo.moneda === form.moneda_pago);
        if (metodoSeleccionado) {
          setForm((current) => ({ ...current, tipo_pago_id: String(metodoSeleccionado.id) }));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar los metodos de pago'))
      .finally(() => setCargandoMetodos(false));
  }, []);

  useEffect(() => {
    if (!metodosFiltrados.length) {
      setForm((current) => ({ ...current, tipo_pago_id: '' }));
      return;
    }

    const existe = metodosFiltrados.some((metodo) => String(metodo.id) === form.tipo_pago_id);
    if (!existe) {
      // Buscar Pix para BRL, sino el primero disponible
      const metodo = form.moneda_pago === 'BRL'
        ? metodosFiltrados.find((m) => m.nombre.toLowerCase() === 'pix')
        : metodosFiltrados[0];
      setForm((current) => ({ ...current, tipo_pago_id: String(metodo?.id || metodosFiltrados[0].id) }));
    }
  }, [form.moneda_pago, form.tipo_pago_id, metodosFiltrados]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await crearTransferencia({
        monto_pago: Number(form.monto_pago),
        moneda_pago: form.moneda_pago,
        numero_tarjeta: form.numero_tarjeta,
        telefono_destinatario: form.telefono_destinatario || undefined,
        tipo_pago_id: Number(form.tipo_pago_id),
        operador_id: operadorId,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        nombre_cliente: form.nombre_cliente || undefined,
        numero_telefono_cliente: form.numero_telefono_cliente || undefined,
      });
      onCreated(response.codigo_operacion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Monto pago
          <input value={form.monto_pago} onChange={(event) => update('monto_pago', event.target.value)} inputMode="decimal" required />
        </label>
        <label>
          Moneda
          <select value={form.moneda_pago} onChange={(event) => update('moneda_pago', event.target.value)}>
            <option value="BRL">BRL</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="UYU">UYU</option>
          </select>
        </label>
        <label>
          Metodo de pago
          <select
            value={form.tipo_pago_id}
            onChange={(event) => update('tipo_pago_id', event.target.value)}
            required
            disabled={cargandoMetodos || metodosFiltrados.length === 0}
          >
            {metodosFiltrados.length === 0 && <option value="">Sin metodos para {form.moneda_pago}</option>}
            {metodosFiltrados.map((metodo) => (
              <option key={metodo.id} value={metodo.id}>
                {metodo.nombre} · {metodo.moneda}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tarjeta destinatario
          <input value={form.numero_tarjeta} onChange={(event) => update('numero_tarjeta', event.target.value)} required />
        </label>
        <label>
          Telefono destinatario Cuba
          <input value={form.telefono_destinatario} onChange={(event) => update('telefono_destinatario', event.target.value)} placeholder="12345678" />
        </label>
        <ClienteLookup
          telefono={form.numero_telefono_cliente}
          nombre={form.nombre_cliente}
          clienteId={form.cliente_id}
          onChange={(data) => setForm((current) => ({
            ...current,
            numero_telefono_cliente: data.telefono ?? current.numero_telefono_cliente,
            nombre_cliente: data.nombre ?? current.nombre_cliente,
            cliente_id: data.clienteId ?? current.cliente_id,
          }))}
          onError={setError}
        />
      </div>
      {error && <div className="notice error">{error}</div>}
      <button className="primary-button" disabled={loading || !form.tipo_pago_id}>
        {loading ? 'Creando...' : 'Crear transferencia'}
      </button>
    </form>
  );
}
