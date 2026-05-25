import { FormEvent, useEffect, useMemo, useState } from 'react';
import { crearSaldo, listarMetodosPago, listarPaquetesSaldo } from '../api/client';
import { CalculoPreview } from '../components/CalculoPreview';
import { ClienteLookup } from '../components/ClienteLookup';
import { ContactosRecientes } from '../components/ContactosRecientes';
import { MetodoPagoSelect } from '../components/MetodoPagoSelect';
import { PasteButton } from '../components/PasteButton';
import type { CalculoOperacionResponse, Contacto, MetodoPago, PaqueteSaldo } from '../types/api';
import { banderaMoneda } from '../utils/monedas';

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
    bonificacion_manual: '',
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

  const paqueteSeleccionado = useMemo(
    () => paquetesFiltrados.find((paquete) => String(paquete.id) === form.paquete_saldo_id),
    [form.paquete_saldo_id, paquetesFiltrados],
  );

  const calculo = useMemo<CalculoOperacionResponse | null>(() => {
    if (!paqueteSeleccionado) return null;
    const montoPago = Number(paqueteSeleccionado.monto_pago) || 0;
    const saldoCup = Number(paqueteSeleccionado.saldo_cup) || 0;
    return {
      paquete_id: paqueteSeleccionado.id,
      monto_resultado: saldoCup,
      tasa: montoPago > 0 ? saldoCup / montoPago : undefined,
      tasa_final: montoPago > 0 ? saldoCup / montoPago : undefined,
      saldo_cup: saldoCup,
    };
  }, [paqueteSeleccionado]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function aplicarContacto(contacto: Contacto) {
    setForm((current) => ({
      ...current,
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
      const response = await crearSaldo({
        telefono_destinatario: form.telefono_destinatario || undefined,
        tipo_pago_id: Number(form.tipo_pago_id),
        operador_id: operadorId,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        nombre_cliente: form.nombre_cliente || undefined,
        numero_telefono_cliente: form.numero_telefono_cliente || undefined,
        paquete_saldo_id: form.paquete_saldo_id ? Number(form.paquete_saldo_id) : null,
        moneda_pago: form.moneda_pago,
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
              <p>Quien paga o solicita la recarga.</p>
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
              <h3>Telefono a recargar</h3>
              <p>Linea cubana que recibira el saldo.</p>
            </div>
          </header>
          <div className="form-grid">
            <label>
              Telefono destinatario Cuba
              <span className="input-action-row">
                <input value={form.telefono_destinatario} onChange={(event) => update('telefono_destinatario', event.target.value)} placeholder="12345678" required />
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
              <h3>Pago y paquete</h3>
              <p>Metodo y paquete activo para la recarga.</p>
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
              Metodo de pago
              <MetodoPagoSelect
                value={form.tipo_pago_id}
                metodos={metodosFiltrados}
                onChange={(value) => update('tipo_pago_id', value)}
                disabled={cargandoCatalogos || metodosFiltrados.length === 0}
                emptyLabel={`Sin metodos para ${form.moneda_pago}`}
              />
            </label>
            <label>
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
              Cupon o bono
              <input value={form.bonificacion_manual} onChange={(event) => update('bonificacion_manual', event.target.value)} inputMode="decimal" placeholder="Referencia opcional" />
            </label>
            <CalculoPreview calculo={calculo} />
            <label className="wide">
              Observaciones
              <input value={form.observaciones} onChange={(event) => update('observaciones', event.target.value)} />
            </label>
          </div>
        </section>
      </div>
      {error && <div className="notice error">{error}</div>}
      <button className="primary-button create-submit-button" disabled={loading || !form.tipo_pago_id || !form.paquete_saldo_id}>
        {loading ? 'Creando...' : 'Crear saldo'}
      </button>
    </form>
  );
}
