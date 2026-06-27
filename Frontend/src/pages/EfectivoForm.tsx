import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, MapPin, MessageCircle } from 'lucide-react';
import { CalculoPreview } from '../components/CalculoPreview';
import { ClienteLookup } from '../components/ClienteLookup';
import { ContactosRecientes } from '../components/ContactosRecientes';
import { CreateOrderFormShell } from '../components/CreateOrderFormShell';
import { CurrencySelect } from '../components/CurrencySelect';
import { FloatingSelect } from '../components/FloatingSelect';
import { MetodoPagoSelect } from '../components/MetodoPagoSelect';
import { PhoneInput } from '../components/PhoneInput';
import { crearEfectivo, subirArchivo } from '../api/client';
import { calcularOperacionDedup, listarMetodosPagoDedup, listarPuntosRecogidaDedup } from '../api/dedupedReads';
import type { CalculoOperacionResponse, Contacto, MetodoPago, PedidoDetalle, PuntoRecogida } from '../types/api';
import { isAbortError, useAbortableEffect } from '../hooks/useAbortableEffect';
import { monedasDisponibles, normalizarMoneda } from '../utils/monedas';
import { borrarBorradorNuevoPedido, useAutosaveBorradorNuevoPedido, type NuevoPedidoDraft } from '../utils/borradoresPedido';
import { codigoPaisPorMoneda, guardarMonedaPedidoPreferida, leerMonedaPedidoPreferida, telefonoClienteConMoneda } from '../utils/preferenciasPedido';
import { telefonoClienteCompleto } from '../utils/telefonos';
import { abrirWhatsAppUrl } from '../utils/whatsapp';

const TELEFONO_CUBA_DEFAULT = '+53';
const DOCUMENTO_ADJUNTO_LABEL = 'Documento adjunto en evidencias';

function telefonoCubaCompleto(value: string) {
  return value.replace(/\D/g, '').length > 2;
}

function telefonoCubaPayload(value: string) {
  const limpio = value.trim();
  return telefonoCubaCompleto(limpio) ? limpio : undefined;
}


function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  const normalized = digits.startsWith('53') ? digits : `53${digits}`;
  return `https://wa.me/${normalized}`;
}

export function EfectivoForm({
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
    moneda_pago: initialData?.moneda_pago ?? leerMonedaPedidoPreferida(),
    tipo_pago_id: initialData?.tipo_pago_id ?? '',
    cuenta_pago_id: initialData?.cuenta_pago_id ?? '',
    punto_recogida_id: initialData?.punto_recogida_id ?? '',
    telefono_destinatario: initialData?.telefono_destinatario ?? TELEFONO_CUBA_DEFAULT,
    documento_identidad_url: initialData?.documento_identidad_url ?? '',
    cliente_id: initialData?.cliente_id ?? '',
    nombre_cliente: initialData?.nombre_cliente ?? '',
    numero_telefono_cliente: initialData?.numero_telefono_cliente ?? '',
    observaciones: initialData?.observaciones ?? '',
    bonificacion_manual: initialData?.bonificacion_manual ?? '',
  });
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [puntos, setPuntos] = useState<PuntoRecogida[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);
  const [calculo, setCalculo] = useState<CalculoOperacionResponse | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [calculoError, setCalculoError] = useState<string | null>(null);
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);
  const [documentoPreview, setDocumentoPreview] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const submittingRef = useRef(false);

  const metodosFiltrados = useMemo<MetodoPago[]>(
    () => metodosPago.filter((metodo) => normalizarMoneda(metodo.moneda) === form.moneda_pago),
    [form.moneda_pago, metodosPago],
  );
  const monedasPago = useMemo(() => monedasDisponibles(metodosPago.map((metodo) => metodo.moneda)), [metodosPago]);

  useAbortableEffect((signal) => {
    setCargandoCatalogos(true);
    Promise.all([listarMetodosPagoDedup(undefined, false, { signal }), listarPuntosRecogidaDedup(false, { signal })])
      .then(([metodos, puntosData]) => {
        setMetodosPago(metodos);
        setPuntos(puntosData);
        setForm((current) => {
          const disponibles = monedasDisponibles(metodos.map((metodo) => metodo.moneda));
          const actual = normalizarMoneda(current.moneda_pago);
          const moneda = disponibles.includes(actual) ? actual : (disponibles[0] ?? actual);
          const metodosMoneda = metodos.filter((metodo) => normalizarMoneda(metodo.moneda) === moneda);
          const metodoActual = metodosMoneda.find((item) => String(item.id) === current.tipo_pago_id);
          const metodo = metodoActual ?? (moneda === 'BRL'
            ? metodosMoneda.find((item) => item.nombre.toLowerCase() === 'pix') ?? metodosMoneda[0]
            : metodosMoneda[0]);
          const puntoActual = puntosData.find((item) => String(item.id) === current.punto_recogida_id);
          guardarMonedaPedidoPreferida(moneda);
          return {
            ...current,
            moneda_pago: moneda,
            tipo_pago_id: metodo ? String(metodo.id) : '',
            punto_recogida_id: puntoActual ? current.punto_recogida_id : (puntosData[0] ? String(puntosData[0].id) : ''),
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

  useAutosaveBorradorNuevoPedido(operadorId, 'efectivo', form, onDraftSavedChange);

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
      servicio: 'efectivo',
      moneda_pago: form.moneda_pago,
      monto_pago: monto,
      bonificacion_manual: Number(form.bonificacion_manual) || 0,
    }, { signal })
      .then((data) => { if (activo) setCalculo(data); })
      .catch((err) => {
        if (isAbortError(err)) return;
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

  useEffect(() => {
    if (!documentoFile || !documentoFile.type.startsWith('image/')) {
      setDocumentoPreview(null);
      return undefined;
    }

    const url = URL.createObjectURL(documentoFile);
    setDocumentoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [documentoFile]);

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
      documento_identidad_url: contacto.documento_identidad_url ?? current.documento_identidad_url,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!telefonoClienteCompleto(form.numero_telefono_cliente)) {
      setError('El telefono/WhatsApp del cliente es obligatorio para enviarle las instrucciones de pago');
      return;
    }
    if (!telefonoCubaCompleto(form.telefono_destinatario)) {
      setError('Completa el telefono de Cuba despues de +53');
      return;
    }
    if (!documentoFile && !form.documento_identidad_url) {
      setError('Sube la foto del documento de identidad');
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
    if (!form.punto_recogida_id) {
      setError('Selecciona un punto de recogida');
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await crearEfectivo({
        monto_pago: Number(form.monto_pago),
        moneda_pago: form.moneda_pago,
        tipo_pago_id: Number(form.tipo_pago_id),
        cuenta_pago_id: form.cuenta_pago_id ? Number(form.cuenta_pago_id) : null,
        operador_id: operadorId,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        nombre_cliente: form.nombre_cliente.trim() || form.numero_telefono_cliente,
        numero_telefono_cliente: form.numero_telefono_cliente || undefined,
        telefono_destinatario: telefonoCubaPayload(form.telefono_destinatario),
        documento_identidad_url: documentoFile ? DOCUMENTO_ADJUNTO_LABEL : form.documento_identidad_url || undefined,
        punto_recogida_id: form.punto_recogida_id ? Number(form.punto_recogida_id) : null,
        bonificacion_manual: Number(form.bonificacion_manual) || undefined,
        observaciones: form.observaciones || undefined,
      });
      const adjuntosFallidos: string[] = [];
      let comprobanteCargado = false;
      if (documentoFile) {
        try {
          const uploadForm = new FormData();
          uploadForm.set('tipo', 'documento_identidad');
          uploadForm.set('archivo', documentoFile);
          await subirArchivo(response.codigo_operacion, uploadForm);
        } catch (err) {
          const detalle = err instanceof Error ? err.message : 'No se pudo subir el documento';
          adjuntosFallidos.push(`documento de identidad (${detalle})`);
        }
      }
      if (comprobante) {
        try {
          const uploadForm = new FormData();
          uploadForm.set('tipo', 'comprobante_cliente');
          uploadForm.set('archivo', comprobante);
          await subirArchivo(response.codigo_operacion, uploadForm);
          comprobanteCargado = true;
        } catch (err) {
          const detalle = err instanceof Error ? err.message : 'No se pudo subir el comprobante';
          adjuntosFallidos.push(`comprobante (${detalle})`);
        }
      }
      const advertencia = adjuntosFallidos.length
        ? `El pedido ${response.codigo_operacion} fue creado, pero no se adjunto: ${adjuntosFallidos.join(', ')}`
        : undefined;
      borrarBorradorNuevoPedido(operadorId, 'efectivo');
      onDraftSavedChange?.(false);
      onCreated(response, comprobanteCargado, advertencia);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  function handleDocumentoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setDocumentoFile(file);
    if (file) update('documento_identidad_url', DOCUMENTO_ADJUNTO_LABEL);
  }

  return (
    <CreateOrderFormShell
      error={error}
      loading={loading}
      loadingLabel="Creando efectivo"
      submitLabel="Crear efectivo"
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
              <h3>Entrega en Cuba</h3>
              <p>Destinatario, documento y punto de recogida.</p>
            </div>
          </header>
          <div className="form-grid">
            <label>
              Telefono destinatario Cuba
              <PhoneInput
                value={form.telefono_destinatario}
                onChange={(value) => update('telefono_destinatario', value)}
                defaultCode="+53"
                codeLocked
                required
                pasteTitle="Pegar telefono destinatario"
                actions={(
                  <a
                    className={telefonoCubaCompleto(form.telefono_destinatario) ? 'icon-button field-action-button' : 'icon-button field-action-button disabled-link'}
                    href={telefonoCubaCompleto(form.telefono_destinatario) ? whatsappHref(form.telefono_destinatario) : undefined}
                    onClick={(event) => {
                      if (!telefonoCubaCompleto(form.telefono_destinatario)) return;
                      event.preventDefault();
                      abrirWhatsAppUrl(whatsappHref(form.telefono_destinatario));
                    }}
                    target="_blank"
                    rel="noreferrer"
                    title="Llamar por WhatsApp"
                    aria-label="Llamar por WhatsApp"
                  >
                    <MessageCircle size={18} />
                  </a>
                )}
              />
            </label>
            <div className="document-input-group">
              <span className="document-field-label">Foto del documento</span>
              <label className="document-upload-field">
                <span className={documentoPreview ? 'document-preview has-image' : 'document-preview'}>
                  {documentoPreview ? <img src={documentoPreview} alt="" /> : <ImagePlus size={24} />}
                </span>
                <span>
                  <strong>{documentoFile?.name ?? (form.documento_identidad_url || 'Elegir de la galeria')}</strong>
                  <small>Seleccionar una imagen guardada</small>
                </span>
                <input type="file" accept="image/*,application/pdf,.pdf,.doc,.docx" onChange={handleDocumentoChange} />
              </label>
            </div>
            <label className="wide">
              Punto de recogida
              <FloatingSelect
                value={form.punto_recogida_id}
                onChange={(value) => update('punto_recogida_id', value)}
                disabled={cargandoCatalogos || puntos.length === 0}
                placeholder="Sin puntos activos"
                ariaLabel="Punto de recogida"
                options={puntos.length === 0 ? [{ value: '', label: 'Sin puntos activos', disabled: true, icon: <MapPin size={17} /> }] : puntos.map((punto) => ({ value: String(punto.id), label: punto.nombre, description: punto.provincia_nombre ?? undefined, icon: <MapPin size={17} /> }))}
                align="left"
              />
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
                disabled={cargandoCatalogos || metodosFiltrados.length === 0}
                emptyLabel={`Sin metodos para ${form.moneda_pago}`}
              />
            </label>
            <label className="payment-bonus-field">
              Cupon o bono
              <input value={form.bonificacion_manual} onChange={(event) => update('bonificacion_manual', event.target.value)} inputMode="decimal" placeholder="Bono de tasa opcional" />
            </label>
            <CalculoPreview calculo={calculo} loading={calculando} error={calculoError} onDismissError={() => setCalculoError(null)} />
            <label className="wide">
              Observaciones
              <input value={form.observaciones} onChange={(event) => update('observaciones', event.target.value)} />
            </label>
          </div>
        </section>
    </CreateOrderFormShell>
  );
}
