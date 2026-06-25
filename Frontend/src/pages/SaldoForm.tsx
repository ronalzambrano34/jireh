import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { crearSaldo, subirArchivo } from '../api/client';
import { listarMetodosPagoDedup, listarPaquetesSaldoDedup } from '../api/dedupedReads';
import { CalculoPreview } from '../components/CalculoPreview';
import { ClienteLookup } from '../components/ClienteLookup';
import { ContactosRecientes } from '../components/ContactosRecientes';
import { CreateOrderFormShell } from '../components/CreateOrderFormShell';
import { CurrencySelect } from '../components/CurrencySelect';
import { FloatingSelect } from '../components/FloatingSelect';
import { MetodoPagoSelect } from '../components/MetodoPagoSelect';
import { PhoneInput } from '../components/PhoneInput';
import type { CalculoOperacionResponse, Contacto, MetodoPago, PaqueteSaldo, PedidoDetalle } from '../types/api';
import { isAbortError, useAbortableEffect } from '../hooks/useAbortableEffect';
import { monedasDisponibles, normalizarMoneda } from '../utils/monedas';
import { codigoPaisPorMoneda, guardarMonedaPedidoPreferida, leerMonedaPedidoPreferida, telefonoClienteConMoneda } from '../utils/preferenciasPedido';
import { telefonoClienteCompleto } from '../utils/telefonos';

const TELEFONO_CUBA_DEFAULT = '+53';

function telefonoCubaCompleto(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('53') && digits.slice(2).length === 8;
}

function telefonoCubaPayload(value: string) {
  const limpio = value.trim();
  return telefonoCubaCompleto(limpio) ? limpio : undefined;
}


type SaldoInitialData = { moneda_pago?: string; paquete_saldo_id?: string };

export function SaldoForm({ operadorId, onCreated, initialData }: { operadorId: number; onCreated: (pedido: PedidoDetalle, pagoConfirmado: boolean, advertencia?: string) => void; initialData?: SaldoInitialData }) {
  const [form, setForm] = useState({
    moneda_pago: initialData?.moneda_pago ?? leerMonedaPedidoPreferida(),
    tipo_pago_id: '',
    cuenta_pago_id: '',
    paquete_saldo_id: initialData?.paquete_saldo_id ?? '',
    telefono_destinatario: TELEFONO_CUBA_DEFAULT,
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
  const [comprobante, setComprobante] = useState<File | null>(null);
  const submittingRef = useRef(false);

  const metodosFiltrados = useMemo(
    () => metodosPago.filter((metodo) => normalizarMoneda(metodo.moneda) === form.moneda_pago),
    [form.moneda_pago, metodosPago],
  );

  const paquetesFiltrados = useMemo(
    () => paquetes.filter((paquete) => normalizarMoneda(paquete.moneda_pago) === form.moneda_pago),
    [form.moneda_pago, paquetes],
  );

  const monedasPago = useMemo(() => {
    const monedasConMetodo = new Set(monedasDisponibles(metodosPago.map((metodo) => metodo.moneda)));
    return monedasDisponibles(paquetes.map((paquete) => paquete.moneda_pago)).filter((moneda) => monedasConMetodo.has(moneda));
  }, [metodosPago, paquetes]);

  useAbortableEffect((signal) => {
    setCargandoCatalogos(true);
    Promise.all([listarMetodosPagoDedup(undefined, false, { signal }), listarPaquetesSaldoDedup(undefined, false, { signal })])
      .then(([metodos, paquetesData]) => {
        setMetodosPago(metodos);
        setPaquetes(paquetesData);
        const monedasConMetodo = new Set(monedasDisponibles(metodos.map((metodo) => metodo.moneda)));
        const disponibles = monedasDisponibles(paquetesData.map((paquete) => paquete.moneda_pago))
          .filter((moneda) => monedasConMetodo.has(moneda));
        setForm((current) => {
          const actual = normalizarMoneda(current.moneda_pago);
          const moneda = disponibles.includes(actual) ? actual : (disponibles[0] ?? actual);
          const metodosMoneda = metodos.filter((metodo) => normalizarMoneda(metodo.moneda) === moneda);
          const metodo = moneda === 'BRL'
            ? metodosMoneda.find((item) => item.nombre.toLowerCase() === 'pix') ?? metodosMoneda[0]
            : metodosMoneda[0];
          const paqueteActual = paquetesData.find((item) => String(item.id) === current.paquete_saldo_id && normalizarMoneda(item.moneda_pago) === moneda);
          const paquete = paqueteActual ?? paquetesData.find((item) => normalizarMoneda(item.moneda_pago) === moneda);
          guardarMonedaPedidoPreferida(moneda);
          return {
            ...current,
            moneda_pago: moneda,
            tipo_pago_id: metodo ? String(metodo.id) : '',
            paquete_saldo_id: paquete ? String(paquete.id) : '',
            numero_telefono_cliente: current.cliente_id ? current.numero_telefono_cliente : telefonoClienteConMoneda(current.numero_telefono_cliente, moneda),
          };
        });
      })
      .catch((err) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : 'No se pudieron cargar los catalogos');
      })
      .finally(() => {
        if (!signal.aborted) setCargandoCatalogos(false);
      });
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
    const tasaSaldo = montoPago > 0 ? saldoCup / montoPago : 0;
    const bonificacion = Number(form.bonificacion_manual) || 0;
    const saldoFinal = Math.round(montoPago * (tasaSaldo + bonificacion));
    return {
      paquete_id: paqueteSeleccionado.id,
      monto_resultado: saldoFinal,
      tasa: montoPago,
      bonificacion,
      tasa_final: montoPago,
      saldo_cup: saldoFinal,
    };
  }, [form.bonificacion_manual, paqueteSeleccionado]);

  function update(field: keyof typeof form, value: string) {
    if (field === 'moneda_pago') guardarMonedaPedidoPreferida(value);
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'moneda_pago' && !current.cliente_id ? { numero_telefono_cliente: telefonoClienteConMoneda(current.numero_telefono_cliente, value) } : {}),
    }));
  }

  function aplicarContacto(contacto: Contacto) {
    setForm((current) => ({
      ...current,
      telefono_destinatario: contacto.telefono ?? current.telefono_destinatario,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!telefonoClienteCompleto(form.numero_telefono_cliente)) {
      setError('El telefono/WhatsApp del cliente es obligatorio para enviarle las instrucciones de pago');
      return;
    }
    if (!telefonoCubaCompleto(form.telefono_destinatario)) {
      setError('El telefono de Cuba debe tener 8 digitos despues de +53');
      return;
    }
    if (!form.tipo_pago_id) {
      setError(`No hay un metodo de pago seleccionado para ${form.moneda_pago}`);
      return;
    }
    if (!form.paquete_saldo_id) {
      setError(`No hay un paquete de saldo seleccionado para ${form.moneda_pago}`);
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await crearSaldo({
        telefono_destinatario: telefonoCubaPayload(form.telefono_destinatario),
        tipo_pago_id: Number(form.tipo_pago_id),
        cuenta_pago_id: form.cuenta_pago_id ? Number(form.cuenta_pago_id) : null,
        operador_id: operadorId,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        nombre_cliente: form.nombre_cliente.trim() || form.numero_telefono_cliente,
        numero_telefono_cliente: form.numero_telefono_cliente || undefined,
        paquete_saldo_id: form.paquete_saldo_id ? Number(form.paquete_saldo_id) : null,
        moneda_pago: form.moneda_pago,
        bonificacion_manual: Number(form.bonificacion_manual) || undefined,
        observaciones: form.observaciones.trim() || undefined,
      });
      let comprobanteCargado = false;
      let advertencia: string | undefined;
      if (comprobante) {
        try {
          const uploadForm = new FormData();
          uploadForm.set('tipo', 'comprobante_cliente');
          uploadForm.set('archivo', comprobante);
          await subirArchivo(response.codigo_operacion, uploadForm);
          comprobanteCargado = true;
        } catch (err) {
          const detalle = err instanceof Error ? err.message : 'No se pudo subir el comprobante';
          advertencia = `El pedido ${response.codigo_operacion} fue creado, pero el comprobante no se adjunto: ${detalle}`;
        }
      }
      onCreated(response, comprobanteCargado, advertencia);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <CreateOrderFormShell
      error={error}
      loading={loading}
      loadingLabel="Creando saldo"
      submitLabel="Crear saldo"
      comprobante={comprobante}
      onComprobanteChange={(event: ChangeEvent<HTMLInputElement>) => setComprobante(event.target.files?.[0] ?? null)}
      onSubmit={handleSubmit}
      onDismissError={() => setError(null)}
    >
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
            defaultCode={codigoPaisPorMoneda(form.moneda_pago)}
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
              <PhoneInput value={form.telefono_destinatario} onChange={(value) => update('telefono_destinatario', value)} defaultCode="+53" codeLocked pasteTitle="Pegar telefono destinatario" required />
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
          </header>
          <div className="form-grid payment-grid">
            <label className="payment-amount-field">
              Paquete de saldo
              <FloatingSelect
                value={form.paquete_saldo_id}
                onChange={(value) => update('paquete_saldo_id', value)}
                disabled={cargandoCatalogos || paquetesFiltrados.length === 0}
                placeholder={`Sin paquetes para ${form.moneda_pago}`}
                ariaLabel="Paquete de saldo"
                options={paquetesFiltrados.length === 0 ? [{ value: '', label: `Sin paquetes para ${form.moneda_pago}`, disabled: true, icon: <Smartphone size={17} /> }] : paquetesFiltrados.map((paquete) => ({ value: String(paquete.id), label: paquete.nombre, description: `${paquete.monto_pago} ${paquete.moneda_pago} · ${paquete.saldo_cup} CUP`, icon: <Smartphone size={17} /> }))}
                align="left"
              />
            </label>
            <label className="payment-currency-field">
              Moneda
              <span className="payment-currency-picker" title="Moneda de pago">
                <CurrencySelect
                  value={form.moneda_pago}
                  onChange={(value) => update('moneda_pago', value)}
                  ariaLabel="Moneda de pago"
                  currencies={monedasPago}
                />
              </span>
            </label>
            <label className="payment-method-field">
              Metodo de pago
              <MetodoPagoSelect
                value={form.tipo_pago_id}
                metodos={metodosFiltrados}
                onChange={(value) => update('tipo_pago_id', value)}
                cuentaValue={form.cuenta_pago_id}
                onCuentaChange={(value) => update('cuenta_pago_id', value)}
                disabled={cargandoCatalogos || metodosFiltrados.length === 0}
                emptyLabel={`Sin metodos para ${form.moneda_pago}`}
              />
            </label>
            <label className="payment-bonus-field">
              Cupon o bono
              <input value={form.bonificacion_manual} onChange={(event) => update('bonificacion_manual', event.target.value)} inputMode="decimal" placeholder="Bono de tasa opcional" />
            </label>
            <CalculoPreview calculo={calculo} tasaLabel="Precio del paquete" />
            <label className="wide">
              Observaciones
              <input value={form.observaciones} onChange={(event) => update('observaciones', event.target.value)} />
            </label>
          </div>
        </section>
    </CreateOrderFormShell>
  );
}
