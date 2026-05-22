import { FormEvent, useEffect, useState } from 'react';
import { Power, RefreshCw, Save } from 'lucide-react';
import { Modal } from '../components/Modal';
import {
  actualizarMetodoPago,
  actualizarOferta,
  actualizarPaqueteSaldo,
  actualizarPuntoRecogida,
  crearCliente,
  crearContacto,
  crearMetodoPago,
  guardarConfiguracion,
  guardarTemplate,
  crearOferta,
  crearPaqueteSaldo,
  crearPuntoRecogida,
  eliminarMetodoPago,
  eliminarOferta,
  eliminarPaqueteSaldo,
  eliminarPuntoRecogida,
  listarClientes,
  listarConfiguraciones,
  listarContactos,
  listarMetodosPago,
  listarOfertas,
  listarPaquetesSaldo,
  listarPuntosRecogida,
  listarTemplates,
} from '../api/client';
import type { Cliente, Configuracion, Contacto, MetodoPago, Oferta, PaqueteSaldo, PuntoRecogida, TemplateConfig } from '../types/api';

const monedas = ['BRL', 'UYU', 'USD', 'EUR'];
const servicios = ['transferencia', 'efectivo', 'saldo', 'mlc', 'usd', 'clasica', 'divisa'];

export function AdminCatalogosPage() {
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [puntos, setPuntos] = useState<PuntoRecogida[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [paquetes, setPaquetes] = useState<PaqueteSaldo[]>([]);
  const [configuraciones, setConfiguraciones] = useState<Configuracion[]>([]);
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [metodoForm, setMetodoForm] = useState({ nombre: '', moneda: 'BRL' });
  const [puntoForm, setPuntoForm] = useState({ nombre: '', direccion: '', telefono: '' });
  const [ofertaForm, setOfertaForm] = useState({ servicio: 'transferencia', nombre: '', tasa: '118', minimo_pago: '0', moneda_pago: 'BRL' });
  const [paqueteForm, setPaqueteForm] = useState({ nombre: '', monto_pago: '10', moneda_pago: 'BRL', saldo_cup: '1000' });
  const [configForm, setConfigForm] = useState({ clave: '', valor: '' });
  const [templateForm, setTemplateForm] = useState({ clave: 'template_transferencia', valor: '' });
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [clienteForm, setClienteForm] = useState({ nombre: '', telefono: '', email: '', pais: 'br', moneda_preferida: 'BRL' });
  const [contactoForm, setContactoForm] = useState({ cliente_id: '', nombre: '', telefono: '', numero_tarjeta: '', tipo_tarjeta: '', documento_identidad_url: '', pais: 'cu', notas: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [metodosData, puntosData, ofertasData, paquetesData, configuracionesData, templatesData, clientesData, contactosData] = await Promise.all([
        listarMetodosPago(undefined, true),
        listarPuntosRecogida(true),
        listarOfertas(true),
        listarPaquetesSaldo(undefined, true),
        listarConfiguraciones(),
        listarTemplates(),
        listarClientes(undefined, true),
        listarContactos(undefined, true),
      ]);
      setMetodos(metodosData);
      setPuntos(puntosData);
      setOfertas(ofertasData);
      setPaquetes(paquetesData);
      setConfiguraciones(configuracionesData);
      setTemplates(templatesData);
      setClientes(clientesData);
      setContactos(contactosData);
      if (templatesData.length) {
        setTemplateForm((current) => {
          const selected = templatesData.find((item) => item.clave === current.clave) ?? templatesData[0];
          return { clave: selected.clave, valor: selected.valor };
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los catalogos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function guardarMetodo(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await crearMetodoPago(metodoForm);
      setMetodoForm({ nombre: '', moneda: metodoForm.moneda });
      setNotice('Metodo de pago creado');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el metodo');
    }
  }

  async function guardarPunto(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await crearPuntoRecogida({
        nombre: puntoForm.nombre,
        direccion: puntoForm.direccion,
        telefono: puntoForm.telefono || undefined,
      });
      setPuntoForm({ nombre: '', direccion: '', telefono: '' });
      setNotice('Punto de recogida creado');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el punto');
    }
  }


  async function guardarOferta(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await crearOferta({
        servicio: ofertaForm.servicio,
        nombre: ofertaForm.nombre || undefined,
        tasa: Number(ofertaForm.tasa),
        minimo_pago: Number(ofertaForm.minimo_pago),
        moneda_pago: ofertaForm.moneda_pago,
        origen: 'manual',
      });
      setOfertaForm((current) => ({ ...current, nombre: '' }));
      setNotice('Oferta creada');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la oferta');
    }
  }

  async function guardarPaquete(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await crearPaqueteSaldo({
        nombre: paqueteForm.nombre,
        monto_pago: Number(paqueteForm.monto_pago),
        moneda_pago: paqueteForm.moneda_pago,
        saldo_cup: Number(paqueteForm.saldo_cup),
        origen: 'manual',
      });
      setPaqueteForm((current) => ({ ...current, nombre: '' }));
      setNotice('Paquete creado');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el paquete');
    }
  }


  async function guardarConfig(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await guardarConfiguracion(configForm);
      setNotice('Configuracion guardada');
      setConfigModalOpen(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la configuracion');
    }
  }


  async function guardarCliente(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await crearCliente({
        nombre: clienteForm.nombre,
        telefono: clienteForm.telefono || undefined,
        email: clienteForm.email || undefined,
        pais: clienteForm.pais || undefined,
        moneda_preferida: clienteForm.moneda_preferida,
      });
      setClienteForm((current) => ({ ...current, nombre: '', telefono: '', email: '' }));
      setNotice('Cliente creado');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el cliente');
    }
  }

  async function guardarContacto(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await crearContacto({
        cliente_id: contactoForm.cliente_id ? Number(contactoForm.cliente_id) : null,
        nombre: contactoForm.nombre,
        telefono: contactoForm.telefono || undefined,
        numero_tarjeta: contactoForm.numero_tarjeta || undefined,
        tipo_tarjeta: contactoForm.tipo_tarjeta || undefined,
        documento_identidad_url: contactoForm.documento_identidad_url || undefined,
        pais: contactoForm.pais || undefined,
        notas: contactoForm.notas || undefined,
      });
      setContactoForm((current) => ({ ...current, nombre: '', telefono: '', numero_tarjeta: '', documento_identidad_url: '', notas: '' }));
      setNotice('Contacto creado');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el contacto');
    }
  }

  async function guardarTemplateActual(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await guardarTemplate(templateForm.clave, templateForm.valor);
      setNotice('Template guardado');
      setTemplateModalOpen(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el template');
    }
  }

  function seleccionarTemplate(clave: string) {
    const template = templates.find((item) => item.clave === clave);
    setTemplateForm({ clave, valor: template?.valor ?? '' });
  }

  function abrirConfig(item: Configuracion) {
    setConfigForm({ clave: item.clave, valor: item.valor });
    setConfigModalOpen(true);
  }

  function abrirTemplate(clave: string) {
    seleccionarTemplate(clave);
    setTemplateModalOpen(true);
  }

  async function toggleMetodo(metodo: MetodoPago) {
    setError(null);
    setNotice(null);
    try {
      await actualizarMetodoPago(metodo.id, { activo: !metodo.activo });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el metodo');
    }
  }

  async function togglePunto(punto: PuntoRecogida) {
    setError(null);
    setNotice(null);
    try {
      await actualizarPuntoRecogida(punto.id, { activo: !punto.activo });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el punto');
    }
  }


  async function toggleOferta(oferta: Oferta) {
    setError(null);
    setNotice(null);
    try {
      await actualizarOferta(oferta.id, { activa: !oferta.activa });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la oferta');
    }
  }

  async function togglePaquete(paquete: PaqueteSaldo) {
    setError(null);
    setNotice(null);
    try {
      await actualizarPaqueteSaldo(paquete.id, { activo: !paquete.activo });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el paquete');
    }
  }

  async function desactivarMetodo(id: number) {
    setError(null);
    setNotice(null);
    try {
      await eliminarMetodoPago(id);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar el metodo');
    }
  }

  async function desactivarPunto(id: number) {
    setError(null);
    setNotice(null);
    try {
      await eliminarPuntoRecogida(id);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar el punto');
    }
  }


  async function desactivarOferta(id: number) {
    setError(null);
    setNotice(null);
    try {
      await eliminarOferta(id);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar la oferta');
    }
  }

  async function desactivarPaquete(id: number) {
    setError(null);
    setNotice(null);
    try {
      await eliminarPaqueteSaldo(id);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar el paquete');
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-toolbar">
        <button className="icon-button" onClick={cargar} disabled={loading} title="Actualizar catalogos">
          <RefreshCw size={18} />
        </button>
      </div>
      {error && <div className="notice error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <div className="admin-kanban-board">
        <section className="admin-panel admin-kanban-column">
          <h2>Metodos de pago</h2>
          <form className="inline-form" onSubmit={guardarMetodo}>
            <input value={metodoForm.nombre} onChange={(event) => setMetodoForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <select value={metodoForm.moneda} onChange={(event) => setMetodoForm((current) => ({ ...current, moneda: event.target.value }))}>
              {monedas.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
            </select>
            <button className="primary-button"><Save size={18} /> Crear</button>
          </form>
          <div className="data-table compact admin-card-list">
            {metodos.map((metodo) => (
              <div className="catalog-row" key={metodo.id}>
                <span><strong>{metodo.nombre}</strong><small>{metodo.moneda}</small></span>
                <span className={metodo.activo ? 'status completado' : 'status cancelado'}>{metodo.activo ? 'activo' : 'inactivo'}</span>
                <button className="icon-button" onClick={() => toggleMetodo(metodo)} title="Cambiar estado"><Power size={18} /></button>
                <button className="ghost-button" onClick={() => desactivarMetodo(metodo.id)}>Desactivar</button>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel admin-kanban-column">
          <h2>Puntos de recogida</h2>
          <form className="stack-form" onSubmit={guardarPunto}>
            <input value={puntoForm.nombre} onChange={(event) => setPuntoForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <input value={puntoForm.direccion} onChange={(event) => setPuntoForm((current) => ({ ...current, direccion: event.target.value }))} placeholder="Direccion" required />
            <input value={puntoForm.telefono} onChange={(event) => setPuntoForm((current) => ({ ...current, telefono: event.target.value }))} placeholder="Telefono opcional" />
            <button className="primary-button"><Save size={18} /> Crear punto</button>
          </form>
          <div className="data-table compact admin-card-list">
            {puntos.map((punto) => (
              <div className="catalog-row" key={punto.id}>
                <span><strong>{punto.nombre}</strong><small>{punto.direccion}</small></span>
                <span className={punto.activo ? 'status completado' : 'status cancelado'}>{punto.activo ? 'activo' : 'inactivo'}</span>
                <button className="icon-button" onClick={() => togglePunto(punto)} title="Cambiar estado"><Power size={18} /></button>
                <button className="ghost-button" onClick={() => desactivarPunto(punto.id)}>Desactivar</button>
              </div>
            ))}
          </div>
        </section>


        <section className="admin-panel admin-kanban-column">
          <h2>Ofertas</h2>
          <form className="stack-form" onSubmit={guardarOferta}>
            <select value={ofertaForm.servicio} onChange={(event) => setOfertaForm((current) => ({ ...current, servicio: event.target.value }))}>
              {servicios.map((servicio) => <option key={servicio} value={servicio}>{servicio}</option>)}
            </select>
            <input value={ofertaForm.nombre} onChange={(event) => setOfertaForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre opcional" />
            <div className="inline-form three">
              <input value={ofertaForm.tasa} onChange={(event) => setOfertaForm((current) => ({ ...current, tasa: event.target.value }))} inputMode="decimal" placeholder="Tasa" required />
              <input value={ofertaForm.minimo_pago} onChange={(event) => setOfertaForm((current) => ({ ...current, minimo_pago: event.target.value }))} inputMode="decimal" placeholder="Minimo" required />
              <select value={ofertaForm.moneda_pago} onChange={(event) => setOfertaForm((current) => ({ ...current, moneda_pago: event.target.value }))}>
                {monedas.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
              </select>
            </div>
            <button className="primary-button"><Save size={18} /> Crear oferta</button>
          </form>
          <div className="data-table compact admin-card-list">
            {ofertas.map((oferta) => (
              <div className="catalog-row" key={oferta.id}>
                <span><strong>{oferta.servicio} · {oferta.tasa}</strong><small>{oferta.moneda_pago} · minimo {oferta.minimo_pago ?? 0} · {oferta.origen}</small></span>
                <span className={oferta.activa ? 'status completado' : 'status cancelado'}>{oferta.activa ? 'activa' : 'inactiva'}</span>
                <button className="icon-button" onClick={() => toggleOferta(oferta)} title="Cambiar estado"><Power size={18} /></button>
                <button className="ghost-button" onClick={() => desactivarOferta(oferta.id)}>Desactivar</button>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel admin-kanban-column">
          <h2>Paquetes de saldo</h2>
          <form className="stack-form" onSubmit={guardarPaquete}>
            <input value={paqueteForm.nombre} onChange={(event) => setPaqueteForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <div className="inline-form three">
              <input value={paqueteForm.monto_pago} onChange={(event) => setPaqueteForm((current) => ({ ...current, monto_pago: event.target.value }))} inputMode="decimal" placeholder="Monto pago" required />
              <input value={paqueteForm.saldo_cup} onChange={(event) => setPaqueteForm((current) => ({ ...current, saldo_cup: event.target.value }))} inputMode="numeric" placeholder="Saldo CUP" required />
              <select value={paqueteForm.moneda_pago} onChange={(event) => setPaqueteForm((current) => ({ ...current, moneda_pago: event.target.value }))}>
                {monedas.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
              </select>
            </div>
            <button className="primary-button"><Save size={18} /> Crear paquete</button>
          </form>
          <div className="data-table compact admin-card-list">
            {paquetes.map((paquete) => (
              <div className="catalog-row" key={paquete.id}>
                <span><strong>{paquete.nombre}</strong><small>{paquete.monto_pago} {paquete.moneda_pago} · {paquete.saldo_cup} CUP · {paquete.origen}</small></span>
                <span className={paquete.activo ? 'status completado' : 'status cancelado'}>{paquete.activo ? 'activo' : 'inactivo'}</span>
                <button className="icon-button" onClick={() => togglePaquete(paquete)} title="Cambiar estado"><Power size={18} /></button>
                <button className="ghost-button" onClick={() => desactivarPaquete(paquete.id)}>Desactivar</button>
              </div>
            ))}
          </div>
        </section>



        <section className="admin-panel admin-kanban-column wide-admin">
          <h2>Clientes y contactos</h2>
          <div className="config-grid">
            <form className="stack-form" onSubmit={guardarCliente}>
              <input value={clienteForm.nombre} onChange={(event) => setClienteForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre cliente" required />
              <input value={clienteForm.telefono} onChange={(event) => setClienteForm((current) => ({ ...current, telefono: event.target.value }))} placeholder="Telefono" />
              <input value={clienteForm.email} onChange={(event) => setClienteForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
              <div className="inline-form three">
                <input value={clienteForm.pais} onChange={(event) => setClienteForm((current) => ({ ...current, pais: event.target.value }))} placeholder="pais" />
                <select value={clienteForm.moneda_preferida} onChange={(event) => setClienteForm((current) => ({ ...current, moneda_preferida: event.target.value }))}>
                  {monedas.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
                </select>
                <button className="primary-button"><Save size={18} /> Crear cliente</button>
              </div>
            </form>
            <form className="stack-form" onSubmit={guardarContacto}>
              <select value={contactoForm.cliente_id} onChange={(event) => setContactoForm((current) => ({ ...current, cliente_id: event.target.value }))}>
                <option value="">Sin cliente</option>
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre} #{cliente.id}</option>)}
              </select>
              <input value={contactoForm.nombre} onChange={(event) => setContactoForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre contacto" required />
              <input value={contactoForm.telefono} onChange={(event) => setContactoForm((current) => ({ ...current, telefono: event.target.value }))} placeholder="Telefono Cuba" />
              <div className="inline-form three">
                <input value={contactoForm.numero_tarjeta} onChange={(event) => setContactoForm((current) => ({ ...current, numero_tarjeta: event.target.value }))} placeholder="Tarjeta" />
                <input value={contactoForm.tipo_tarjeta} onChange={(event) => setContactoForm((current) => ({ ...current, tipo_tarjeta: event.target.value }))} placeholder="Tipo tarjeta" />
                <input value={contactoForm.pais} onChange={(event) => setContactoForm((current) => ({ ...current, pais: event.target.value }))} placeholder="pais" />
              </div>
              <input value={contactoForm.documento_identidad_url} onChange={(event) => setContactoForm((current) => ({ ...current, documento_identidad_url: event.target.value }))} placeholder="Documento URL" />
              <input value={contactoForm.notas} onChange={(event) => setContactoForm((current) => ({ ...current, notas: event.target.value }))} placeholder="Notas" />
              <button className="primary-button"><Save size={18} /> Crear contacto</button>
            </form>
          </div>
          <div className="admin-split-list">
            <div className="config-list">
              {clientes.map((cliente) => (
                <button type="button" className="config-row" key={cliente.id} onClick={() => setClienteForm({ nombre: cliente.nombre, telefono: cliente.telefono ?? '', email: cliente.email ?? '', pais: cliente.pais ?? 'br', moneda_preferida: cliente.moneda_preferida ?? 'BRL' })}>
                  <strong>{cliente.nombre} #{cliente.id}</strong>
                  <span>{cliente.telefono ?? 'sin telefono'} · {cliente.moneda_preferida ?? 'sin moneda'}</span>
                </button>
              ))}
            </div>
            <div className="config-list">
              {contactos.map((contacto) => (
                <button type="button" className="config-row" key={contacto.id} onClick={() => setContactoForm({ cliente_id: contacto.cliente_id ? String(contacto.cliente_id) : '', nombre: contacto.nombre, telefono: contacto.telefono ?? '', numero_tarjeta: contacto.numero_tarjeta ?? '', tipo_tarjeta: contacto.tipo_tarjeta ?? '', documento_identidad_url: contacto.documento_identidad_url ?? '', pais: contacto.pais ?? 'cu', notas: contacto.notas ?? '' })}>
                  <strong>{contacto.nombre} #{contacto.id}</strong>
                  <span>{contacto.telefono ?? 'sin telefono'} · cliente {contacto.cliente_id ?? 'sin asociar'}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-panel admin-kanban-column wide-admin">
          <h2>Configuracion y templates</h2>
          <div className="admin-actions-row">
            <button type="button" className="primary-button" onClick={() => { setConfigForm({ clave: '', valor: '' }); setConfigModalOpen(true); }}>
              <Save size={18} /> Nueva configuracion
            </button>
            <button type="button" className="ghost-button" onClick={() => abrirTemplate(templateForm.clave)} disabled={templates.length === 0}>
              Editar template
            </button>
          </div>
          <div className="admin-split-list">
            <div className="config-list">
              {configuraciones.map((item) => (
                <button type="button" className="config-row" key={item.clave} onClick={() => abrirConfig(item)}>
                  <strong>{item.clave}</strong>
                  <span>{item.valor}</span>
                </button>
              ))}
            </div>
            <div className="config-list">
              {templates.map((template) => (
                <button type="button" className="config-row" key={template.clave} onClick={() => abrirTemplate(template.clave)}>
                  <strong>{template.clave}</strong>
                  <span>{template.valor}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
        {configModalOpen && (
          <Modal title="Configuracion" subtitle={configForm.clave || 'Nueva clave'} onClose={() => setConfigModalOpen(false)} wide>
            <form className="stack-form modal-form" onSubmit={guardarConfig}>
              <input value={configForm.clave} onChange={(event) => setConfigForm((current) => ({ ...current, clave: event.target.value }))} placeholder="clave" required />
              <textarea value={configForm.valor} onChange={(event) => setConfigForm((current) => ({ ...current, valor: event.target.value }))} placeholder="valor" rows={10} required />
              <button className="primary-button"><Save size={18} /> Guardar configuracion</button>
            </form>
          </Modal>
        )}
        {templateModalOpen && (
          <Modal title="Template" subtitle={templateForm.clave} onClose={() => setTemplateModalOpen(false)} wide>
            <form className="stack-form modal-form" onSubmit={guardarTemplateActual}>
              <select value={templateForm.clave} onChange={(event) => seleccionarTemplate(event.target.value)}>
                {templates.map((template) => <option key={template.clave} value={template.clave}>{template.clave}</option>)}
              </select>
              <textarea value={templateForm.valor} onChange={(event) => setTemplateForm((current) => ({ ...current, valor: event.target.value }))} rows={12} />
              <button className="primary-button"><Save size={18} /> Guardar template</button>
            </form>
          </Modal>
        )}
      </div>
    </section>
  );
}
