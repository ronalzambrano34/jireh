import { type DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Banknote, ChevronDown, FileText, ImagePlus, MapPin, Package, Power, RefreshCw, Save, Settings2, Tags, UploadCloud, UserRound, UsersRound } from 'lucide-react';
import { Modal } from '../components/Modal';
import {
  actualizarMetodoPago,
  actualizarOferta,
  actualizarOperador,
  actualizarPaqueteSaldo,
  actualizarPuntoRecogida,
  crearCliente,
  crearContacto,
  crearMetodoPago,
  crearOperador,
  eliminarOperador,
  guardarConfiguracion,
  guardarTemplate,
  crearOferta,
  crearPaqueteSaldo,
  crearPuntoRecogida,
  listarClientes,
  listarConfiguraciones,
  listarContactos,
  listarMetodosPago,
  listarOfertas,
  listarOperadores,
  listarPaquetesSaldo,
  listarPuntosRecogida,
  listarTemplates,
  subirImagenMetodoPago,
} from '../api/client';
import type { Cliente, Configuracion, Contacto, MetodoPago, Oferta, Operador, PaqueteSaldo, PuntoRecogida, TemplateConfig } from '../types/api';
import { metodoPagoVisual } from '../utils/metodosPago';

const monedas = ['BRL', 'UYU', 'USD', 'EUR'];
const servicios = ['transferencia', 'efectivo', 'saldo', 'mlc', 'usd', 'clasica', 'divisa'];
const rolesOperador = ['operador', 'supervisor', 'admin'];

type AdminEstadoVista = 'activos' | 'inactivos';
type AdminTema = 'metodos' | 'puntos' | 'ofertas' | 'paquetes' | 'clientes' | 'contactos' | 'operadores' | 'configuracion' | 'templates';

function tituloTema(tema: AdminTema | null) {
  if (tema === 'metodos') return 'Metodos de pago';
  if (tema === 'puntos') return 'Puntos de recogida';
  if (tema === 'ofertas') return 'Ofertas';
  if (tema === 'paquetes') return 'Paquetes de saldo';
  if (tema === 'clientes') return 'Clientes';
  if (tema === 'contactos') return 'Contactos';
  if (tema === 'operadores') return 'Operadores';
  if (tema === 'configuracion') return 'Configuracion';
  if (tema === 'templates') return 'Templates';
  return 'Catalogos';
}

function servicioLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}


export function AdminCatalogosPage() {
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [puntos, setPuntos] = useState<PuntoRecogida[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [paquetes, setPaquetes] = useState<PaqueteSaldo[]>([]);
  const [configuraciones, setConfiguraciones] = useState<Configuracion[]>([]);
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [metodoForm, setMetodoForm] = useState({ nombre: '', moneda: 'BRL', imagen_url: '', activo: true });
  const [puntoForm, setPuntoForm] = useState({ nombre: '', direccion: '', telefono: '' });
  const [ofertaForm, setOfertaForm] = useState({ servicio: 'transferencia', nombre: '', tasa: '', minimo_pago: '', moneda_pago: 'BRL' });
  const [paqueteForm, setPaqueteForm] = useState({ nombre: '', monto_pago: '', moneda_pago: 'BRL', saldo_cup: '' });
  const [configForm, setConfigForm] = useState({ clave: '', valor: '' });
  const [templateForm, setTemplateForm] = useState({ clave: 'template_transferencia', valor: '' });
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [clienteForm, setClienteForm] = useState({ nombre: '', telefono: '', email: '', pais: '', moneda_preferida: 'BRL' });
  const [contactoForm, setContactoForm] = useState({ cliente_id: '', nombre: '', telefono: '', numero_tarjeta: '', tipo_tarjeta: '', documento_identidad_url: '', pais: '', notas: '' });
  const [operadorForm, setOperadorForm] = useState({ nombre: '', telefono: '', password: '', rol: 'operador', activo: true });
  const [operadorEditando, setOperadorEditando] = useState<Operador | null>(null);
  const [metodoEditando, setMetodoEditando] = useState<MetodoPago | null>(null);
  const [metodoUploading, setMetodoUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [estadoVista, setEstadoVista] = useState<AdminEstadoVista>('activos');
  const [temaActivo, setTemaActivo] = useState<AdminTema | null>(null);
  const [crearModalTema, setCrearModalTema] = useState<AdminTema | null>(null);

  const mostrarActivos = estadoVista === 'activos';
  const metodosVisibles = useMemo(() => metodos.filter((metodo) => metodo.activo === mostrarActivos), [metodos, mostrarActivos]);
  const puntosVisibles = useMemo(() => puntos.filter((punto) => punto.activo === mostrarActivos), [puntos, mostrarActivos]);
  const ofertasVisibles = useMemo(() => ofertas.filter((oferta) => oferta.activa === mostrarActivos), [ofertas, mostrarActivos]);
  const ofertasPorServicio = useMemo(() => {
    const grupos = new Map<string, Oferta[]>();
    ofertasVisibles.forEach((oferta) => {
      const servicio = oferta.servicio || 'sin_servicio';
      grupos.set(servicio, [...(grupos.get(servicio) ?? []), oferta]);
    });

    return Array.from(grupos.entries()).sort(([servicioA], [servicioB]) => servicioA.localeCompare(servicioB));
  }, [ofertasVisibles]);
  const paquetesVisibles = useMemo(() => paquetes.filter((paquete) => paquete.activo === mostrarActivos), [paquetes, mostrarActivos]);
  const clientesVisibles = useMemo(() => clientes.filter((cliente) => cliente.activo === mostrarActivos), [clientes, mostrarActivos]);
  const contactosVisibles = useMemo(() => contactos.filter((contacto) => contacto.activo === mostrarActivos), [contactos, mostrarActivos]);
  const operadoresVisibles = useMemo(() => operadores.filter((item) => item.activo === mostrarActivos), [operadores, mostrarActivos]);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [metodosData, puntosData, ofertasData, paquetesData, configuracionesData, templatesData, clientesData, contactosData, operadoresData] = await Promise.all([
        listarMetodosPago(undefined, true),
        listarPuntosRecogida(true),
        listarOfertas(true),
        listarPaquetesSaldo(undefined, true),
        listarConfiguraciones(),
        listarTemplates(),
        listarClientes(undefined, true),
        listarContactos(undefined, true),
        listarOperadores(true),
      ]);
      setMetodos(metodosData);
      setPuntos(puntosData);
      setOfertas(ofertasData);
      setPaquetes(paquetesData);
      setConfiguraciones(configuracionesData);
      setTemplates(templatesData);
      setClientes(clientesData);
      setContactos(contactosData);
      setOperadores(operadoresData);
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

  function abrirTema(tema: AdminTema) {
    setTemaActivo(tema);
    setError(null);
    setNotice(null);
  }

  function volverMenu() {
    setTemaActivo(null);
    setError(null);
    setNotice(null);
  }

  function abrirCrearModal(tema: AdminTema) {
    if (tema === 'metodos') setMetodoForm({ nombre: '', moneda: 'BRL', imagen_url: '', activo: true });
    if (tema === 'puntos') setPuntoForm({ nombre: '', direccion: '', telefono: '' });
    if (tema === 'ofertas') setOfertaForm({ servicio: 'transferencia', nombre: '', tasa: '', minimo_pago: '', moneda_pago: 'BRL' });
    if (tema === 'paquetes') setPaqueteForm({ nombre: '', monto_pago: '', moneda_pago: 'BRL', saldo_cup: '' });
    if (tema === 'clientes') setClienteForm({ nombre: '', telefono: '', email: '', pais: '', moneda_preferida: 'BRL' });
    if (tema === 'contactos') setContactoForm({ cliente_id: '', nombre: '', telefono: '', numero_tarjeta: '', tipo_tarjeta: '', documento_identidad_url: '', pais: '', notas: '' });
    if (tema === 'operadores') setOperadorForm({ nombre: '', telefono: '', password: '', rol: 'operador', activo: true });
    setError(null);
    setNotice(null);
    setCrearModalTema(tema);
  }

  async function guardarMetodo(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await crearMetodoPago({
        nombre: metodoForm.nombre,
        moneda: metodoForm.moneda,
        imagen_url: metodoForm.imagen_url || undefined,
      });
      setMetodoForm({ nombre: '', moneda: metodoForm.moneda, imagen_url: '', activo: true });
      setNotice('Metodo de pago creado');
      setCrearModalTema(null);
      setEstadoVista('activos');
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
      setCrearModalTema(null);
      setEstadoVista('activos');
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
      setCrearModalTema(null);
      setEstadoVista('activos');
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
      setCrearModalTema(null);
      setEstadoVista('activos');
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
      setCrearModalTema(null);
      setEstadoVista('activos');
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
      setCrearModalTema(null);
      setEstadoVista('activos');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el contacto');
    }
  }

  async function guardarOperador(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await crearOperador({
        nombre: operadorForm.nombre,
        telefono: operadorForm.telefono,
        password: operadorForm.password || undefined,
        rol: operadorForm.rol,
      });
      setOperadorForm({ nombre: '', telefono: '', password: '', rol: 'operador', activo: true });
      setNotice('Operador creado');
      setCrearModalTema(null);
      setEstadoVista('activos');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el operador');
    }
  }

  function abrirEditarOperador(item: Operador) {
    setOperadorEditando(item);
    setOperadorForm({
      nombre: item.nombre,
      telefono: item.telefono ?? '',
      password: '',
      rol: item.rol,
      activo: item.activo,
    });
    setError(null);
    setNotice(null);
  }

  async function guardarOperadorEditado(event: FormEvent) {
    event.preventDefault();
    if (!operadorEditando) return;
    setError(null);
    setNotice(null);
    try {
      await actualizarOperador(operadorEditando.id, {
        nombre: operadorForm.nombre,
        telefono: operadorForm.telefono,
        password: operadorForm.password || undefined,
        rol: operadorForm.rol,
        activo: operadorForm.activo,
      });
      setNotice('Operador actualizado');
      setOperadorEditando(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el operador');
    }
  }

  async function toggleOperador(item: Operador) {
    setError(null);
    setNotice(null);
    try {
      if (item.activo) {
        await eliminarOperador(item.id);
      } else {
        await actualizarOperador(item.id, { activo: true });
      }
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado del operador');
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

  function abrirEditarMetodo(metodo: MetodoPago) {
    setMetodoEditando(metodo);
    setMetodoForm({
      nombre: metodo.nombre,
      moneda: metodo.moneda,
      imagen_url: metodo.imagen_url ?? '',
      activo: metodo.activo,
    });
    setError(null);
    setNotice(null);
  }

  async function guardarMetodoEditado(event: FormEvent) {
    event.preventDefault();
    if (!metodoEditando) return;
    setError(null);
    setNotice(null);
    try {
      await actualizarMetodoPago(metodoEditando.id, {
        nombre: metodoForm.nombre,
        moneda: metodoForm.moneda,
        imagen_url: metodoForm.imagen_url || null,
        activo: metodoForm.activo,
      });
      setNotice('Metodo de pago actualizado');
      setMetodoEditando(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el metodo');
    }
  }

  async function subirImagenMetodo(file: File) {
    if (!metodoEditando) return;
    setError(null);
    setNotice(null);
    setMetodoUploading(true);
    try {
      const actualizado = await subirImagenMetodoPago(metodoEditando.id, file);
      setMetodoEditando(actualizado);
      setMetodoForm((current) => ({ ...current, imagen_url: actualizado.imagen_url ?? '' }));
      setNotice('Imagen del metodo actualizada');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setMetodoUploading(false);
    }
  }

  function manejarDropImagenMetodo(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void subirImagenMetodo(file);
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

  return (
    <section className="admin-page admin-surface">
      <div className="admin-hero-card">
        <div className="admin-hero-main">
          {temaActivo ? (
            <button className="icon-button" type="button" onClick={volverMenu} title="Volver a administracion" aria-label="Volver a administracion">
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div className="admin-hero-icon"><Settings2 size={24} /></div>
          )}
          <div>
            <h2>{tituloTema(temaActivo)}</h2>
            <p>{loading ? 'Actualizando...' : temaActivo ? `Administracion / ${tituloTema(temaActivo)}` : 'Administracion'}</p>
          </div>
          <button className="icon-button" onClick={cargar} disabled={loading} title="Actualizar catalogos" aria-label="Actualizar catalogos">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      {!temaActivo && (
        <>
          <div className="profile-section admin-menu-section">
            <h3>Catalogos operativos</h3>
            <button className="profile-option admin-topic-option" type="button" onClick={() => abrirTema('metodos')}>
              <Banknote size={22} />
              <span><strong>Metodos de pago</strong><small>{metodos.filter((item) => item.activo).length} activos · {metodos.filter((item) => !item.activo).length} inactivos</small></span>
              <ChevronDown size={18} />
            </button>
            <button className="profile-option admin-topic-option" type="button" onClick={() => abrirTema('puntos')}>
              <MapPin size={22} />
              <span><strong>Puntos de recogida</strong><small>{puntos.filter((item) => item.activo).length} activos · {puntos.filter((item) => !item.activo).length} inactivos</small></span>
              <ChevronDown size={18} />
            </button>
            <button className="profile-option admin-topic-option" type="button" onClick={() => abrirTema('ofertas')}>
              <Tags size={22} />
              <span><strong>Ofertas</strong><small>{ofertas.filter((item) => item.activa).length} activas · {ofertas.filter((item) => !item.activa).length} inactivas</small></span>
              <ChevronDown size={18} />
            </button>
            <button className="profile-option admin-topic-option" type="button" onClick={() => abrirTema('paquetes')}>
              <Package size={22} />
              <span><strong>Paquetes de saldo</strong><small>{paquetes.filter((item) => item.activo).length} activos · {paquetes.filter((item) => !item.activo).length} inactivos</small></span>
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="profile-section admin-menu-section">
            <h3>Personas</h3>
            <button className="profile-option admin-topic-option" type="button" onClick={() => abrirTema('clientes')}>
              <UsersRound size={22} />
              <span><strong>Clientes</strong><small>{clientes.filter((item) => item.activo).length} activos · {clientes.filter((item) => !item.activo).length} inactivos</small></span>
              <ChevronDown size={18} />
            </button>
            <button className="profile-option admin-topic-option" type="button" onClick={() => abrirTema('contactos')}>
              <UserRound size={22} />
              <span><strong>Contactos</strong><small>{contactos.filter((item) => item.activo).length} activos · {contactos.filter((item) => !item.activo).length} inactivos</small></span>
              <ChevronDown size={18} />
            </button>
            <button className="profile-option admin-topic-option" type="button" onClick={() => abrirTema('operadores')}>
              <UsersRound size={22} />
              <span><strong>Operadores</strong><small>{operadores.filter((item) => item.activo).length} activos · {operadores.filter((item) => !item.activo).length} inactivos</small></span>
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="profile-section admin-menu-section">
            <h3>Sistema</h3>
            <button className="profile-option admin-topic-option" type="button" onClick={() => abrirTema('configuracion')}>
              <Settings2 size={22} />
              <span><strong>Configuracion</strong><small>{configuraciones.length} claves</small></span>
              <ChevronDown size={18} />
            </button>
            <button className="profile-option admin-topic-option" type="button" onClick={() => abrirTema('templates')}>
              <FileText size={22} />
              <span><strong>Templates</strong><small>{templates.length} plantillas</small></span>
              <ChevronDown size={18} />
            </button>
          </div>
        </>
      )}

      {temaActivo === 'metodos' && (
        <section className="admin-section admin-detail-section">
          <header className="admin-section-header">
            <span className="admin-section-icon"><Banknote size={22} /></span>
            <div>
              <h3>Metodos de pago</h3>
              <small>{metodosVisibles.length} de {metodos.length}</small>
            </div>
            <button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('metodos')}>
              Crear
            </button>
          </header>
          <div className="admin-state-switch" role="group" aria-label="Vista de registros">
            <button type="button" className={estadoVista === 'activos' ? 'active' : ''} onClick={() => setEstadoVista('activos')}>Activos</button>
            <button type="button" className={estadoVista === 'inactivos' ? 'active' : ''} onClick={() => setEstadoVista('inactivos')}>Inactivos</button>
          </div>
          <div className="admin-card-list">
            {metodosVisibles.length === 0 && <div className="admin-empty-row">Sin registros {estadoVista}</div>}
            {metodosVisibles.map((metodo) => {
              const visual = metodoPagoVisual(metodo);
              return (
              <div className="catalog-row payment-method-admin-row" key={metodo.id}>
                <button type="button" className="payment-method-admin-main" onClick={() => abrirEditarMetodo(metodo)}>
                  <span className="payment-method-logo" aria-hidden="true">{visual.src ? <img src={visual.src} alt="" /> : <span>{visual.initials}</span>}</span>
                  <span><strong>{metodo.nombre}</strong><small>{metodo.moneda}{metodo.imagen_url ? ' · imagen propia' : ' · logo automatico'}</small></span>
                </button>
                <span className={metodo.activo ? 'status completado' : 'status cancelado'}>{metodo.activo ? 'activo' : 'inactivo'}</span>
                <button className="ghost-button catalog-toggle-action" onClick={() => toggleMetodo(metodo)}><Power size={18} /> {metodo.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {temaActivo === 'puntos' && (
        <section className="admin-section admin-detail-section">
          <header className="admin-section-header">
            <span className="admin-section-icon"><MapPin size={22} /></span>
            <div>
              <h3>Puntos de recogida</h3>
              <small>{puntosVisibles.length} de {puntos.length}</small>
            </div>
            <button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('puntos')}>
              Crear
            </button>
          </header>
          <div className="admin-state-switch" role="group" aria-label="Vista de registros">
            <button type="button" className={estadoVista === 'activos' ? 'active' : ''} onClick={() => setEstadoVista('activos')}>Activos</button>
            <button type="button" className={estadoVista === 'inactivos' ? 'active' : ''} onClick={() => setEstadoVista('inactivos')}>Inactivos</button>
          </div>
          <div className="admin-card-list">
            {puntosVisibles.length === 0 && <div className="admin-empty-row">Sin registros {estadoVista}</div>}
            {puntosVisibles.map((punto) => (
              <div className="catalog-row" key={punto.id}>
                <span><strong>{punto.nombre}</strong><small>{punto.direccion}</small></span>
                <span className={punto.activo ? 'status completado' : 'status cancelado'}>{punto.activo ? 'activo' : 'inactivo'}</span>
                <button className="ghost-button catalog-toggle-action" onClick={() => togglePunto(punto)}><Power size={18} /> {punto.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {temaActivo === 'ofertas' && (
        <section className="admin-section admin-detail-section">
          <header className="admin-section-header">
            <span className="admin-section-icon"><Tags size={22} /></span>
            <div>
              <h3>Ofertas</h3>
              <small>{ofertasVisibles.length} de {ofertas.length}</small>
            </div>
            <button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('ofertas')}>
              Crear
            </button>
          </header>
          <div className="admin-state-switch" role="group" aria-label="Vista de registros">
            <button type="button" className={estadoVista === 'activos' ? 'active' : ''} onClick={() => setEstadoVista('activos')}>Activos</button>
            <button type="button" className={estadoVista === 'inactivos' ? 'active' : ''} onClick={() => setEstadoVista('inactivos')}>Inactivos</button>
          </div>
          <div className="admin-service-groups">
            {ofertasVisibles.length === 0 && <div className="admin-empty-row">Sin registros {estadoVista}</div>}
            {ofertasPorServicio.map(([servicio, ofertasGrupo]) => (
              <section className="admin-service-group" key={servicio}>
                <header className="admin-service-group-header">
                  <strong>{servicioLabel(servicio)}</strong>
                  <small>{ofertasGrupo.length} {ofertasGrupo.length === 1 ? 'oferta' : 'ofertas'}</small>
                </header>
                <div className="admin-card-list">
                  {ofertasGrupo.map((oferta) => (
                    <div className="catalog-row catalog-row-offer" key={oferta.id}>
                      <span><strong>{oferta.nombre || `${servicioLabel(oferta.servicio)} · ${oferta.tasa}`}</strong><small>{oferta.moneda_pago} · minimo {oferta.minimo_pago ?? 0} · {oferta.origen}</small></span>
                      <div className="catalog-offer-actions">
                        <span className={oferta.activa ? 'status completado' : 'status cancelado'}>{oferta.activa ? 'activa' : 'inactiva'}</span>
                        <button className="ghost-button catalog-toggle-action" onClick={() => toggleOferta(oferta)}><Power size={18} /> {oferta.activa ? 'Desactivar' : 'Activar'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}

      {temaActivo === 'paquetes' && (
        <section className="admin-section admin-detail-section">
          <header className="admin-section-header">
            <span className="admin-section-icon"><Package size={22} /></span>
            <div>
              <h3>Paquetes de saldo</h3>
              <small>{paquetesVisibles.length} de {paquetes.length}</small>
            </div>
            <button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('paquetes')}>
              Crear
            </button>
          </header>
          <div className="admin-state-switch" role="group" aria-label="Vista de registros">
            <button type="button" className={estadoVista === 'activos' ? 'active' : ''} onClick={() => setEstadoVista('activos')}>Activos</button>
            <button type="button" className={estadoVista === 'inactivos' ? 'active' : ''} onClick={() => setEstadoVista('inactivos')}>Inactivos</button>
          </div>
          <div className="admin-card-list">
            {paquetesVisibles.length === 0 && <div className="admin-empty-row">Sin registros {estadoVista}</div>}
            {paquetesVisibles.map((paquete) => (
              <div className="catalog-row" key={paquete.id}>
                <span><strong>{paquete.nombre}</strong><small>{paquete.monto_pago} {paquete.moneda_pago} · {paquete.saldo_cup} CUP · {paquete.origen}</small></span>
                <span className={paquete.activo ? 'status completado' : 'status cancelado'}>{paquete.activo ? 'activo' : 'inactivo'}</span>
                <button className="ghost-button catalog-toggle-action" onClick={() => togglePaquete(paquete)}><Power size={18} /> {paquete.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {temaActivo === 'clientes' && (
        <section className="admin-section admin-detail-section">
          <header className="admin-section-header">
            <span className="admin-section-icon"><UsersRound size={22} /></span>
            <div>
              <h3>Clientes</h3>
              <small>{clientesVisibles.length} de {clientes.length}</small>
            </div>
            <button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('clientes')}>
              Crear
            </button>
          </header>
          <div className="admin-state-switch" role="group" aria-label="Vista de registros">
            <button type="button" className={estadoVista === 'activos' ? 'active' : ''} onClick={() => setEstadoVista('activos')}>Activos</button>
            <button type="button" className={estadoVista === 'inactivos' ? 'active' : ''} onClick={() => setEstadoVista('inactivos')}>Inactivos</button>
          </div>
          <div className="admin-card-list">
            {clientesVisibles.length === 0 && <div className="admin-empty-row">Sin registros {estadoVista}</div>}
            {clientesVisibles.map((cliente) => (
              <button type="button" className="config-row admin-config-card" key={cliente.id} onClick={() => setClienteForm({ nombre: cliente.nombre, telefono: cliente.telefono ?? '', email: cliente.email ?? '', pais: cliente.pais ?? 'br', moneda_preferida: cliente.moneda_preferida ?? 'BRL' })}>
                <strong>{cliente.nombre} #{cliente.id}</strong>
                <span>{cliente.telefono ?? 'sin telefono'} · {cliente.moneda_preferida ?? 'sin moneda'}</span>
                <span className={cliente.activo ? 'status completado' : 'status cancelado'}>{cliente.activo ? 'activo' : 'inactivo'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {temaActivo === 'contactos' && (
        <section className="admin-section admin-detail-section">
          <header className="admin-section-header">
            <span className="admin-section-icon"><UserRound size={22} /></span>
            <div>
              <h3>Contactos</h3>
              <small>{contactosVisibles.length} de {contactos.length}</small>
            </div>
            <button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('contactos')}>
              Crear
            </button>
          </header>
          <div className="admin-state-switch" role="group" aria-label="Vista de registros">
            <button type="button" className={estadoVista === 'activos' ? 'active' : ''} onClick={() => setEstadoVista('activos')}>Activos</button>
            <button type="button" className={estadoVista === 'inactivos' ? 'active' : ''} onClick={() => setEstadoVista('inactivos')}>Inactivos</button>
          </div>
          <div className="admin-card-list">
            {contactosVisibles.length === 0 && <div className="admin-empty-row">Sin registros {estadoVista}</div>}
            {contactosVisibles.map((contacto) => (
              <button type="button" className="config-row admin-config-card" key={contacto.id} onClick={() => setContactoForm({ cliente_id: contacto.cliente_id ? String(contacto.cliente_id) : '', nombre: contacto.nombre, telefono: contacto.telefono ?? '', numero_tarjeta: contacto.numero_tarjeta ?? '', tipo_tarjeta: contacto.tipo_tarjeta ?? '', documento_identidad_url: contacto.documento_identidad_url ?? '', pais: contacto.pais ?? 'cu', notas: contacto.notas ?? '' })}>
                <strong>{contacto.nombre} #{contacto.id}</strong>
                <span>{contacto.telefono ?? 'sin telefono'} · cliente {contacto.cliente_id ?? 'sin asociar'}</span>
                <span className={contacto.activo ? 'status completado' : 'status cancelado'}>{contacto.activo ? 'activo' : 'inactivo'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {temaActivo === 'operadores' && (
        <section className="admin-section admin-detail-section">
          <header className="admin-section-header">
            <span className="admin-section-icon"><UsersRound size={22} /></span>
            <div>
              <h3>Operadores</h3>
              <small>{operadoresVisibles.length} de {operadores.length}</small>
            </div>
            <button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('operadores')}>
              Crear
            </button>
          </header>
          <div className="admin-state-switch" role="group" aria-label="Vista de operadores">
            <button type="button" className={estadoVista === 'activos' ? 'active' : ''} onClick={() => setEstadoVista('activos')}>Activos</button>
            <button type="button" className={estadoVista === 'inactivos' ? 'active' : ''} onClick={() => setEstadoVista('inactivos')}>Inactivos</button>
          </div>
          <div className="admin-card-list">
            {operadoresVisibles.length === 0 && <div className="admin-empty-row">Sin registros {estadoVista}</div>}
            {operadoresVisibles.map((item) => (
              <div className="catalog-row operator-admin-row" key={item.id}>
                <button type="button" className="operator-admin-main" onClick={() => abrirEditarOperador(item)}>
                  <span><strong>{item.nombre}</strong><small>{item.telefono ?? 'sin telefono'} · {item.codigo_operador}</small></span>
                  <span className="profile-role-pill operator-role-pill">{item.rol}</span>
                </button>
                <span className={item.activo ? 'status completado' : 'status cancelado'}>{item.activo ? 'activo' : 'inactivo'}</span>
                <button className="ghost-button catalog-toggle-action" onClick={() => toggleOperador(item)}><Power size={18} /> {item.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {temaActivo === 'configuracion' && (
        <section className="admin-section admin-detail-section">
          <header className="admin-section-header">
            <span className="admin-section-icon"><Settings2 size={22} /></span>
            <div>
              <h3>Configuracion</h3>
              <small>{configuraciones.length}</small>
            </div>
            <button type="button" className="primary-button admin-create-button" onClick={() => { setConfigForm({ clave: '', valor: '' }); setConfigModalOpen(true); }}>
              Nueva
            </button>
          </header>
          <div className="config-list">
            {configuraciones.map((item) => (
              <button type="button" className="config-row" key={item.clave} onClick={() => abrirConfig(item)}>
                <strong>{item.clave}</strong>
                <span>{item.valor}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {temaActivo === 'templates' && (
        <section className="admin-section admin-detail-section">
          <header className="admin-section-header">
            <span className="admin-section-icon"><FileText size={22} /></span>
            <div>
              <h3>Templates</h3>
              <small>{templates.length}</small>
            </div>
            <button type="button" className="ghost-button admin-create-button" onClick={() => abrirTemplate(templateForm.clave)} disabled={templates.length === 0}>
              Editar
            </button>
          </header>
          <div className="config-list">
            {templates.map((template) => (
              <button type="button" className="config-row" key={template.clave} onClick={() => abrirTemplate(template.clave)}>
                <strong>{template.clave}</strong>
                <span>{template.valor}</span>
              </button>
            ))}
          </div>
        </section>
      )}


      {crearModalTema === 'metodos' && (
        <Modal title="Crear metodo de pago" subtitle="Administracion / Metodos de pago" onClose={() => setCrearModalTema(null)}>
          <form className="stack-form modal-form" onSubmit={guardarMetodo}>
            <input value={metodoForm.nombre} onChange={(event) => setMetodoForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <select value={metodoForm.moneda} onChange={(event) => setMetodoForm((current) => ({ ...current, moneda: event.target.value }))}>
              {monedas.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
            </select>
            <input value={metodoForm.imagen_url} onChange={(event) => setMetodoForm((current) => ({ ...current, imagen_url: event.target.value }))} placeholder="Imagen URL opcional" />
            <div className="method-image-note"><ImagePlus size={16} /> Si lo dejas vacio, usa el logo automatico desde assets.</div>
            <button className="primary-button"><Save size={18} /> Crear</button>
          </form>
        </Modal>
      )}
      {metodoEditando && (
        <Modal title="Editar metodo de pago" subtitle={`${metodoEditando.nombre} · ${metodoEditando.moneda}`} onClose={() => setMetodoEditando(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarMetodoEditado}>
            <div
              className="method-image-dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={manejarDropImagenMetodo}
            >
              <span className="payment-method-logo method-image-preview" aria-hidden="true">
                {metodoPagoVisual({ ...metodoEditando, imagen_url: metodoForm.imagen_url || metodoEditando.imagen_url }).src ? (
                  <img src={metodoPagoVisual({ ...metodoEditando, imagen_url: metodoForm.imagen_url || metodoEditando.imagen_url }).src} alt="" />
                ) : (
                  <span>{metodoPagoVisual(metodoEditando).initials}</span>
                )}
              </span>
              <div>
                <strong>Imagen del metodo</strong>
                <small>Arrastra una imagen aqui o sube un archivo. Si no hay imagen, se usa el logo automatico de assets.</small>
              </div>
              <label className="ghost-button method-image-picker">
                <UploadCloud size={18} /> {metodoUploading ? 'Subiendo...' : 'Subir'}
                <input type="file" accept="image/*" disabled={metodoUploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void subirImagenMetodo(file); event.currentTarget.value = ''; }} />
              </label>
            </div>
            <input value={metodoForm.nombre} onChange={(event) => setMetodoForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <div className="inline-form three">
              <select value={metodoForm.moneda} onChange={(event) => setMetodoForm((current) => ({ ...current, moneda: event.target.value }))}>
                {monedas.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
              </select>
              <select value={metodoForm.activo ? 'activo' : 'inactivo'} onChange={(event) => setMetodoForm((current) => ({ ...current, activo: event.target.value === 'activo' }))}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
              <button className="primary-button"><Save size={18} /> Guardar</button>
            </div>
            <input value={metodoForm.imagen_url} onChange={(event) => setMetodoForm((current) => ({ ...current, imagen_url: event.target.value }))} placeholder="Imagen URL o /storage/metodos-pago/archivo.webp" />
          </form>
        </Modal>
      )}

      {crearModalTema === 'puntos' && (
        <Modal title="Crear punto de recogida" subtitle="Administracion / Puntos de recogida" onClose={() => setCrearModalTema(null)}>
          <form className="stack-form modal-form" onSubmit={guardarPunto}>
            <input value={puntoForm.nombre} onChange={(event) => setPuntoForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <input value={puntoForm.direccion} onChange={(event) => setPuntoForm((current) => ({ ...current, direccion: event.target.value }))} placeholder="Direccion" required />
            <input value={puntoForm.telefono} onChange={(event) => setPuntoForm((current) => ({ ...current, telefono: event.target.value }))} placeholder="Telefono opcional" />
            <button className="primary-button"><Save size={18} /> Crear punto</button>
          </form>
        </Modal>
      )}
      {crearModalTema === 'ofertas' && (
        <Modal title="Crear oferta" subtitle="Administracion / Ofertas" onClose={() => setCrearModalTema(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarOferta}>
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
        </Modal>
      )}
      {crearModalTema === 'paquetes' && (
        <Modal title="Crear paquete de saldo" subtitle="Administracion / Paquetes de saldo" onClose={() => setCrearModalTema(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarPaquete}>
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
        </Modal>
      )}
      {crearModalTema === 'clientes' && (
        <Modal title="Crear cliente" subtitle="Administracion / Clientes" onClose={() => setCrearModalTema(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarCliente}>
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
        </Modal>
      )}
      {crearModalTema === 'contactos' && (
        <Modal title="Crear contacto" subtitle="Administracion / Contactos" onClose={() => setCrearModalTema(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarContacto}>
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
        </Modal>
      )}

      {crearModalTema === 'operadores' && (
        <Modal title="Crear operador" subtitle="Administracion / Operadores" onClose={() => setCrearModalTema(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarOperador}>
            <input value={operadorForm.nombre} onChange={(event) => setOperadorForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <input value={operadorForm.telefono} onChange={(event) => setOperadorForm((current) => ({ ...current, telefono: event.target.value }))} placeholder="Telefono de acceso" required />
            <input type="password" value={operadorForm.password} onChange={(event) => setOperadorForm((current) => ({ ...current, password: event.target.value }))} placeholder="Contrasena inicial" autoComplete="new-password" />
            <select value={operadorForm.rol} onChange={(event) => setOperadorForm((current) => ({ ...current, rol: event.target.value }))}>
              {rolesOperador.map((rol) => <option key={rol} value={rol}>{rol}</option>)}
            </select>
            <button className="primary-button"><Save size={18} /> Crear operador</button>
          </form>
        </Modal>
      )}

      {operadorEditando && (
        <Modal title="Editar operador" subtitle={`${operadorEditando.nombre} · ${operadorEditando.codigo_operador}`} onClose={() => setOperadorEditando(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarOperadorEditado}>
            <input value={operadorForm.nombre} onChange={(event) => setOperadorForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <input value={operadorForm.telefono} onChange={(event) => setOperadorForm((current) => ({ ...current, telefono: event.target.value }))} placeholder="Telefono de acceso" required />
            <input type="password" value={operadorForm.password} onChange={(event) => setOperadorForm((current) => ({ ...current, password: event.target.value }))} placeholder="Nueva contrasena opcional" autoComplete="new-password" />
            <div className="inline-form three operator-edit-inline">
              <select value={operadorForm.rol} onChange={(event) => setOperadorForm((current) => ({ ...current, rol: event.target.value }))}>
                {rolesOperador.map((rol) => <option key={rol} value={rol}>{rol}</option>)}
              </select>
              <select value={operadorForm.activo ? 'activo' : 'inactivo'} onChange={(event) => setOperadorForm((current) => ({ ...current, activo: event.target.value === 'activo' }))}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
              <button className="primary-button"><Save size={18} /> Guardar</button>
            </div>
          </form>
        </Modal>
      )}

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
    </section>
  );
}
