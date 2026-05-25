import { FormEvent, useEffect, useMemo, useState } from 'react';
import { crearDivisa, listarMetodosPago } from '../api/client';
import { CalculoPreview } from '../components/CalculoPreview';
import { ClienteLookup } from '../components/ClienteLookup';
import { ContactosRecientes } from '../components/ContactosRecientes';
import { MetodoPagoSelect } from '../components/MetodoPagoSelect';
import { PasteButton } from '../components/PasteButton';
import type { CalculoOperacionResponse, Contacto, MetodoPago } from '../types/api';
import { banderaMoneda } from '../utils/monedas';

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
    bonificacion_manual: '',
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

  const calculo = useMemo<CalculoOperacionResponse | null>(() => {
    const montoPago = Number(form.monto_pago) || 0;
    const montoDivisa = Number(form.monto_divisa) || 0;
    if (montoPago <= 0 || montoDivisa <= 0) return null;
    const tasa = montoDivisa / montoPago;
    return { monto_resultado: montoDivisa, tasa, tasa_final: tasa };
  }, [form.monto_pago, form.monto_divisa]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function aplicarContacto(contacto: Contacto) {
    setForm((current) => ({
      ...current,
      tipo_tarjeta: contacto.tipo_tarjeta ?? current.tipo_tarjeta,
      numero_tarjeta: contacto.numero_tarjeta ?? current.numero_tarjeta,
      telefono_destinatario: contacto.telefono ?? current.telefono_destinatario,
    }));
  }

  function observacionesConBono() {
    const bono = form.bonificacion_manual.trim();
    const observaciones = form.observaciones.trim();
    if (!bono) return observaciones || undefined;
    return [observaciones, `Cupon/bono: ${bono}`].filter(Boolean).join(' | ');
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
        observaciones: observacionesConBono(),
      });
      onCreated(response.codigo_operacion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-panel create-form-panel" onSubmit={handleSubmit}>
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
              <h3>Tarjeta destino</h3>
              <p>Tipo, tarjeta y telefono del destinatario.</p>
            </div>
          </header>
          <div className="form-grid">
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
              <span className="input-action-row">
                <input value={form.numero_tarjeta} onChange={(event) => update('numero_tarjeta', event.target.value)} required />
                <PasteButton onPaste={(value) => update('numero_tarjeta', value)} title="Pegar tarjeta destinatario" />
              </span>
            </label>
            <label>
              Telefono destinatario Cuba
              <span className="input-action-row">
                <input value={form.telefono_destinatario} onChange={(event) => update('telefono_destinatario', event.target.value)} placeholder="12345678" />
                <PasteButton onPaste={(value) => update('telefono_destinatario', value)} title="Pegar telefono destinatario" />
              </span>
            </label>
          </div>
          <ContactosRecientes clienteId={form.cliente_id} onSelect={aplicarContacto} onError={setError} />
        </section>

        <section className="form-section-card payment-section-card">
          <header className="form-section-header payment-section-header">
            <span className="form-step-number">3</span>
            <div>
              <h3>Pago de la operacion</h3>
              <p>Cantidad, metodo y monto en divisa.</p>
            </div>
            <label className="payment-currency-picker" title="Moneda de pago">
              <span className="currency-flag" aria-hidden="true">{banderaMoneda(form.moneda_pago)}</span>
              <select value={form.moneda_pago} onChange={(event) => update('moneda_pago', event.target.value)} aria-label="Moneda de pago">
                    <option value="BRL">BRL</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="UYU">UYU</option>
              </select>
            </label>
          </header>
          <div className="form-grid payment-grid">
            <label>
              Monto pago
              <input value={form.monto_pago} onChange={(event) => update('monto_pago', event.target.value)} inputMode="decimal" required />
            </label>
            <label>
              Metodo de pago
              <MetodoPagoSelect
                value={form.tipo_pago_id}
                metodos={metodosFiltrados}
                onChange={(value) => update('tipo_pago_id', value)}
                disabled={cargandoMetodos || metodosFiltrados.length === 0}
                emptyLabel={`Sin metodos para ${form.moneda_pago}`}
              />
            </label>
            <label>
              Cupon o bono
              <input value={form.bonificacion_manual} onChange={(event) => update('bonificacion_manual', event.target.value)} inputMode="decimal" placeholder="Referencia opcional" />
            </label>
            <label>
              Monto divisa
              <input value={form.monto_divisa} onChange={(event) => update('monto_divisa', event.target.value)} inputMode="decimal" required />
            </label>
            <CalculoPreview calculo={calculo} monedaResultado={form.tipo_tarjeta || 'DIV'} />
            <label className="wide">
              Observaciones
              <input value={form.observaciones} onChange={(event) => update('observaciones', event.target.value)} />
            </label>
          </div>
        </section>
      </div>
      {error && <div className="notice error">{error}</div>}
      <button className="primary-button create-submit-button" disabled={loading || !form.tipo_pago_id}>
        {loading ? 'Creando...' : 'Crear divisa'}
      </button>
    </form>
  );
}
