import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { ImagePlus, MapPin } from 'lucide-react';
import { crearOtros, listarMetodosPago, listarPuntosRecogida, subirArchivo } from '../api/client';
import { CardNumberInput } from '../components/CardNumberInput';
import { ClienteLookup } from '../components/ClienteLookup';
import { ContactosRecientes } from '../components/ContactosRecientes';
import { CreateOrderFormShell } from '../components/CreateOrderFormShell';
import { CurrencySelect } from '../components/CurrencySelect';
import { FloatingSelect } from '../components/FloatingSelect';
import { MetodoPagoSelect } from '../components/MetodoPagoSelect';
import { PhoneInput } from '../components/PhoneInput';
import type { Contacto, MetodoPago, PedidoDetalle, PuntoRecogida } from '../types/api';
import { telefonoClienteCompleto } from '../utils/telefonos';

const TELEFONO_CUBA_DEFAULT = '+53';
const DOCUMENTO_ADJUNTO_LABEL = 'Documento adjunto en evidencias';

function telefonoCubaCompleto(value: string) {
  return value.replace(/\D/g, '').length > 2;
}

export function OtrosForm({ operadorId, onCreated }: { operadorId: number; onCreated: (pedido: PedidoDetalle, pagoConfirmado: boolean) => void }) {
  const [form, setForm] = useState({
    monto_pago: '',
    moneda_pago: 'BRL',
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
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);
  const [documentoPreview, setDocumentoPreview] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);

  const metodosFiltrados = useMemo(
    () => metodosPago.filter((metodo) => metodo.moneda === form.moneda_pago),
    [form.moneda_pago, metodosPago],
  );

  useEffect(() => {
    setCargandoMetodos(true);
    Promise.all([listarMetodosPago(), listarPuntosRecogida()])
      .then(([data, puntosData]) => {
        setMetodosPago(data);
        setPuntos(puntosData);
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
    setForm((current) => ({ ...current, [field]: value }));
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
      if (documentoFile) {
        const uploadForm = new FormData();
        uploadForm.set('tipo', 'documento_identidad');
        uploadForm.set('archivo', documentoFile);
        await subirArchivo(response.codigo_operacion, uploadForm);
      }
      if (comprobante) {
        const uploadForm = new FormData();
        uploadForm.set('tipo', 'comprobante_cliente');
        uploadForm.set('archivo', comprobante);
        await subirArchivo(response.codigo_operacion, uploadForm);
      }
      onCreated(response, Boolean(comprobante));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido');
    } finally {
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
                disabled={cargandoMetodos}
                placeholder="Sin punto de recogida"
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
              Descripcion
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
            <div className="payment-currency-picker" title="Moneda de pago">
              <CurrencySelect
                value={form.moneda_pago}
                onChange={(value) => update('moneda_pago', value)}
                ariaLabel="Moneda de pago"
                currencies={['BRL', 'USD', 'EUR', 'UYU']}
              />
            </div>
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
