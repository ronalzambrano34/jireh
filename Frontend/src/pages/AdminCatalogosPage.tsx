import { createElement, type DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CalendarClock, Edit3, FileText, ImagePlus, Loader2, MapPin, Megaphone, MessageCircle, Package, Power, Save, Settings2, Tags, UploadCloud, UserRound, UsersRound } from 'lucide-react';
import { CardNumberInput } from '../components/CardNumberInput';
import { FloatingSelect } from '../components/FloatingSelect';
import { Modal } from '../components/Modal';
import { PhoneInput } from '../components/PhoneInput';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { PageLoader } from '../components/PageLoader';
import { PasswordField } from '../components/PasswordField';
import { UiSwitch } from '../components/UiSwitch';
import {
  apiAssetUrl,
  actualizarMetodoPago,
  listarCuentasMetodoPago,
  crearCuentaMetodoPago,
  actualizarCuentaMetodoPago,
  actualizarOferta,
  actualizarOperador,
  actualizarPaqueteSaldo,
  actualizarProvinciaServicio,
  actualizarPuntoRecogida,
  actualizarPromocion,
  crearCliente,
  crearContacto,
  crearMetodoPago,
  crearOperador,
  eliminarOperador,
  guardarConfiguracion,
  guardarTemplate,
  crearOferta,
  crearPaqueteSaldo,
  crearProvinciaServicio,
  crearPuntoRecogida,
  crearPromocion,
  eliminarPromocion,
  listarClientes,
  listarConfiguraciones,
  listarContactos,
  listarMetodosPago,
  listarOfertas,
  listarOperadores,
  listarPaquetesSaldo,
  listarProvinciasServicio,
  listarPuntosRecogida,
  listarPromociones,
  listarTemplates,
  subirImagenMetodoPago,
  subirImagenPromocion,
} from '../api/client';
import type { Cliente, Configuracion, Contacto, MetodoPago, MetodoPagoCuenta, Oferta, Operador, PaqueteSaldo, Promocion, ProvinciaServicio, PuntoRecogida, TemplateConfig } from '../types/api';
import { metodoPagoVisual } from '../utils/metodosPago';
import { AdminEmpty, AdminHero, AdminMenu, AdminSection, AdminStateSwitch, type AdminEstadoVista, type AdminMenuGroup } from './admin/AdminCatalogosLayout';
import './admin/AdminCatalogosPage.css';

const monedas = ['BRL', 'UYU', 'USD', 'EUR'];
const servicios = ['transferencia', 'efectivo', 'saldo', 'mlc', 'usd', 'clasica', 'divisa'];
const rolesOperador = ['operador', 'supervisor', 'admin'];
const tiposSlide = [
  { value: 'promocion', label: 'Promocion con imagen' },
  { value: 'precios', label: 'Precios destacados' },
  { value: 'marca', label: 'Marca' },
] as const;

const nuevoSlideForm = () => ({
  tipo: 'promocion' as Promocion['tipo'],
  titulo: '',
  subtitulo: '',
  descripcion: '',
  imagen_url: '',
  orden: '0',
  fecha_desde: datetimeLocalValue(),
  fecha_hasta: datetimeLocalPlusDays(7),
  activa: true,
});

function esMetodoEfectivo(nombre: string) {
  return nombre.trim().toLowerCase() === 'efectivo';
}

const permisosOperador = [
  { value: 'pedidos:crear', label: 'Crear pedidos', group: 'Pedidos' },
  { value: 'pedidos:gestionar', label: 'Gestionar pedidos', group: 'Pedidos' },
  { value: 'clientes:crear', label: 'Crear clientes', group: 'Clientes' },
  { value: 'clientes:gestionar', label: 'Gestionar clientes', group: 'Clientes' },
  { value: 'contactos:gestionar', label: 'Gestionar contactos', group: 'Clientes' },
  { value: 'operadores:ver', label: 'Ver operadores', group: 'Operadores' },
  { value: 'operadores:crear', label: 'Crear operadores', group: 'Operadores' },
  { value: 'operadores:editar', label: 'Editar operadores', group: 'Operadores' },
  { value: 'operadores:desactivar', label: 'Desactivar operadores', group: 'Operadores' },
  { value: 'configuracion:gestionar', label: 'Gestionar configuracion', group: 'Configuracion' },
  { value: 'empresa:control_total', label: 'Control total', group: 'Configuracion' },
];

const permisosPorRol: Record<string, string[]> = {
  operador: ['pedidos:crear', 'clientes:crear', 'contactos:gestionar'],
  supervisor: ['pedidos:gestionar', 'clientes:gestionar', 'operadores:ver'],
  admin: ['operadores:ver', 'operadores:crear', 'operadores:editar', 'operadores:desactivar', 'empresa:control_total', 'pedidos:gestionar', 'clientes:gestionar', 'configuracion:gestionar'],
};

type OperadorFormState = {
  nombre: string;
  telefono: string;
  password: string;
  rol: string;
  activo: boolean;
  permisos: string[];
};

function permisosBaseRol(rol: string) {
  return [...(permisosPorRol[rol] ?? permisosPorRol.operador)];
}

function togglePermiso(permisos: string[], permiso: string) {
  if (permisos.includes(permiso)) return permisos.filter((item) => item !== permiso);
  return [...permisos, permiso];
}


function SavingLabel({ saving, idle, busy }: { saving: boolean; idle: string; busy: string }) {
  return (
    <>
      {saving ? <Loader2 className="button-spinner" size={18} /> : <Save size={18} />}
      {saving ? busy : idle}
    </>
  );
}

function PermissionSwitches({ permisos, onChange }: { permisos: string[]; onChange: (permisos: string[]) => void }) {
  const grupos = Array.from(new Set(permisosOperador.map((permiso) => permiso.group)));

  return (
    <section className="operator-permissions-panel" aria-label="Permisos del operador">
      <div className="operator-permissions-head">
        <strong>Permisos</strong>
        <small>Activa o desactiva accesos especificos para este operador.</small>
      </div>
      {grupos.map((grupo) => (
        <div className="operator-permission-group" key={grupo}>
          <h4>{grupo}</h4>
          <div className="operator-permission-list">
            {permisosOperador.filter((permiso) => permiso.group === grupo).map((permiso) => (
              <label className="permission-switch-row" key={permiso.value}>
                <span>{permiso.label}<small>{permiso.value}</small></span>
                <UiSwitch
                  checked={permisos.includes(permiso.value)}
                  ariaLabel={`Activar permiso ${permiso.label}`}
                  onChange={() => onChange(togglePermiso(permisos, permiso.value))}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

type AdminTema = 'metodos' | 'provincias' | 'puntos' | 'ofertas' | 'paquetes' | 'promociones' | 'clientes' | 'contactos' | 'operadores' | 'configuracion' | 'templates';
const ADMIN_THEME_KEY = 'jireh.adminTema';
const ADMIN_THEMES = new Set<AdminTema>(['metodos', 'provincias', 'puntos', 'ofertas', 'paquetes', 'promociones', 'clientes', 'contactos', 'operadores', 'configuracion', 'templates']);

function temaAdminGuardado(): AdminTema | null {
  if (typeof sessionStorage === 'undefined') return null;
  const saved = sessionStorage.getItem(ADMIN_THEME_KEY) as AdminTema | null;
  return saved && ADMIN_THEMES.has(saved) ? saved : null;
}

function tituloTema(tema: AdminTema | null) {
  if (tema === 'metodos') return 'Metodos de pago';
  if (tema === 'provincias') return 'Provincias de servicio';
  if (tema === 'puntos') return 'Puntos de recogida';
  if (tema === 'ofertas') return 'Ofertas';
  if (tema === 'paquetes') return 'Paquetes de saldo';
  if (tema === 'promociones') return 'Promociones';
  if (tema === 'clientes') return 'Clientes';
  if (tema === 'contactos') return 'Contactos';
  if (tema === 'operadores') return 'Operadores';
  if (tema === 'configuracion') return 'Configuracion';
  if (tema === 'templates') return 'Templates';
  return 'Catalogos';
}

const adminTemaVisual: Record<AdminTema, { descripcion: string; icono: typeof Settings2 }> = {
  metodos: { descripcion: 'Administra medios de cobro, monedas, logos y cuentas asociadas.', icono: Banknote },
  provincias: { descripcion: 'Define las provincias disponibles para organizar la cobertura del servicio.', icono: MapPin },
  puntos: { descripcion: 'Gestiona ubicaciones, direcciones y contactos para las entregas en efectivo.', icono: MapPin },
  ofertas: { descripcion: 'Configura tasas, monedas, importes minimos y servicios disponibles.', icono: Tags },
  paquetes: { descripcion: 'Organiza los paquetes de recarga, su precio y el saldo que recibe el cliente.', icono: Package },
  promociones: { descripcion: 'Crea y ordena slides de precios, marca y promociones para el carrusel.', icono: Megaphone },
  clientes: { descripcion: 'Consulta y administra las personas que solicitan o pagan operaciones.', icono: UsersRound },
  contactos: { descripcion: 'Mantiene los destinatarios frecuentes y sus datos operativos.', icono: UserRound },
  operadores: { descripcion: 'Controla accesos, roles, permisos y disponibilidad del equipo.', icono: UsersRound },
  configuracion: { descripcion: 'Centraliza enlaces, claves y valores que definen el comportamiento del sistema.', icono: Settings2 },
  templates: { descripcion: 'Edita los mensajes utilizados en operaciones, estados y notificaciones.', icono: FileText },
};

function resumenCarga(cargado: boolean, resumen: string) {
  return cargado ? resumen : 'Se carga al abrir';
}

function servicioLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function datetimeLocalValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function datetimeLocalPlusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return datetimeLocalValue(date);
}

function fechaInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return datetimeLocalValue(date);
}

function formatFechaPromo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-UY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function estadoPromocion(item: Promocion) {
  if (!item.activa) return 'inactiva';
  if (item.vigente) return 'vigente';
  const desde = new Date(item.fecha_desde).getTime();
  if (!Number.isNaN(desde) && desde > Date.now()) return 'programada';
  return 'activa';
}

const templateVariablesComunes = [
  'codigo_operacion',
  'servicio',
  'estado',
  'operador',
  'operador_codigo',
  'operador_telefono',
  'cliente_nombre',
  'cliente_telefono',
  'monto_pago',
  'moneda_pago',
  'monto_resultado',
  'tasa_final',
  'metodo_pago',
  'cuenta_pago',
  'cuenta_pago_alias',
  'cuenta_pago_titular',
  'qr_pago_url',
  'ganancia',
  'comprobante_pago',
  'observaciones',
];

const templateVariablesPorClave: Record<string, string[]> = {
  template_transferencia: ['numero_tarjeta', 'telefono_destinatario'],
  template_efectivo: ['telefono_destinatario', 'documento_identidad_url', 'punto_recogida'],
  template_saldo: ['telefono_destinatario', 'saldo_cup'],
  template_divisa: ['tipo_tarjeta', 'numero_tarjeta', 'telefono_destinatario', 'monto_divisa'],
  template_otros: [
    'numero_tarjeta',
    'telefono_destinatario',
    'documento_identidad_url',
    'punto_recogida',
  ],
};

const configuracionesDestacadas = new Set([
  'whatsapp_grupo_pedidos_url',
  'whatsapp_grupo_finalizados_url',
  'setup_inicial_completado',
  'carousel_slides_seeded_v1',
]);

const todasLasVariablesTemplate = Array.from(new Set([
  ...templateVariablesComunes,
  ...Object.values(templateVariablesPorClave).flat(),
]));

function variablesDisponiblesTemplate(clave: string) {
  const especificas = templateVariablesPorClave[clave] ?? [];
  return Array.from(new Set([...templateVariablesComunes, ...especificas]));
}


export function AdminCatalogosPage() {
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [puntos, setPuntos] = useState<PuntoRecogida[]>([]);
  const [provincias, setProvincias] = useState<ProvinciaServicio[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [paquetes, setPaquetes] = useState<PaqueteSaldo[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [configuraciones, setConfiguraciones] = useState<Configuracion[]>([]);
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [metodoForm, setMetodoForm] = useState({ nombre: '', moneda: 'BRL', imagen_url: '', activo: true });
  const [puntoForm, setPuntoForm] = useState({ nombre: '', direccion: '', telefono: '', provincia_id: '', activo: true });
  const [provinciaForm, setProvinciaForm] = useState({ nombre: '', activo: false });
  const [ofertaForm, setOfertaForm] = useState({ servicio: 'transferencia', nombre: '', tasa: '', minimo_pago: '', moneda_pago: 'BRL' });
  const [paqueteForm, setPaqueteForm] = useState({ nombre: '', monto_pago: '', moneda_pago: 'BRL', saldo_cup: '' });
  const [promoForm, setPromoForm] = useState(nuevoSlideForm);
  const [promoFile, setPromoFile] = useState<File | null>(null);
  const [promoFilePreview, setPromoFilePreview] = useState('');
  const [configForm, setConfigForm] = useState({ clave: '', valor: '' });
  const [templateForm, setTemplateForm] = useState({ clave: 'template_transferencia', valor: '' });
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [clienteForm, setClienteForm] = useState({ nombre: '', telefono: '', email: '', pais: '', moneda_preferida: 'BRL' });
  const [contactoForm, setContactoForm] = useState({ cliente_id: '', nombre: '', telefono: '', numero_tarjeta: '', tipo_tarjeta: '', documento_identidad_url: '', pais: '', notas: '' });
  const [operadorForm, setOperadorForm] = useState<OperadorFormState>({ nombre: '', telefono: '', password: '', rol: 'operador', activo: true, permisos: permisosBaseRol('operador') });
  const [operadorEditando, setOperadorEditando] = useState<Operador | null>(null);
  const [puntoEditando, setPuntoEditando] = useState<PuntoRecogida | null>(null);
  const [provinciaEditando, setProvinciaEditando] = useState<ProvinciaServicio | null>(null);
  const [metodoEditando, setMetodoEditando] = useState<MetodoPago | null>(null);
  const [cuentasMetodo, setCuentasMetodo] = useState<MetodoPagoCuenta[]>([]);
  const [cuentaMetodoForm, setCuentaMetodoForm] = useState({ alias: '', cuenta: '', titular: '', qr_url: '', predeterminada: true, activa: true });
  const [promoEditando, setPromoEditando] = useState<Promocion | null>(null);
  const [metodoUploading, setMetodoUploading] = useState(false);
  const [metodoSaving, setMetodoSaving] = useState(false);
  const [metodoEditSaving, setMetodoEditSaving] = useState(false);
  const [cuentaMetodoSaving, setCuentaMetodoSaving] = useState(false);
  const [promoUploading, setPromoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [estadoVista, setEstadoVista] = useState<AdminEstadoVista>('activos');
  const [temaActivo, setTemaActivo] = useState<AdminTema | null>(temaAdminGuardado);
  const [temasCargados, setTemasCargados] = useState<Set<AdminTema>>(() => new Set());
  const [temasCargando, setTemasCargando] = useState<Set<AdminTema>>(() => new Set());
  const [crearModalTema, setCrearModalTema] = useState<AdminTema | null>(null);
  const temaActivoRef = useRef<AdminTema | null>(temaActivo);
  const temasCargadosRef = useRef<Set<AdminTema>>(new Set());
  const temasCargandoRef = useRef<Set<AdminTema>>(new Set());
  const configModalOpenRef = useRef(false);
  const templateModalOpenRef = useRef(false);
  const configTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const templateTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const loading = temaActivo ? temasCargando.has(temaActivo) : false;

  const mostrarActivos = estadoVista === 'activos';
  const metodosVisibles = useMemo(() => metodos.filter((metodo) => metodo.activo === mostrarActivos), [metodos, mostrarActivos]);
  const puntosVisibles = useMemo(() => puntos.filter((punto) => punto.activo === mostrarActivos), [puntos, mostrarActivos]);
  const provinciasVisibles = useMemo(() => provincias.filter((provincia) => provincia.activo === mostrarActivos), [provincias, mostrarActivos]);
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
  const promocionesVisibles = useMemo(() => promociones.filter((promocion) => promocion.activa === mostrarActivos), [promociones, mostrarActivos]);
  const clientesVisibles = useMemo(() => clientes.filter((cliente) => cliente.activo === mostrarActivos), [clientes, mostrarActivos]);
  const contactosVisibles = useMemo(() => contactos.filter((contacto) => contacto.activo === mostrarActivos), [contactos, mostrarActivos]);
  const operadoresVisibles = useMemo(() => operadores.filter((item) => item.activo === mostrarActivos), [operadores, mostrarActivos]);
  const whatsappConfiguraciones = useMemo(() => [
    {
      clave: 'whatsapp_grupo_pedidos_url',
      titulo: 'Grupo de pedidos en trabajo',
      descripcion: 'Recibe la orden completa cuando se crea un pedido.',
    },
    {
      clave: 'whatsapp_grupo_finalizados_url',
      titulo: 'Grupo de operaciones finalizadas',
      descripcion: 'Recibe el cierre, comprobante y datos para historico/Excel.',
    },
  ].map((item) => ({
    ...item,
    valor: configuraciones.find((config) => config.clave === item.clave)?.valor ?? '',
  })), [configuraciones]);
  const configuracionesSistema = useMemo(
    () => configuraciones.filter((item) => !item.clave.startsWith('template_') && !configuracionesDestacadas.has(item.clave)),
    [configuraciones]
  );
  const configuracionesSistemaTotal = configuracionesSistema.length + whatsappConfiguraciones.length;
  const templateVariables = useMemo(
    () => variablesDisponiblesTemplate(templateForm.clave),
    [templateForm.clave]
  );

  function marcarTemasCargados(...temas: AdminTema[]) {
    temas.forEach((tema) => temasCargadosRef.current.add(tema));
    setTemasCargados(new Set(temasCargadosRef.current));
  }

  async function cargarTema(tema: AdminTema, force = false) {
    if ((!force && temasCargadosRef.current.has(tema)) || temasCargandoRef.current.has(tema)) return;

    temasCargandoRef.current.add(tema);
    setTemasCargando(new Set(temasCargandoRef.current));
    setError(null);
    try {
      if (tema === 'metodos') setMetodos(await listarMetodosPago(undefined, true));
      if (tema === 'provincias') setProvincias(await listarProvinciasServicio(true));
      if (tema === 'ofertas') setOfertas(await listarOfertas(true));
      if (tema === 'paquetes') setPaquetes(await listarPaquetesSaldo(undefined, true));
      if (tema === 'promociones') setPromociones(await listarPromociones(true));
      if (tema === 'clientes') setClientes(await listarClientes(undefined, true));
      if (tema === 'operadores') setOperadores(await listarOperadores(true));
      if (tema === 'configuracion') setConfiguraciones(await listarConfiguraciones());

      if (tema === 'puntos') {
        const [puntosData, provinciasData] = await Promise.all([
          listarPuntosRecogida(true),
          temasCargadosRef.current.has('provincias') ? Promise.resolve(null) : listarProvinciasServicio(true),
        ]);
        setPuntos(puntosData);
        if (provinciasData) {
          setProvincias(provinciasData);
          marcarTemasCargados('provincias');
        }
      }

      if (tema === 'contactos') {
        const [contactosData, clientesData] = await Promise.all([
          listarContactos(undefined, true),
          temasCargadosRef.current.has('clientes') ? Promise.resolve(null) : listarClientes(undefined, true),
        ]);
        setContactos(contactosData);
        if (clientesData) {
          setClientes(clientesData);
          marcarTemasCargados('clientes');
        }
      }

      if (tema === 'templates') {
        const templatesData = await listarTemplates();
        setTemplates(templatesData);
        if (templatesData.length) {
          setTemplateForm((current) => {
            const selected = templatesData.find((item) => item.clave === current.clave) ?? templatesData[0];
            return { clave: selected.clave, valor: selected.valor };
          });
        }
      }

      marcarTemasCargados(tema);
    } catch (err) {
      if (temaActivoRef.current === tema) {
        setError(err instanceof Error ? err.message : `No se pudo cargar ${tituloTema(tema).toLowerCase()}`);
      }
    } finally {
      temasCargandoRef.current.delete(tema);
      setTemasCargando(new Set(temasCargandoRef.current));
    }
  }

  async function cargar() {
    if (temaActivo) await cargarTema(temaActivo, true);
  }

  useEffect(() => {
    if (temaActivo) void cargarTema(temaActivo);
  }, []);

  useEffect(() => {
    configModalOpenRef.current = configModalOpen;
  }, [configModalOpen]);

  useEffect(() => {
    templateModalOpenRef.current = templateModalOpen;
  }, [templateModalOpen]);

  useEffect(() => {
    function handlePopState(event: PopStateEvent) {
      const state = event.state as { jirehAdminModal?: string } | null;
      if (templateModalOpenRef.current && state?.jirehAdminModal !== 'template') {
        setTemplateModalOpen(false);
      }
      if (configModalOpenRef.current && state?.jirehAdminModal !== 'config') {
        setConfigModalOpen(false);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function abrirModalAdmin(tipo: 'config' | 'template') {
    const state = window.history.state as { jirehAdminModal?: string; jirehView?: string } | null;
    if (state?.jirehAdminModal !== tipo) {
      window.history.pushState({ ...state, jirehView: 'admin', jirehAdminModal: tipo }, '');
    }
  }

  function cerrarModalAdmin(tipo: 'config' | 'template') {
    if (tipo === 'template') setTemplateModalOpen(false);
    if (tipo === 'config') setConfigModalOpen(false);

    const state = window.history.state as { jirehAdminModal?: string } | null;
    if (state?.jirehAdminModal === tipo) {
      window.history.back();
    }
  }

  function abrirTema(tema: AdminTema) {
    temaActivoRef.current = tema;
    sessionStorage.setItem(ADMIN_THEME_KEY, tema);
    setTemaActivo(tema);
    setEstadoVista('activos');
    setError(null);
    setNotice(null);
    void cargarTema(tema);
  }

  function volverMenu() {
    temaActivoRef.current = null;
    sessionStorage.removeItem(ADMIN_THEME_KEY);
    setTemaActivo(null);
    setError(null);
    setNotice(null);
  }

  function abrirCrearModal(tema: AdminTema) {
    if (tema === 'metodos') setMetodoForm({ nombre: '', moneda: 'BRL', imagen_url: '', activo: true });
    if (tema === 'puntos') {
      setPuntoEditando(null);
      setPuntoForm({ nombre: '', direccion: '', telefono: '', provincia_id: provincias.find((provincia) => provincia.activo)?.id ? String(provincias.find((provincia) => provincia.activo)?.id) : '', activo: true });
    }
    if (tema === 'provincias') {
      setProvinciaEditando(null);
      setProvinciaForm({ nombre: '', activo: false });
    }
    if (tema === 'ofertas') setOfertaForm({ servicio: 'transferencia', nombre: '', tasa: '', minimo_pago: '', moneda_pago: 'BRL' });
    if (tema === 'paquetes') setPaqueteForm({ nombre: '', monto_pago: '', moneda_pago: 'BRL', saldo_cup: '' });
    if (tema === 'promociones') { setPromoForm(nuevoSlideForm()); setPromoFile(null); setPromoFilePreview(''); }
    if (tema === 'clientes') setClienteForm({ nombre: '', telefono: '', email: '', pais: '', moneda_preferida: 'BRL' });
    if (tema === 'contactos') setContactoForm({ cliente_id: '', nombre: '', telefono: '', numero_tarjeta: '', tipo_tarjeta: '', documento_identidad_url: '', pais: '', notas: '' });
    if (tema === 'operadores') setOperadorForm({ nombre: '', telefono: '', password: '', rol: 'operador', activo: true, permisos: permisosBaseRol('operador') });
    setError(null);
    setNotice(null);
    setCrearModalTema(tema);
  }

  async function guardarMetodo(event: FormEvent) {
    event.preventDefault();
    if (metodoSaving) return;
    setError(null);
    setNotice(null);
    setMetodoSaving(true);
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
    } finally {
      setMetodoSaving(false);
    }
  }

  async function guardarPunto(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const payload = {
        nombre: puntoForm.nombre,
        direccion: puntoForm.direccion,
        telefono: puntoForm.telefono || undefined,
        provincia_id: puntoForm.provincia_id ? Number(puntoForm.provincia_id) : null,
      };
      if (puntoEditando) {
        await actualizarPuntoRecogida(puntoEditando.id, { ...payload, activo: puntoForm.activo });
      } else {
        await crearPuntoRecogida(payload);
      }
      setPuntoForm({ nombre: '', direccion: '', telefono: '', provincia_id: '', activo: true });
      setNotice(puntoEditando ? 'Punto de recogida actualizado' : 'Punto de recogida creado');
      setPuntoEditando(null);
      setCrearModalTema(null);
      setEstadoVista('activos');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el punto');
    }
  }


  async function guardarProvincia(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      if (provinciaEditando) {
        await actualizarProvinciaServicio(provinciaEditando.id, provinciaForm);
      } else {
        await crearProvinciaServicio(provinciaForm);
      }
      setProvinciaForm({ nombre: '', activo: false });
      setNotice(provinciaEditando ? 'Provincia de servicio actualizada' : 'Provincia de servicio creada');
      setProvinciaEditando(null);
      setCrearModalTema(null);
      setEstadoVista(provinciaForm.activo ? 'activos' : 'inactivos');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la provincia');
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


  async function guardarPromocion(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (promoForm.tipo === 'promocion' && !promoFile && !promoForm.imagen_url) {
      setError('La imagen es obligatoria para una promocion');
      return;
    }
    try {
      const creada = await crearPromocion({
        tipo: promoForm.tipo,
        titulo: promoForm.titulo,
        subtitulo: promoForm.subtitulo,
        descripcion: promoForm.descripcion,
        imagen_url: promoForm.imagen_url || undefined,
        orden: Number(promoForm.orden) || 0,
        fecha_desde: promoForm.fecha_desde,
        fecha_hasta: promoForm.fecha_hasta,
        activa: promoForm.activa,
      });
      if (promoFile) await subirImagenPromocion(creada.id, promoFile);
      setPromoForm(nuevoSlideForm());
      setPromoFile(null);
      setPromoFilePreview('');
      setNotice('Promocion creada');
      setCrearModalTema(null);
      setEstadoVista('activos');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la promocion');
    }
  }

  function abrirEditarPromocion(promocion: Promocion) {
    setPromoEditando(promocion);
    setPromoForm({
      tipo: promocion.tipo,
      titulo: promocion.titulo,
      subtitulo: promocion.subtitulo,
      descripcion: promocion.descripcion,
      imagen_url: promocion.imagen_url,
      orden: String(promocion.orden),
      fecha_desde: fechaInputValue(promocion.fecha_desde),
      fecha_hasta: fechaInputValue(promocion.fecha_hasta),
      activa: promocion.activa,
    });
    setPromoFile(null);
    setPromoFilePreview('');
    setError(null);
    setNotice(null);
  }

  async function guardarPromocionEditada(event: FormEvent) {
    event.preventDefault();
    if (!promoEditando) return;
    setError(null);
    setNotice(null);
    try {
      const actualizada = await actualizarPromocion(promoEditando.id, {
        tipo: promoForm.tipo,
        titulo: promoForm.titulo,
        subtitulo: promoForm.subtitulo,
        descripcion: promoForm.descripcion,
        imagen_url: promoForm.imagen_url || null,
        orden: Number(promoForm.orden) || 0,
        fecha_desde: promoForm.fecha_desde,
        fecha_hasta: promoForm.fecha_hasta,
        activa: promoForm.activa,
      });
      let final = actualizada;
      if (promoFile) final = await subirImagenPromocion(promoEditando.id, promoFile);
      setPromoEditando(final);
      setPromoForm({
        tipo: final.tipo,
        titulo: final.titulo,
        subtitulo: final.subtitulo,
        descripcion: final.descripcion,
        imagen_url: final.imagen_url,
        orden: String(final.orden),
        fecha_desde: fechaInputValue(final.fecha_desde),
        fecha_hasta: fechaInputValue(final.fecha_hasta),
        activa: final.activa,
      });
      setPromoFile(null);
      setPromoFilePreview('');
      setNotice('Promocion actualizada');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la promocion');
    }
  }

  async function subirImagenPromo(file: File) {
    if (!promoEditando) {
      setPromoFile(file);
      setPromoFilePreview(URL.createObjectURL(file));
      return;
    }
    setError(null);
    setNotice(null);
    setPromoUploading(true);
    try {
      setPromoFilePreview(URL.createObjectURL(file));
      const actualizada = await subirImagenPromocion(promoEditando.id, file);
      setPromoEditando(actualizada);
      setPromoForm((current) => ({ ...current, imagen_url: actualizada.imagen_url }));
      setNotice('Imagen del slide actualizada');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setPromoUploading(false);
    }
  }

  function manejarDropImagenPromo(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void subirImagenPromo(file);
  }

  async function togglePromocion(promocion: Promocion) {
    setError(null);
    setNotice(null);
    try {
      await actualizarPromocion(promocion.id, { activa: !promocion.activa });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el slide');
    }
  }

  async function desactivarPromocion(promocion: Promocion) {
    setError(null);
    setNotice(null);
    try {
      await eliminarPromocion(promocion.id);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el slide');
    }
  }


  async function guardarConfig(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await guardarConfiguracion(configForm);
      setNotice('Configuracion guardada');
      cerrarModalAdmin('config');
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
        permisos: operadorForm.permisos,
      });
      setOperadorForm({ nombre: '', telefono: '', password: '', rol: 'operador', activo: true, permisos: permisosBaseRol('operador') });
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
      permisos: item.permisos.length ? item.permisos : permisosBaseRol(item.rol),
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
        permisos: operadorForm.permisos,
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
      cerrarModalAdmin('template');
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
    abrirModalAdmin('config');
    setConfigModalOpen(true);
  }

  function abrirTemplate(clave: string) {
    seleccionarTemplate(clave);
    abrirModalAdmin('template');
    setTemplateModalOpen(true);
  }

  function insertarVariableConfig(variable: string) {
    const token = '{' + variable + '}';
    const textarea = configTextareaRef.current;
    const start = textarea?.selectionStart ?? configForm.valor.length;
    const end = textarea?.selectionEnd ?? start;
    const valor = configForm.valor.slice(0, start) + token + configForm.valor.slice(end);
    const cursor = start + token.length;

    setConfigForm((current) => ({
      ...current,
      valor,
    }));

    window.setTimeout(() => {
      configTextareaRef.current?.focus();
      configTextareaRef.current?.setSelectionRange(cursor, cursor);
    }, 0);
  }

  function insertarVariableTemplate(variable: string) {
    const token = '{' + variable + '}';
    const textarea = templateTextareaRef.current;
    const start = textarea?.selectionStart ?? templateForm.valor.length;
    const end = textarea?.selectionEnd ?? start;
    const valor = templateForm.valor.slice(0, start) + token + templateForm.valor.slice(end);
    const cursor = start + token.length;

    setTemplateForm((current) => ({
      ...current,
      valor,
    }));

    window.setTimeout(() => {
      templateTextareaRef.current?.focus();
      templateTextareaRef.current?.setSelectionRange(cursor, cursor);
    }, 0);
  }

  function abrirEditarMetodo(metodo: MetodoPago) {
    setMetodoEditando(metodo);
    setMetodoForm({
      nombre: metodo.nombre,
      moneda: metodo.moneda,
      imagen_url: metodo.imagen_url ?? '',
      activo: metodo.activo,
    });
    setCuentaMetodoForm({ alias: '', cuenta: '', titular: '', qr_url: '', predeterminada: false, activa: true });
    setError(null);
    setNotice(null);
    listarCuentasMetodoPago(metodo.id, true)
      .then((cuentas) => {
        setCuentasMetodo(cuentas);
        setCuentaMetodoForm((current) => ({ ...current, predeterminada: cuentas.length === 0 }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar las cuentas del metodo'));
  }

  async function guardarMetodoEditado(event: FormEvent) {
    event.preventDefault();
    if (!metodoEditando || metodoEditSaving) return;
    setError(null);
    setNotice(null);
    setMetodoEditSaving(true);
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
    } finally {
      setMetodoEditSaving(false);
    }
  }

  async function guardarCuentaMetodo(event: FormEvent) {
    event.preventDefault();
    if (!metodoEditando || cuentaMetodoSaving) return;
    setError(null);
    setNotice(null);
    setCuentaMetodoSaving(true);
    try {
      await crearCuentaMetodoPago(metodoEditando.id, {
        alias: cuentaMetodoForm.alias,
        cuenta: cuentaMetodoForm.cuenta,
        titular: cuentaMetodoForm.titular,
        qr_url: cuentaMetodoForm.qr_url || null,
        predeterminada: cuentaMetodoForm.predeterminada,
        activa: cuentaMetodoForm.activa,
      });
      const cuentasActualizadas = await listarCuentasMetodoPago(metodoEditando.id, true);
      setCuentaMetodoForm({
        alias: '',
        cuenta: '',
        titular: '',
        qr_url: '',
        predeterminada: cuentasActualizadas.length === 0,
        activa: true,
      });
      setCuentasMetodo(cuentasActualizadas);
      setNotice('Cuenta de pago guardada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la cuenta');
    } finally {
      setCuentaMetodoSaving(false);
    }
  }

  async function marcarCuentaPredeterminada(cuenta: MetodoPagoCuenta) {
    if (!metodoEditando) return;
    setError(null);
    setNotice(null);
    try {
      await actualizarCuentaMetodoPago(metodoEditando.id, cuenta.id, { predeterminada: true, activa: true });
      setCuentasMetodo(await listarCuentasMetodoPago(metodoEditando.id, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar la cuenta predeterminada');
    }
  }

  async function toggleCuentaMetodo(cuenta: MetodoPagoCuenta) {
    if (!metodoEditando) return;
    setError(null);
    setNotice(null);
    try {
      await actualizarCuentaMetodoPago(metodoEditando.id, cuenta.id, { activa: !cuenta.activa });
      setCuentasMetodo(await listarCuentasMetodoPago(metodoEditando.id, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la cuenta');
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

  async function toggleProvincia(provincia: ProvinciaServicio) {
    setError(null);
    setNotice(null);
    try {
      await actualizarProvinciaServicio(provincia.id, { activo: !provincia.activo });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la provincia');
    }
  }

  function abrirEditarProvincia(provincia: ProvinciaServicio) {
    setProvinciaEditando(provincia);
    setProvinciaForm({ nombre: provincia.nombre, activo: provincia.activo });
    setError(null);
    setNotice(null);
    setCrearModalTema('provincias');
  }

  function abrirEditarPunto(punto: PuntoRecogida) {
    setPuntoEditando(punto);
    setPuntoForm({
      nombre: punto.nombre,
      direccion: punto.direccion,
      telefono: punto.telefono ?? '',
      provincia_id: punto.provincia_id ? String(punto.provincia_id) : '',
      activo: punto.activo,
    });
    setError(null);
    setNotice(null);
    setCrearModalTema('puntos');
  }

  function cerrarModalProvincia() {
    setCrearModalTema(null);
    setProvinciaEditando(null);
  }

  function cerrarModalPunto() {
    setCrearModalTema(null);
    setPuntoEditando(null);
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

  const menuGroups: AdminMenuGroup<AdminTema>[] = [
    {
      titulo: 'Catalogos operativos',
      items: [
        { tema: 'metodos', titulo: 'Metodos de pago', resumen: resumenCarga(temasCargados.has('metodos'), `${metodos.filter((item) => item.activo).length} activos · ${metodos.filter((item) => !item.activo).length} inactivos`), icono: Banknote },
        { tema: 'provincias', titulo: 'Provincias de servicio', resumen: resumenCarga(temasCargados.has('provincias'), `${provincias.filter((item) => item.activo).length} activas · ${provincias.filter((item) => !item.activo).length} inactivas`), icono: MapPin },
        { tema: 'puntos', titulo: 'Puntos de recogida', resumen: resumenCarga(temasCargados.has('puntos'), `${puntos.filter((item) => item.activo).length} activos · ${puntos.filter((item) => !item.activo).length} inactivos`), icono: MapPin },
        { tema: 'ofertas', titulo: 'Ofertas', resumen: resumenCarga(temasCargados.has('ofertas'), `${ofertas.filter((item) => item.activa).length} activas · ${ofertas.filter((item) => !item.activa).length} inactivas`), icono: Tags },
        { tema: 'paquetes', titulo: 'Paquetes de saldo', resumen: resumenCarga(temasCargados.has('paquetes'), `${paquetes.filter((item) => item.activo).length} activos · ${paquetes.filter((item) => !item.activo).length} inactivos`), icono: Package },
        { tema: 'promociones', titulo: 'Carrusel', resumen: resumenCarga(temasCargados.has('promociones'), `${promociones.filter((item) => item.activa).length} activos · ${promociones.filter((item) => !item.activa).length} inactivos`), icono: Megaphone },
      ],
    },
    {
      titulo: 'Personas',
      items: [
        { tema: 'clientes', titulo: 'Clientes', resumen: resumenCarga(temasCargados.has('clientes'), `${clientes.filter((item) => item.activo).length} activos · ${clientes.filter((item) => !item.activo).length} inactivos`), icono: UsersRound },
        { tema: 'contactos', titulo: 'Contactos', resumen: resumenCarga(temasCargados.has('contactos'), `${contactos.filter((item) => item.activo).length} activos · ${contactos.filter((item) => !item.activo).length} inactivos`), icono: UserRound },
        { tema: 'operadores', titulo: 'Operadores', resumen: resumenCarga(temasCargados.has('operadores'), `${operadores.filter((item) => item.activo).length} activos · ${operadores.filter((item) => !item.activo).length} inactivos`), icono: UsersRound },
      ],
    },
    {
      titulo: 'Sistema',
      items: [
        { tema: 'configuracion', titulo: 'Configuracion', resumen: resumenCarga(temasCargados.has('configuracion'), `${configuracionesSistemaTotal} claves`), icono: Settings2 },
        { tema: 'templates', titulo: 'Templates', resumen: resumenCarga(temasCargados.has('templates'), `${templates.length} plantillas`), icono: FileText },
      ],
    },
  ];

  return (
    <section className="admin-page admin-surface app-page-width">
      <AdminHero
        titulo={tituloTema(temaActivo)}
        subtitulo={temaActivo ? 'Administracion / Catalogos' : 'Administracion'}
        descripcion={temaActivo ? adminTemaVisual[temaActivo].descripcion : undefined}
        icono={temaActivo ? adminTemaVisual[temaActivo].icono : undefined}
        loading={loading}
        detail={Boolean(temaActivo)}
        onBack={volverMenu}
        onRefresh={() => void cargar()}
      />

      {error && <DismissibleNotice className="notice error" role="alert">{error}</DismissibleNotice>}
      {notice && <DismissibleNotice className="notice">{notice}</DismissibleNotice>}
      {loading && temaActivo && !temasCargados.has(temaActivo) && (
        <PageLoader label={`Cargando ${tituloTema(temaActivo).toLowerCase()}`} inline />
      )}

      {!temaActivo && <AdminMenu groups={menuGroups} onOpen={abrirTema} />}

      {temaActivo === 'metodos' && temasCargados.has('metodos') && (
        <AdminSection icono={Banknote} titulo="Metodos de pago" resumen={`${metodosVisibles.length} de ${metodos.length}`} action={<button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('metodos')}>Crear</button>}>
          <AdminStateSwitch value={estadoVista} onChange={setEstadoVista} />
          <div className="admin-card-list">
            {metodosVisibles.length === 0 && <AdminEmpty>Sin registros {estadoVista}</AdminEmpty>}
            {metodosVisibles.map((metodo) => {
              const visual = metodoPagoVisual(metodo);
              return (
              <div className="catalog-row payment-method-admin-row" key={metodo.id}>
                <button type="button" className="payment-method-admin-main" onClick={() => abrirEditarMetodo(metodo)}>
                  <span className="payment-method-logo" aria-hidden="true">{visual.src ? <img src={visual.src} alt="" /> : visual.Icon ? createElement(visual.Icon, { size: 22, strokeWidth: 2.4 }) : <span>{visual.initials}</span>}</span>
                  <span><strong>{metodo.nombre}</strong><small>{metodo.moneda}{metodo.imagen_url ? ' · imagen propia' : ' · logo automatico'}</small></span>
                </button>
                <span className={metodo.activo ? 'status completado' : 'status cancelado'}>{metodo.activo ? 'activo' : 'inactivo'}</span>
                <button className="ghost-button catalog-toggle-action" onClick={() => toggleMetodo(metodo)}><Power size={18} /> {metodo.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
              );
            })}
          </div>
        </AdminSection>
      )}

      {temaActivo === 'provincias' && temasCargados.has('provincias') && (
        <AdminSection icono={MapPin} titulo="Provincias de servicio" resumen={`${provinciasVisibles.length} de ${provincias.length}`} action={<button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('provincias')}>Crear</button>}>
          <AdminStateSwitch value={estadoVista} onChange={setEstadoVista} feminine ariaLabel="Vista de provincias" />
          <div className="admin-card-list">
            {provinciasVisibles.length === 0 && <AdminEmpty>Sin provincias {estadoVista}</AdminEmpty>}
            {provinciasVisibles.map((provincia) => (
              <div className="catalog-row" key={provincia.id}>
                <button type="button" className="catalog-edit-main" onClick={() => abrirEditarProvincia(provincia)}>
                  <span><strong>{provincia.nombre}</strong><small>{provincia.activo ? 'Disponible para puntos de recogida' : 'No disponible para nuevos puntos'}</small></span>
                </button>
                <div className="catalog-offer-actions">
                  <span className={provincia.activo ? 'status completado' : 'status cancelado'}>{provincia.activo ? 'habilitada' : 'deshabilitada'}</span>
                  <button className="ghost-button catalog-toggle-action" type="button" onClick={() => toggleProvincia(provincia)}><Power size={18} /> {provincia.activo ? 'Deshabilitar' : 'Habilitar'}</button>
                </div>
              </div>
            ))}
          </div>
        </AdminSection>
      )}

      {temaActivo === 'puntos' && temasCargados.has('puntos') && (
        <AdminSection icono={MapPin} titulo="Puntos de recogida" resumen={`${puntosVisibles.length} de ${puntos.length}`} action={<button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('puntos')}>Crear</button>}>
          <AdminStateSwitch value={estadoVista} onChange={setEstadoVista} />
          <div className="admin-card-list">
            {puntosVisibles.length === 0 && <AdminEmpty>Sin registros {estadoVista}</AdminEmpty>}
            {puntosVisibles.map((punto) => (
              <div className="catalog-row" key={punto.id}>
                <button type="button" className="catalog-edit-main" onClick={() => abrirEditarPunto(punto)}>
                  <span><strong>{punto.nombre}</strong><small>{[punto.provincia_nombre, punto.direccion].filter(Boolean).join(' · ')}</small></span>
                </button>
                <div className="catalog-offer-actions">
                  <span className={punto.activo ? 'status completado' : 'status cancelado'}>{punto.activo ? 'activo' : 'inactivo'}</span>
                  <button className="ghost-button catalog-toggle-action" type="button" onClick={() => togglePunto(punto)}><Power size={18} /> {punto.activo ? 'Desactivar' : 'Activar'}</button>
                </div>
              </div>
            ))}
          </div>
        </AdminSection>
      )}

      {temaActivo === 'ofertas' && temasCargados.has('ofertas') && (
        <AdminSection icono={Tags} titulo="Ofertas" resumen={`${ofertasVisibles.length} de ${ofertas.length}`} action={<button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('ofertas')}>Crear</button>}>
          <AdminStateSwitch value={estadoVista} onChange={setEstadoVista} />
          <div className="admin-service-groups">
            {ofertasVisibles.length === 0 && <AdminEmpty>Sin registros {estadoVista}</AdminEmpty>}
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
        </AdminSection>
      )}

      {temaActivo === 'paquetes' && temasCargados.has('paquetes') && (
        <AdminSection icono={Package} titulo="Paquetes de saldo" resumen={`${paquetesVisibles.length} de ${paquetes.length}`} action={<button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('paquetes')}>Crear</button>}>
          <AdminStateSwitch value={estadoVista} onChange={setEstadoVista} />
          <div className="admin-card-list">
            {paquetesVisibles.length === 0 && <AdminEmpty>Sin registros {estadoVista}</AdminEmpty>}
            {paquetesVisibles.map((paquete) => (
              <div className="catalog-row" key={paquete.id}>
                <span><strong>{paquete.nombre}</strong><small>{paquete.monto_pago} {paquete.moneda_pago} · {paquete.saldo_cup} CUP · {paquete.origen}</small></span>
                <span className={paquete.activo ? 'status completado' : 'status cancelado'}>{paquete.activo ? 'activo' : 'inactivo'}</span>
                <button className="ghost-button catalog-toggle-action" onClick={() => togglePaquete(paquete)}><Power size={18} /> {paquete.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            ))}
          </div>
        </AdminSection>
      )}


      {temaActivo === 'promociones' && temasCargados.has('promociones') && (
        <AdminSection icono={Megaphone} titulo="Slides del carrusel" resumen={`${promocionesVisibles.length} de ${promociones.length}`} action={<button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('promociones')}>Crear</button>}>
          <AdminStateSwitch value={estadoVista} onChange={setEstadoVista} ariaLabel="Vista de slides" />
          <div className="admin-card-list promo-admin-list">
            {promocionesVisibles.length === 0 && <AdminEmpty>Sin slides {estadoVista}</AdminEmpty>}
            {promocionesVisibles.map((promocion) => (
              <div className="catalog-row promo-admin-row" key={promocion.id}>
                <button type="button" className="promo-admin-main" onClick={() => abrirEditarPromocion(promocion)}>
                  <span className="promo-admin-thumb" aria-hidden="true">
                    {promocion.imagen_url ? <img src={apiAssetUrl(promocion.imagen_url)} alt="" /> : <ImagePlus size={22} />}
                  </span>
                  <span>
                    <strong>{promocion.titulo}</strong>
                    <small>{promocion.tipo} · orden {promocion.orden}</small>
                    <small><CalendarClock size={14} /> {formatFechaPromo(promocion.fecha_desde)} - {formatFechaPromo(promocion.fecha_hasta)}</small>
                  </span>
                </button>
                <span className={promocion.vigente ? 'status completado' : promocion.activa ? 'status en_operacion' : 'status cancelado'}>{estadoPromocion(promocion)}</span>
                <button className="ghost-button catalog-toggle-action" onClick={() => togglePromocion(promocion)}><Power size={18} /> {promocion.activa ? 'Desactivar' : 'Activar'}</button>
                <button className="ghost-button catalog-toggle-action" onClick={() => desactivarPromocion(promocion)}>Eliminar</button>
              </div>
            ))}
          </div>
        </AdminSection>
      )}

      {temaActivo === 'clientes' && temasCargados.has('clientes') && (
        <AdminSection icono={UsersRound} titulo="Clientes" resumen={`${clientesVisibles.length} de ${clientes.length}`} action={<button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('clientes')}>Crear</button>}>
          <AdminStateSwitch value={estadoVista} onChange={setEstadoVista} />
          <div className="admin-card-list">
            {clientesVisibles.length === 0 && <AdminEmpty>Sin registros {estadoVista}</AdminEmpty>}
            {clientesVisibles.map((cliente) => (
              <button type="button" className="config-row admin-config-card" key={cliente.id} onClick={() => setClienteForm({ nombre: cliente.nombre, telefono: cliente.telefono ?? '', email: cliente.email ?? '', pais: cliente.pais ?? 'br', moneda_preferida: cliente.moneda_preferida ?? 'BRL' })}>
                <strong>{cliente.nombre} #{cliente.id}</strong>
                <span>{cliente.telefono ?? 'sin telefono'} · {cliente.moneda_preferida ?? 'sin moneda'}</span>
                <span className={cliente.activo ? 'status completado' : 'status cancelado'}>{cliente.activo ? 'activo' : 'inactivo'}</span>
              </button>
            ))}
          </div>
        </AdminSection>
      )}

      {temaActivo === 'contactos' && temasCargados.has('contactos') && (
        <AdminSection icono={UserRound} titulo="Contactos" resumen={`${contactosVisibles.length} de ${contactos.length}`} action={<button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('contactos')}>Crear</button>}>
          <AdminStateSwitch value={estadoVista} onChange={setEstadoVista} />
          <div className="admin-card-list">
            {contactosVisibles.length === 0 && <AdminEmpty>Sin registros {estadoVista}</AdminEmpty>}
            {contactosVisibles.map((contacto) => (
              <button type="button" className="config-row admin-config-card" key={contacto.id} onClick={() => setContactoForm({ cliente_id: contacto.cliente_id ? String(contacto.cliente_id) : '', nombre: contacto.nombre, telefono: contacto.telefono ?? '', numero_tarjeta: contacto.numero_tarjeta ?? '', tipo_tarjeta: contacto.tipo_tarjeta ?? '', documento_identidad_url: contacto.documento_identidad_url ?? '', pais: contacto.pais ?? 'cu', notas: contacto.notas ?? '' })}>
                <strong>{contacto.nombre} #{contacto.id}</strong>
                <span>{contacto.telefono ?? 'sin telefono'} · cliente {contacto.cliente_id ?? 'sin asociar'}</span>
                <span className={contacto.activo ? 'status completado' : 'status cancelado'}>{contacto.activo ? 'activo' : 'inactivo'}</span>
              </button>
            ))}
          </div>
        </AdminSection>
      )}

      {temaActivo === 'operadores' && temasCargados.has('operadores') && (
        <AdminSection icono={UsersRound} titulo="Operadores" resumen={`${operadoresVisibles.length} de ${operadores.length}`} action={<button type="button" className="primary-button admin-create-button" onClick={() => abrirCrearModal('operadores')}>Crear</button>}>
          <AdminStateSwitch value={estadoVista} onChange={setEstadoVista} ariaLabel="Vista de operadores" />
          <div className="admin-card-list">
            {operadoresVisibles.length === 0 && <AdminEmpty>Sin registros {estadoVista}</AdminEmpty>}
            {operadoresVisibles.map((item) => (
              <div className="catalog-row operator-admin-row" key={item.id}>
                <button type="button" className="operator-admin-main" onClick={() => abrirEditarOperador(item)}>
                  <span><strong>{item.nombre}</strong><small>{item.telefono ?? 'sin telefono'} · {item.codigo_operador}</small></span>
                  <span className="operator-role-pill">{item.rol}</span>
                </button>
                <span className={item.activo ? 'status completado' : 'status cancelado'}>{item.activo ? 'activo' : 'inactivo'}</span>
                <button className="ghost-button catalog-toggle-action" onClick={() => toggleOperador(item)}><Power size={18} /> {item.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            ))}
          </div>
        </AdminSection>
      )}

      {temaActivo === 'configuracion' && temasCargados.has('configuracion') && (
        <AdminSection icono={Settings2} titulo="Configuracion" resumen={configuracionesSistemaTotal} action={<button type="button" className="primary-button admin-create-button" onClick={() => { setConfigForm({ clave: '', valor: '' }); abrirModalAdmin('config'); setConfigModalOpen(true); }}>Nueva</button>}>
          <div className="config-list whatsapp-config-list">
            {whatsappConfiguraciones.map((item) => (
              <button type="button" className="config-row whatsapp-config-row" key={item.clave} onClick={() => abrirConfig({ id: 0, clave: item.clave, valor: item.valor, editable: true })}>
                <span className="admin-section-icon"><MessageCircle size={18} /></span>
                <span><strong>{item.titulo}</strong><small>{item.descripcion}</small></span>
                <span>{item.valor || 'Sin link configurado'}</span>
              </button>
            ))}
          </div>
          <div className="config-list">
            {configuracionesSistema.map((item) => (
              <button type="button" className="config-row" key={item.clave} onClick={() => abrirConfig(item)}>
                <strong>{item.clave}</strong>
                <span>{item.valor}</span>
              </button>
            ))}
            {configuracionesSistema.length === 0 && <AdminEmpty>Sin configuraciones adicionales</AdminEmpty>}
          </div>
        </AdminSection>
      )}

      {temaActivo === 'templates' && temasCargados.has('templates') && (
        <AdminSection icono={FileText} titulo="Templates" resumen={templates.length} action={<button type="button" className="ghost-button admin-create-button" onClick={() => abrirTemplate(templateForm.clave)} disabled={templates.length === 0}>Editar</button>}>
          <div className="config-list">
            {templates.map((template) => (
              <button type="button" className="config-row" key={template.clave} onClick={() => abrirTemplate(template.clave)}>
                <strong>{template.clave}</strong>
                <span>{template.valor}</span>
              </button>
            ))}
          </div>
        </AdminSection>
      )}


      {crearModalTema === 'metodos' && (
        <Modal title="Crear metodo de pago" subtitle="Administracion / Metodos de pago" onClose={() => setCrearModalTema(null)}>
          <form className="stack-form modal-form" onSubmit={guardarMetodo}>
            <input value={metodoForm.nombre} onChange={(event) => setMetodoForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <FloatingSelect value={metodoForm.moneda} onChange={(value) => setMetodoForm((current) => ({ ...current, moneda: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda }))} ariaLabel="Moneda" align="left" />
            <input value={metodoForm.imagen_url} onChange={(event) => setMetodoForm((current) => ({ ...current, imagen_url: event.target.value }))} placeholder="Imagen URL opcional" />
            <div className="method-image-note"><ImagePlus size={16} /> Si lo dejas vacio, usa el logo automatico desde assets.</div>
            <button className="primary-button" disabled={metodoSaving}><SavingLabel saving={metodoSaving} idle="Crear" busy="Creando..." /></button>
          </form>
        </Modal>
      )}
      {metodoEditando && (
        <Modal title="Editar metodo de pago" subtitle={`${metodoEditando.nombre} · ${metodoEditando.moneda}`} onClose={() => { setMetodoEditando(null); setCuentasMetodo([]); }} wide>
          <form className="stack-form modal-form" onSubmit={guardarMetodoEditado}>
            <div
              className="method-image-dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={manejarDropImagenMetodo}
            >
              <span className="payment-method-logo method-image-preview" aria-hidden="true">
                {metodoPagoVisual({ ...metodoEditando, imagen_url: metodoForm.imagen_url || metodoEditando.imagen_url }).src ? (
                  <img src={metodoPagoVisual({ ...metodoEditando, imagen_url: metodoForm.imagen_url || metodoEditando.imagen_url }).src} alt="" />
                ) : metodoPagoVisual(metodoEditando).Icon ? (
                  createElement(metodoPagoVisual(metodoEditando).Icon!, { size: 22, strokeWidth: 2.4 })
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
              <FloatingSelect value={metodoForm.moneda} onChange={(value) => setMetodoForm((current) => ({ ...current, moneda: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda }))} ariaLabel="Moneda" align="left" />
              <FloatingSelect value={metodoForm.activo ? 'activo' : 'inactivo'} onChange={(value) => setMetodoForm((current) => ({ ...current, activo: value === 'activo' }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} ariaLabel="Estado" align="left" />
              <button className="primary-button" disabled={metodoEditSaving}><SavingLabel saving={metodoEditSaving} idle="Guardar" busy="Guardando..." /></button>
            </div>
            <input value={metodoForm.imagen_url} onChange={(event) => setMetodoForm((current) => ({ ...current, imagen_url: event.target.value }))} placeholder="Imagen URL o /storage/metodos-pago/archivo.webp" />
          </form>

          {!esMetodoEfectivo(metodoForm.nombre) && <section className="payment-accounts-panel">
            <header className="payment-accounts-header">
              <div>
                <strong>Cuentas de pago</strong>
                <small>La predeterminada aparece en la pantalla de pago del pedido.</small>
              </div>
            </header>
            <div className="payment-account-list">
              {cuentasMetodo.length === 0 && <div className="admin-empty-row">Sin cuentas configuradas</div>}
              {cuentasMetodo.map((cuenta) => (
                <div className="catalog-row payment-account-row" key={cuenta.id}>
                  <span><strong>{cuenta.alias}</strong><small>{cuenta.cuenta} · {cuenta.titular}</small></span>
                  <div className="catalog-offer-actions">
                    <div className="payment-account-statuses">
                      <span className={cuenta.predeterminada ? 'status completado' : 'status neutral'}>{cuenta.predeterminada ? 'predeterminada' : 'secundaria'}</span>
                      <span className={cuenta.activa ? 'status completado' : 'status cancelado'}>{cuenta.activa ? 'activa' : 'inactiva'}</span>
                    </div>
                    {!cuenta.predeterminada && <button type="button" className="ghost-button catalog-toggle-action" onClick={() => marcarCuentaPredeterminada(cuenta)}>Predeterminar</button>}
                    <button type="button" className="ghost-button catalog-toggle-action" onClick={() => toggleCuentaMetodo(cuenta)}><Power size={18} /> {cuenta.activa ? 'Desactivar' : 'Activar'}</button>
                  </div>
                </div>
              ))}
            </div>
            <form className="stack-form modal-form payment-account-form" onSubmit={guardarCuentaMetodo}>
              <div className="inline-form three">
                <input value={cuentaMetodoForm.alias} onChange={(event) => setCuentaMetodoForm((current) => ({ ...current, alias: event.target.value }))} placeholder="Alias, ej. Pix principal" required />
                <input value={cuentaMetodoForm.cuenta} onChange={(event) => setCuentaMetodoForm((current) => ({ ...current, cuenta: event.target.value }))} placeholder={metodoEditando.nombre.toLowerCase().includes('pix') ? 'Llave Pix' : 'Cuenta o clave'} required />
                <input value={cuentaMetodoForm.titular} onChange={(event) => setCuentaMetodoForm((current) => ({ ...current, titular: event.target.value }))} placeholder="Titular" required />
              </div>
              <input value={cuentaMetodoForm.qr_url} onChange={(event) => setCuentaMetodoForm((current) => ({ ...current, qr_url: event.target.value }))} placeholder="QR URL opcional" />
              <label className="permission-switch-row">
                <span>Predeterminada<small>Usar esta cuenta en pedidos nuevos con este metodo.</small></span>
                <UiSwitch checked={cuentaMetodoForm.predeterminada} onChange={(checked) => setCuentaMetodoForm((current) => ({ ...current, predeterminada: checked }))} ariaLabel="Marcar cuenta como predeterminada" />
              </label>
              <button className="primary-button" disabled={cuentaMetodoSaving}><SavingLabel saving={cuentaMetodoSaving} idle="Agregar cuenta" busy="Agregando..." /></button>
            </form>
          </section>}
        </Modal>
      )}

      {crearModalTema === 'provincias' && (
        <Modal title={provinciaEditando ? 'Editar provincia de servicio' : 'Crear provincia de servicio'} subtitle="Administracion / Provincias de servicio" onClose={cerrarModalProvincia}>
          <form className="stack-form modal-form" onSubmit={guardarProvincia}>
            <input value={provinciaForm.nombre} onChange={(event) => setProvinciaForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Provincia" required />
            <label className="permission-switch-row">
              <span>Habilitada<small>Disponible para entrega de efectivo</small></span>
              <UiSwitch checked={provinciaForm.activo} onChange={(checked) => setProvinciaForm((current) => ({ ...current, activo: checked }))} ariaLabel="Habilitar provincia" />
            </label>
            <button className="primary-button"><Save size={18} /> {provinciaEditando ? 'Guardar cambios' : 'Crear provincia'}</button>
          </form>
        </Modal>
      )}

      {crearModalTema === 'puntos' && (
        <Modal title={puntoEditando ? 'Editar punto de recogida' : 'Crear punto de recogida'} subtitle="Administracion / Puntos de recogida" onClose={cerrarModalPunto}>
          <form className="stack-form modal-form" onSubmit={guardarPunto}>
            <input value={puntoForm.nombre} onChange={(event) => setPuntoForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <input value={puntoForm.direccion} onChange={(event) => setPuntoForm((current) => ({ ...current, direccion: event.target.value }))} placeholder="Direccion" required />
            <FloatingSelect value={puntoForm.provincia_id} onChange={(value) => setPuntoForm((current) => ({ ...current, provincia_id: value }))} options={provincias.map((provincia) => ({ value: String(provincia.id), label: provincia.nombre, description: provincia.activo ? 'Habilitada' : 'Deshabilitada' }))} ariaLabel="Provincia" align="left" />
            <PhoneInput value={puntoForm.telefono} onChange={(value) => setPuntoForm((current) => ({ ...current, telefono: value }))} defaultCode="+53" pasteTitle="Pegar telefono" />
            {puntoEditando && (
              <label className="permission-switch-row">
                <span>Activo<small>Disponible para seleccionar en pedidos de efectivo.</small></span>
                <UiSwitch checked={puntoForm.activo} onChange={(checked) => setPuntoForm((current) => ({ ...current, activo: checked }))} ariaLabel="Activar punto de recogida" />
              </label>
            )}
            <button className="primary-button"><Save size={18} /> {puntoEditando ? 'Guardar cambios' : 'Crear punto'}</button>
          </form>
        </Modal>
      )}
      {crearModalTema === 'ofertas' && (
        <Modal title="Crear oferta" subtitle="Administracion / Ofertas" onClose={() => setCrearModalTema(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarOferta}>
            <FloatingSelect value={ofertaForm.servicio} onChange={(value) => setOfertaForm((current) => ({ ...current, servicio: value }))} options={servicios.map((servicio) => ({ value: servicio, label: servicio }))} ariaLabel="Servicio" align="left" />
            <input value={ofertaForm.nombre} onChange={(event) => setOfertaForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre opcional" />
            <div className="inline-form three">
              <input value={ofertaForm.tasa} onChange={(event) => setOfertaForm((current) => ({ ...current, tasa: event.target.value }))} inputMode="decimal" placeholder="Tasa" required />
              <input value={ofertaForm.minimo_pago} onChange={(event) => setOfertaForm((current) => ({ ...current, minimo_pago: event.target.value }))} inputMode="decimal" placeholder="Minimo" required />
              <FloatingSelect value={ofertaForm.moneda_pago} onChange={(value) => setOfertaForm((current) => ({ ...current, moneda_pago: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda }))} ariaLabel="Moneda de pago" align="left" />
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
              <FloatingSelect value={paqueteForm.moneda_pago} onChange={(value) => setPaqueteForm((current) => ({ ...current, moneda_pago: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda }))} ariaLabel="Moneda de pago" align="left" />
            </div>
            <button className="primary-button"><Save size={18} /> Crear paquete</button>
          </form>
        </Modal>
      )}
      {crearModalTema === 'promociones' && (
        <Modal title="Crear slide" subtitle="Administracion / Carrusel" onClose={() => setCrearModalTema(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarPromocion}>
            <div className="inline-form three">
              <FloatingSelect value={promoForm.tipo} onChange={(value) => setPromoForm((current) => ({ ...current, tipo: value as Promocion['tipo'] }))} options={[...tiposSlide]} ariaLabel="Tipo de slide" align="left" />
              <input value={promoForm.titulo} onChange={(event) => setPromoForm((current) => ({ ...current, titulo: event.target.value }))} placeholder="Titulo" required />
              <input value={promoForm.subtitulo} onChange={(event) => setPromoForm((current) => ({ ...current, subtitulo: event.target.value }))} placeholder="Etiqueta corta" />
            </div>
            {promoForm.tipo !== 'precios' && (
              <div className="method-image-dropzone promo-image-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={manejarDropImagenPromo}>
                <span className="promo-admin-thumb promo-edit-preview" aria-hidden="true">
                  {promoFilePreview ? <img src={promoFilePreview} alt="" /> : promoForm.imagen_url ? <img src={apiAssetUrl(promoForm.imagen_url)} alt="" /> : <ImagePlus size={22} />}
                </span>
                <div>
                  <strong>{promoForm.tipo === 'marca' ? 'Logo opcional' : 'Imagen de la promocion'}</strong>
                  <small>{promoForm.tipo === 'marca' ? 'Si no subes una imagen se usa el logo de El Jireh.' : 'Recomendado: 1600 x 600 px, con el contenido importante centrado.'}</small>
                </div>
                <label className="ghost-button method-image-picker">
                  <UploadCloud size={18} /> {promoFile ? promoFile.name : 'Elegir'}
                  <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setPromoFile(file); setPromoFilePreview(URL.createObjectURL(file)); } event.currentTarget.value = ''; }} />
                </label>
              </div>
            )}
            <textarea value={promoForm.descripcion} onChange={(event) => setPromoForm((current) => ({ ...current, descripcion: event.target.value }))} placeholder="Descripcion de la promocion" rows={3} required />
            {promoForm.tipo !== 'precios' && <input value={promoForm.imagen_url} onChange={(event) => setPromoForm((current) => ({ ...current, imagen_url: event.target.value }))} placeholder="Imagen URL opcional" />}
            <div className="inline-form three">
              <label><span>Desde</span><input type="datetime-local" value={promoForm.fecha_desde} onChange={(event) => setPromoForm((current) => ({ ...current, fecha_desde: event.target.value }))} required /></label>
              <label><span>Hasta</span><input type="datetime-local" value={promoForm.fecha_hasta} onChange={(event) => setPromoForm((current) => ({ ...current, fecha_hasta: event.target.value }))} required /></label>
              <label><span>Orden</span><input type="number" value={promoForm.orden} onChange={(event) => setPromoForm((current) => ({ ...current, orden: event.target.value }))} /></label>
            </div>
            <FloatingSelect value={promoForm.activa ? 'activa' : 'inactiva'} onChange={(value) => setPromoForm((current) => ({ ...current, activa: value === 'activa' }))} options={[{ value: 'activa', label: 'Activo' }, { value: 'inactiva', label: 'Inactivo' }]} ariaLabel="Estado del slide" align="left" />
            <button className="primary-button"><Save size={18} /> Crear slide</button>
          </form>
        </Modal>
      )}

      {promoEditando && (
        <Modal title="Editar slide" subtitle={`#${promoEditando.id} · ${estadoPromocion(promoEditando)}`} onClose={() => setPromoEditando(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarPromocionEditada}>
            <div className="inline-form three">
              <FloatingSelect value={promoForm.tipo} onChange={(value) => setPromoForm((current) => ({ ...current, tipo: value as Promocion['tipo'] }))} options={[...tiposSlide]} ariaLabel="Tipo de slide" align="left" />
              <input value={promoForm.titulo} onChange={(event) => setPromoForm((current) => ({ ...current, titulo: event.target.value }))} placeholder="Titulo" required />
              <input value={promoForm.subtitulo} onChange={(event) => setPromoForm((current) => ({ ...current, subtitulo: event.target.value }))} placeholder="Etiqueta corta" />
            </div>
            {promoForm.tipo !== 'precios' && (
              <div className="method-image-dropzone promo-image-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={manejarDropImagenPromo}>
                <span className="promo-admin-thumb promo-edit-preview" aria-hidden="true">
                  {promoFilePreview ? <img src={promoFilePreview} alt="" /> : promoForm.imagen_url ? <img src={apiAssetUrl(promoForm.imagen_url)} alt="" /> : <ImagePlus size={22} />}
                </span>
                <div><strong>{promoForm.tipo === 'marca' ? 'Logo opcional' : 'Imagen de la promocion'}</strong><small>El slide se publica sólo si está activo y vigente.</small></div>
                <label className="ghost-button method-image-picker">
                  <UploadCloud size={18} /> {promoUploading ? 'Subiendo...' : promoFile ? promoFile.name : 'Subir'}
                  <input type="file" accept="image/*" disabled={promoUploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) { setPromoFile(file); setPromoFilePreview(URL.createObjectURL(file)); } event.currentTarget.value = ''; }} />
                </label>
              </div>
            )}
            <textarea value={promoForm.descripcion} onChange={(event) => setPromoForm((current) => ({ ...current, descripcion: event.target.value }))} placeholder="Descripcion de la promocion" rows={3} required />
            {promoForm.tipo !== 'precios' && <input value={promoForm.imagen_url} onChange={(event) => setPromoForm((current) => ({ ...current, imagen_url: event.target.value }))} placeholder="Imagen URL" />}
            <div className="inline-form three">
              <label><span>Desde</span><input type="datetime-local" value={promoForm.fecha_desde} onChange={(event) => setPromoForm((current) => ({ ...current, fecha_desde: event.target.value }))} required /></label>
              <label><span>Hasta</span><input type="datetime-local" value={promoForm.fecha_hasta} onChange={(event) => setPromoForm((current) => ({ ...current, fecha_hasta: event.target.value }))} required /></label>
              <label><span>Orden</span><input type="number" value={promoForm.orden} onChange={(event) => setPromoForm((current) => ({ ...current, orden: event.target.value }))} /></label>
            </div>
            <FloatingSelect value={promoForm.activa ? 'activa' : 'inactiva'} onChange={(value) => setPromoForm((current) => ({ ...current, activa: value === 'activa' }))} options={[{ value: 'activa', label: 'Activo' }, { value: 'inactiva', label: 'Inactivo' }]} ariaLabel="Estado del slide" align="left" />
            <button className="primary-button"><Save size={18} /> Guardar slide</button>
          </form>
        </Modal>
      )}

      {crearModalTema === 'clientes' && (
        <Modal title="Crear cliente" subtitle="Administracion / Clientes" onClose={() => setCrearModalTema(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarCliente}>
            <input value={clienteForm.nombre} onChange={(event) => setClienteForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre cliente" required />
            <PhoneInput value={clienteForm.telefono} onChange={(value) => setClienteForm((current) => ({ ...current, telefono: value }))} defaultCode="+55" pasteTitle="Pegar telefono cliente" />
            <input value={clienteForm.email} onChange={(event) => setClienteForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
            <div className="inline-form three">
              <input value={clienteForm.pais} onChange={(event) => setClienteForm((current) => ({ ...current, pais: event.target.value }))} placeholder="pais" />
              <FloatingSelect value={clienteForm.moneda_preferida} onChange={(value) => setClienteForm((current) => ({ ...current, moneda_preferida: value }))} options={monedas.map((moneda) => ({ value: moneda, label: moneda }))} ariaLabel="Moneda preferida" align="left" />
              <button className="primary-button"><Save size={18} /> Crear cliente</button>
            </div>
          </form>
        </Modal>
      )}
      {crearModalTema === 'contactos' && (
        <Modal title="Crear contacto" subtitle="Administracion / Contactos" onClose={() => setCrearModalTema(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarContacto}>
            <FloatingSelect value={contactoForm.cliente_id} onChange={(value) => setContactoForm((current) => ({ ...current, cliente_id: value }))} options={[{ value: '', label: 'Sin cliente' }, ...clientes.map((cliente) => ({ value: String(cliente.id), label: cliente.nombre, description: `#${cliente.id}` }))]} ariaLabel="Cliente" align="left" />
            <input value={contactoForm.nombre} onChange={(event) => setContactoForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre contacto" required />
            <PhoneInput value={contactoForm.telefono} onChange={(value) => setContactoForm((current) => ({ ...current, telefono: value }))} defaultCode="+53" pasteTitle="Pegar telefono Cuba" />
            <div className="inline-form three">
              <CardNumberInput value={contactoForm.numero_tarjeta} onChange={(value) => setContactoForm((current) => ({ ...current, numero_tarjeta: value }))} placeholder="Tarjeta" pasteTitle="Pegar tarjeta" />
              <input value={contactoForm.tipo_tarjeta} onChange={(event) => setContactoForm((current) => ({ ...current, tipo_tarjeta: event.target.value }))} placeholder="Tipo tarjeta" />
              <input value={contactoForm.pais} onChange={(event) => setContactoForm((current) => ({ ...current, pais: event.target.value }))} placeholder="pais" />
            </div>
            <input value={contactoForm.documento_identidad_url} onChange={(event) => setContactoForm((current) => ({ ...current, documento_identidad_url: event.target.value }))} placeholder="Foto documento / nota" />
            <input value={contactoForm.notas} onChange={(event) => setContactoForm((current) => ({ ...current, notas: event.target.value }))} placeholder="Notas" />
            <button className="primary-button"><Save size={18} /> Crear contacto</button>
          </form>
        </Modal>
      )}

      {crearModalTema === 'operadores' && (
        <Modal title="Crear operador" subtitle="Administracion / Operadores" onClose={() => setCrearModalTema(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarOperador}>
            <input value={operadorForm.nombre} onChange={(event) => setOperadorForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <PhoneInput value={operadorForm.telefono} onChange={(value) => setOperadorForm((current) => ({ ...current, telefono: value }))} defaultCode="+55" required pasteTitle="Pegar telefono de acceso" />
            <PasswordField value={operadorForm.password} onChange={(event) => setOperadorForm((current) => ({ ...current, password: event.target.value }))} placeholder="contraseña inicial" autoComplete="new-password" />
            <FloatingSelect value={operadorForm.rol} onChange={(value) => setOperadorForm((current) => ({ ...current, rol: value, permisos: permisosBaseRol(value) }))} options={rolesOperador.map((rol) => ({ value: rol, label: rol }))} ariaLabel="Rol" align="left" />
            <PermissionSwitches permisos={operadorForm.permisos} onChange={(permisos) => setOperadorForm((current) => ({ ...current, permisos }))} />
            <button className="primary-button"><Save size={18} /> Crear operador</button>
          </form>
        </Modal>
      )}

      {operadorEditando && (
        <Modal title="Editar operador" subtitle={`${operadorEditando.nombre} · ${operadorEditando.codigo_operador}`} onClose={() => setOperadorEditando(null)} wide>
          <form className="stack-form modal-form" onSubmit={guardarOperadorEditado}>
            <input value={operadorForm.nombre} onChange={(event) => setOperadorForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre" required />
            <PhoneInput value={operadorForm.telefono} onChange={(value) => setOperadorForm((current) => ({ ...current, telefono: value }))} defaultCode="+55" required pasteTitle="Pegar telefono de acceso" />
            <PasswordField value={operadorForm.password} onChange={(event) => setOperadorForm((current) => ({ ...current, password: event.target.value }))} placeholder="Nueva contraseña opcional" autoComplete="new-password" />
            <div className="inline-form two operator-edit-inline">
              <FloatingSelect value={operadorForm.rol} onChange={(value) => setOperadorForm((current) => ({ ...current, rol: value, permisos: permisosBaseRol(value) }))} options={rolesOperador.map((rol) => ({ value: rol, label: rol }))} ariaLabel="Rol" align="left" />
              <FloatingSelect value={operadorForm.activo ? 'activo' : 'inactivo'} onChange={(value) => setOperadorForm((current) => ({ ...current, activo: value === 'activo' }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} ariaLabel="Estado" align="left" />
            </div>
            <PermissionSwitches permisos={operadorForm.permisos} onChange={(permisos) => setOperadorForm((current) => ({ ...current, permisos }))} />
            <button className="primary-button"><Save size={18} /> Guardar</button>
          </form>
        </Modal>
      )}

      {configModalOpen && (
        <Modal title="Configuracion" subtitle={configForm.clave || 'Nueva clave'} onClose={() => cerrarModalAdmin('config')} wide>
          <form className="stack-form modal-form" onSubmit={guardarConfig}>
            <input value={configForm.clave} onChange={(event) => setConfigForm((current) => ({ ...current, clave: event.target.value }))} placeholder="clave" required />
            <textarea ref={configTextareaRef} value={configForm.valor} onChange={(event) => setConfigForm((current) => ({ ...current, valor: event.target.value }))} placeholder="valor" rows={10} required />
            <div className="template-variable-panel" aria-label="Variables disponibles">
              {todasLasVariablesTemplate.map((variable) => (
                <button key={variable} type="button" onClick={() => insertarVariableConfig(variable)} title={'Agregar {' + variable + '}'}>
                  {'{' + variable + '}'}
                </button>
              ))}
            </div>
            <button className="primary-button"><Save size={18} /> Guardar configuracion</button>
          </form>
        </Modal>
      )}
      {templateModalOpen && (
        <Modal title="Template" subtitle={templateForm.clave} onClose={() => cerrarModalAdmin('template')} wide>
          <form className="stack-form modal-form" onSubmit={guardarTemplateActual}>
            <FloatingSelect value={templateForm.clave} onChange={seleccionarTemplate} options={templates.map((template) => ({ value: template.clave, label: template.clave }))} ariaLabel="Template" align="left" />
            <textarea ref={templateTextareaRef} value={templateForm.valor} onChange={(event) => setTemplateForm((current) => ({ ...current, valor: event.target.value }))} rows={12} />
            <div className="template-variable-panel" aria-label="Variables disponibles">
              {templateVariables.map((variable) => (
                <button key={variable} type="button" onClick={() => insertarVariableTemplate(variable)} title={'Agregar {' + variable + '}'}>
                  {'{' + variable + '}'}
                </button>
              ))}
            </div>
            <button className="primary-button"><Save size={18} /> Guardar template</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
