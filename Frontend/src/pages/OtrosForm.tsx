import { FormEvent, useEffect, useMemo, useState } from 'react';
import { crearOtros, listarMetodosPago } from '../api/client';
import { ClienteLookup } from '../components/ClienteLookup';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { FloatingSelect } from '../components/FloatingSelect';
import { MetodoPagoSelect } from '../components/MetodoPagoSelect';
import { PageLoader } from '../components/PageLoader';
import type { MetodoPago, PedidoDetalle } from '../types/api';
import { banderaMoneda } from '../utils/monedas';
import { telefonoClienteCompleto } from '../utils/telefonos';

export function OtrosForm({ operadorId, onCreated }: { operadorId: number; onCreated: (pedido: PedidoDetalle) => void }) {
  const [form, setForm] = useState({
    monto_pago: '',
    moneda_pago: 'BRL',
    tipo_pago_id: '1',
    cuenta_pago_id: '',
    cliente_id: '',
    nombre_cliente: '',
    numero_telefono_cliente: '',
    observaciones: '',
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
      const metodo = form.moneda_pago === 'BRL'
        ? metodosFiltrados.find((item) => item.nombre.toLowerCase() === 'pix')
        : metodosFiltrados[0];
      setForm((current) => ({ ...current, tipo_pago_id: String(metodo?.id || metodosFiltrados[0].id) }));
    }
  }, [form.moneda_pago, form.tipo_pago_id, metodosFiltrados]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!telefonoClienteCompleto(form.numero_telefono_cliente)) {
      setError('El telefono/WhatsApp del cliente es obligatorio para enviarle las instrucciones de pago');
      return;
    }
    if (!form.observaciones.trim()) {
      setError('Escribe la informacion de la operacion');
      return;
    }
    if (!form.tipo_pago_id) {
      setError(`No hay un metodo de pago seleccionado para ${form.moneda_pago}`);
      return;
    }
    if (!(Number(form.monto_pago) > 0)) {
      setError('Escribe un monto de pago mayor que cero');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await crearOtros({
        servicio: 'otros',
        monto_pago: Number(form.monto_pago),
        moneda_pago: form.moneda_pago,
        tipo_pago_id: Number(form.tipo_pago_id),
        cuenta_pago_id: form.cuenta_pago_id ? Number(form.cuenta_pago_id) : null,
        operador_id: operadorId,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        nombre_cliente: form.nombre_cliente.trim() || form.numero_telefono_cliente,
        numero_telefono_cliente: form.numero_telefono_cliente || undefined,
        observaciones: form.observaciones.trim(),
      });
      onCreated(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-panel create-form-panel" onSubmit={handleSubmit} noValidate>
      <div className="form-flow">
        <section className="form-section-card client-step">
          <header className="form-section-header">
            <span className="form-step-number">1</span>
            <div>
              <h3>Datos del cliente</h3>
              <p>Quien paga o solicita la operacion.</p>
            </div>
          </header>
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
        </section>

        <section className="form-section-card">
          <header className="form-section-header">
            <span className="form-step-number">2</span>
            <div>
              <h3>Informacion de la operacion</h3>
              <p>Texto libre para pedidos especiales o casos no clasificados.</p>
            </div>
          </header>
          <label>
            Detalle
            <textarea value={form.observaciones} onChange={(event) => update('observaciones', event.target.value)} rows={7} placeholder="Ej: pago manual, gestion puntual, nota para el operador o cualquier dato necesario" required />
          </label>
        </section>

        <section className="form-section-card payment-section-card">
          <header className="form-section-header payment-section-header">
            <span className="form-step-number">3</span>
            <div>
              <h3>Pago de la operacion</h3>
              <p>Cantidad y metodo usado para pagar.</p>
            </div>
            <label className="payment-currency-picker" title="Moneda de pago">
              <FloatingSelect
                className="payment-currency-select"
                value={form.moneda_pago}
                onChange={(value) => update('moneda_pago', value)}
                ariaLabel="Moneda de pago"
                options={['BRL', 'USD', 'EUR', 'UYU'].map((moneda) => ({ value: moneda, label: moneda, icon: <span className="currency-flag" aria-hidden="true">{banderaMoneda(moneda)}</span> }))}
              />
            </label>
          </header>
          <div className="form-grid payment-grid">
            <label>
              Metodo de pago
              <MetodoPagoSelect
                value={form.tipo_pago_id}
                metodos={metodosFiltrados}
                onChange={(value) => update('tipo_pago_id', value)}
                cuentaValue={form.cuenta_pago_id}
                onCuentaChange={(value) => update('cuenta_pago_id', value)}
                disabled={cargandoMetodos || metodosFiltrados.length === 0}
                emptyLabel={`Sin metodos para ${form.moneda_pago}`}
              />
            </label>
            <label>
              Monto pago
              <input value={form.monto_pago} onChange={(event) => update('monto_pago', event.target.value)} onFocus={(event) => event.currentTarget.select()} inputMode="decimal" placeholder="230" required />
            </label>
          </div>
        </section>
      </div>
      {error && <DismissibleNotice className="notice error" role="alert" onDismiss={() => setError(null)}>{error}</DismissibleNotice>}
      {loading && <PageLoader label="Creando pedido" inline />}
      <button className="primary-button create-submit-button" type="submit" disabled={loading}>
        {loading ? 'Creando...' : 'Crear otros'}
      </button>
    </form>
  );
}
