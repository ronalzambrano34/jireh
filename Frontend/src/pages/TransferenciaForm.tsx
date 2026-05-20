import { FormEvent, useState } from 'react';
import { crearTransferencia } from '../api/client';

export function TransferenciaForm({ operadorId, onCreated }: { operadorId: number; onCreated: (codigo: string) => void }) {
  const [form, setForm] = useState({
    monto_pago: '230',
    moneda_pago: 'BRL',
    numero_tarjeta: '',
    telefono_destinatario: '',
    tipo_pago_id: '1',
    nombre_cliente: '',
    numero_telefono_cliente: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        cliente_id: null,
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
          Metodo pago ID
          <input value={form.tipo_pago_id} onChange={(event) => update('tipo_pago_id', event.target.value)} inputMode="numeric" required />
        </label>
        <label>
          Tarjeta destinatario
          <input value={form.numero_tarjeta} onChange={(event) => update('numero_tarjeta', event.target.value)} required />
        </label>
        <label>
          Telefono destinatario Cuba
          <input value={form.telefono_destinatario} onChange={(event) => update('telefono_destinatario', event.target.value)} placeholder="12345678" />
        </label>
        <label>
          Telefono cliente
          <input value={form.numero_telefono_cliente} onChange={(event) => update('numero_telefono_cliente', event.target.value)} />
        </label>
        <label className="wide">
          Nombre cliente
          <input value={form.nombre_cliente} onChange={(event) => update('nombre_cliente', event.target.value)} />
        </label>
      </div>
      {error && <div className="notice error">{error}</div>}
      <button className="primary-button" disabled={loading}>{loading ? 'Creando...' : 'Crear transferencia'}</button>
    </form>
  );
}
