import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { crearTransferencia, subirArchivo } from '../api/client';
import { calcularOperacionDedup, listarMetodosPagoDedup } from '../api/dedupedReads';
import { CalculoPreview } from '../components/CalculoPreview';
import { CardNumberInput } from '../components/CardNumberInput';
import { ClienteLookup } from '../components/ClienteLookup';
import { ContactosRecientes } from '../components/ContactosRecientes';
import { CreateOrderFormShell } from '../components/CreateOrderFormShell';
import { CurrencySelect } from '../components/CurrencySelect';
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


export function TransferenciaForm({
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
    numero_tarjeta: initialData?.numero_tarjeta ?? '',
    telefono_destinatario: initialData?.telefono_destinatario ?? TELEFONO_CUBA_DEFAULT,
    tipo_pago_id: initialData?.tipo_pago_id ?? '1',
    cuenta_pago_id: initialData?.cuenta_pago_id ?? '',
    cliente_id: initialData?.cliente_id ?? '',
    nombre_cliente: initialData?.nombre_cliente ?? '',
    numero_telefono_cliente: initialData?.numero_telefono_cliente ?? '',
    bonificacion_manual: initialData?.bonificacion_manual ?? '',
    observaciones: initialData?.observaciones ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [cargandoMetodos, setCargandoMetodos] = useState(false);
  const [calculo, setCalculo] = useState<CalculoOperacionResponse | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [calculoError, setCalculoError] = useState<string | null>(null);
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
          const metodoActual = metodosMoneda.find((item) => String(item.id) === current.tipo_pago_id);
          const metodo = metodoActual ?? (moneda === 'BRL'
            ? metodosMoneda.find((item) => item.nombre.toLowerCase() === 'pix') ?? metodosMoneda[0]
            : metodosMoneda[0]);
          guardarMonedaPedidoPreferida(moneda, operadorId);
          return {
            ...current,
            moneda_pago: moneda,
            tipo_pago_id: metodo ? String(metodo.id) : '',
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

  useAutosaveBorradorNuevoPedido(operadorId, 'transferencia', form, onDraftSavedChange);

  useAbortableEffect((signal) => {
    const monto = Number(form.monto_pago);
    if (!monto || monto <= 0) {
      setCalculo(null);
      setCalculoError(null);
      return;
    }

    let activo = true;
    setCalculando(true);
    setCalculoError(null);
    calcularOperacionDedup({
      servicio: 'transferencia',
      moneda_pago: form.moneda_pago,
      monto_pago: monto,
      bonificacion_manual: Number(form.bonificacion_manual) || 0,
    }, { signal })
      .then((data) => { if (activo) setCalculo(data); })
      .catch((err) => {
        if (isAbortError(err)) return;
        if (activo) {
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
      numero_tarjeta: form.numero_tarjeta,
      telefono_destinatario: telefonoCubaPayload(form.telefono_destinatario),
      tipo_pago_id: Number(form.tipo_pago_id),
      cuenta_pago_id: form.cuenta_pago_id ? Number(form.cuenta_pago_id) : null,
      operador_id: operadorId,
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
      enqueueOfflineCreateOrder('transferencia', operadorId, payload);
      borrarBorradorNuevoPedido(operadorId, 'transferencia');
      onDraftSavedChange?.(false);
      setError('Pedido guardado en cola local. Se enviara automaticamente al volver la conexion.');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await crearTransferencia(payload);
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
      borrarBorradorNuevoPedido(operadorId, 'transferencia');
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
      loadingLabel="Creando transferencia"
      submitLabel="Crear transferencia"
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
            <label className="wide">
              Observaciones
              <textarea value={form.observaciones} onChange={(event) => update('observaciones', event.target.value)} rows={3} placeholder="Detalles adicionales de la transferencia" />
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
            <CalculoPreview calculo={calculo} loading={calculando} error={calculoError} onDismissError={() => setCalculoError(null)} />
          </div>
        </section>
    </CreateOrderFormShell>
  );
}
