import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { crearDivisa, subirArchivo } from '../api/client';
import { calcularOperacionDedup, listarMetodosPagoDedup } from '../api/dedupedReads';
import { CalculoPreview } from '../components/CalculoPreview';
import { CardNumberInput } from '../components/CardNumberInput';
import { ClienteLookup } from '../components/ClienteLookup';
import { ContactosRecientes } from '../components/ContactosRecientes';
import { CreateOrderFormShell } from '../components/CreateOrderFormShell';
import { CurrencySelect } from '../components/CurrencySelect';
import { FloatingSelect } from '../components/FloatingSelect';
import { MetodoPagoSelect } from '../components/MetodoPagoSelect';
import { PhoneInput } from '../components/PhoneInput';
import type { CalculoOperacionResponse, Contacto, MetodoPago, PedidoDetalle } from '../types/api';
import { isAbortError, useAbortableEffect } from '../hooks/useAbortableEffect';
import { monedasDisponibles, normalizarMoneda } from '../utils/monedas';
import { borrarBorradorNuevoPedido, useAutosaveBorradorNuevoPedido, type NuevoPedidoDraft } from '../utils/borradoresPedido';
import { codigoPaisPorMoneda, guardarMonedaPedidoPreferida, leerMonedaPedidoPreferida, telefonoClienteConMoneda } from '../utils/preferenciasPedido';
import { telefonoClienteCompleto } from '../utils/telefonos';
import { appEstaOffline, enqueueOfflineCreateOrder } from '../utils/offlineQueue';

const TELEFONO_CUBA_DEFAULT = '+53';

function telefonoCubaCompleto(value: string) {
  return value.replace(/\D/g, '').length > 2;
}

function telefonoCubaPayload(value: string) {
  const limpio = value.trim();
  return telefonoCubaCompleto(limpio) ? limpio : undefined;
}


export function DivisaForm({
  operadorId,
  onCreated,
  initialData,
  onDraftSavedChange,
}: {
  operadorId: number;
  onCreated: (pedido: PedidoDetalle, pagoConfirmado: boolean, advertencia?: string) => void;
  initialData?: NuevoPedidoDraft;
  onDraftSavedChange?: (saved: boolean) => void;
}) {
  const [form, setForm] = useState({
    monto_pago: initialData?.monto_pago ?? '',
    moneda_pago: initialData?.moneda_pago ?? leerMonedaPedidoPreferida('BRL', operadorId),
    tipo_pago_id: initialData?.tipo_pago_id ?? '',
    cuenta_pago_id: initialData?.cuenta_pago_id ?? '',
    tipo_tarjeta: initialData?.tipo_tarjeta ?? 'MLC',
    numero_tarjeta: initialData?.numero_tarjeta ?? '',
    telefono_destinatario: initialData?.telefono_destinatario ?? TELEFONO_CUBA_DEFAULT,
    cliente_id: initialData?.cliente_id ?? '',
    nombre_cliente: initialData?.nombre_cliente ?? '',
    numero_telefono_cliente: initialData?.numero_telefono_cliente ?? '',
    observaciones: initialData?.observaciones ?? '',
    bonificacion_manual: initialData?.bonificacion_manual ?? '',
  });
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cargandoMetodos, setCargandoMetodos] = useState(false);
  const [calculo, setCalculo] = useState<CalculoOperacionResponse | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const submittingRef = useRef(false);

  const metodosFiltrados = useMemo(
    () => metodosPago.filter((metodo) => normalizarMoneda(metodo.moneda) === form.moneda_pago),
    [form.moneda_pago, metodosPago],
  );
  const monedasPago = useMemo(() => monedasDisponibles(metodosPago.map((metodo) => metodo.moneda)), [metodosPago]);

  useAbortableEffect((signal) => {
    setCargandoMetodos(true);
    listarMetodosPagoDedup(undefined, false, { signal })
      .then((data) => {
        setMetodosPago(data);
        const disponibles = monedasDisponibles(data.map((metodo) => metodo.moneda));
        setForm((current) => {
          const actual = normalizarMoneda(current.moneda_pago);
          const moneda = disponibles.includes(actual) ? actual : (disponibles[0] ?? actual);
          const metodosMoneda = data.filter((metodo) => normalizarMoneda(metodo.moneda) === moneda);
          const metodoActual = metodosMoneda.find((metodo) => String(metodo.id) === current.tipo_pago_id);
          const primero = metodoActual ?? metodosMoneda[0];
          guardarMonedaPedidoPreferida(moneda, operadorId);
          return {
            ...current,
            moneda_pago: moneda,
            tipo_pago_id: primero ? String(primero.id) : '',
            numero_telefono_cliente: current.cliente_id ? current.numero_telefono_cliente : telefonoClienteConMoneda(current.numero_telefono_cliente, moneda),
          };
        });
      })
      .catch((err) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : 'No se pudieron cargar los metodos de pago');
      })
      .finally(() => {
        if (!signal.aborted) setCargandoMetodos(false);
      });
  }, []);

  useAutosaveBorradorNuevoPedido(operadorId, 'divisa', form, onDraftSavedChange);

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

  useAbortableEffect((signal) => {
    const montoPago = Number(form.monto_pago);
    if (!montoPago || montoPago <= 0) {
      setCalculo(null);
      return;
    }

    let activo = true;
    calcularOperacionDedup({
      servicio: form.tipo_tarjeta.toLowerCase(),
      moneda_pago: form.moneda_pago,
      monto_pago: montoPago,
      bonificacion_manual: Number(form.bonificacion_manual) || 0,
    }, { signal })
      .then((data) => { if (activo) setCalculo(data); })
      .catch(() => undefined);

    return () => { activo = false; };
  }, [form.bonificacion_manual, form.monto_pago, form.moneda_pago, form.tipo_tarjeta]);

  function update(field: keyof typeof form, value: string) {
    if (field === 'moneda_pago') guardarMonedaPedidoPreferida(value, operadorId);
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'moneda_pago' && !current.cliente_id ? { numero_telefono_cliente: telefonoClienteConMoneda(current.numero_telefono_cliente, value) } : {}),
    }));
  }

  function aplicarContacto(contacto: Contacto) {
    setForm((current) => ({
      ...current,
      tipo_tarjeta: contacto.tipo_tarjeta ?? current.tipo_tarjeta,
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
    if (!form.numero_tarjeta.trim()) {
      setError('Completa la tarjeta del destinatario');
      return;
    }
    if (!form.tipo_pago_id) {
      setError(`No hay un metodo de pago seleccionado para ${form.moneda_pago}`);
      return;
    }
    if (!form.cuenta_pago_id) {
      setError('Selecciona la cuenta de pago');
      return;
    }
    if (!(Number(form.monto_pago) > 0)) {
      setError('Escribe un monto de pago mayor que cero');
      return;
    }
    const payload = {
      monto_pago: Number(form.monto_pago),
      moneda_pago: form.moneda_pago,
      tipo_pago_id: Number(form.tipo_pago_id),
      cuenta_pago_id: form.cuenta_pago_id ? Number(form.cuenta_pago_id) : null,
      operador_id: operadorId,
      tipo_tarjeta: form.tipo_tarjeta || undefined,
      numero_tarjeta: form.numero_tarjeta || undefined,
      telefono_destinatario: telefonoCubaPayload(form.telefono_destinatario),
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      nombre_cliente: form.nombre_cliente.trim() || form.numero_telefono_cliente,
      numero_telefono_cliente: form.numero_telefono_cliente || undefined,
      bonificacion_manual: Number(form.bonificacion_manual) || undefined,
      observaciones: form.observaciones.trim() || undefined,
    };
    if (appEstaOffline()) {
      if (comprobante) {
        setError('Sin internet: los archivos no se pueden guardar en cola. Quita el comprobante o vuelve con conexion.');
        return;
      }
      enqueueOfflineCreateOrder('divisa', operadorId, payload);
      borrarBorradorNuevoPedido(operadorId, 'divisa');
      onDraftSavedChange?.(false);
      setError('Pedido guardado en cola local. Se enviara automaticamente al volver la conexion.');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await crearDivisa(payload);
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
      borrarBorradorNuevoPedido(operadorId, 'divisa');
      onDraftSavedChange?.(false);
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
      loadingLabel="Creando divisa"
      submitLabel="Crear divisa"
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
            defaultCode={codigoPaisPorMoneda(form.moneda_pago)}
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
              <FloatingSelect
                value={form.tipo_tarjeta}
                onChange={(value) => update('tipo_tarjeta', value)}
                ariaLabel="Tipo tarjeta"
                options={[{ value: 'MLC', label: 'MLC', icon: <CreditCard size={17} /> }, { value: 'USD', label: 'USD', icon: <CreditCard size={17} /> }, { value: 'Clasica', label: 'Clasica', icon: <CreditCard size={17} /> }]}
                align="left"
              />
            </label>
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
              <p>Cantidad, metodo y divisa calculada segun la oferta.</p>
            </div>
          </header>
          <div className="form-grid payment-grid">
            <label className="payment-amount-field">
              Monto pago
              <input value={form.monto_pago} onChange={(event) => update('monto_pago', event.target.value)} onFocus={(event) => event.currentTarget.select()} inputMode="decimal" placeholder="230" required />
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
                disabled={cargandoMetodos || metodosFiltrados.length === 0}
                emptyLabel={`Sin metodos para ${form.moneda_pago}`}
              />
            </label>
            <label className="payment-bonus-field">
              Cupon o bono
              <input value={form.bonificacion_manual} onChange={(event) => update('bonificacion_manual', event.target.value)} inputMode="decimal" placeholder="Bono de tasa opcional" />
            </label>
            <CalculoPreview calculo={calculo} monedaResultado={form.tipo_tarjeta || 'DIV'} />
            <label className="wide">
              Observaciones
              <input value={form.observaciones} onChange={(event) => update('observaciones', event.target.value)} />
            </label>
          </div>
        </section>
    </CreateOrderFormShell>
  );
}
