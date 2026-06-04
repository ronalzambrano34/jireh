import { FormEvent, useEffect, useMemo, useState } from 'react';
import { calcularOperacion, crearTransferencia, listarMetodosPago } from '../api/client';
import { CalculoPreview } from '../components/CalculoPreview';
import { CardNumberInput } from '../components/CardNumberInput';
import { ClienteLookup } from '../components/ClienteLookup';
import { ContactosRecientes } from '../components/ContactosRecientes';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { FloatingSelect } from '../components/FloatingSelect';
import { MetodoPagoSelect } from '../components/MetodoPagoSelect';
import { PhoneInput } from '../components/PhoneInput';
import { PageLoader } from '../components/PageLoader';
import type { CalculoOperacionResponse, Contacto, MetodoPago, PedidoDetalle } from '../types/api';
import { banderaMoneda } from '../utils/monedas';
import { telefonoClienteCompleto } from '../utils/telefonos';

const TELEFONO_CUBA_DEFAULT = '+53';

function telefonoCubaCompleto(value: string) {
  return value.replace(/\D/g, '').length > 2;
}

function telefonoCubaPayload(value: string) {
  const limpio = value.trim();
  return telefonoCubaCompleto(limpio) ? limpio : undefined;
}


type TransferenciaInitialData = { monto_pago?: string; moneda_pago?: string };


export function TransferenciaForm({ operadorId, onCreated, initialData }: { operadorId: number; onCreated: (pedido: PedidoDetalle) => void; initialData?: TransferenciaInitialData }) {
  const [form, setForm] = useState({
    monto_pago: initialData?.monto_pago ?? '',
    moneda_pago: initialData?.moneda_pago ?? 'BRL',
    numero_tarjeta: '',
    telefono_destinatario: TELEFONO_CUBA_DEFAULT,
    tipo_pago_id: '1',
    cliente_id: '',
    nombre_cliente: '',
    numero_telefono_cliente: '',
    bonificacion_manual: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [cargandoMetodos, setCargandoMetodos] = useState(false);
  const [calculo, setCalculo] = useState<CalculoOperacionResponse | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [calculoError, setCalculoError] = useState<string | null>(null);

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
    const monto = Number(form.monto_pago);
    if (!monto || monto <= 0) {
      setCalculo(null);
      setCalculoError(null);
      return;
    }

    let activo = true;
    setCalculando(true);
    setCalculoError(null);
    calcularOperacion({
      servicio: 'transferencia',
      moneda_pago: form.moneda_pago,
      monto_pago: monto,
      bonificacion_manual: Number(form.bonificacion_manual) || 0,
    })
      .then((data) => { if (activo) setCalculo(data); })
      .catch((err) => {
        if (activo) {
          setCalculo(null);
          setCalculoError(err instanceof Error ? err.message : 'No se pudo calcular');
        }
      })
      .finally(() => { if (activo) setCalculando(false); });

    return () => { activo = false; };
  }, [form.monto_pago, form.moneda_pago, form.bonificacion_manual]);

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

  function aplicarContacto(contacto: Contacto) {
    setForm((current) => ({
      ...current,
      numero_tarjeta: contacto.numero_tarjeta ?? current.numero_tarjeta,
      telefono_destinatario: contacto.telefono ?? current.telefono_destinatario,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!telefonoClienteCompleto(form.numero_telefono_cliente)) {
      setError('El telefono/WhatsApp del cliente es obligatorio para enviarle las instrucciones de pago');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await crearTransferencia({
        monto_pago: Number(form.monto_pago),
        moneda_pago: form.moneda_pago,
        numero_tarjeta: form.numero_tarjeta,
        telefono_destinatario: telefonoCubaPayload(form.telefono_destinatario),
        tipo_pago_id: Number(form.tipo_pago_id),
        operador_id: operadorId,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        nombre_cliente: form.nombre_cliente.trim() || form.numero_telefono_cliente,
        numero_telefono_cliente: form.numero_telefono_cliente || undefined,
        bonificacion_manual: Number(form.bonificacion_manual) || undefined,
      });
      onCreated(response);
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
              <h3>Destino en Cuba</h3>
              <p>Tarjeta y telefono del destinatario.</p>
            </div>
          </header>
          <div className="form-grid">
            <label>
              Tarjeta destinatario
              <CardNumberInput value={form.numero_tarjeta} onChange={(value) => update('numero_tarjeta', value)} required pasteTitle="Pegar tarjeta destinatario" />
            </label>
            <label>
              Telefono destinatario Cuba
              <PhoneInput value={form.telefono_destinatario} onChange={(value) => update('telefono_destinatario', value)} defaultCode="+53" codeLocked pasteTitle="Pegar telefono destinatario" />
            </label>
          </div>
          <ContactosRecientes clienteId={form.cliente_id} onSelect={aplicarContacto} onError={setError} />
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
              Monto pago
              <input value={form.monto_pago} onChange={(event) => update('monto_pago', event.target.value)} onFocus={(event) => event.currentTarget.select()} inputMode="decimal" placeholder="230" required />
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
              <input value={form.bonificacion_manual} onChange={(event) => update('bonificacion_manual', event.target.value)} inputMode="decimal" placeholder="Bono de tasa opcional" />
            </label>
            <CalculoPreview calculo={calculo} loading={calculando} error={calculoError} />
          </div>
        </section>
      </div>
      {error && <DismissibleNotice className="notice error" role="alert">{error}</DismissibleNotice>}
      {loading && <PageLoader label="Creando transferencia" inline />}
      <button className="primary-button create-submit-button" disabled={loading || !form.tipo_pago_id || !telefonoClienteCompleto(form.numero_telefono_cliente)}>
        {loading ? 'Creando...' : 'Crear transferencia'}
      </button>
    </form>
  );
}
