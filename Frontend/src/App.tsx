import { lazy, type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, BarChart3, BriefcaseBusiness, ChevronDown, ClipboardList, Copy, Edit3, HelpCircle, Home, KeyRound, LayoutGrid, LayoutList, LogOut, Menu, Palette, Percent, Plus, RefreshCw, Search, Settings, ShieldCheck, Smartphone, Upload, UserCircle, WalletCards, WifiOff, X } from 'lucide-react';
import { actualizarEstado, actualizarMiPerfil, apiAssetUrl, cambiarMiPassword, clearToken, getMe, getToken, listarPedidos, obtenerEstadoConfiguracionInicial, subirArchivo, subirMiFotoPerfil } from './api/client';
import type { Operador, PedidoDetalle, PedidoResumen } from './types/api';
import { LoginPage } from './pages/LoginPage';
import { PageLoader } from './components/PageLoader';
import { Modal } from './components/Modal';
import { PasswordField } from './components/PasswordField';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { FloatingSelect } from './components/FloatingSelect';
import { DismissibleNotice } from './components/DismissibleNotice';
import { formatearNumeroTarjeta } from './utils/tarjetas';
import { copiarAlPortapapeles } from './utils/clipboard';
import {
  abrirWhatsAppUrl,
} from './utils/whatsapp';
import logoJireh from './assets/brand/logo-jireh.jpeg';

const PedidoDetallePanel = lazy(() => import('./pages/PedidoDetallePanel').then((module) => ({ default: module.PedidoDetallePanel })));
const DivisaForm = lazy(() => import('./pages/DivisaForm').then((module) => ({ default: module.DivisaForm })));
const EfectivoForm = lazy(() => import('./pages/EfectivoForm').then((module) => ({ default: module.EfectivoForm })));
const SaldoForm = lazy(() => import('./pages/SaldoForm').then((module) => ({ default: module.SaldoForm })));
const OtrosForm = lazy(() => import('./pages/OtrosForm').then((module) => ({ default: module.OtrosForm })));
const TransferenciaForm = lazy(() => import('./pages/TransferenciaForm').then((module) => ({ default: module.TransferenciaForm })));
const ReportesPage = lazy(() => import('./pages/ReportesPage').then((module) => ({ default: module.ReportesPage })));
const AdminCatalogosPage = lazy(() => import('./pages/AdminCatalogosPage').then((module) => ({ default: module.AdminCatalogosPage })));
const InicioPage = lazy(() => import('./pages/InicioPage').then((module) => ({ default: module.InicioPage })));
const ThemeTestPage = lazy(() => import('./pages/ThemeTestPage').then((module) => ({ default: module.ThemeTestPage })));
const SetupInicialPage = lazy(() => import('./pages/SetupInicialPage').then((module) => ({ default: module.SetupInicialPage })));

const estados = [
  { value: '', label: 'Estado' },
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pago_confirmado', label: 'Pago confirmado' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const servicios = [
  { value: '', label: 'Servicio' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'saldo', label: 'Saldo' },
  { value: 'divisa', label: 'Divisa' },
  { value: 'otros', label: 'Otros' },
];

type CrearPedidoDraft = {
  monto_pago?: string;
  moneda_pago?: string;
  paquete_saldo_id?: string;
  monto_divisa?: string;
  tipo_tarjeta?: string;
};

type ProfileSection = 'editar' | 'permisos' | 'password' | 'ayuda' | null;
type AppTheme = 'light' | 'dark-deep' | 'dark-sidebar';
type AlcancePedidos = 'mis' | 'todas';
type PeriodoPedidos = 'hoy' | '7_dias' | 'mes' | 'todos';
type ServicioCrear = 'transferencia' | 'efectivo' | 'saldo' | 'divisa' | 'otros';
type AppToastKind = 'success' | 'error';

const THEME_KEY = 'jireh.theme';
const DARK_THEME_OPTIONS: Array<{ value: Exclude<AppTheme, 'light'>; label: string }> = [
  { value: 'dark-sidebar', label: 'Oscuro menu' },
  { value: 'dark-deep', label: 'Oscuro profundo' },
];

const estadosBandeja = estados.filter((item) => item.value);
const INFO_TOAST_DURATION_MS = 3800;
const PROFILE_TOAST_DURATION_MS = 5600;
const ERROR_TOAST_DURATION_MS = 5200;

function intervaloRefrescoPedidos() {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  }).connection;

  if (connection?.saveData || connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') {
    return 60000;
  }
  return 30000;
}

function estadoLabel(value: string) {
  if (value === 'en_operacion') return 'Pago confirmado';
  return estados.find((item) => item.value === value)?.label ?? value.replaceAll('_', ' ');
}

function estadoFaseUno(value: string) {
  return value === 'en_operacion' ? 'pago_confirmado' : value;
}

function servicioIcon(value: string, size = 18) {
  if (value === 'transferencia') return <WalletCards size={size} />;
  if (value === 'efectivo') return <Banknote size={size} />;
  if (value === 'saldo') return <Smartphone size={size} />;
  if (value === 'divisa') return <WalletCards size={size} />;
  if (value === 'otros') return <BriefcaseBusiness size={size} />;
  return <BriefcaseBusiness size={size} />;
}

function WhatsAppIcon() {
  return (
    <span className="whatsapp-icon" aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false">
        <path d="M16.1 4.2C9.7 4.2 4.5 9.4 4.5 15.8c0 2.1.6 4.2 1.7 6L4.4 28l6.4-1.7c1.6.9 3.4 1.3 5.3 1.3 6.4 0 11.6-5.2 11.6-11.6S22.5 4.2 16.1 4.2Zm0 21.4c-1.7 0-3.3-.4-4.7-1.2l-.3-.2-3.8 1 1-3.7-.2-.4c-1-1.5-1.5-3.3-1.5-5.2 0-5.3 4.3-9.6 9.6-9.6s9.6 4.3 9.6 9.6-4.4 9.7-9.7 9.7Zm5.3-7.2c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5s-.7-1.6-.9-2.2c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.1.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.2-.2-.4-.3-.7-.4Z" />
      </svg>
    </span>
  );
}


function inicialesOperador(operador: Operador) {
  return operador.nombre.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function OperadorAvatar({ operador, className }: { operador: Operador; className: string }) {
  if (operador.foto_url) {
    return <img className={`${className} avatar-photo`} src={apiAssetUrl(operador.foto_url)} alt="" />;
  }

  return <span className={className}>{inicialesOperador(operador)}</span>;
}

function AppToast({ kind, message, onClose }: { kind: AppToastKind; message: string; onClose: () => void }) {
  return (
    <div className={`app-toast ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      <button type="button" onClick={onClose} title="Cerrar notificacion" aria-label="Cerrar notificacion">
        <X size={16} />
      </button>
    </div>
  );
}

function detalleValor(pedido: PedidoResumen, key: string) {
  const value = pedido.detalle?.[key];
  if (value === null || value === undefined || value === '') return null;
  if (key === 'numero_tarjeta') return formatearNumeroTarjeta(String(value));
  return String(value);
}

function monedaEntregaPedido(pedido: PedidoResumen) {
  if (pedido.servicio === 'divisa') return detalleValor(pedido, 'tipo_tarjeta') ?? 'DIVISA';
  if (pedido.servicio === 'otros') return pedido.moneda_pago;
  return 'CUP';
}

function tasaAplicadaPedido(pedido: PedidoResumen) {
  if (pedido.servicio === 'saldo') return pedido.monto_pago;
  return pedido.tasa_final;
}

function camposTarjetaPedido(pedido: PedidoResumen) {
  if (pedido.servicio === 'transferencia') {
    return [
      { label: 'Tarjeta', value: detalleValor(pedido, 'numero_tarjeta') },
      { label: 'Telefono', value: detalleValor(pedido, 'telefono_destinatario') },
      { label: 'Monto CUP', value: detalleValor(pedido, 'monto_cup') ?? String(pedido.monto_resultado) },
    ];
  }

  if (pedido.servicio === 'efectivo') {
    return [
      { label: 'Telefono', value: detalleValor(pedido, 'telefono_destinatario') },
      { label: 'Foto documento', value: detalleValor(pedido, 'documento_identidad_url') },
      { label: 'Monto CUP', value: detalleValor(pedido, 'monto_cup') ?? String(pedido.monto_resultado) },
    ];
  }

  if (pedido.servicio === 'saldo') {
    return [
      { label: 'Telefono', value: detalleValor(pedido, 'telefono_destinatario') },
      { label: 'Saldo', value: `${detalleValor(pedido, 'saldo_cup') ?? pedido.monto_resultado} CUP` },
    ];
  }

  if (pedido.servicio === 'divisa') {
    return [
      { label: 'Tipo', value: detalleValor(pedido, 'tipo_tarjeta') },
      { label: 'Tarjeta', value: detalleValor(pedido, 'numero_tarjeta') },
      { label: 'Telefono', value: detalleValor(pedido, 'telefono_destinatario') },
      { label: 'Monto divisa', value: `${detalleValor(pedido, 'monto_divisa') ?? pedido.monto_resultado} ${monedaEntregaPedido(pedido)}` },
    ];
  }

  if (pedido.servicio === 'otros') {
    return [
      { label: 'Telefono', value: detalleValor(pedido, 'telefono_destinatario') },
      { label: 'Tarjeta', value: detalleValor(pedido, 'numero_tarjeta') },
      { label: 'Info', value: pedido.observaciones },
      { label: 'Pago', value: `${pedido.monto_pago} ${pedido.moneda_pago}` },
    ];
  }

  return [
    { label: 'Resultado', value: String(pedido.monto_resultado) },
  ];
}

function resumenPedido(pedido: PedidoResumen) {
  return camposTarjetaPedido(pedido)
    .filter((field) => field.value)
    .slice(0, 2);
}

function tiempoRelativo(value?: string, nowMs = Date.now()) {
  if (!value) return null;
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return null;

  const diffMs = nowMs - fecha.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return 'hace instantes';
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `hace ${diffHoras} h`;

  const diffDias = Math.floor(diffHoras / 24);
  return `hace ${diffDias} d`;
}

function rangoPeriodoPedidos(periodo: PeriodoPedidos) {
  if (periodo === 'todos') return {};

  const ahora = new Date();
  const hasta = new Date(ahora);
  hasta.setHours(24, 0, 0, 0);

  const desde = new Date(ahora);
  desde.setHours(0, 0, 0, 0);
  if (periodo === '7_dias') {
    desde.setDate(desde.getDate() - 6);
  } else if (periodo === 'mes') {
    desde.setDate(1);
  }

  return {
    fecha_desde: desde.toISOString(),
    fecha_hasta: hasta.toISOString(),
  };
}

export function App() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof localStorage === 'undefined') return 'light';
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark-deep' || saved === 'dark-sidebar') return saved;
    if (saved === 'dark' || saved === 'dark-vscode' || saved === 'dark-pro') return 'dark-sidebar';
    return 'light';
  });
  const [operador, setOperador] = useState<Operador | null>(null);
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [pedidoPagoModal, setPedidoPagoModal] = useState<PedidoDetalle | null>(null);
  const [whatsappGrupoPendiente, setWhatsappGrupoPendiente] = useState<{
    codigo: string;
    url: string;
    mensaje: string;
  } | null>(null);
  const [alcanceConteos, setAlcanceConteos] = useState({ mis: 0, todas: 0 });
  const [estado, setEstado] = useState('');
  const [servicio, setServicio] = useState('');
  const [alcancePedidos, setAlcancePedidos] = useState<AlcancePedidos>('mis');
  const [periodoPedidos, setPeriodoPedidos] = useState<PeriodoPedidos>('hoy');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [vista, setVista] = useState<'inicio' | 'bandeja' | 'crear' | 'reportes' | 'admin' | 'setup' | 'tema' | 'perfil'>('inicio');
  const [vistaPedidos, setVistaPedidos] = useState<'lista' | 'kanban'>('kanban');
  const [servicioCrear, setServicioCrear] = useState<ServicioCrear>('transferencia');
  const [crearDraft, setCrearDraft] = useState<CrearPedidoDraft>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pedidosClock, setPedidosClock] = useState(() => Date.now());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateHidden, setQuickCreateHidden] = useState(false);
  const [pedidosEstadosColapsados, setPedidosEstadosColapsados] = useState<Set<string>>(() => new Set(['completado', 'cancelado']));
  const [profileSection, setProfileSection] = useState<ProfileSection>(null);
  const [profileNombre, setProfileNombre] = useState('');
  const [profilePassword, setProfilePassword] = useState({
    actual: '',
    nueva: '',
    confirmar: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profilePhotoSaving, setProfilePhotoSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [setupRevisado, setSetupRevisado] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [confirmandoPagoCreado, setConfirmandoPagoCreado] = useState(false);
  const copyToastTimeoutRef = useRef<number | null>(null);
  const comprobantePedidoCreadoInputRef = useRef<HTMLInputElement | null>(null);
  const profileMessageTimeoutRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const profileErrorTimeoutRef = useRef<number | null>(null);

  const puedeCrear = useMemo(
    () => operador?.permisos.includes('pedidos:crear') || operador?.permisos.includes('pedidos:gestionar') || operador?.permisos.includes('empresa:control_total'),
    [operador],
  );

  const puedeReportes = useMemo(
    () => operador?.permisos.includes('pedidos:gestionar') || operador?.permisos.includes('empresa:control_total'),
    [operador],
  );

  const puedeVerTodasLasOrdenes = useMemo(
    () => operador?.rol === 'admin' || operador?.rol === 'supervisor' || operador?.permisos.includes('pedidos:gestionar') || operador?.permisos.includes('empresa:control_total'),
    [operador],
  );

  const puedeAdmin = useMemo(
    () => operador?.permisos.includes('empresa:control_total'),
    [operador],
  );

  const puedeSincronizarTasas = useMemo(
    () => operador?.rol !== 'cliente' && (puedeCrear || puedeReportes || puedeAdmin),
    [operador, puedeAdmin, puedeCrear, puedeReportes],
  );

  const pedidosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();

    return pedidos.filter((pedido) => {
      if (estado && estadoFaseUno(pedido.estado) !== estado) return false;
      if (servicio && pedido.servicio !== servicio) return false;
      if (!term) return true;

      const detalle = pedido.detalle ? Object.values(pedido.detalle).join(' ') : '';
      return [
        pedido.codigo_operacion,
        pedido.servicio,
        pedido.estado,
        pedido.moneda_pago,
        detalle,
      ].join(' ').toLowerCase().includes(term);
    });
  }, [busqueda, estado, pedidos, servicio]);

  const pedidosConteoPorEstado = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const counts = new Map<string, number>(estadosBandeja.map((item) => [item.value, 0] as const));

    for (const pedido of pedidos) {
      if (servicio && pedido.servicio !== servicio) continue;
      if (term) {
        const detalle = pedido.detalle ? Object.values(pedido.detalle).join(' ') : '';
        const searchable = [
          pedido.codigo_operacion,
          pedido.servicio,
          pedido.estado,
          pedido.moneda_pago,
          detalle,
        ].join(' ').toLowerCase();
        if (!searchable.includes(term)) continue;
      }
      const estadoVisible = estadoFaseUno(pedido.estado);
      counts.set(estadoVisible, (counts.get(estadoVisible) ?? 0) + 1);
    }

    return counts;
  }, [busqueda, pedidos, servicio]);

  const totalPedidosConteo = useMemo(() => {
    return Array.from(pedidosConteoPorEstado.values()).reduce((total, count) => total + count, 0);
  }, [pedidosConteoPorEstado]);

  function pedidoPerteneceAMi(pedido: PedidoResumen) {
    return Boolean(
      operador
      && (
        pedido.operador_id === operador.id
        || pedido.operador_asignado_id === operador.id
        || pedido.redirigido_a_operador_id === operador.id
      )
    );
  }

  const misPedidosConteo = alcanceConteos.mis;
  const todasPedidosConteo = alcanceConteos.todas;
  const pedidoSeleccionadoInicial = useMemo(
    () => pedidos.find((pedido) => pedido.codigo_operacion === seleccionado) ?? null,
    [pedidos, seleccionado],
  );

  function pedidoTomadoPorMi(pedido: PedidoResumen) {
    return Boolean(operador && pedido.lock_activo && pedido.operador_asignado_id === operador.id);
  }

  function pedidoBloqueadoPorOtro(pedido: PedidoResumen) {
    return Boolean(operador && pedido.lock_activo && pedido.operador_asignado_id && pedido.operador_asignado_id !== operador.id);
  }

  function disponibilidadPedidoClass(pedido: PedidoResumen, base: string, selected: boolean, delayed: boolean) {
    return [
      selected ? `${base} selected` : base,
      delayed ? 'order-delayed' : '',
      pedidoTomadoPorMi(pedido) ? 'order-owned-by-me' : '',
      pedidoBloqueadoPorOtro(pedido) ? 'order-blocked-by-other' : '',
      !pedido.lock_activo ? 'order-available' : '',
    ].filter(Boolean).join(' ');
  }

  const pedidosPorEstado = useMemo(() => {
    return estadosBandeja
      .filter((item) => !estado || item.value === estado)
      .map((item, index) => ({
        ...item,
        orden: index,
        pedidos: pedidosFiltrados.filter((pedido) => estadoFaseUno(pedido.estado) === item.value),
      }))
      .filter((grupo) => grupo.pedidos.length > 0 || Boolean(estado));
  }, [estado, pedidosFiltrados]);

  const pedidosListaOrdenada = useMemo(() => {
    return pedidosPorEstado.flatMap((grupo) => grupo.pedidos);
  }, [pedidosPorEstado]);

  function navegar(nextVista: typeof vista) {
    if (nextVista !== 'crear') setCrearDraft({});
    setVista(nextVista);
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setQuickCreateOpen(false);
    setQuickCreateHidden(false);
    setProfileSection(null);
    setProfileMessage(null);
    setProfileError(null);
  }

  function abrirPerfilSeccion(section: Exclude<ProfileSection, null>) {
    setProfileSection((current) => current === section ? null : section);
    setProfileMessage(null);
    setProfileError(null);
  }

  function toggleEstadoPedido(value: string) {
    setPedidosEstadosColapsados((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function abrirCrear(servicio: ServicioCrear, draft: CrearPedidoDraft = {}) {
    setServicioCrear(servicio);
    setCrearDraft(draft);
    setVista('crear');
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setQuickCreateOpen(false);
  }

  function rastrearPedido(codigo: string) {
    const codigoNormalizado = codigo.trim().toUpperCase();
    if (!codigoNormalizado) return;
    setCrearDraft({});
    setBusqueda(codigoNormalizado);
    setEstado('');
    setServicio('');
    setSeleccionado(codigoNormalizado);
    setVista('bandeja');
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setQuickCreateOpen(false);
    setProfileSection(null);
    setError(null);
    void cargarPedidos();
  }

  function abrirPerfilDesdeMenu(section: Exclude<ProfileSection, null>) {
    setVista('perfil');
    setProfileSection(section);
    setProfileMessage(null);
    setProfileError(null);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }

  function navegarDesdeMenuUsuario(nextVista: typeof vista) {
    setUserMenuOpen(false);
    navegar(nextVista);
  }

  function cerrarSesion() {
    clearToken();
    setOperador(null);
    setSetupRevisado(false);
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setQuickCreateOpen(false);
  }

  function finalizarCreacionPedido(pedido: PedidoDetalle) {
    setPedidoPagoModal(pedido);
    setSeleccionado(null);
    setAlcancePedidos('mis');
    setVista('bandeja');
    void cargarPedidos();
  }

  async function copiarPago(value?: string | null) {
    if (!value) return;
    const copiado = await copiarAlPortapapeles(value);
    if (copiado) {
      setCopyToast('Copiado');
      if (copyToastTimeoutRef.current) window.clearTimeout(copyToastTimeoutRef.current);
      copyToastTimeoutRef.current = window.setTimeout(() => setCopyToast(null), INFO_TOAST_DURATION_MS);
    } else {
      setError('No se pudo copiar. Selecciona el texto y copialo manualmente.');
    }
  }

  function cerrarCopyToast() {
    if (copyToastTimeoutRef.current) window.clearTimeout(copyToastTimeoutRef.current);
    copyToastTimeoutRef.current = null;
    setCopyToast(null);
  }

  function cerrarProfileMessage() {
    if (profileMessageTimeoutRef.current) window.clearTimeout(profileMessageTimeoutRef.current);
    profileMessageTimeoutRef.current = null;
    setProfileMessage(null);
  }

  function cerrarError() {
    if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = null;
    setError(null);
  }

  function cerrarProfileError() {
    if (profileErrorTimeoutRef.current) window.clearTimeout(profileErrorTimeoutRef.current);
    profileErrorTimeoutRef.current = null;
    setProfileError(null);
  }

  function abrirUrlPago(url?: string | null) {
    abrirWhatsAppUrl(url);
  }

  function abrirMensajeGrupoPedido() {
    abrirUrlPago(pedidoPagoModal?.whatsapp_grupo_pedidos_url);
  }

  async function confirmarPagoPedidoCreado(file: File) {
    if (!pedidoPagoModal || confirmandoPagoCreado) return;
    setConfirmandoPagoCreado(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('tipo', 'comprobante_cliente');
      form.set('archivo', file);
      await subirArchivo(pedidoPagoModal.codigo_operacion, form);
      const actualizado = await actualizarEstado(
        pedidoPagoModal.codigo_operacion,
        'pago_confirmado',
        'Pago confirmado al crear el pedido con comprobante cargado.',
      );
      if (actualizado.whatsapp_grupo_pedidos_url) {
        setWhatsappGrupoPendiente({
          codigo: actualizado.codigo_operacion,
          url: actualizado.whatsapp_grupo_pedidos_url,
          mensaje: actualizado.mensaje_grupo_pedidos ?? '',
        });
      }
      setPedidoPagoModal(null);
      await cargarPedidos();
      setCopyToast('Pago confirmado');
      if (copyToastTimeoutRef.current) window.clearTimeout(copyToastTimeoutRef.current);
      copyToastTimeoutRef.current = window.setTimeout(() => setCopyToast(null), INFO_TOAST_DURATION_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el pago');
    } finally {
      setConfirmandoPagoCreado(false);
    }
  }

  function seleccionarComprobantePedidoCreado() {
    if (confirmandoPagoCreado) return;
    comprobantePedidoCreadoInputRef.current?.click();
  }

  function handleComprobantePedidoCreado(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void confirmarPagoPedidoCreado(file);
  }

  const aplicarPedidosPorAlcance = useCallback((data: PedidoResumen[]) => {
    const misPedidos = data.filter((pedido) => pedidoPerteneceAMi(pedido));
    setAlcanceConteos({ mis: misPedidos.length, todas: data.length });
    setPedidos(alcancePedidos === 'mis' ? misPedidos : data);
  }, [alcancePedidos, operador]);

  const cargarPedidos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const alcanceCarga = puedeVerTodasLasOrdenes ? 'todas' : 'mis';
      const data = await listarPedidos({
        limit: 200,
        alcance: alcanceCarga,
        ...rangoPeriodoPedidos(periodoPedidos),
      });
      if (puedeVerTodasLasOrdenes) {
        aplicarPedidosPorAlcance(data);
      } else {
        setAlcanceConteos({ mis: data.length, todas: data.length });
        setPedidos(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  }, [alcancePedidos, aplicarPedidosPorAlcance, puedeVerTodasLasOrdenes, periodoPedidos]);

  const refrescarPedidosSilencioso = useCallback(async () => {
    try {
      const alcanceCarga = puedeVerTodasLasOrdenes ? 'todas' : 'mis';
      const data = await listarPedidos({
        limit: 200,
        alcance: alcanceCarga,
        ...rangoPeriodoPedidos(periodoPedidos),
      });
      if (puedeVerTodasLasOrdenes) {
        aplicarPedidosPorAlcance(data);
      } else {
        setAlcanceConteos({ mis: data.length, todas: data.length });
        setPedidos(data);
      }
    } catch {
      // El refresco silencioso no debe interrumpir al operador si falla una vuelta.
    }
  }, [aplicarPedidosPorAlcance, puedeVerTodasLasOrdenes, periodoPedidos]);


  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!getToken()) return;
    getMe()
      .then(setOperador)
      .catch((err) => {
        const message = err instanceof Error ? err.message.toLowerCase() : '';
        if (message.includes('401') || message.includes('token')) {
          clearToken();
        }
        setOperador(null);
      });
  }, []);

  useEffect(() => {
    if (operador) void cargarPedidos();
  }, [cargarPedidos, operador]);

  useEffect(() => {
    if (!operador || !puedeAdmin || setupRevisado) return;
    setSetupRevisado(true);
    obtenerEstadoConfiguracionInicial()
      .then((estadoSetup) => {
        if (!estadoSetup.completada) setVista('setup');
      })
      .catch(() => {
        // La configuracion inicial no debe impedir entrar a una instalacion existente.
      });
  }, [operador, puedeAdmin, setupRevisado]);

  useEffect(() => {
    if (!operador || vista !== 'bandeja' || !online) return undefined;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void refrescarPedidosSilencioso();
    }, intervaloRefrescoPedidos());
    return () => window.clearInterval(interval);
  }, [online, operador, refrescarPedidosSilencioso, vista]);

  useEffect(() => {
    const interval = window.setInterval(() => setPedidosClock(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (vista !== 'inicio' && vista !== 'bandeja') {
      setQuickCreateHidden(false);
      return undefined;
    }

    lastScrollYRef.current = window.scrollY || document.documentElement.scrollTop || 0;

    function handleQuickCreateScroll() {
      if (window.innerWidth > 920) {
        setQuickCreateHidden(false);
        lastScrollYRef.current = window.scrollY || document.documentElement.scrollTop || 0;
        return;
      }

      const currentY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
      const delta = currentY - lastScrollYRef.current;
      if (Math.abs(delta) < 10) return;

      if (quickCreateOpen) {
        setQuickCreateOpen(false);
        lastScrollYRef.current = currentY;
        return;
      }

      setQuickCreateHidden(currentY > 120 && delta > 0);
      lastScrollYRef.current = currentY;
    }

    window.addEventListener('scroll', handleQuickCreateScroll, { passive: true });
    window.addEventListener('resize', handleQuickCreateScroll);
    return () => {
      window.removeEventListener('scroll', handleQuickCreateScroll);
      window.removeEventListener('resize', handleQuickCreateScroll);
    };
  }, [quickCreateOpen, vista]);

  useEffect(() => {
    if (!userMenuOpen) return undefined;

    function closeUserMenuOnScroll() {
      setUserMenuOpen(false);
    }

    window.addEventListener('scroll', closeUserMenuOnScroll, true);
    window.addEventListener('resize', closeUserMenuOnScroll);
    return () => {
      window.removeEventListener('scroll', closeUserMenuOnScroll, true);
      window.removeEventListener('resize', closeUserMenuOnScroll);
    };
  }, [userMenuOpen]);


  useEffect(() => {
    if (!operador) return;
    setProfileNombre(operador.nombre);
  }, [operador]);

  useEffect(() => {
    if (!userMenuOpen) return;

    function closeUserMenuOutside(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (userMenuRef.current?.contains(target)) return;
      setUserMenuOpen(false);
    }

    document.addEventListener('pointerdown', closeUserMenuOutside, true);
    return () => document.removeEventListener('pointerdown', closeUserMenuOutside, true);
  }, [userMenuOpen]);

  useEffect(() => {
    function syncOnline() {
      setOnline(navigator.onLine);
    }

    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
    return () => {
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
    };
  }, []);

  useEffect(() => {
    if (!profileMessage) return undefined;
    if (profileMessageTimeoutRef.current) window.clearTimeout(profileMessageTimeoutRef.current);
    profileMessageTimeoutRef.current = window.setTimeout(() => setProfileMessage(null), PROFILE_TOAST_DURATION_MS);
    return () => {
      if (profileMessageTimeoutRef.current) window.clearTimeout(profileMessageTimeoutRef.current);
    };
  }, [profileMessage]);

  useEffect(() => {
    if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
    if (!error) return undefined;
    errorTimeoutRef.current = window.setTimeout(() => {
      setError(null);
      errorTimeoutRef.current = null;
    }, ERROR_TOAST_DURATION_MS);
    return () => {
      if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    };
  }, [error]);

  useEffect(() => {
    if (profileErrorTimeoutRef.current) window.clearTimeout(profileErrorTimeoutRef.current);
    if (!profileError) return undefined;
    profileErrorTimeoutRef.current = window.setTimeout(() => {
      setProfileError(null);
      profileErrorTimeoutRef.current = null;
    }, ERROR_TOAST_DURATION_MS);
    return () => {
      if (profileErrorTimeoutRef.current) window.clearTimeout(profileErrorTimeoutRef.current);
      profileErrorTimeoutRef.current = null;
    };
  }, [profileError]);

  useEffect(() => {
    return () => {
      if (copyToastTimeoutRef.current) window.clearTimeout(copyToastTimeoutRef.current);
      if (profileMessageTimeoutRef.current) window.clearTimeout(profileMessageTimeoutRef.current);
      if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
      if (profileErrorTimeoutRef.current) window.clearTimeout(profileErrorTimeoutRef.current);
    };
  }, []);


  async function subirFotoPerfil(file: File) {
    setProfilePhotoSaving(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      const actualizado = await subirMiFotoPerfil(file);
      setOperador(actualizado);
      setProfileMessage('Foto de perfil actualizada');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'No se pudo subir la foto');
    } finally {
      setProfilePhotoSaving(false);
    }
  }

  async function guardarPerfil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nombre = profileNombre.trim();
    if (!nombre) {
      setProfileError('El nombre no puede estar vacio');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      const actualizado = await actualizarMiPerfil({ nombre });
      setOperador(actualizado);
      setProfileMessage('Datos actualizados correctamente');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'No se pudo actualizar el perfil');
    } finally {
      setProfileSaving(false);
    }
  }

  async function guardarPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profilePassword.nueva !== profilePassword.confirmar) {
      setProfileError('La confirmacion no coincide con la nueva contraseña');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      await cambiarMiPassword({
        password_actual: profilePassword.actual,
        password_nueva: profilePassword.nueva,
      });
      setProfilePassword({ actual: '', nueva: '', confirmar: '' });
      setProfileMessage('contraseña actualizada correctamente');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setProfileSaving(false);
    }
  }

  if (!operador) {
    return <LoginPage onLogin={setOperador} />;
  }

  const appShellClassName = [
    'app-shell',
    vista === 'bandeja' ? 'orders-view-shell' : '',
    vista === 'bandeja' && seleccionado ? 'order-detail-view-shell' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={appShellClassName}>
      {(copyToast || error || profileMessage || profileError) && (
        <div className="app-toast-stack" aria-live="polite">
          {copyToast && <AppToast kind="success" message={copyToast} onClose={cerrarCopyToast} />}
          {profileMessage && <AppToast kind="success" message={profileMessage} onClose={cerrarProfileMessage} />}
          {error && <AppToast kind="error" message={error} onClose={cerrarError} />}
          {profileError && <AppToast kind="error" message={profileError} onClose={cerrarProfileError} />}
        </div>
      )}
      <PwaInstallPrompt />
      <aside className={mobileMenuOpen ? 'sidebar mobile-open' : 'sidebar'}>
        <div>
          <div className="mobile-sidebar-head">
            <button className="brand-button" onClick={() => navegar('inicio')} title="Ir al inicio">
              <img src={logoJireh} alt="El Jireh" />
              <span>EL JIREH</span>
            </button>
            <button className="icon-button mobile-menu-close" onClick={() => setMobileMenuOpen(false)} title="Cerrar menu">
              <X size={18} />
            </button>
          </div>
          <div className="operator">{operador.nombre}</div>
        </div>
        <nav className="nav-stack">
          <button className={vista === 'inicio' ? 'active' : ''} onClick={() => navegar('inicio')}><Home size={18} /> Inicio</button>
          <button className={vista === 'bandeja' ? 'active' : ''} onClick={() => navegar('bandeja')}><ClipboardList size={18} /> Pedidos</button>
          <button className={vista === 'reportes' ? 'active' : ''} onClick={() => navegar('reportes')} disabled={!puedeReportes}><BarChart3 size={18} /> Reportes</button>
          <button className={vista === 'admin' ? 'active' : ''} onClick={() => navegar('admin')} disabled={!puedeAdmin}><Settings size={18} /> Admin</button>
          {puedeAdmin && <button className={vista === 'setup' ? 'active' : ''} onClick={() => navegar('setup')}><ShieldCheck size={18} /> Configurar</button>}
          {puedeAdmin && <button className={vista === 'tema' ? 'active' : ''} onClick={() => navegar('tema')}><Palette size={18} /> Tema UI</button>}
          <button className={vista === 'perfil' ? 'active' : ''} onClick={() => navegar('perfil')}><UserCircle size={18} /> Perfil</button>
        </nav>
        <button className="ghost-button" onClick={cerrarSesion}>
          <LogOut size={18} /> Salir
        </button>
      </aside>

      {mobileMenuOpen && <button className="mobile-menu-backdrop" aria-label="Cerrar menu" onClick={() => setMobileMenuOpen(false)} />}

      <main className="workspace">
        {!online && (
          <div className="offline-banner">
            <WifiOff size={18} /> Sin conexion, los datos del formulario se conservan en esta pantalla.
          </div>
        )}
        <header className="toolbar">
          <button className="icon-button mobile-header-menu" onClick={() => setMobileMenuOpen(true)} title="Abrir menu" aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <button className="header-brand" onClick={() => navegar('inicio')} title="Ir al dashboard">
            <img src={logoJireh} alt="El Jireh"/>
            <span>EL JIREH</span>
          </button>
          <div className="toolbar-title">
            <h1>{vista === 'inicio' ? 'Inicio' : vista === 'crear' ? 'Nuevo pedido' : vista === 'reportes' ? 'Reportes' : vista === 'admin' ? 'Administracion' : vista === 'setup' ? 'Configuracion inicial' : vista === 'tema' ? 'Tema UI' : vista === 'perfil' ? 'Perfil' : 'Pedidos'}</h1>
            <p>{vista === 'inicio' ? 'Tasas activas y accesos rapidos' : vista === 'crear' ? 'Registro rapido para operacion interna' : vista === 'reportes' ? 'Resumen operativo por filtros' : vista === 'admin' ? 'Catalogos operativos' : vista === 'setup' ? 'Guia para preparar una instalacion nueva' : vista === 'tema' ? 'Comparacion visual de componentes' : vista === 'perfil' ? 'Datos del operador activo' : 'Seguimiento simple, familiar y movil'}</p>
          </div>
          <div className="toolbar-actions">
            {userMenuOpen && <button className="floating-create-backdrop user-floating-backdrop" type="button" aria-label="Cerrar opciones de usuario" onClick={() => setUserMenuOpen(false)} />}
            <div ref={userMenuRef} className={userMenuOpen ? 'user-floating-wrap open' : 'user-floating-wrap'}>
              {userMenuOpen && (
                <div className="floating-create-menu user-floating-menu" role="menu" aria-label="Opciones de usuario" onClick={(event) => event.stopPropagation()}>
                  <div className="user-menu-summary">
                    <OperadorAvatar operador={operador} className="operator-chip-avatar" />
                    <span><strong>{operador.nombre}</strong><small>{operador.codigo_operador}</small></span>
                  </div>
                  <button type="button" role="menuitem" onClick={() => abrirPerfilDesdeMenu('editar')}>
                    <Edit3 size={18} /> Modificar usuario
                  </button>
                  <div className="user-menu-theme-row" role="menuitem">
                    <button className="user-menu-theme-link" type="button" onClick={() => navegarDesdeMenuUsuario('perfil')}>
                      <Palette size={18} />
                      <span><strong>Apariencia</strong><small>{theme === 'light' ? 'Tema claro' : DARK_THEME_OPTIONS.find((item) => item.value === theme)?.label}</small></span>
                    </button>
                    <label className="theme-switch user-menu-theme-switch" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={theme !== 'light'}
                        onChange={(event) => setTheme(event.target.checked ? 'dark-sidebar' : 'light')}
                        aria-label="Activar tema oscuro"
                      />
                      <span>Oscuro</span>
                    </label>
                  </div>
                  {puedeAdmin && (
                    <button type="button" role="menuitem" onClick={() => navegarDesdeMenuUsuario('admin')}>
                      <Settings size={18} /> Configuracion Admin
                    </button>
                  )}
                  <button type="button" role="menuitem" onClick={() => abrirPerfilDesdeMenu('ayuda')}>
                    <HelpCircle size={18} /> Soporte
                  </button>
                  <button className="danger" type="button" role="menuitem" onClick={cerrarSesion}>
                    <LogOut size={18} /> Salir
                  </button>
                </div>
              )}
              <button
                className={userMenuOpen ? 'operator-chip user-floating-trigger active' : 'operator-chip user-floating-trigger'}
                type="button"
                onClick={() => setUserMenuOpen((current) => !current)}
                title={userMenuOpen ? 'Cerrar opciones' : 'Opciones de usuario'}
                aria-label={userMenuOpen ? 'Cerrar opciones de usuario' : 'Opciones de usuario'}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <OperadorAvatar operador={operador} className="operator-chip-avatar" />
                <span className="operator-chip-text">
                  <strong>{operador.nombre}</strong>
                  <small>{operador.rol}</small>
                </span>
                {userMenuOpen ? <X className="user-menu-chevron open" size={16} /> : <ChevronDown className="user-menu-chevron" size={16} />}
              </button>
            </div>
            <button className="icon-button mobile-menu-button" onClick={() => setMobileMenuOpen(true)} title="Abrir menu">
              <Menu size={20} />
            </button>
          </div>
        </header>

        {vista === 'inicio' ? (
          <InicioPage canSyncTasas={puedeSincronizarTasas} onCreate={abrirCrear} onTrackPedido={rastrearPedido} />
        ) : vista === 'setup' ? (
          <SetupInicialPage onComplete={() => navegar('inicio')} onOpenAdmin={() => navegar('admin')} />
        ) : vista === 'admin' ? (
          <AdminCatalogosPage />
        ) : vista === 'tema' ? (
          <ThemeTestPage />
        ) : vista === 'reportes' ? (
          <ReportesPage />
        ) : vista === 'perfil' ? (
          <section className="profile-page">
            <div className="profile-hero-card">
              <div className="profile-hero-main">
                <div className="profile-avatar-wrap">
                  <OperadorAvatar operador={operador} className="profile-avatar initials" />
                  <label className="profile-photo-upload" title="Cambiar foto">
                    {profilePhotoSaving ? 'Subiendo...' : 'Cambiar foto'}
                    <input type="file" accept="image/*" disabled={profilePhotoSaving} onChange={(event) => { const file = event.target.files?.[0]; if (file) void subirFotoPerfil(file); event.currentTarget.value = ''; }} />
                  </label>
                </div>
                <div>
                  <h2>{operador.nombre}</h2>
                  <p>{operador.telefono}</p>
                </div>
              </div>
              <div className="profile-hero-meta">
                <span>Codigo: <strong>{operador.codigo_operador}</strong></span>
                <span>Rol: <strong>{operador.rol}</strong></span>
                <button className="icon-button" onClick={() => void copiarPago(operador.codigo_operador)} title="Copiar codigo" aria-label="Copiar codigo"><Copy size={18} /></button>
              </div>
            </div>

            <div className="profile-section">
              <h3>Mi cuenta</h3>
              <button className={profileSection === 'editar' ? 'profile-option active' : 'profile-option'} type="button" onClick={() => abrirPerfilSeccion('editar')} aria-expanded={profileSection === 'editar'}><Edit3 size={22} /><span>Modificar perfil</span><ChevronDown className={profileSection === 'editar' ? 'chevron-open' : ''} size={18} /></button>
              {profileSection === 'editar' && (
                <form className="profile-inline-panel profile-form" onSubmit={guardarPerfil}>
                  <label>
                    <span>Nombre visible</span>
                    <input value={profileNombre} onChange={(event) => setProfileNombre(event.target.value)} autoComplete="name" />
                  </label>
                  <label>
                    <span>Telefono de acceso</span>
                    <input value={operador.telefono ?? ''} disabled />
                  </label>
                  <small>El telefono se mantiene fijo para evitar cambios accidentales en el acceso.</small>
                  <button className="primary-action" type="submit" disabled={profileSaving}>{profileSaving ? 'Guardando...' : 'Guardar datos'}</button>
                </form>
              )}

              <button className={profileSection === 'permisos' ? 'profile-option active' : 'profile-option'} type="button" onClick={() => abrirPerfilSeccion('permisos')} aria-expanded={profileSection === 'permisos'}><Percent size={22} /><span>Mis permisos y rol</span><ChevronDown className={profileSection === 'permisos' ? 'chevron-open' : ''} size={18} /></button>
              {profileSection === 'permisos' && (
                <div className="profile-inline-panel">
                  <div className="profile-role-pill"><ShieldCheck size={18} /> {operador.rol}</div>
                  <div className="profile-permission-list">
                    {operador.permisos.length ? operador.permisos.map((permiso) => <span key={permiso}>{permiso}</span>) : <span>Sin permisos especiales</span>}
                  </div>
                </div>
              )}


              <div className="profile-appearance-row">
                <span className="profile-appearance-icon" aria-hidden="true"><Palette size={22} /></span>
                <div className="profile-appearance-copy">
                  <div className="profile-appearance-title">
                    <strong>Apariencia</strong>
                    <label className="theme-switch">
                      <input
                        type="checkbox"
                        checked={theme !== 'light'}
                        onChange={(event) => setTheme(event.target.checked ? 'dark-sidebar' : 'light')}
                        aria-label="Activar tema oscuro"
                      />
                      <span>Oscuro</span>
                    </label>
                  </div>
                  <small>{theme === 'light' ? 'Tema claro predeterminado' : DARK_THEME_OPTIONS.find((item) => item.value === theme)?.label}</small>
                </div>
              </div>
              {theme !== 'light' && (
                <div className="theme-variant-row" aria-label="Variante de tema oscuro">
                  {DARK_THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={theme === option.value ? 'active' : ''}
                      onClick={() => setTheme(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="profile-section">
              <h3>Seguridad</h3>
              <button className={profileSection === 'password' ? 'profile-option active' : 'profile-option'} type="button" onClick={() => abrirPerfilSeccion('password')} aria-expanded={profileSection === 'password'}><KeyRound size={22} /><span>Cambiar contraseña</span><ChevronDown className={profileSection === 'password' ? 'chevron-open' : ''} size={18} /></button>
              {profileSection === 'password' && (
                <form className="profile-inline-panel profile-form" onSubmit={guardarPassword}>
                  <label>
                    <span>contraseña actual</span>
                    <PasswordField value={profilePassword.actual} onChange={(event) => setProfilePassword((current) => ({ ...current, actual: event.target.value }))} autoComplete="current-password" />
                  </label>
                  <label>
                    <span>Nueva contraseña</span>
                    <PasswordField value={profilePassword.nueva} onChange={(event) => setProfilePassword((current) => ({ ...current, nueva: event.target.value }))} autoComplete="new-password" />
                  </label>
                  <label>
                    <span>Confirmar nueva</span>
                    <PasswordField value={profilePassword.confirmar} onChange={(event) => setProfilePassword((current) => ({ ...current, confirmar: event.target.value }))} autoComplete="new-password" />
                  </label>
                  <button className="primary-action" type="submit" disabled={profileSaving}>{profileSaving ? 'Actualizando...' : 'Cambiar contraseña'}</button>
                </form>
              )}

            </div>

            <div className="profile-section">
              <h3>Soporte</h3>
              <button
                className={profileSection === 'ayuda' ? 'profile-option active' : 'profile-option'}
                type="button"
                onClick={() => abrirPerfilSeccion('ayuda')}
                aria-expanded={profileSection === 'ayuda'}
              >
                <HelpCircle size={22} />
                <span>Ayuda para operar</span>
                <ChevronDown className={profileSection === 'ayuda' ? 'chevron-open' : ''} size={18} />
              </button>
              {profileSection === 'ayuda' && (
                <div className="profile-support-options">
                  <div className="profile-support-panel">
                    <a className="support-whatsapp-link support-whatsapp-link-br" href="https://wa.me/554891233191?text=Ayuda" onClick={(event) => { event.preventDefault(); abrirWhatsAppUrl('https://wa.me/554891233191?text=Ayuda'); }} target="_blank" rel="noreferrer">
                      <WhatsAppIcon />
                      <span>
                        <strong>Brasil</strong>
                        <small>+55 48 9123-3191</small>
                      </span>
                    </a>
                    <a className="support-whatsapp-link support-whatsapp-link-uy" href="https://wa.me/59894207862?text=Ayuda" onClick={(event) => { event.preventDefault(); abrirWhatsAppUrl('https://wa.me/59894207862?text=Ayuda'); }} target="_blank" rel="noreferrer">
                      <WhatsAppIcon />
                      <span>
                        <strong>Uruguay</strong>
                        <small>+598 94 207 862</small>
                      </span>
                    </a>
                  </div>
                  <div className="profile-support-panel profile-support-panel-list">
                    <a className="support-whatsapp-link support-whatsapp-link-br" href="https://wa.me/554891233191?text=Ayuda" onClick={(event) => { event.preventDefault(); abrirWhatsAppUrl('https://wa.me/554891233191?text=Ayuda'); }} target="_blank" rel="noreferrer">
                      <WhatsAppIcon />
                      <span>
                        <strong>Soporte Brasil</strong>
                        <small>+55 48 9123-3191</small>
                      </span>
                    </a>
                    <a className="support-whatsapp-link support-whatsapp-link-uy" href="https://wa.me/59894207862?text=Ayuda" onClick={(event) => { event.preventDefault(); abrirWhatsAppUrl('https://wa.me/59894207862?text=Ayuda'); }} target="_blank" rel="noreferrer">
                      <WhatsAppIcon />
                      <span>
                        <strong>Soporte Uruguay</strong>
                        <small>+598 94 207 862</small>
                      </span>
                    </a>
                  </div>
                </div>
              )}
              <button className="profile-option danger profile-logout-option" type="button" onClick={cerrarSesion}><LogOut size={22} /><span>Salir</span></button>
            </div>
          </section>
        ) : vista === 'crear' ? (
          <section className="create-stack">
            <div className="service-tabs">
              <button
                type="button"
                className={servicioCrear === 'transferencia' ? 'active' : ''}
                onClick={() => { setServicioCrear('transferencia'); setCrearDraft({}); }}
              >
                Transferencia
              </button>
              <button
                type="button"
                className={servicioCrear === 'efectivo' ? 'active' : ''}
                onClick={() => { setServicioCrear('efectivo'); setCrearDraft({}); }}
              >
                Efectivo
              </button>
              <button
                type="button"
                className={servicioCrear === 'saldo' ? 'active' : ''}
                onClick={() => { setServicioCrear('saldo'); setCrearDraft({}); }}
              >
                Saldo
              </button>
              <button
                type="button"
                className={servicioCrear === 'divisa' ? 'active' : ''}
                onClick={() => { setServicioCrear('divisa'); setCrearDraft({}); }}
              >
                Divisa
              </button>
              <button
                type="button"
                className={servicioCrear === 'otros' ? 'active' : ''}
                onClick={() => { setServicioCrear('otros'); setCrearDraft({}); }}
              >
                Otros
              </button>
            </div>
            {servicioCrear === 'transferencia' && (
              <TransferenciaForm operadorId={operador.id} initialData={crearDraft} onCreated={finalizarCreacionPedido} />
            )}
            {servicioCrear === 'efectivo' && (
              <EfectivoForm operadorId={operador.id} initialData={crearDraft} onCreated={finalizarCreacionPedido} />
            )}
            {servicioCrear === 'saldo' && (
              <SaldoForm operadorId={operador.id} initialData={crearDraft} onCreated={finalizarCreacionPedido} />
            )}
            {servicioCrear === 'divisa' && (
              <DivisaForm operadorId={operador.id} initialData={crearDraft} onCreated={finalizarCreacionPedido} />
            )}
            {servicioCrear === 'otros' && (
              <OtrosForm operadorId={operador.id} onCreated={finalizarCreacionPedido} />
            )}
          </section>
        ) : (
          <>
            {seleccionado ? (
              <PedidoDetallePanel
                codigo={seleccionado}
                pedidoInicial={pedidoSeleccionadoInicial}
                operadorId={operador.id}
                onChanged={cargarPedidos}
                onClose={() => setSeleccionado(null)}
              />
            ) : (
            <section className="content-grid orders-content-grid">
              <div className="list-panel orders-list-panel">
                <div className="filters orders-toolbar-row">
                  <label className="search-box orders-search-box">
                    <Search size={18} />
                    <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar codigo, tarjeta o telefono" />
                  </label>
                </div>
                <div className="status-filters orders-scope-chips" aria-label="Alcance de ordenes">
                  <button type="button" className={alcancePedidos === 'mis' ? 'active scope-my-orders' : 'scope-my-orders'} onClick={() => setAlcancePedidos('mis')}>
                    <UserCircle size={16} />
                    <span>Mis pedidos</span>
                    <strong>{misPedidosConteo}</strong>
                  </button>
                  {puedeVerTodasLasOrdenes && (
                    <button type="button" className={alcancePedidos === 'todas' ? 'active' : ''} onClick={() => setAlcancePedidos('todas')}>
                      <ClipboardList size={16} />
                      <span>Todas</span>
                      <strong>{todasPedidosConteo}</strong>
                    </button>
                  )}
                  <div className="orders-top-actions">
                    <div className="order-filter-field order-filter-floating orders-period-action">
                      <FloatingSelect
                        value={periodoPedidos}
                        onChange={(value) => setPeriodoPedidos(value as PeriodoPedidos)}
                        options={[
                          { value: 'hoy', label: 'Hoy' },
                          { value: '7_dias', label: '7 dias' },
                          { value: 'mes', label: 'Este mes' },
                          { value: 'todos', label: 'Todos' },
                        ]}
                        ariaLabel="Filtrar pedidos por fecha"
                        align="left"
                        buttonClassName="order-filter-button"
                      />
                    </div>
                    <div className="order-filter-field order-filter-floating orders-service-action">
                      <FloatingSelect
                        value={servicio}
                        onChange={setServicio}
                        options={servicios.map((item) => ({
                          value: item.value,
                          label: item.value ? item.label : 'Todos los servicios',
                          icon: servicioIcon(item.value, 17),
                        }))}
                        ariaLabel="Filtrar por servicio"
                        align="right"
                        buttonClassName="order-filter-button"
                      />
                    </div>
                    <button
                      type="button"
                      className="view-toggle single-view-toggle"
                      onClick={() => setVistaPedidos((current) => current === 'lista' ? 'kanban' : 'lista')}
                      title={vistaPedidos === 'lista' ? 'Cambiar a cuadricula' : 'Cambiar a lista'}
                      aria-label={vistaPedidos === 'lista' ? 'Cambiar a cuadricula' : 'Cambiar a lista'}
                    >
                      {vistaPedidos === 'lista' ? <LayoutGrid size={18} /> : <LayoutList size={18} />}
                    </button>
                    <button className="icon-button orders-refresh-button" onClick={cargarPedidos} title="Actualizar pedidos" aria-label="Actualizar pedidos" disabled={loading}>
                      <RefreshCw size={18} />
                    </button>
                  </div>
                </div>
                <div className="status-filters orders-status-chips" aria-label="Filtros rapidos por estado">
                  <button type="button" className={!estado ? 'active' : ''} onClick={() => setEstado('')}>
                    <span>Todos</span>
                    <strong>{totalPedidosConteo}</strong>
                  </button>
                  {estadosBandeja.map((item) => (
                    <button
                      type="button"
                      key={item.value}
                      className={estado === item.value ? `active ${item.value}` : item.value}
                      onClick={() => setEstado(item.value)}
                    >
                      <span>{item.label}</span>
                      <strong>{pedidosConteoPorEstado.get(item.value) ?? 0}</strong>
                    </button>
                  ))}
                </div>
                {loading && <PageLoader label="Cargando pedidos" inline />}
                {pedidosFiltrados.length === 0 && !loading && <DismissibleNotice className="notice">No hay pedidos para estos filtros</DismissibleNotice>}
                {vistaPedidos === 'lista' ? (
                  <div className="chat-order-list">
                    {pedidosListaOrdenada.map((pedido) => {
                      const bloqueadoPorOtro = pedidoBloqueadoPorOtro(pedido);
                      return (
                      <button
                        key={pedido.codigo_operacion}
                        className={disponibilidadPedidoClass(pedido, 'chat-order-card', seleccionado === pedido.codigo_operacion, false)}
                        onClick={() => { if (!bloqueadoPorOtro) setSeleccionado(pedido.codigo_operacion); }}
                        disabled={bloqueadoPorOtro}
                      >
                        <span className="chat-card-main">
                          <span className="pedido-card-head">
                            <strong>{pedido.servicio}</strong>
                            <small>{pedido.codigo_operacion} {tiempoRelativo(pedido.created_at, pedidosClock) ? `- ${tiempoRelativo(pedido.created_at, pedidosClock)}` : ''}</small>
                          </span>
                          <span className="pedido-card-fields compact">
                            {resumenPedido(pedido).map((field) => (
                              <span className="pedido-card-field" key={field.label}>
                                <small>{field.label}</small>
                                <strong>{field.value}</strong>
                              </span>
                            ))}
                          </span>
                        </span>
                        <span className="chat-card-side">
                          <span className={`status ${pedido.estado}`}>{estadoLabel(pedido.estado)}</span>
                          {pedido.redirigido_a_operador_id && <small className={pedido.redirigido_a_operador_id === operador.id ? 'order-redirect-chip own' : 'order-redirect-chip'}>Para {pedido.redirigido_a_operador_nombre ?? 'operador'}</small>}
                          {pedidoTomadoPorMi(pedido) && <small className="order-taken-chip owned">Lo tienes tu</small>}
                          {pedidoBloqueadoPorOtro(pedido) && <small className="order-taken-chip blocked">Atendido por {pedido.operador_asignado_nombre ?? 'operador'}</small>}
                          <strong>{pedido.monto_pago} {pedido.moneda_pago}</strong>
                          <small>Recibe {pedido.monto_resultado} {monedaEntregaPedido(pedido)}</small>
                        </span>
                      </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="pedido-board">
                    {pedidosPorEstado.map((grupo) => {
                      const colapsado = pedidosEstadosColapsados.has(grupo.value);
                      return (
                      <section className={colapsado ? 'pedido-column collapsed' : 'pedido-column'} key={grupo.value} style={{ order: grupo.orden }}>
                        <header className="pedido-column-header">
                          <button className="pedido-column-toggle" type="button" onClick={() => toggleEstadoPedido(grupo.value)} aria-expanded={!colapsado}>
                            <ChevronDown className={colapsado ? 'collapsed' : ''} size={18} />
                            <span className={`status ${grupo.value}`}>{grupo.label}</span>
                          </button>
                          <strong>{grupo.pedidos.length}</strong>
                        </header>
                        {!colapsado && <div className="pedido-list">
                          {grupo.pedidos.map((pedido) => {
                            const bloqueadoPorOtro = pedidoBloqueadoPorOtro(pedido);
                            return (
                            <button
                              key={pedido.codigo_operacion}
                              className={disponibilidadPedidoClass(pedido, 'pedido-row', seleccionado === pedido.codigo_operacion, false)}
                              onClick={() => { if (!bloqueadoPorOtro) setSeleccionado(pedido.codigo_operacion); }}
                              disabled={bloqueadoPorOtro}
                            >
                              <span className="kanban-card-top">
                                <span className="pedido-card-head">
                                  <strong>{pedido.servicio}</strong>
                                  <small>{pedido.codigo_operacion} {tiempoRelativo(pedido.created_at, pedidosClock) ? `- ${tiempoRelativo(pedido.created_at, pedidosClock)}` : ''}</small>
                                  {pedido.redirigido_a_operador_id && <small className={pedido.redirigido_a_operador_id === operador.id ? 'order-redirect-chip own inline' : 'order-redirect-chip inline'}>Para {pedido.redirigido_a_operador_nombre ?? 'operador'}</small>}
                                  {pedidoTomadoPorMi(pedido) && <small className="order-taken-chip owned inline">Lo tienes tu</small>}
                                  {pedidoBloqueadoPorOtro(pedido) && <small className="order-taken-chip blocked inline">Atendido por {pedido.operador_asignado_nombre ?? 'operador'}</small>}
                                </span>
                                <strong>{pedido.monto_pago} {pedido.moneda_pago}</strong>
                              </span>
                              <span className="pedido-card-fields compact">
                                {resumenPedido(pedido).map((field) => (
                                  <span className="pedido-card-field" key={field.label}>
                                    <small>{field.label}</small>
                                    <strong>{field.value}</strong>
                                  </span>
                                ))}
                              </span>
                              <span className="pedido-card-pay compact-pay">
                                <small>Recibe {pedido.monto_resultado} {monedaEntregaPedido(pedido)}</small>
                                <small>Tasa {tasaAplicadaPedido(pedido)}</small>
                              </span>
                            </button>
                            );
                          })}
                        </div>}
                      </section>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
            )}
          </>
        )}
      </main>
      {puedeCrear && (vista === 'inicio' || (vista === 'bandeja' && !seleccionado)) && (
        <div className={[quickCreateOpen ? 'floating-create-wrap open' : 'floating-create-wrap', quickCreateHidden && !quickCreateOpen ? 'hide-on-scroll' : ''].filter(Boolean).join(' ')}>
          {quickCreateOpen && <button className="floating-create-backdrop" aria-label="Cerrar menu de creacion" onClick={() => setQuickCreateOpen(false)} />}
          {quickCreateOpen && (
            <div className="floating-create-menu" role="menu" aria-label="Crear pedido">
              <button type="button" role="menuitem" onClick={() => abrirCrear('transferencia')}><WalletCards size={18} /> Transferencia</button>
              <button type="button" role="menuitem" onClick={() => abrirCrear('efectivo')}><Banknote size={18} /> Efectivo</button>
              <button type="button" role="menuitem" onClick={() => abrirCrear('saldo')}><Smartphone size={18} /> Saldo</button>
              <button type="button" role="menuitem" onClick={() => abrirCrear('divisa')}><WalletCards size={18} /> Divisa</button>
              <button type="button" role="menuitem" onClick={() => abrirCrear('otros')}><BriefcaseBusiness size={18} /> Otros</button>
            </div>
          )}
          <button
            className="floating-create"
            type="button"
            onClick={() => setQuickCreateOpen((current) => !current)}
            title={quickCreateOpen ? 'Cerrar opciones' : 'Nuevo pedido'}
            aria-label={quickCreateOpen ? 'Cerrar opciones de nuevo pedido' : 'Nuevo pedido'}
            aria-expanded={quickCreateOpen}
          >
            {quickCreateOpen ? <X size={24} /> : <Plus size={24} />}
          </button>
        </div>
      )}

      {pedidoPagoModal && (
        <Modal title="Pedido creado" subtitle={`${pedidoPagoModal.codigo_operacion} · pendiente de pago`} onClose={() => setPedidoPagoModal(null)}>
          <div className="payment-instructions-modal">
            <section className="payment-instructions-summary">
              <span className="status pendiente_pago">Pendiente pago</span>
              <strong>{pedidoPagoModal.monto_pago} {pedidoPagoModal.moneda_pago}</strong>
              <small>El pedido ya fue creado. Se confirmara el pago cuando se suba el comprobante.</small>
            </section>
            {pedidoPagoModal.datos_pago?.metodo_pago?.toLowerCase().includes('pix') && (
              <section className="payment-qr-placeholder" aria-label="QR Pix pendiente">
                <strong>QR Pix</strong>
                <small>Aun sin definir</small>
              </section>
            )}
            <div className="payment-data-grid">
              <div>
                <span>Metodo</span>
                <strong>{pedidoPagoModal.datos_pago?.metodo_pago ?? 'Por confirmar'}</strong>
              </div>
              <div>
                <span>{pedidoPagoModal.datos_pago?.metodo_pago?.toLowerCase().includes('pix') ? 'Llave Pix' : 'Cuenta'}</span>
                <button className="copy-field-button" type="button" onClick={() => void copiarPago(pedidoPagoModal.datos_pago?.cuenta_pago)}>
                  <strong>{pedidoPagoModal.datos_pago?.cuenta_pago ?? 'Por confirmar'}</strong>
                  <Copy size={16} />
                </button>
              </div>
              <div>
                <span>Titular</span>
                <button className="copy-field-button" type="button" onClick={() => void copiarPago(pedidoPagoModal.datos_pago?.titular_pago)}>
                  <strong>{pedidoPagoModal.datos_pago?.titular_pago ?? 'El Jireh'}</strong>
                  <Copy size={16} />
                </button>
              </div>
            </div>
            <section className="payment-already-paid">
              <div>
                <strong>Si el cliente ya pago</strong>
                <small>Sube el comprobante y confirma el pago sin salir de esta vista.</small>
              </div>
              <button className="primary-button" type="button" onClick={seleccionarComprobantePedidoCreado} disabled={confirmandoPagoCreado}>
                {confirmandoPagoCreado ? <RefreshCw className="button-spinner" size={16} /> : <Upload size={16} />} {confirmandoPagoCreado ? 'Subiendo...' : 'Subir comprobante y confirmar'}
              </button>
              <input
                ref={comprobantePedidoCreadoInputRef}
                type="file"
                accept="image/*,.pdf"
                className="visually-hidden-file"
                onChange={handleComprobantePedidoCreado}
              />
            </section>
            <div className="message-actions payment-modal-actions">
              <button className="ghost-button" type="button" onClick={() => void copiarPago(pedidoPagoModal.mensaje_pago_cliente)}>
                <Copy size={16} /> Copiar mensaje
              </button>
              <button className="primary-button" type="button" onClick={() => abrirUrlPago(pedidoPagoModal.whatsapp_pago_url)} disabled={!pedidoPagoModal.whatsapp_pago_url}>
                Enviar al cliente
              </button>
              <button className="primary-button" type="button" onClick={abrirMensajeGrupoPedido} disabled={!pedidoPagoModal.whatsapp_grupo_pedidos_url}>
                Enviar al grupo
              </button>
            </div>
          </div>
        </Modal>
      )}
      {whatsappGrupoPendiente && (
        <Modal
          title="Pago confirmado"
          subtitle={`${whatsappGrupoPendiente.codigo} · mensaje listo para Operaciones`}
          onClose={() => setWhatsappGrupoPendiente(null)}
          className="payment-confirmed-modal"
        >
          <div className="whatsapp-message-preview">
            <label htmlFor="whatsapp-grupo-pendiente">Mensaje que se enviara</label>
            <textarea
              id="whatsapp-grupo-pendiente"
              value={whatsappGrupoPendiente.mensaje}
              rows={8}
              readOnly
            />
          </div>
          <div className="message-actions payment-modal-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() => void copiarPago(whatsappGrupoPendiente.mensaje)}
            >
              <Copy size={16} /> Copiar mensaje
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                abrirWhatsAppUrl(whatsappGrupoPendiente.url);
                setWhatsappGrupoPendiente(null);
              }}
            >
              Enviar al grupo por WhatsApp
            </button>
            <button className="ghost-button" type="button" onClick={() => setWhatsappGrupoPendiente(null)}>
              Enviar despues
            </button>
          </div>
        </Modal>
      )}
      <nav className="bottom-nav" aria-label="Navegacion principal">
        <button className={vista === 'inicio' ? 'active' : ''} onClick={() => navegar('inicio')}><Home size={20} /> Inicio</button>
        <button className={vista === 'bandeja' ? 'active' : ''} onClick={() => navegar('bandeja')}><ClipboardList size={20} /> Pedidos</button>
        <button className={vista === 'reportes' ? 'active' : ''} onClick={() => navegar('reportes')} disabled={!puedeReportes}><BarChart3 size={20} /> Reportes</button>
        <button className={vista === 'perfil' ? 'active' : ''} onClick={() => navegar('perfil')}><UserCircle size={20} /> Perfil</button>
      </nav>
    </div>
  );
}
