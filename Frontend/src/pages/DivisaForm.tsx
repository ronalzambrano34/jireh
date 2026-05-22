import { FormEvent, useEffect, useMemo, useState } from 'react';
import { crearDivisa, listarMetodosPago } from '../api/client';
import { ClienteLookup } from '../components/ClienteLookup';
import type { MetodoPago } from '../types/api';

type DivisaInitialData = { monto_pago?: string; monto_divisa?: string; moneda_pago?: string; tipo_tarjeta?: string };

export function DivisaForm({ operadorId, onCreated, initialData }: { operadorId: number; onCreated: (codigo: string) => void; initialData?: DivisaInitialData }) {
  const [form, setForm] = useState({
    monto_pago: initialData?.monto_pago ?? '230',
    monto_divisa: initialData?.monto_divisa ?? '100',
    moneda_pago: initialData?.moneda_pago ?? 'BRL',
    tipo_pago_id: '',
    tipo_tarjeta: initialData?.tipo_tarjeta ?? 'MLC',
    numero_tarjeta: '',
    telefono_destinatario: '',
    cliente_id: '',
    nombre_cliente: '',
    numero_telefono_cliente: '',
    observaciones: '',
  });
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
        const primero = data.find((metodo) => metodo.moneda === form.moneda_pago);
        if (primero) {
          setForm((current) => ({ ...current, tipo_pago_id: String(primero.id) }));
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
      setForm((current) => ({ ...current, tipo_pago_id: String(metodosFiltrados[0].id) }));
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
      const response = await crearDivisa({
        monto_pago: Number(form.monto_pago),
        moneda_pago: form.moneda_pago,
        monto_divisa: Number(form.monto_divisa),
        tipo_pago_id: Number(form.tipo_pago_id),
        operador_id: operadorId,
        tipo_tarjeta: form.tipo_tarjeta || undefined,
        numero_tarjeta: form.numero_tarjeta || undefined,
        telefono_destinatario: form.telefono_destinatario || undefined,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        nombre_cliente: form.nombre_cliente || undefined,
        numero_telefono_cliente: form.numero_telefono_cliente || undefined,
        observaciones: form.observaciones || undefined,
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
              <option key={metodo.id} value={metodo.id}>{metodo.nombre} · {metodo.moneda}</option>
            ))}
          </select>
        </label>
        <label>
          Monto divisa
          <input value={form.monto_divisa} onChange={(event) => update('monto_divisa', event.target.value)} inputMode="decimal" required />
        </label>
        <label>
          Tipo tarjeta
          <select value={form.tipo_tarjeta} onChange={(event) => update('tipo_tarjeta', event.target.value)}>
            <option value="MLC">MLC</option>
            <option value="CUP">CUP</option>
            <option value="USD">USD</option>
            <option value="OTRA">Otra</option>
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
        <label className="wide">
          Observaciones
          <input value={form.observaciones} onChange={(event) => update('observaciones', event.target.value)} />
        </label>
      </div>
      {error && <div className="notice error">{error}</div>}
      <button className="primary-button" disabled={loading || !form.tipo_pago_id}>
        {loading ? 'Creando...' : 'Crear divisa'}
      </button>
    </form>
  );
}
