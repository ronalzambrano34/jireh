import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { ClienteLookup } from '../components/ClienteLookup';
import { ContactosRecientes } from '../components/ContactosRecientes';
import { crearEfectivo, listarMetodosPago, listarPuntosRecogida } from '../api/client';
import type { Contacto, MetodoPago, PuntoRecogida } from '../types/api';
import { banderaMoneda } from '../utils/monedas';

type EfectivoInitialData = { monto_pago?: string; moneda_pago?: string };

function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  const normalized = digits.startsWith('53') ? digits : `53${digits}`;
  return `https://wa.me/${normalized}`;
}

export function EfectivoForm({ operadorId, onCreated, initialData }: { operadorId: number; onCreated: (codigo: string) => void; initialData?: EfectivoInitialData }) {
  const [form, setForm] = useState({
    monto_pago: initialData?.monto_pago ?? '230',
    moneda_pago: initialData?.moneda_pago ?? 'BRL',
    tipo_pago_id: '',
    punto_recogida_id: '',
    telefono_destinatario: '',
    documento_identidad_url: '',
    cliente_id: '',
    nombre_cliente: '',
    numero_telefono_cliente: '',
    observaciones: '',
  });
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [puntos, setPuntos] = useState<PuntoRecogida[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);

  const metodosFiltrados = useMemo<MetodoPago[]>(
    () => metodosPago.filter((metodo) => metodo.moneda === form.moneda_pago),
    [form.moneda_pago, metodosPago],
  );

  useEffect(() => {
    setCargandoCatalogos(true);
    Promise.all([listarMetodosPago(), listarPuntosRecogida()])
      .then(([metodos, puntosData]) => {
        setMetodosPago(metodos);
        setPuntos(puntosData);
        // Buscar Pix para BRL, sino el primero disponible
        const metodo = form.moneda_pago === 'BRL'
          ? metodos.find((item) => item.moneda === 'BRL' && item.nombre.toLowerCase() === 'pix')
          : metodos.find((item) => item.moneda === form.moneda_pago);
        setForm((current) => ({
          ...current,
          tipo_pago_id: metodo ? String(metodo.id) : '',
          punto_recogida_id: puntosData[0] ? String(puntosData[0].id) : '',
        }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar los catalogos'))
      .finally(() => setCargandoCatalogos(false));
  }, []);

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
      telefono_destinatario: contacto.telefono ?? current.telefono_destinatario,
      documento_identidad_url: contacto.documento_identidad_url ?? current.documento_identidad_url,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await crearEfectivo({
        monto_pago: Number(form.monto_pago),
        moneda_pago: form.moneda_pago,
        tipo_pago_id: Number(form.tipo_pago_id),
        operador_id: operadorId,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        nombre_cliente: form.nombre_cliente || undefined,
        numero_telefono_cliente: form.numero_telefono_cliente || undefined,
        telefono_destinatario: form.telefono_destinatario || undefined,
        documento_identidad_url: form.documento_identidad_url || undefined,
        punto_recogida_id: form.punto_recogida_id ? Number(form.punto_recogida_id) : null,
        observaciones: form.observaciones || undefined,
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
              <h3>Entrega en Cuba</h3>
              <p>Destinatario, documento y punto de recogida.</p>
            </div>
          </header>
          <div className="form-grid">
            <label>
              Telefono destinatario Cuba
              <span className="input-action-row">
                <input value={form.telefono_destinatario} onChange={(event) => update('telefono_destinatario', event.target.value)} placeholder="12345678" required />
                <a
                  className={form.telefono_destinatario ? 'icon-button field-action-button' : 'icon-button field-action-button disabled-link'}
                  href={whatsappHref(form.telefono_destinatario) || undefined}
                  target="_blank"
                  rel="noreferrer"
                  title="Llamar por WhatsApp"
                  aria-label="Llamar por WhatsApp"
                >
                  <MessageCircle size={18} />
                </a>
              </span>
            </label>
            <label>
              Documento identidad URL
              <input value={form.documento_identidad_url} onChange={(event) => update('documento_identidad_url', event.target.value)} />
            </label>
            <label className="wide">
              Punto de recogida
              <select
                value={form.punto_recogida_id}
                onChange={(event) => update('punto_recogida_id', event.target.value)}
                disabled={cargandoCatalogos || puntos.length === 0}
              >
                {puntos.length === 0 && <option value="">Sin puntos activos</option>}
                {puntos.map((punto) => (
                  <option key={punto.id} value={punto.id}>{punto.nombre}</option>
                ))}
              </select>
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
              <select
                value={form.tipo_pago_id}
                onChange={(event) => update('tipo_pago_id', event.target.value)}
                required
                disabled={cargandoCatalogos || metodosFiltrados.length === 0}
              >
                {metodosFiltrados.length === 0 && <option value="">Sin metodos para {form.moneda_pago}</option>}
                {metodosFiltrados.map((metodo) => (
                  <option key={metodo.id} value={metodo.id}>{metodo.nombre} · {metodo.moneda}</option>
                ))}
              </select>
            </label>
            <label className="wide">
              Observaciones
              <input value={form.observaciones} onChange={(event) => update('observaciones', event.target.value)} />
            </label>
          </div>
        </section>
      </div>
      {error && <div className="notice error">{error}</div>}
      <button className="primary-button create-submit-button" disabled={loading || !form.tipo_pago_id}>
        {loading ? 'Creando...' : 'Crear efectivo'}
      </button>
    </form>
  );
}
