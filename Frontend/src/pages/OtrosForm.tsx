import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, MapPin } from 'lucide-react';
import { crearOtros, subirArchivo } from '../api/client';
import { listarMetodosPagoDedup, listarPuntosRecogidaDedup } from '../api/dedupedReads';
import { CardNumberInput } from '../components/CardNumberInput';
import { ClienteLookup } from '../components/ClienteLookup';
import { ContactosRecientes } from '../components/ContactosRecientes';
import { CreateOrderFormShell } from '../components/CreateOrderFormShell';
import { CurrencySelect } from '../components/CurrencySelect';
import { FloatingSelect } from '../components/FloatingSelect';
import { MetodoPagoSelect } from '../components/MetodoPagoSelect';
import { PhoneInput } from '../components/PhoneInput';
import type { Contacto, MetodoPago, PedidoDetalle, PuntoRecogida } from '../types/api';
import { isAbortError, useAbortableEffect } from '../hooks/useAbortableEffect';
import { monedasDisponibles, normalizarMoneda } from '../utils/monedas';
import { codigoPaisPorMoneda, guardarMonedaPedidoPreferida, leerMonedaPedidoPreferida, telefonoClienteConMoneda } from '../utils/preferenciasPedido';
import { telefonoClienteCompleto } from '../utils/telefonos';

const TELEFONO_CUBA_DEFAULT = '+53';
const DOCUMENTO_ADJUNTO_LABEL = 'Documento adjunto en evidencias';

function telefonoCubaCompleto(value: string) {
  return value.replace(/\D/g, '').length > 2;
}

type OtrosInitialData = { monto_pago?: string; moneda_pago?: string };

export function OtrosForm({ operadorId, onCreated, initialData }: { operadorId: number; onCreated: (pedido: PedidoDetalle, pagoConfirmado: boolean, advertencia?: string) => void; initialData?: OtrosInitialData }) {
  const [form, setForm] = useState({
    monto_pago: initialData?.monto_pago ?? '',
    moneda_pago: initialData?.moneda_pago ?? leerMonedaPedidoPreferida(),
    tipo_pago_id: '1',
    cuenta_pago_id: '',
    cliente_id: '',
    nombre_cliente: '',
    numero_telefono_cliente: '',
    numero_tarjeta: '',
    telefono_destinatario: TELEFONO_CUBA_DEFAULT,
    documento_identidad_url: '',
    punto_recogida_id: '',
    observaciones: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [puntos, setPuntos] = useState<PuntoRecogida[]>([]);
  const [cargandoMetodos, setCargandoMetodos] = useState(false);
  const [cargandoPuntos, setCargandoPuntos] = useState(false);
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);
  const [documentoPreview, setDocumentoPreview] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const submittingRef = useRef(false);

  const metodosFiltrados = useMemo(
    () => metodosPago.filter((metodo) => normalizarMoneda(metodo.moneda) === form.moneda_pago),
    [form.moneda_pago, metodosPago],
  );
  const monedasPago = useMemo(() => monedasDisponibles(metodosPago.map((metodo) => metodo.moneda)), [metodosPago]);

  useAbortableEffect((signal) => {
    let active = true;
    setCargandoMetodos(true);
    listarMetodosPagoDedup(undefined, false, { signal })
      .then((data) => {
        if (!active) return;
        setMetodosPago(data);
        const disponibles = monedasDisponibles(data.map((metodo) => metodo.moneda));
        setForm((current) => {
          const actual = normalizarMoneda(current.moneda_pago);
          const moneda = disponibles.includes(actual) ? actual : (disponibles[0] ?? actual);
          const metodosMoneda = data.filter((metodo) => normalizarMoneda(metodo.moneda) === moneda);
          const metodo = moneda === 'BRL'
            ? metodosMoneda.find((item) => item.nombre.trim().toLowerCase() === 'pix') ?? metodosMoneda[0]
            : metodosMoneda[0];
          guardarMonedaPedidoPreferida(moneda);
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
        if (active) setCargandoMetodos(false);
      });

    setCargandoPuntos(true);
    listarPuntosRecogidaDedup(false, { signal })
      .then((data) => {
        if (active) setPuntos(data);
      })
      .catch((err) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : 'No se pudieron cargar los puntos de recogida');
      })
      .finally(() => {
        if (active) setCargandoPuntos(false);
      });

    return () => {
      active = false;
    };
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
      numero_tarjeta: contacto.numero_tarjeta ?? current.numero_tarjeta,
      telefono_destinatario: contacto.telefono ?? current.telefono_destinatario,
      documento_identidad_url: contacto.documento_identidad_url ?? current.documento_identidad_url,
    }));
  }

  function handleDocumentoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setDocumentoFile(file);
    if (file) update('documento_identidad_url', DOCUMENTO_ADJUNTO_LABEL);
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

    if (submittingRef.current) return;
    submittingRef.current = true;
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
        numero_tarjeta: form.numero_tarjeta.trim() || undefined,
        telefono_destinatario: telefonoCubaCompleto(form.telefono_destinatario)
          ? form.telefono_destinatario
          : undefined,
        documento_identidad_url: documentoFile
          ? DOCUMENTO_ADJUNTO_LABEL
          : form.documento_identidad_url || undefined,
        punto_recogida_id: form.punto_recogida_id
          ? Number(form.punto_recogida_id)
          : null,
        observaciones: form.observaciones.trim(),
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
      loadingLabel="Creando pedido"
      submitLabel="Crear otros"
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
              <h3>Datos de la operacion</h3>
              <p>Completa solamente los campos que necesite este pedido.</p>
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
                pasteTitle="Pegar telefono destinatario"
              />
            </label>
            <label>
              Tarjeta destinatario
              <CardNumberInput
                value={form.numero_tarjeta}
                onChange={(value) => update('numero_tarjeta', value)}
                pasteTitle="Pegar tarjeta destinatario"
              />
            </label>
            <label>
              Foto o documento
              <span className="document-upload-field">
                <span className={documentoPreview ? 'document-preview has-image' : 'document-preview'}>
                  {documentoPreview ? <img src={documentoPreview} alt="" /> : <ImagePlus size={24} />}
                </span>
                <span>
                  <strong>{documentoFile?.name ?? (form.documento_identidad_url || 'Seleccionar imagen')}</strong>
                  <small>Opcional para efectivo u otra evidencia</small>
                </span>
                <input type="file" accept="image/*,application/*" onChange={handleDocumentoChange} />
              </span>
            </label>
            <label>
              Punto de recogida
              <FloatingSelect
                value={form.punto_recogida_id}
                onChange={(value) => update('punto_recogida_id', value)}
                disabled={cargandoPuntos}
                placeholder={cargandoPuntos ? 'Cargando puntos' : 'Sin punto de recogida'}
                ariaLabel="Punto de recogida"
                options={[
                  { value: '', label: 'Sin punto de recogida', icon: <MapPin size={17} /> },
                  ...puntos.map((punto) => ({
                    value: String(punto.id),
                    label: punto.nombre,
                    description: punto.provincia_nombre ?? undefined,
                    icon: <MapPin size={17} />,
                  })),
                ]}
                align="left"
              />
            </label>
            <label className="wide">
              Observaciones
              <textarea value={form.observaciones} onChange={(event) => update('observaciones', event.target.value)} rows={5} placeholder="Detalles exclusivos de esta operacion" required />
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
          </div>
        </section>
    </CreateOrderFormShell>
  );
}
