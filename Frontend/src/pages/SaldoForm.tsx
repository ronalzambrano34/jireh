import { FormEvent, useEffect, useMemo, useState } from 'react';
import { crearSaldo, listarMetodosPago, listarPaquetesSaldo } from '../api/client';
import { ClienteLookup } from '../components/ClienteLookup';
import type { MetodoPago, PaqueteSaldo } from '../types/api';

type SaldoInitialData = { moneda_pago?: string; paquete_saldo_id?: string };

export function SaldoForm({ operadorId, onCreated, initialData }: { operadorId: number; onCreated: (codigo: string) => void; initialData?: SaldoInitialData }) {
  const [form, setForm] = useState({
    moneda_pago: initialData?.moneda_pago ?? 'BRL',
    tipo_pago_id: '',
    paquete_saldo_id: initialData?.paquete_saldo_id ?? '',
    telefono_destinatario: '',
    cliente_id: '',
    nombre_cliente: '',
    numero_telefono_cliente: '',
    observaciones: '',
  });
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [paquetes, setPaquetes] = useState<PaqueteSaldo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);

  const metodosFiltrados = useMemo(
    () => metodosPago.filter((metodo) => metodo.moneda === form.moneda_pago),
    [form.moneda_pago, metodosPago],
  );

  const paquetesFiltrados = useMemo(
    () => paquetes.filter((paquete) => paquete.moneda_pago === form.moneda_pago),
    [form.moneda_pago, paquetes],
  );

  useEffect(() => {
    setCargandoCatalogos(true);
    Promise.all([listarMetodosPago(), listarPaquetesSaldo()])
      .then(([metodos, paquetesData]) => {
        setMetodosPago(metodos);
        setPaquetes(paquetesData);
        // Buscar Pix para BRL, sino el primero disponible
        const metodo = form.moneda_pago === 'BRL'
          ? metodos.find((item) => item.moneda === 'BRL' && item.nombre.toLowerCase() === 'pix')
          : metodos.find((item) => item.moneda === form.moneda_pago);
        const paquete = paquetesData.find((item) => item.moneda_pago === form.moneda_pago);
        setForm((current) => ({
          ...current,
          tipo_pago_id: metodo ? String(metodo.id) : '',
          paquete_saldo_id: paquete ? String(paquete.id) : '',
        }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar los catalogos'))
      .finally(() => setCargandoCatalogos(false));
  }, []);

  useEffect(() => {
    if (metodosFiltrados.length) {
      const existe = metodosFiltrados.some((metodo) => String(metodo.id) === form.tipo_pago_id);
      if (!existe) {
        // Buscar Pix para BRL, sino el primero disponible
        const metodo = form.moneda_pago === 'BRL'
          ? metodosFiltrados.find((m) => m.nombre.toLowerCase() === 'pix')
          : metodosFiltrados[0];
        setForm((current) => ({ ...current, tipo_pago_id: String(metodo?.id || metodosFiltrados[0].id) }));
      }
    } else {
      setForm((current) => ({ ...current, tipo_pago_id: '' }));
    }

    if (paquetesFiltrados.length) {
      const existe = paquetesFiltrados.some((paquete) => String(paquete.id) === form.paquete_saldo_id);
      if (!existe) {
        setForm((current) => ({ ...current, paquete_saldo_id: String(paquetesFiltrados[0].id) }));
      }
    } else {
      setForm((current) => ({ ...current, paquete_saldo_id: '' }));
    }
  }, [form.moneda_pago, form.tipo_pago_id, form.paquete_saldo_id, metodosFiltrados, paquetesFiltrados]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await crearSaldo({
        telefono_destinatario: form.telefono_destinatario || undefined,
        tipo_pago_id: Number(form.tipo_pago_id),
        operador_id: operadorId,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        nombre_cliente: form.nombre_cliente || undefined,
        numero_telefono_cliente: form.numero_telefono_cliente || undefined,
        paquete_saldo_id: form.paquete_saldo_id ? Number(form.paquete_saldo_id) : null,
        moneda_pago: form.moneda_pago,
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
            disabled={cargandoCatalogos || metodosFiltrados.length === 0}
          >
            {metodosFiltrados.length === 0 && <option value="">Sin metodos para {form.moneda_pago}</option>}
            {metodosFiltrados.map((metodo) => (
              <option key={metodo.id} value={metodo.id}>{metodo.nombre} · {metodo.moneda}</option>
            ))}
          </select>
        </label>
        <label className="wide">
          Paquete de saldo
          <select
            value={form.paquete_saldo_id}
            onChange={(event) => update('paquete_saldo_id', event.target.value)}
            required
            disabled={cargandoCatalogos || paquetesFiltrados.length === 0}
          >
            {paquetesFiltrados.length === 0 && <option value="">Sin paquetes para {form.moneda_pago}</option>}
            {paquetesFiltrados.map((paquete) => (
              <option key={paquete.id} value={paquete.id}>
                {paquete.nombre} · {paquete.monto_pago} {paquete.moneda_pago} · {paquete.saldo_cup} CUP
              </option>
            ))}
          </select>
        </label>
        <label>
          Telefono destinatario Cuba
          <input value={form.telefono_destinatario} onChange={(event) => update('telefono_destinatario', event.target.value)} placeholder="12345678" required />
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
      <button className="primary-button" disabled={loading || !form.tipo_pago_id || !form.paquete_saldo_id}>
        {loading ? 'Creando...' : 'Crear saldo'}
      </button>
    </form>
  );
}
