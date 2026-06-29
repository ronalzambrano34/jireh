import { lazy, type ChangeEvent, type FormEvent, type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, BarChart3, BriefcaseBusiness, CheckCircle2, ClipboardList, Copy, Home, LogOut, Menu, MessageCircle, Plus, RefreshCw, Settings, ShieldCheck, Smartphone, Sparkles, Upload, UserCircle, UsersRound, WalletCards, Wifi, WifiOff, X } from 'lucide-react';
import { actualizarEstado, actualizarMiPerfil, cambiarMiPassword, clearToken, getToken, listarPedidos, obtenerPedido, subirArchivo, subirMiFotoPerfil } from './api/client';
import { getMeDedup, obtenerEstadoConfiguracionInicialDedup } from './api/dedupedReads';
import type { Operador, PedidoDetalle, PedidoResumen } from './types/api';
import { LoginPage } from './pages/LoginPage';
import { Modal } from './components/Modal';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { UserHeaderMenu } from './components/UserHeaderMenu';
import { ERROR_TOAST_DURATION_MS, INFO_TOAST_DURATION_MS, PROFILE_TOAST_DURATION_MS, ToastMessage } from './components/FloatingToast';
import { UploadStatus } from './components/UploadStatus';
import { NotificationBell, defaultNotificationSoundPreferences, notificationKindLabels, type AppNotification, type AppNotificationKind, type NotificationSoundPreferences } from './components/NotificationBell';
import { isAbortError, useAbortableEffect } from './hooks/useAbortableEffect';
import { useDocumentVisible } from './hooks/useDocumentVisible';
import { useOfflineQueue } from './hooks/useOfflineQueue';
import { copiarAlPortapapeles } from './utils/clipboard';
import { guardarMonedaPedidoPreferida } from './utils/preferenciasPedido';
import type { CreateOrderDraft as CrearPedidoDraft } from './pages/CreateOrderPage';
import {
  abrirWhatsAppUrl,
} from './utils/whatsapp';
import logoJireh from './assets/brand/logo-jireh.jpeg';

const PedidoDetallePanel = lazy(() => import('./pages/PedidoDetallePanel').then((module) => ({ default: module.PedidoDetallePanel })));
const ReportesPage = lazy(() => import('./pages/ReportesPage').then((module) => ({ default: module.ReportesPage })));
const AdminCatalogosPage = lazy(() => import('./pages/AdminCatalogosPage').then((module) => ({ default: module.AdminCatalogosPage })));
const InicioPage = lazy(() => import('./pages/InicioPage').then((module) => ({ default: module.InicioPage })));
const HomeTestPage = lazy(() => import('./pages/HomeTestPage').then((module) => ({ default: module.HomeTestPage })));
const SetupInicialPage = lazy(() => import('./pages/SetupInicialPage').then((module) => ({ default: module.SetupInicialPage })));
const CreateOrderPage = lazy(() => import('./pages/CreateOrderPage').then((module) => ({ default: module.CreateOrderPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((module) => ({ default: module.OrdersPage })));

const estados = [
  { value: '', label: 'Estado' },
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pago_confirmado', label: 'Pago confirmado' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

type ProfileSection = 'editar' | 'permisos' | 'notificaciones' | 'password' | 'ayuda' | null;
type AppTheme = 'light' | 'dark-sidebar';
type AlcancePedidos = 'mis' | 'todas';
type PeriodoPedidos = 'hoy' | 'ayer' | '7_dias' | 'mes' | 'todos';
type ServicioCrear = 'transferencia' | 'efectivo' | 'saldo' | 'divisa' | 'otros';
type AppView = 'inicio' | 'home-test' | 'bandeja' | 'crear' | 'reportes' | 'admin' | 'setup' | 'perfil';
type PendingAuthAction =
  | { type: 'crear'; servicio: ServicioCrear; draft: CrearPedidoDraft }
  | { type: 'rastrear'; codigo: string }
  | null;
type AppBackState = {
  vista: AppView;
  seleccionado: string | null;
  mobileMenuOpen: boolean;
  quickCreateOpen: boolean;
  loginOpen: boolean;
  pedidoPagoModalOpen: boolean;
  whatsappGrupoPendienteOpen: boolean;
  profileSection: ProfileSection;
};
type NetworkStatusKind = 'online' | 'slow' | 'offline' | 'reconnecting';
type NetworkStatus = {
  kind: NetworkStatusKind;
  online: boolean;
  label: string;
  detail: string;
};
type ViewConnectivityMode = 'offline' | 'draft' | 'online-required';
type ViewConnectivityPolicy = {
  mode: ViewConnectivityMode;
  label: string;
  detail: string;
};
type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
};
type NetworkInformationLike = EventTarget & {
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
  addEventListener?: EventTarget['addEventListener'];
  removeEventListener?: EventTarget['removeEventListener'];
};

const THEME_KEY = 'jireh.theme';
const VIEW_KEY = 'jireh.view';
const CREATE_SERVICE_KEY = 'jireh.create.service';
const ADMIN_THEME_KEY = 'jireh.adminTema';
const APP_VIEWS = new Set<AppView>(['inicio', 'home-test', 'bandeja', 'crear', 'reportes', 'admin', 'setup', 'perfil']);
const CREATE_SERVICES = new Set<ServicioCrear>(['transferencia', 'efectivo', 'saldo', 'divisa', 'otros']);
const estadosBandeja = estados.filter((item) => item.value);
const PULL_REFRESH_THRESHOLD = 64;
const EXIT_BACK_WINDOW_MS = 2000;
const NOTIFICATION_LIMIT = 50;
const ORDER_DELAY_MINUTES = 10;
const PEDIDOS_REFRESH_FAST_MS = 30000;
const PEDIDOS_REFRESH_3G_MS = 120000;
const PEDIDOS_REFRESH_2G_MS = 240000;
const PEDIDOS_REFRESH_SAVE_DATA_MS = 300000;
const VIEW_CONNECTIVITY: Record<AppView, ViewConnectivityPolicy> = {
  inicio: {
    mode: 'offline',
    label: 'Disponible sin conexion',
    detail: 'Puedes ver el inicio con datos guardados. Sin internet no se sincronizan tasas ni rastreos.',
  },
  'home-test': {
    mode: 'offline',
    label: 'Disponible sin conexion',
    detail: 'Puedes consultar la vista con datos locales. Sin internet no se sincronizan tasas ni rastreos.',
  },
  crear: {
    mode: 'draft',
    label: 'Modo borrador sin conexion',
    detail: 'Puedes crear pedidos sin archivos y conservar borradores locales. Subir archivos y confirmar pagos requiere internet.',
  },
  perfil: {
    mode: 'offline',
    label: 'Disponible sin conexion',
    detail: 'Puedes ver datos y preferencias guardadas. Guardar cambios, foto o contrasena requiere internet.',
  },
  bandeja: {
    mode: 'draft',
    label: 'Pedidos con datos conservados',
    detail: 'Puedes revisar lo ya cargado y dejar finalizaciones sin comprobante en cola. Tomar, liberar, transferir, cancelar y subir archivos requiere internet.',
  },
  reportes: {
    mode: 'online-required',
    label: 'Reportes requiere conexion',
    detail: 'Los reportes se calculan con datos actuales y no se descargan sin internet.',
  },
  admin: {
    mode: 'online-required',
    label: 'Admin requiere conexion',
    detail: 'Los catalogos, roles, permisos y configuraciones deben leerse y guardarse en el servidor.',
  },
  setup: {
    mode: 'online-required',
    label: 'Configuracion inicial requiere conexion',
    detail: 'La configuracion inicial crea y valida catalogos del servidor.',
  },
};

type WebAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function getConnectionInfo() {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as NavigatorWithConnection).connection;
}

function vistaGuardada(): AppView {
  if (typeof sessionStorage === 'undefined') return 'inicio';
  const saved = sessionStorage.getItem(VIEW_KEY) as AppView | null;
  return saved && APP_VIEWS.has(saved) ? saved : 'inicio';
}

function servicioCrearGuardado(): ServicioCrear {
  const storages = [
    typeof sessionStorage === 'undefined' ? null : sessionStorage,
    typeof localStorage === 'undefined' ? null : localStorage,
  ];

  for (const storage of storages) {
    try {
      const saved = storage?.getItem(CREATE_SERVICE_KEY) as ServicioCrear | null;
      if (saved && CREATE_SERVICES.has(saved)) return saved;
    } catch {
      continue;
    }
  }

  return 'transferencia';
}

function intervaloRefrescoPedidos() {
  const connection = getConnectionInfo();

  if (connection?.saveData) return PEDIDOS_REFRESH_SAVE_DATA_MS;
  if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return PEDIDOS_REFRESH_2G_MS;
  if (connection?.effectiveType === '3g') return PEDIDOS_REFRESH_3G_MS;
  return PEDIDOS_REFRESH_FAST_MS;
}

function connectionIsSlow(connection?: NetworkInformationLike) {
  return Boolean(
    connection?.effectiveType === 'slow-2g'
    || connection?.effectiveType === '2g'
    || connection?.effectiveType === '3g'
  );
}

function readNetworkStatus(reconnecting = false): NetworkStatus {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const connection = getConnectionInfo();

  if (!online) {
    return {
      kind: 'offline',
      online: false,
      label: 'Sin conexion',
      detail: 'Conservamos los datos visibles. Las acciones que requieren internet pueden fallar.',
    };
  }

  if (reconnecting) {
    return {
      kind: 'reconnecting',
      online: true,
      label: 'Reconectando',
      detail: 'Estamos recuperando los datos y notificaciones.',
    };
  }

  if (connectionIsSlow(connection)) {
    return {
      kind: 'slow',
      online: true,
      label: 'Conexion lenta',
      detail: 'Las cargas pueden tardar mas. Evitamos refrescos agresivos.',
    };
  }

  return {
    kind: 'online',
    online: true,
    label: 'Conectado',
    detail: '',
  };
}

function NetworkStatusBanner({ status }: { status: NetworkStatus }) {
  if (status.kind === 'online') return null;
  const Icon = status.kind === 'offline' ? WifiOff : status.kind === 'reconnecting' ? RefreshCw : Wifi;
  return (
    <div className={`network-banner ${status.kind}`} role={status.kind === 'offline' ? 'alert' : 'status'} aria-live="polite">
      <Icon size={18} />
      <span>
        <strong>{status.label}</strong>
        <small>{status.detail}</small>
      </span>
    </div>
  );
}

function ViewConnectivityNotice({ policy }: { policy: ViewConnectivityPolicy }) {
  if (policy.mode === 'online-required') return null;
  return (
    <div className={`view-connectivity-notice ${policy.mode}`} role="status" aria-live="polite">
      <WifiOff size={17} />
      <span>
        <strong>{policy.label}</strong>
        <small>{policy.detail}</small>
      </span>
    </div>
  );
}

function OfflineQueueBanner({ pendingCount, syncing }: { pendingCount: number; syncing: boolean }) {
  if (pendingCount <= 0) return null;
  return (
    <div className="network-banner reconnecting" role="status" aria-live="polite">
      <RefreshCw size={18} />
      <span>
        <strong>{syncing ? 'Sincronizando pendientes' : 'Acciones pendientes'}</strong>
        <small>{pendingCount} accion{pendingCount === 1 ? '' : 'es'} guardada{pendingCount === 1 ? '' : 's'} en este dispositivo.</small>
      </span>
    </div>
  );
}

function OfflineRequiredView({ policy, onGoHome }: { policy: ViewConnectivityPolicy; onGoHome: () => void }) {
  return (
    <section className="offline-required-view app-page-width" role="status">
      <span className="offline-required-icon" aria-hidden="true"><WifiOff size={28} /></span>
      <div>
        <h2>{policy.label}</h2>
        <p>{policy.detail}</p>
      </div>
      <button className="primary-button" type="button" onClick={onGoHome}>
        <Home size={17} /> Ir al inicio
      </button>
    </section>
  );
}

function estadoFaseUno(value: string) {
  return value === 'en_operacion' ? 'pago_confirmado' : value;
}

function estadoCoincideFiltro(value: string, filtro: string) {
  const estadoVisible = estadoFaseUno(value);
  if (filtro === 'en_proceso') {
    return estadoVisible === 'pendiente_pago' || estadoVisible === 'pago_confirmado';
  }
  return estadoVisible === filtro;
}

function pedidoDisponibleParaNotificacion(pedido: PedidoResumen) {
  return estadoFaseUno(pedido.estado) === 'pago_confirmado';
}

function pedidoTomadoPorOtroOperador(pedido: PedidoResumen | undefined, operador: Operador | null) {
  return Boolean(
    pedido
    && operador
    && pedido.lock_activo
    && pedido.operador_asignado_id
    && pedido.operador_asignado_id !== operador.id
  );
}

function pedidoTomadoPorOperador(pedido: PedidoResumen | undefined) {
  return Boolean(pedido?.lock_activo && pedido.operador_asignado_id);
}

function notificationStorageKey(operadorId: number) {
  return `jireh.notifications.${operadorId}`;
}

function notificationPreferencesStorageKey(operadorId: number) {
  return `jireh.notificationPreferences.${operadorId}`;
}

function notificationSeenStorageKey(operadorId: number) {
  return `jireh.notificationSeen.${operadorId}`;
}

function themeStorageKey(operadorId: number) {
  return `${THEME_KEY}.${operadorId}`;
}

function orderPreferencesStorageKey(operadorId: number) {
  return `jireh.orderPreferences.${operadorId}`;
}

function normalizeTheme(value?: string | null): AppTheme | null {
  if (value === 'light') return 'light';
  if (value === 'dark-deep' || value === 'dark-sidebar') return 'dark-sidebar';
  if (value === 'dark' || value === 'dark-vscode' || value === 'dark-pro') return 'dark-sidebar';
  return null;
}

function readStoredTheme(operadorId?: number | null) {
  if (typeof localStorage === 'undefined') return null;
  const operadorTheme = operadorId ? normalizeTheme(localStorage.getItem(themeStorageKey(operadorId))) : null;
  return operadorTheme ?? normalizeTheme(localStorage.getItem(THEME_KEY));
}

function normalizeNotificationPreferences(value: unknown): NotificationSoundPreferences {
  return {
    ...defaultNotificationSoundPreferences,
    ...(value && typeof value === 'object' ? value as Partial<NotificationSoundPreferences> : {}),
  };
}

function normalizeNotifications(value: unknown): AppNotification[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: AppNotification[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<AppNotification>;
    if (
      !candidate.id
      || typeof candidate.id !== 'string'
      || seen.has(candidate.id)
      || !candidate.kind
      || !(candidate.kind in defaultNotificationSoundPreferences)
      || !candidate.codigo
      || typeof candidate.codigo !== 'string'
    ) continue;

    seen.add(candidate.id);
    result.push({
      id: candidate.id,
      kind: candidate.kind,
      codigo: candidate.codigo,
      title: typeof candidate.title === 'string' ? candidate.title : notificationKindLabels[candidate.kind],
      body: typeof candidate.body === 'string' ? candidate.body : candidate.codigo,
      createdAt: typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt) ? candidate.createdAt : Date.now(),
      read: Boolean(candidate.read),
    });
  }

  return result.slice(0, NOTIFICATION_LIMIT);
}

function readNotificationSeenIds(operadorId: number) {
  if (typeof localStorage === 'undefined') return new Set<string>();
  try {
    const saved = localStorage.getItem(notificationSeenStorageKey(operadorId));
    const parsed = saved ? JSON.parse(saved) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function writeNotificationSeenIds(operadorId: number, ids: Set<string>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(notificationSeenStorageKey(operadorId), JSON.stringify(Array.from(ids).slice(-500)));
  } catch {
    return;
  }
}

type OrderPreferences = {
  busqueda: string;
  estado: string;
  servicio: string;
  alcance: AlcancePedidos;
  periodo: PeriodoPedidos;
  vista: 'lista' | 'kanban';
  colapsados: string[];
};

const orderEstadoValues = new Set(['', 'pendiente_pago', 'pago_confirmado', 'en_proceso', 'completado', 'cancelado']);
const orderServicioValues = new Set(['', 'transferencia', 'efectivo', 'saldo', 'divisa', 'otros']);
const orderPeriodoValues = new Set<PeriodoPedidos>(['hoy', 'ayer', '7_dias', 'mes', 'todos']);

function normalizeOrderPreferences(value: unknown, canViewAll: boolean): OrderPreferences | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<OrderPreferences>;
  const periodo = raw.periodo && orderPeriodoValues.has(raw.periodo) ? raw.periodo : 'hoy';
  return {
    busqueda: typeof raw.busqueda === 'string' ? raw.busqueda.slice(0, 120) : '',
    estado: typeof raw.estado === 'string' && orderEstadoValues.has(raw.estado) ? raw.estado : '',
    servicio: typeof raw.servicio === 'string' && orderServicioValues.has(raw.servicio) ? raw.servicio : '',
    alcance: canViewAll ? 'todas' : 'mis',
    periodo,
    vista: raw.vista === 'lista' ? 'lista' : 'kanban',
    colapsados: Array.isArray(raw.colapsados)
      ? raw.colapsados.filter((item): item is string => typeof item === 'string' && orderEstadoValues.has(item))
      : ['completado', 'cancelado'],
  };
}

function readOrderPreferences(operadorId: number, canViewAll: boolean) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const saved = localStorage.getItem(orderPreferencesStorageKey(operadorId));
    return normalizeOrderPreferences(saved ? JSON.parse(saved) : null, canViewAll);
  } catch {
    return null;
  }
}

function writeOrderPreferences(operadorId: number, preferences: OrderPreferences) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(orderPreferencesStorageKey(operadorId), JSON.stringify(preferences));
  } catch {
    return;
  }
}

function servicioNotificacionLabel(value: string) {
  const labels: Record<string, string> = {
    transferencia: 'Transferencia',
    efectivo: 'Entrega de efectivo',
    saldo: 'Saldo',
    divisa: 'Divisa',
    otros: 'Otros',
  };
  return labels[value] ?? value;
}

function rangoPeriodoPedidos(periodo: PeriodoPedidos) {
  if (periodo === 'todos') return {};

  const ahora = new Date();
  const hasta = new Date(ahora);
  hasta.setHours(24, 0, 0, 0);

  const desde = new Date(ahora);
  desde.setHours(0, 0, 0, 0);
  if (periodo === 'ayer') {
    hasta.setHours(0, 0, 0, 0);
    desde.setDate(desde.getDate() - 1);
  } else if (periodo === '7_dias') {
    desde.setDate(desde.getDate() - 6);
  } else if (periodo === 'mes') {
    desde.setDate(1);
  }

  return {
    fecha_desde: desde.toISOString(),
    fecha_hasta: hasta.toISOString(),
  };
}

function parseBackendTime(value?: string | null) {
  if (!value) return Number.NaN;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  return Date.parse(normalized);
}

export function App() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    return readStoredTheme() ?? 'dark-sidebar';
  });
  const [operador, setOperador] = useState<Operador | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<PendingAuthAction>(null);
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
  const [alcancePedidos, setAlcancePedidos] = useState<AlcancePedidos>('todas');
  const [periodoPedidos, setPeriodoPedidos] = useState<PeriodoPedidos>('hoy');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [vista, setVista] = useState<AppView>(vistaGuardada);
  const [viewResetToken, setViewResetToken] = useState(0);
  const [vistaPedidos, setVistaPedidos] = useState<'lista' | 'kanban'>('kanban');
  const [operatorPreferencesReadyFor, setOperatorPreferencesReadyFor] = useState<number | null>(null);
  const [servicioCrear, setServicioCrear] = useState<ServicioCrear>(servicioCrearGuardado);
  const [crearDraft, setCrearDraft] = useState<CrearPedidoDraft>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(() => readNetworkStatus());
  const appVisible = useDocumentVisible();
  const online = networkStatus.online;
  const { pendingCount: offlineQueuePendingCount, syncing: offlineQueueSyncing } = useOfflineQueue(Boolean(operador));
  const [pedidosClock, setPedidosClock] = useState(() => Date.now());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const [pedidoCreadoUploadProgress, setPedidoCreadoUploadProgress] = useState<number | null>(null);
  const [pedidoCreadoUploadError, setPedidoCreadoUploadError] = useState<string | null>(null);
  const [profilePhotoProgress, setProfilePhotoProgress] = useState<number | null>(null);
  const [profilePhotoUploadError, setProfilePhotoUploadError] = useState<string | null>(null);
  const copyToastTimeoutRef = useRef<number | null>(null);
  const comprobantePedidoCreadoInputRef = useRef<HTMLInputElement | null>(null);
  const retryPedidoCreadoUploadRef = useRef<(() => void) | null>(null);
  const retryProfilePhotoUploadRef = useRef<(() => void) | null>(null);
  const confirmandoPagoCreadoRef = useRef(false);
  const profileSavingRef = useRef(false);
  const profilePhotoSavingRef = useRef(false);
  const profileMessageTimeoutRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const profileErrorTimeoutRef = useRef<number | null>(null);
  const reconnectingTimeoutRef = useRef<number | null>(null);
  const pullStartRef = useRef<{ x: number; y: number } | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [notificaciones, setNotificaciones] = useState<AppNotification[]>([]);
  const [notificationSoundPreferences, setNotificationSoundPreferences] = useState<NotificationSoundPreferences>(defaultNotificationSoundPreferences);
  const historyViewRef = useRef<AppView>(vista);
  const appBackHandlerRef = useRef<() => boolean>(() => false);
  const appBackStateRef = useRef<AppBackState>({
    vista,
    seleccionado,
    mobileMenuOpen,
    quickCreateOpen,
    loginOpen,
    pedidoPagoModalOpen: Boolean(pedidoPagoModal),
    whatsappGrupoPendienteOpen: Boolean(whatsappGrupoPendiente),
    profileSection,
  });
  const handlingPopStateRef = useRef(false);
  const lastExitBackRef = useRef(0);
  const notificationAudioContextRef = useRef<AudioContext | null>(null);
  const notificacionesRef = useRef<AppNotification[]>([]);
  const notificationSnapshotReadyRef = useRef(false);
  const notificationKnownIdsRef = useRef<Set<string>>(new Set());
  const knownPedidoCodesRef = useRef<Set<string>>(new Set());
  const knownTransferKeysRef = useRef<Map<string, string>>(new Map());
  const delayedNotificationCodesRef = useRef<Set<string>>(new Set());
  const pedidosRequestKeysRef = useRef<Set<string>>(new Set());
  const lastPedidosRefreshAtRef = useRef(0);
  const themePreferenceHydratingRef = useRef<number | null>(null);
  const orderPreferencesHydratingRef = useRef<number | null>(null);
  const offlineQueuePreviousPendingRef = useRef(offlineQueuePendingCount);

  const puedeCrear = useMemo(
    () => operador?.permisos.includes('pedidos:crear') || operador?.permisos.includes('pedidos:gestionar') || operador?.permisos.includes('empresa:control_total'),
    [operador],
  );

  const puedeReportes = useMemo(
    () => operador?.permisos.includes('reportes:ver') || operador?.permisos.includes('pedidos:gestionar') || operador?.permisos.includes('empresa:control_total'),
    [operador],
  );

  const puedeVerTodasLasOrdenes = useMemo(
    () => Boolean(operador && operador.rol !== 'cliente'),
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

  const notificacionesSinLeer = useMemo(
    () => notificaciones.filter((notificacion) => !notificacion.read).length,
    [notificaciones],
  );

  function iniciarPullRefresh(event: TouchEvent<HTMLElement>) {
    if (
      !window.matchMedia('(max-width: 920px)').matches
      || pullRefreshing
      || event.currentTarget.scrollTop > 0
      || event.touches.length !== 1
    ) return;
    const touch = event.touches[0];
    pullStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function moverPullRefresh(event: TouchEvent<HTMLElement>) {
    const start = pullStartRef.current;
    if (!start || pullRefreshing || event.currentTarget.scrollTop > 0 || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (deltaY <= 0 || Math.abs(deltaX) >= deltaY) {
      setPullDistance(0);
      return;
    }

    setPullDistance(Math.min(96, deltaY * 0.45));
  }

  function finalizarPullRefresh() {
    pullStartRef.current = null;
    if (pullDistance < PULL_REFRESH_THRESHOLD) {
      setPullDistance(0);
      return;
    }

    setPullRefreshing(true);
    setPullDistance(PULL_REFRESH_THRESHOLD);
    window.setTimeout(() => window.location.reload(), 180);
  }

  function cancelarPullRefresh() {
    pullStartRef.current = null;
    setPullDistance(0);
  }

  const reproducirSonidoNotificacion = useCallback(() => {
    try {
      const AudioContextCtor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
      if (!AudioContextCtor) return;

      const audioContext = notificationAudioContextRef.current ?? new AudioContextCtor();
      notificationAudioContextRef.current = audioContext;

      const play = () => {
        const start = audioContext.currentTime;
        [880, 1175].forEach((frequency, index) => {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const toneStart = start + index * 0.16;
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, toneStart);
          gain.gain.setValueAtTime(0.0001, toneStart);
          gain.gain.exponentialRampToValueAtTime(0.18, toneStart + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.14);
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.start(toneStart);
          oscillator.stop(toneStart + 0.15);
        });
      };

      if (audioContext.state === 'suspended') {
        void audioContext.resume().then(play).catch(() => {});
        return;
      }
      play();
    } catch {
    }
  }, []);

  const agregarNotificaciones = useCallback((items: AppNotification[]) => {
    if (!items.length) return;

    const nuevas: AppNotification[] = [];
    for (const item of items) {
      if (notificationKnownIdsRef.current.has(item.id)) continue;
      notificationKnownIdsRef.current.add(item.id);
      nuevas.push(item);
    }
    if (!nuevas.length) return;
    if (operador) writeNotificationSeenIds(operador.id, notificationKnownIdsRef.current);

    const shouldPlaySound = nuevas.some((item) => notificationSoundPreferences[item.kind] !== false);
    setNotificaciones((current) => {
      const ids = new Set(current.map((item) => item.id));
      const next = normalizeNotifications([...nuevas.filter((item) => !ids.has(item.id)), ...current]);
      notificacionesRef.current = next;
      return next;
    });
    if (shouldPlaySound) reproducirSonidoNotificacion();
  }, [notificationSoundPreferences, operador, reproducirSonidoNotificacion]);

  const revisarNotificacionesPedidos = useCallback((data: PedidoResumen[]) => {
    if (!operador) return;

    const nextCodes = new Set<string>();
    const nextTransferKeys = new Map<string, string>();
    const delayedCodesToRemove = new Set<string>();
    const nuevas: AppNotification[] = [];
    const now = Date.now();

    for (const pedido of data) {
      const codigo = pedido.codigo_operacion;
      const disponibleParaNotificar = pedidoDisponibleParaNotificacion(pedido);
      const tomadoPorOperador = pedidoTomadoPorOperador(pedido);
      if (disponibleParaNotificar) nextCodes.add(codigo);
      if (tomadoPorOperador) {
        delayedCodesToRemove.add(codigo);
        delayedNotificationCodesRef.current.delete(codigo);
      }

      const createdAt = parseBackendTime(pedido.created_at);
      const confirmedAt = Number.isNaN(parseBackendTime(pedido.fecha_pago_confirmado)) ? createdAt : parseBackendTime(pedido.fecha_pago_confirmado);
      const parsedTransferAt = parseBackendTime(pedido.redirigido_en);
      const transferAt = Number.isNaN(parsedTransferAt) ? now : parsedTransferAt;
      const transferStamp = Number.isNaN(parsedTransferAt) ? 'sin-fecha' : String(parsedTransferAt);
      const transferKey = pedido.redirigido_a_operador_id
        ? `${pedido.redirigido_a_operador_id}:${pedido.redirigido_por_operador_id ?? ''}:${transferStamp}`
        : '';
      if (transferKey) nextTransferKeys.set(codigo, transferKey);

      const confirmadoReciente = Number.isNaN(confirmedAt) || now - confirmedAt <= 30 * 60 * 1000;
      const transferidoReciente = Number.isNaN(transferAt) || now - transferAt <= 30 * 60 * 1000;
      const transferidoAMi = pedido.redirigido_a_operador_id === operador.id;
      const estaAtrasado = disponibleParaNotificar
        && !tomadoPorOperador
        && !Number.isNaN(createdAt)
        && now - createdAt >= ORDER_DELAY_MINUTES * 60 * 1000
        && pedido.estado !== 'completado'
        && pedido.estado !== 'cancelado';

      if (notificationSnapshotReadyRef.current && transferidoAMi && transferKey && knownTransferKeysRef.current.get(codigo) !== transferKey && transferidoReciente) {
        nuevas.push({
          id: `transferido:${codigo}:${transferKey}`,
          kind: 'pedido_transferido',
          codigo,
          title: 'Pedido transferido',
          body: `${codigo} para ti${pedido.redireccion_mensaje ? ` · ${pedido.redireccion_mensaje}` : ''}`,
          createdAt: Number.isNaN(transferAt) ? now : transferAt,
          read: false,
        });
        continue;
      }

      if (notificationSnapshotReadyRef.current && disponibleParaNotificar && !knownPedidoCodesRef.current.has(codigo) && pedido.operador_id !== operador.id && confirmadoReciente) {
        nuevas.push({
          id: `nuevo:${codigo}`,
          kind: 'nuevo_pedido',
          codigo,
          title: 'Nuevo pedido',
          body: `${codigo} · ${servicioNotificacionLabel(pedido.servicio)} · ${pedido.moneda_pago}`,
          createdAt: Number.isNaN(confirmedAt) ? now : confirmedAt,
          read: false,
        });
      }

      if (estaAtrasado && !delayedNotificationCodesRef.current.has(codigo)) {
        nuevas.push({
          id: `atrasado:${codigo}`,
          kind: 'pedido_atrasado',
          codigo,
          title: 'Pedido atrasado',
          body: `${codigo} lleva mas de ${ORDER_DELAY_MINUTES} min sin completarse`,
          createdAt: now,
          read: false,
        });
        delayedNotificationCodesRef.current.add(codigo);
      }
    }

    knownPedidoCodesRef.current = nextCodes;
    knownTransferKeysRef.current = nextTransferKeys;
    if (!notificationSnapshotReadyRef.current) {
      notificationSnapshotReadyRef.current = true;
    }
    if (delayedCodesToRemove.size) {
      setNotificaciones((current) => current.filter((item) => (
        item.kind !== 'pedido_atrasado'
        || !item.codigo
        || !delayedCodesToRemove.has(item.codigo)
      )));
    }
    agregarNotificaciones(nuevas);
  }, [agregarNotificaciones, operador]);

  const pedidosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();

    return pedidos.filter((pedido) => {
      if (estado && !estadoCoincideFiltro(pedido.estado, estado)) return false;
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
  const codigosPedidosTomadosPorMi = useMemo(
    () => pedidos
      .filter((pedido) => Boolean(operador && pedido.lock_activo && pedido.operador_asignado_id === operador.id))
      .map((pedido) => pedido.codigo_operacion),
    [operador, pedidos],
  );

  function pedidoTomadoPorMi(pedido: PedidoResumen) {
    return Boolean(operador && pedido.lock_activo && pedido.operador_asignado_id === operador.id);
  }

  function pedidoBloqueadoPorOtro(pedido: PedidoResumen) {
    return Boolean(operador && pedido.lock_activo && pedido.operador_asignado_id && pedido.operador_asignado_id !== operador.id);
  }

  function pedidoAtrasado(pedido: PedidoResumen) {
    if (pedido.estado === 'completado' || pedido.estado === 'cancelado') return false;
    const createdAt = parseBackendTime(pedido.created_at);
    return !Number.isNaN(createdAt) && pedidosClock - createdAt >= ORDER_DELAY_MINUTES * 60 * 1000;
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
      .filter((item) => !estado || estado === 'en_proceso' || item.value === estado)
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
    if (nextVista === 'admin') sessionStorage.removeItem(ADMIN_THEME_KEY);
    if (nextVista === 'bandeja') {
      setSeleccionado(null);
      limpiarFiltrosPedidos();
    } else {
      setSeleccionado(null);
    }
    setPedidoPagoModal(null);
    setWhatsappGrupoPendiente(null);
    setViewResetToken((token) => token + 1);
    setVista(nextVista);
    setMobileMenuOpen(false);
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
    guardarMonedaPedidoPreferida(draft.moneda_pago, operador?.id);
    setServicioCrear(servicio);
    setCrearDraft(draft);
    setVista('crear');
    setMobileMenuOpen(false);
    setQuickCreateOpen(false);
  }

  function solicitarLogin(action: PendingAuthAction = null) {
    setPendingAuthAction(action);
    setLoginOpen(true);
  }

  function completarLogin(nextOperador: Operador) {
    setOperador(nextOperador);
    setLoginOpen(false);

    if (pendingAuthAction?.type === 'crear') {
      abrirCrear(pendingAuthAction.servicio, pendingAuthAction.draft);
    } else if (pendingAuthAction?.type === 'rastrear') {
      const codigo = pendingAuthAction.codigo.trim().toUpperCase();
      setBusqueda(codigo);
      setEstado('');
      setServicio('');
      setSeleccionado(codigo);
      setVista('bandeja');
    } else {
      setVista('inicio');
    }

    setPendingAuthAction(null);
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
    setMobileMenuOpen(false);
  }

  function navegarDesdeMenuUsuario(nextVista: typeof vista) {
    navegar(nextVista);
  }

  function cerrarSesion() {
    clearToken();
    sessionStorage.removeItem(VIEW_KEY);
    sessionStorage.removeItem(ADMIN_THEME_KEY);
    setOperador(null);
    setVista('inicio');
    setSetupRevisado(false);
    setMobileMenuOpen(false);
    setQuickCreateOpen(false);
  }

  async function finalizarCreacionPedido(
    pedido: PedidoDetalle,
    pagoConfirmado: boolean,
    advertencia?: string,
  ) {
    if (pagoConfirmado) {
      try {
        const actualizado = await actualizarEstado(
          pedido.codigo_operacion,
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'El comprobante se cargo, pero no se pudo confirmar el pago');
      }
    } else {
      setPedidoPagoModal(pedido);
    }
    setSeleccionado(null);
    setAlcancePedidos(puedeVerTodasLasOrdenes ? 'todas' : 'mis');
    setVista('bandeja');
    void cargarPedidos();
    if (advertencia) setError(advertencia);
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

  function mostrarInfoToast(message: string) {
    setCopyToast(message);
    if (copyToastTimeoutRef.current) window.clearTimeout(copyToastTimeoutRef.current);
    copyToastTimeoutRef.current = window.setTimeout(() => setCopyToast(null), INFO_TOAST_DURATION_MS);
  }

  function cambiarSonidoNotificacion(kind: AppNotificationKind, enabled: boolean) {
    setNotificationSoundPreferences((current) => ({ ...current, [kind]: enabled }));
    mostrarInfoToast(`${notificationKindLabels[kind]} ${enabled ? 'con sonido' : 'silenciada'}`);
  }

  function silenciarTipoNotificacion(kind: AppNotificationKind) {
    cambiarSonidoNotificacion(kind, false);
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

  function marcarTodasNotificacionesLeidas() {
    setNotificaciones((current) => current.map((item) => ({ ...item, read: true })));
  }

  function marcarNotificacionLeida(id: string) {
    setNotificaciones((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  function eliminarNotificacion(id: string) {
    if (operador) {
      notificationKnownIdsRef.current.add(id);
      writeNotificationSeenIds(operador.id, notificationKnownIdsRef.current);
    }
    setNotificaciones((current) => current.filter((item) => item.id !== id));
  }

  function limpiarNotificaciones() {
    if (operador) {
      notificacionesRef.current.forEach((item) => notificationKnownIdsRef.current.add(item.id));
      writeNotificationSeenIds(operador.id, notificationKnownIdsRef.current);
    }
    setNotificaciones([]);
  }

  function limpiarFiltrosPedidos() {
    setBusqueda('');
    setEstado('');
    setServicio('');
    setAlcancePedidos(puedeVerTodasLasOrdenes ? 'todas' : 'mis');
    setPeriodoPedidos('hoy');
  }

  function cerrarDetallePedido() {
    setSeleccionado(null);
    limpiarFiltrosPedidos();
  }

  function ejecutarAtrasAplicacion() {
    const current = appBackStateRef.current;

    if (current.loginOpen) {
      setLoginOpen(false);
      setPendingAuthAction(null);
      return true;
    }

    if (current.mobileMenuOpen) {
      setMobileMenuOpen(false);
      return true;
    }

    if (current.quickCreateOpen) {
      setQuickCreateOpen(false);
      return true;
    }

    if (current.pedidoPagoModalOpen) {
      setPedidoPagoModal(null);
      setPedidoCreadoUploadError(null);
      setPedidoCreadoUploadProgress(null);
      retryPedidoCreadoUploadRef.current = null;
      return true;
    }

    if (current.whatsappGrupoPendienteOpen) {
      setWhatsappGrupoPendiente(null);
      return true;
    }

    if (current.seleccionado) {
      cerrarDetallePedido();
      return true;
    }

    if (current.vista === 'perfil' && current.profileSection) {
      setProfileSection(null);
      setProfileMessage(null);
      setProfileError(null);
      return true;
    }

    if (current.vista !== 'inicio') {
      historyViewRef.current = 'inicio';
      setVista('inicio');
      setMobileMenuOpen(false);
      setQuickCreateOpen(false);
      setProfileSection(null);
      setProfileMessage(null);
      setProfileError(null);
      return true;
    }

    return false;
  }

  function actualizarPedidosDesdeDetalle() {
    limpiarFiltrosPedidos();
    void cargarPedidos();
  }

  async function abrirNotificacion(id: string) {
    const notificacion = notificacionesRef.current.find((item) => item.id === id);
    setNotificaciones((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    if (!notificacion?.codigo) return;

    setBusqueda(notificacion.codigo);
    setEstado('');
    setServicio('');
    setAlcancePedidos(puedeVerTodasLasOrdenes ? 'todas' : 'mis');
    setSeleccionado(null);
    setVista('bandeja');
    setMobileMenuOpen(false);
    setQuickCreateOpen(false);
    setProfileSection(null);
    try {
      const alcanceCarga = puedeVerTodasLasOrdenes ? 'todas' : 'mis';
      const data = await listarPedidos({
        limit: 200,
        alcance: alcanceCarga,
        ...rangoPeriodoPedidos(periodoPedidos),
      });
      revisarNotificacionesPedidos(data);
      if (puedeVerTodasLasOrdenes) {
        aplicarPedidosPorAlcance(data);
      } else {
        setAlcanceConteos({ mis: data.length, todas: data.length });
        setPedidos(data);
      }

      const pedidoActual = data.find((pedido) => pedido.codigo_operacion === notificacion.codigo);
      if (pedidoTomadoPorOtroOperador(pedidoActual, operador)) {
        setError('Este pedido ya esta tomado por otro operador');
        return;
      }
      const detalleActual = await obtenerPedido(notificacion.codigo);
      if (pedidoTomadoPorOtroOperador(detalleActual, operador)) {
        setPedidos((current) => current.map((pedido) => (
          pedido.codigo_operacion === detalleActual.codigo_operacion ? { ...pedido, ...detalleActual } : pedido
        )));
        setError('Este pedido ya esta tomado por otro operador');
        return;
      }
      if (!pedidoDisponibleParaNotificacion(detalleActual)) return;
      setSeleccionado(detalleActual.codigo_operacion);
    } catch {
      void cargarPedidos();
    }
  }

  function abrirUrlPago(url?: string | null) {
    abrirWhatsAppUrl(url);
  }

  function abrirMensajeGrupoPedido() {
    abrirUrlPago(pedidoPagoModal?.whatsapp_grupo_pedidos_url);
  }

  function verPedidoCreado() {
    if (!pedidoPagoModal) return;
    setSeleccionado(pedidoPagoModal.codigo_operacion);
    setPedidoPagoModal(null);
    setPedidoCreadoUploadError(null);
    setPedidoCreadoUploadProgress(null);
    retryPedidoCreadoUploadRef.current = null;
    setVista('bandeja');
    void cargarPedidos();
  }

  function continuarPedidoConfirmado() {
    if (!whatsappGrupoPendiente) return;
    setSeleccionado(whatsappGrupoPendiente.codigo);
    setWhatsappGrupoPendiente(null);
    setVista('bandeja');
    void cargarPedidos();
  }

  async function confirmarPagoPedidoCreado(file: File) {
    if (!pedidoPagoModal || confirmandoPagoCreadoRef.current) return;
    const codigoOperacion = pedidoPagoModal.codigo_operacion;
    retryPedidoCreadoUploadRef.current = () => void confirmarPagoPedidoCreado(file);
    confirmandoPagoCreadoRef.current = true;
    setConfirmandoPagoCreado(true);
    setPedidoCreadoUploadProgress(0);
    setPedidoCreadoUploadError(null);
    setError(null);
    try {
      const form = new FormData();
      form.set('tipo', 'comprobante_cliente');
      form.set('archivo', file);
      try {
        await subirArchivo(codigoOperacion, form, {
          onProgress: (progress) => setPedidoCreadoUploadProgress(progress.percent),
        });
      } catch (err) {
        setPedidoCreadoUploadError(err instanceof Error ? err.message : 'No se pudo subir el comprobante');
        return;
      }
      retryPedidoCreadoUploadRef.current = null;
      setPedidoCreadoUploadProgress(100);
      const actualizado = await actualizarEstado(
        codigoOperacion,
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
      setPedidoCreadoUploadError(null);
      setPedidoCreadoUploadProgress(null);
      await cargarPedidos();
      setCopyToast('Pago confirmado');
      if (copyToastTimeoutRef.current) window.clearTimeout(copyToastTimeoutRef.current);
      copyToastTimeoutRef.current = window.setTimeout(() => setCopyToast(null), INFO_TOAST_DURATION_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el pago');
    } finally {
      confirmandoPagoCreadoRef.current = false;
      setConfirmandoPagoCreado(false);
    }
  }

  function seleccionarComprobantePedidoCreado() {
    if (confirmandoPagoCreadoRef.current) return;
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

  const cargarPedidos = useCallback(async (signal?: AbortSignal) => {
    const alcanceCarga = puedeVerTodasLasOrdenes ? 'todas' : 'mis';
    const cargaKey = `pedidos:${operador?.id ?? 'anon'}:${alcanceCarga}:${alcancePedidos}:${periodoPedidos}`;
    if (pedidosRequestKeysRef.current.has(cargaKey)) return;

    pedidosRequestKeysRef.current.add(cargaKey);
    setLoading(true);
    setError(null);
    try {
      const data = await listarPedidos({
        limit: 200,
        alcance: alcanceCarga,
        ...rangoPeriodoPedidos(periodoPedidos),
      }, { signal });
      revisarNotificacionesPedidos(data);
      if (puedeVerTodasLasOrdenes) {
        aplicarPedidosPorAlcance(data);
      } else {
        setAlcanceConteos({ mis: data.length, todas: data.length });
        setPedidos(data);
      }
      lastPedidosRefreshAtRef.current = Date.now();
    } catch (err) {
      if (!isAbortError(err)) setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos');
    } finally {
      pedidosRequestKeysRef.current.delete(cargaKey);
      if (!signal?.aborted) setLoading(false);
    }
  }, [alcancePedidos, aplicarPedidosPorAlcance, operador?.id, puedeVerTodasLasOrdenes, periodoPedidos, revisarNotificacionesPedidos]);

  useEffect(() => {
    const previous = offlineQueuePreviousPendingRef.current;
    offlineQueuePreviousPendingRef.current = offlineQueuePendingCount;
    if (previous > 0 && offlineQueuePendingCount === 0 && online && operador) {
      void cargarPedidos();
    }
  }, [cargarPedidos, offlineQueuePendingCount, online, operador]);

  const refrescarPedidosSilencioso = useCallback(async (signal?: AbortSignal) => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    const alcanceCarga = puedeVerTodasLasOrdenes ? 'todas' : 'mis';
    const cargaKey = `pedidos:${operador?.id ?? 'anon'}:${alcanceCarga}:${alcancePedidos}:${periodoPedidos}`;
    if (pedidosRequestKeysRef.current.has(cargaKey)) return;

    pedidosRequestKeysRef.current.add(cargaKey);
    try {
      const data = await listarPedidos({
        limit: 200,
        alcance: alcanceCarga,
        ...rangoPeriodoPedidos(periodoPedidos),
      }, { signal });
      revisarNotificacionesPedidos(data);
      if (puedeVerTodasLasOrdenes) {
        aplicarPedidosPorAlcance(data);
      } else {
        setAlcanceConteos({ mis: data.length, todas: data.length });
        setPedidos(data);
      }
      lastPedidosRefreshAtRef.current = Date.now();
    } catch {
      // El refresco silencioso no debe interrumpir al operador si falla una vuelta.
    } finally {
      pedidosRequestKeysRef.current.delete(cargaKey);
    }
  }, [alcancePedidos, aplicarPedidosPorAlcance, operador?.id, puedeVerTodasLasOrdenes, periodoPedidos, revisarNotificacionesPedidos]);

  useEffect(() => {
    if (!puedeVerTodasLasOrdenes && alcancePedidos === 'todas') {
      setAlcancePedidos('mis');
    }
  }, [alcancePedidos, puedeVerTodasLasOrdenes]);

  useEffect(() => {
    if (!operador) {
      setOperatorPreferencesReadyFor(null);
      return;
    }

    orderPreferencesHydratingRef.current = operador.id;
    const preferences = readOrderPreferences(operador.id, puedeVerTodasLasOrdenes);
    if (preferences) {
      setBusqueda(preferences.busqueda);
      setEstado(preferences.estado);
      setServicio(preferences.servicio);
      setAlcancePedidos(preferences.alcance);
      setPeriodoPedidos(preferences.periodo);
      setVistaPedidos(preferences.vista);
      setPedidosEstadosColapsados(new Set(preferences.colapsados));
    } else {
      setAlcancePedidos(puedeVerTodasLasOrdenes ? 'todas' : 'mis');
    }
    setOperatorPreferencesReadyFor(operador.id);
  }, [operador?.id, puedeVerTodasLasOrdenes]);

  useEffect(() => {
    if (!operador || operatorPreferencesReadyFor !== operador.id) return;
    if (orderPreferencesHydratingRef.current === operador.id) {
      orderPreferencesHydratingRef.current = null;
      return;
    }
    writeOrderPreferences(operador.id, {
      busqueda,
      estado,
      servicio,
      alcance: alcancePedidos,
      periodo: periodoPedidos,
      vista: vistaPedidos,
      colapsados: Array.from(pedidosEstadosColapsados),
    });
  }, [alcancePedidos, busqueda, estado, operador, operatorPreferencesReadyFor, pedidosEstadosColapsados, periodoPedidos, servicio, vistaPedidos]);

  useEffect(() => {
    if (!operador) return;
    const savedTheme = readStoredTheme(operador.id);
    if (savedTheme && savedTheme !== theme) {
      themePreferenceHydratingRef.current = operador.id;
      setTheme(savedTheme);
    }
  }, [operador?.id]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    if (!operador) return;
    if (themePreferenceHydratingRef.current === operador.id) {
      themePreferenceHydratingRef.current = null;
      return;
    }
    localStorage.setItem(themeStorageKey(operador.id), theme);
  }, [operador, theme]);

  useEffect(() => {
    sessionStorage.setItem(VIEW_KEY, vista);
  }, [vista]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CREATE_SERVICE_KEY, servicioCrear);
      localStorage.setItem(CREATE_SERVICE_KEY, servicioCrear);
    } catch {
      return;
    }
  }, [servicioCrear]);

  useEffect(() => {
    const mobileBreakpoint = window.matchMedia('(max-width: 920px)');
    const closeMenuOnBreakpointChange = () => setMobileMenuOpen(false);

    mobileBreakpoint.addEventListener('change', closeMenuOnBreakpointChange);
    return () => mobileBreakpoint.removeEventListener('change', closeMenuOnBreakpointChange);
  }, []);

  useEffect(() => {
    appBackStateRef.current = {
      vista,
      seleccionado,
      mobileMenuOpen,
      quickCreateOpen,
      loginOpen,
      pedidoPagoModalOpen: Boolean(pedidoPagoModal),
      whatsappGrupoPendienteOpen: Boolean(whatsappGrupoPendiente),
      profileSection,
    };
    appBackHandlerRef.current = ejecutarAtrasAplicacion;
  });

  useEffect(() => {
    const initialView = historyViewRef.current;
    window.history.replaceState({ ...window.history.state, jirehExitGuard: true }, '');
    window.history.pushState({ jirehView: initialView }, '');

    function handlePopState() {
      if (appBackHandlerRef.current()) {
        lastExitBackRef.current = 0;
        window.history.pushState({ jirehView: historyViewRef.current }, '');
        return;
      }

      const now = Date.now();
      if (now - lastExitBackRef.current <= EXIT_BACK_WINDOW_MS) {
        window.history.back();
        return;
      }

      lastExitBackRef.current = now;
      window.history.pushState({ jirehView: 'inicio' }, '');
      setCopyToast('Presiona Atras nuevamente para salir');
      if (copyToastTimeoutRef.current) window.clearTimeout(copyToastTimeoutRef.current);
      copyToastTimeoutRef.current = window.setTimeout(() => setCopyToast(null), EXIT_BACK_WINDOW_MS);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    historyViewRef.current = vista;
    if (handlingPopStateRef.current) {
      handlingPopStateRef.current = false;
      return;
    }

    const currentState = window.history.state as { jirehView?: AppView } | null;
    if (currentState?.jirehView !== vista) {
      window.history.pushState({ jirehView: vista }, '');
    }
  }, [vista]);

  useAbortableEffect((signal) => {
    if (!getToken()) return;
    getMeDedup({ signal })
      .then(setOperador)
      .catch((err) => {
        if (isAbortError(err)) return;
        const message = err instanceof Error ? err.message.toLowerCase() : '';
        if (message.includes('401') || message.includes('token')) {
          clearToken();
        }
        setOperador(null);
      });
  }, []);

  useEffect(() => {
    if (!operador) {
      setNotificaciones([]);
      setNotificationSoundPreferences(defaultNotificationSoundPreferences);
      notificacionesRef.current = [];
      notificationKnownIdsRef.current = new Set();
      notificationSnapshotReadyRef.current = false;
      knownPedidoCodesRef.current = new Set();
      knownTransferKeysRef.current = new Map();
      delayedNotificationCodesRef.current = new Set();
      return;
    }

    notificationSnapshotReadyRef.current = false;
    knownPedidoCodesRef.current = new Set();
    knownTransferKeysRef.current = new Map();
    delayedNotificationCodesRef.current = new Set();
    const knownNotificationIds = readNotificationSeenIds(operador.id);

    try {
      const saved = localStorage.getItem(notificationStorageKey(operador.id));
      const parsed = saved ? JSON.parse(saved) : [];
      const savedNotifications = normalizeNotifications(parsed);
      savedNotifications.forEach((item) => {
        knownNotificationIds.add(item.id);
        if (item.kind === 'pedido_atrasado') delayedNotificationCodesRef.current.add(item.codigo);
      });
      notificationKnownIdsRef.current = knownNotificationIds;
      notificacionesRef.current = savedNotifications;
      setNotificaciones(savedNotifications);
      writeNotificationSeenIds(operador.id, knownNotificationIds);
    } catch {
      notificationKnownIdsRef.current = knownNotificationIds;
      notificacionesRef.current = [];
      setNotificaciones([]);
      writeNotificationSeenIds(operador.id, knownNotificationIds);
    }

    try {
      const savedPreferences = localStorage.getItem(notificationPreferencesStorageKey(operador.id));
      setNotificationSoundPreferences(normalizeNotificationPreferences(savedPreferences ? JSON.parse(savedPreferences) : null));
    } catch {
      setNotificationSoundPreferences(defaultNotificationSoundPreferences);
    }
  }, [operador]);

  useEffect(() => {
    const normalized = normalizeNotifications(notificaciones);
    notificacionesRef.current = normalized;
    if (!operador) return;
    normalized.forEach((item) => notificationKnownIdsRef.current.add(item.id));
    writeNotificationSeenIds(operador.id, notificationKnownIdsRef.current);
    localStorage.setItem(notificationStorageKey(operador.id), JSON.stringify(normalized));
  }, [notificaciones, operador]);

  useEffect(() => {
    if (!operador) return;
    localStorage.setItem(notificationPreferencesStorageKey(operador.id), JSON.stringify(notificationSoundPreferences));
  }, [notificationSoundPreferences, operador]);

  useEffect(() => {
    if (!operador) return undefined;

    function unlockAudio() {
      try {
        const AudioContextCtor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
        if (!AudioContextCtor) return;
        const audioContext = notificationAudioContextRef.current ?? new AudioContextCtor();
        notificationAudioContextRef.current = audioContext;
        if (audioContext.state === 'suspended') void audioContext.resume();
      } catch {
      }
    }

    window.addEventListener('pointerdown', unlockAudio, true);
    window.addEventListener('keydown', unlockAudio, true);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio, true);
      window.removeEventListener('keydown', unlockAudio, true);
    };
  }, [operador]);

  useAbortableEffect((signal) => {
    if (operador && operatorPreferencesReadyFor === operador.id) void cargarPedidos(signal);
  }, [cargarPedidos, operador, operatorPreferencesReadyFor]);

  useAbortableEffect((signal) => {
    if (!operador || !puedeAdmin || setupRevisado) return;
    obtenerEstadoConfiguracionInicialDedup({ signal })
      .then((estadoSetup) => {
        if (!estadoSetup.completada) setVista('setup');
      })
      .catch(() => {})
      .finally(() => {
        if (!signal.aborted) setSetupRevisado(true);
      });
  }, [operador, puedeAdmin, setupRevisado]);

  useAbortableEffect((signal) => {
    if (!operador || !online || !appVisible) return undefined;
    const intervalMs = intervaloRefrescoPedidos();
    const interval = window.setInterval(() => {
      void refrescarPedidosSilencioso(signal);
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [appVisible, networkStatus.kind, online, operador, refrescarPedidosSilencioso]);

  useEffect(() => {
    if (!operador || !online || !appVisible) return;
    const intervalMs = intervaloRefrescoPedidos();
    if (Date.now() - lastPedidosRefreshAtRef.current >= intervalMs) {
      void refrescarPedidosSilencioso();
    }
  }, [appVisible, networkStatus.kind, online, operador, refrescarPedidosSilencioso]);

  useEffect(() => {
    if (!appVisible) return undefined;
    setPedidosClock(Date.now());
    const interval = window.setInterval(() => setPedidosClock(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, [appVisible]);

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
    if (!operador) return;
    setProfileNombre(operador.nombre);
  }, [operador]);

  useEffect(() => {
    const connection = getConnectionInfo();

    function clearReconnectingTimeout() {
      if (reconnectingTimeoutRef.current) window.clearTimeout(reconnectingTimeoutRef.current);
      reconnectingTimeoutRef.current = null;
    }

    function finishReconnecting() {
      reconnectingTimeoutRef.current = window.setTimeout(() => {
        setNetworkStatus(readNetworkStatus(false));
        reconnectingTimeoutRef.current = null;
      }, 4500);
    }

    function handleOnline() {
      clearReconnectingTimeout();
      setNetworkStatus(readNetworkStatus(true));
      finishReconnecting();
    }

    function handleOffline() {
      clearReconnectingTimeout();
      setNetworkStatus(readNetworkStatus(false));
    }

    function handleConnectionChange() {
      setNetworkStatus((current) => readNetworkStatus(current.kind === 'reconnecting'));
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    connection?.addEventListener?.('change', handleConnectionChange);
    setNetworkStatus(readNetworkStatus(false));

    return () => {
      clearReconnectingTimeout();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      connection?.removeEventListener?.('change', handleConnectionChange);
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
      if (reconnectingTimeoutRef.current) window.clearTimeout(reconnectingTimeoutRef.current);
    };
  }, []);


  async function subirFotoPerfil(file: File) {
    if (profilePhotoSavingRef.current) return;
    retryProfilePhotoUploadRef.current = () => void subirFotoPerfil(file);
    profilePhotoSavingRef.current = true;
    setProfilePhotoSaving(true);
    setProfilePhotoProgress(0);
    setProfilePhotoUploadError(null);
    setProfileError(null);
    setProfileMessage(null);
    try {
      const actualizado = await subirMiFotoPerfil(file, {
        onProgress: (progress) => setProfilePhotoProgress(progress.percent),
      });
      retryProfilePhotoUploadRef.current = null;
      setProfilePhotoProgress(100);
      setOperador(actualizado);
      setProfileMessage('Foto de perfil actualizada');
    } catch (err) {
      setProfilePhotoUploadError(err instanceof Error ? err.message : 'No se pudo subir la foto');
    } finally {
      profilePhotoSavingRef.current = false;
      setProfilePhotoSaving(false);
    }
  }

  async function guardarPerfil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profileSavingRef.current) return;
    const nombre = profileNombre.trim();
    if (!nombre) {
      setProfileError('El nombre no puede estar vacio');
      return;
    }

    profileSavingRef.current = true;
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
      profileSavingRef.current = false;
      setProfileSaving(false);
    }
  }

  async function guardarPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profileSavingRef.current) return;
    if (profilePassword.nueva !== profilePassword.confirmar) {
      setProfileError('La confirmacion no coincide con la nueva contraseña');
      return;
    }

    profileSavingRef.current = true;
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
      profileSavingRef.current = false;
      setProfileSaving(false);
    }
  }

  if (!operador) {
    return (
      <div className="public-home-shell">
        <main className="workspace public-home-workspace">
          <header className="toolbar public-home-toolbar">
            <button className="header-brand" type="button" title="Inicio">
              <img src={logoJireh} alt="El Jireh" />
              <span>EL JIREH</span>
            </button>
            <div className="toolbar-title">
              <h1>Inicio</h1>
              <p>Tasas activas y accesos rapidos</p>
            </div>
            <div className="toolbar-actions">
              <button className="primary-button" type="button" onClick={() => solicitarLogin()}>
                Entrar
              </button>
            </div>
          </header>
          <NetworkStatusBanner status={networkStatus} />
          <InicioPage
            onCreate={(nextServicio, draft) => solicitarLogin({ type: 'crear', servicio: nextServicio, draft: draft ?? {} })}
            onTrackPedido={(codigo) => solicitarLogin({ type: 'rastrear', codigo })}
          />
        </main>
        {loginOpen && (
          <Modal
            title="Iniciar sesion"
            subtitle="Identificate para continuar con la operacion"
            onClose={() => {
              setLoginOpen(false);
              setPendingAuthAction(null);
            }}
            className="login-modal"
            backdropClassName="login-popover-backdrop"
          >
            <LoginPage embedded onLogin={completarLogin} />
          </Modal>
        )}
      </div>
    );
  }

  const appShellClassName = [
    'app-shell',
    vista === 'bandeja' ? 'orders-view-shell' : '',
    vista === 'bandeja' && seleccionado ? 'order-detail-view-shell' : '',
  ].filter(Boolean).join(' ');
  const viewConnectivity = VIEW_CONNECTIVITY[vista];
  const viewBlockedOffline = !online && viewConnectivity.mode === 'online-required';

  return (
    <div className={appShellClassName}>
      {(copyToast || error || profileMessage || profileError) && (
        <div className="app-toast-stack" aria-live="polite">
          {copyToast && <ToastMessage kind="success" message={copyToast} onClose={cerrarCopyToast} />}
          {profileMessage && <ToastMessage kind="success" message={profileMessage} onClose={cerrarProfileMessage} />}
          {error && <ToastMessage kind="error" message={error} onClose={cerrarError} />}
          {profileError && <ToastMessage kind="error" message={profileError} onClose={cerrarProfileError} />}
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
          <button className={`ui-nav-item ${vista === 'inicio' ? 'active' : ''}`} onClick={() => navegar('inicio')}><Home size={18} /> Inicio</button>
          <button className={`ui-nav-item ${vista === 'home-test' ? 'active' : ''}`} onClick={() => navegar('home-test')}><Sparkles size={18} /> Home Test</button>
          <button className={`ui-nav-item ${vista === 'bandeja' ? 'active' : ''}`} onClick={() => navegar('bandeja')}><ClipboardList size={18} /> Pedidos</button>
          <button className={`ui-nav-item ${vista === 'reportes' ? 'active' : ''}`} onClick={() => navegar('reportes')} disabled={!puedeReportes}><BarChart3 size={18} /> Reportes</button>
          <button className={`ui-nav-item ${vista === 'admin' ? 'active' : ''}`} onClick={() => navegar('admin')} disabled={!puedeAdmin}><Settings size={18} /> Admin</button>
          {puedeAdmin && <button className={`ui-nav-item ${vista === 'setup' ? 'active' : ''}`} onClick={() => navegar('setup')}><ShieldCheck size={18} /> Configurar</button>}
          <button className={`ui-nav-item ${vista === 'perfil' ? 'active' : ''}`} onClick={() => navegar('perfil')}><UserCircle size={18} /> Perfil</button>
        </nav>
        <button className="ghost-button" onClick={cerrarSesion}>
          <LogOut size={18} /> Salir
        </button>
      </aside>

      {mobileMenuOpen && <button className="mobile-menu-backdrop" aria-label="Cerrar menu" onClick={() => setMobileMenuOpen(false)} />}

      <main
        className="workspace"
        onTouchStart={iniciarPullRefresh}
        onTouchMove={moverPullRefresh}
        onTouchEnd={finalizarPullRefresh}
        onTouchCancel={cancelarPullRefresh}
      >
        <div
          className={`pull-refresh-indicator ${pullDistance > 0 ? 'visible' : ''} ${pullRefreshing ? 'refreshing' : ''}`}
          style={{ '--pull-distance': `${pullDistance}px` } as React.CSSProperties}
          aria-live="polite"
        >
          <RefreshCw size={17} />
          <span>{pullRefreshing ? 'Actualizando...' : pullDistance >= PULL_REFRESH_THRESHOLD ? 'Suelta para actualizar' : 'Desliza para actualizar'}</span>
        </div>
        <NetworkStatusBanner status={networkStatus} />
        <OfflineQueueBanner pendingCount={offlineQueuePendingCount} syncing={offlineQueueSyncing} />
        {!online && !viewBlockedOffline && <ViewConnectivityNotice policy={viewConnectivity} />}
        <header className="toolbar">
          <button className="icon-button mobile-header-menu" onClick={() => setMobileMenuOpen(true)} title="Abrir menu" aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <button className="header-brand" onClick={() => navegar('inicio')} title="Ir al dashboard">
            <img src={logoJireh} alt="El Jireh"/>
            <span>EL JIREH</span>
          </button>
          <div className="toolbar-title">
            <h1>{vista === 'inicio' ? 'Inicio' : vista === 'home-test' ? 'Home Test' : vista === 'crear' ? 'Nuevo pedido' : vista === 'reportes' ? 'Reportes' : vista === 'admin' ? 'Administracion' : vista === 'setup' ? 'Configuracion inicial' : vista === 'perfil' ? 'Perfil' : 'Pedidos'}</h1>
            <p>{vista === 'inicio' ? 'Tasas activas y accesos rapidos' : vista === 'home-test' ? 'Nueva propuesta visual del inicio' : vista === 'crear' ? 'Registro rapido para operacion interna' : vista === 'reportes' ? 'Resumen operativo por filtros' : vista === 'admin' ? 'Catalogos operativos' : vista === 'setup' ? 'Guia para preparar una instalacion nueva' : vista === 'perfil' ? 'Datos del operador activo' : 'Seguimiento simple, familiar y movil'}</p>
          </div>
          <div className="toolbar-actions">
            <NotificationBell
              notifications={notificaciones}
              unreadCount={notificacionesSinLeer}
              soundPreferences={notificationSoundPreferences}
              onSelect={abrirNotificacion}
              onMuteKind={silenciarTipoNotificacion}
              onMarkRead={marcarNotificacionLeida}
              onDelete={eliminarNotificacion}
              onMarkAllRead={marcarTodasNotificacionesLeidas}
              onClear={limpiarNotificaciones}
            />
            <UserHeaderMenu
              operador={operador}
              darkTheme={theme !== 'light'}
              canAdmin={Boolean(puedeAdmin)}
              onThemeChange={(dark) => setTheme(dark ? 'dark-sidebar' : 'light')}
              onEditProfile={() => abrirPerfilDesdeMenu('editar')}
              onAppearance={() => navegarDesdeMenuUsuario('perfil')}
              onAdmin={() => navegarDesdeMenuUsuario('admin')}
              onSupport={() => abrirPerfilDesdeMenu('ayuda')}
              onLogout={cerrarSesion}
            />
            <button className="icon-button mobile-menu-button" onClick={() => setMobileMenuOpen(true)} title="Abrir menu">
              <Menu size={20} />
            </button>
          </div>
        </header>

        {viewBlockedOffline ? (
          <OfflineRequiredView policy={viewConnectivity} onGoHome={() => navegar('inicio')} />
        ) : vista === 'inicio' ? (
          <InicioPage key={`inicio-${viewResetToken}`} operadorId={operador.id} canSyncTasas={puedeSincronizarTasas} onCreate={abrirCrear} onTrackPedido={rastrearPedido} />
        ) : vista === 'home-test' ? (
          <HomeTestPage key={`home-test-${viewResetToken}`} operadorId={operador.id} canSyncTasas={puedeSincronizarTasas} onCreate={abrirCrear} onTrackPedido={rastrearPedido} />
        ) : vista === 'setup' ? (
          <SetupInicialPage key={`setup-${viewResetToken}`} onComplete={() => navegar('inicio')} onOpenAdmin={() => navegar('admin')} />
        ) : vista === 'admin' ? (
          <AdminCatalogosPage key={`admin-${viewResetToken}`} />
        ) : vista === 'reportes' ? (
          <ReportesPage key={`reportes-${viewResetToken}`} />
        ) : vista === 'perfil' ? (
          <ProfilePage
            key={`perfil-${viewResetToken}`}
            operador={operador}
            section={profileSection}
            nombre={profileNombre}
            password={profilePassword}
            theme={theme}
            notificationSoundPreferences={notificationSoundPreferences}
            saving={profileSaving}
            photoSaving={profilePhotoSaving}
            photoProgress={profilePhotoProgress}
            photoError={profilePhotoUploadError}
            onSectionChange={abrirPerfilSeccion}
            onNombreChange={setProfileNombre}
            onPasswordChange={setProfilePassword}
            onThemeChange={setTheme}
            onNotificationSoundChange={cambiarSonidoNotificacion}
            onPhoto={(file) => void subirFotoPerfil(file)}
            onRetryPhoto={retryProfilePhotoUploadRef.current ?? undefined}
            onSaveProfile={guardarPerfil}
            onSavePassword={guardarPassword}
            onCopyCode={() => void copiarPago(operador.codigo_operador)}
            onCopyPhone={() => void copiarPago(operador.telefono)}
            onCopyReferralCode={() => void copiarPago(operador.codigo_operador)}
            onLogout={cerrarSesion}
          />
        ) : vista === 'crear' ? (
          <CreateOrderPage key={`crear-${viewResetToken}`} service={servicioCrear} draft={crearDraft} operadorId={operador.id} onServiceChange={(service) => { setServicioCrear(service); setCrearDraft({}); }} onCreated={finalizarCreacionPedido} />
        ) : seleccionado ? (
          <PedidoDetallePanel
            codigo={seleccionado}
            pedidoInicial={pedidoSeleccionadoInicial}
            operadorId={operador.id}
            canManage={Boolean(operador.permisos.includes('pedidos:gestionar') || operador.permisos.includes('empresa:control_total'))}
            onChanged={actualizarPedidosDesdeDetalle}
            onClose={cerrarDetallePedido}
            codigosNavegacion={codigosPedidosTomadosPorMi}
            onNavigate={setSeleccionado}
          />
        ) : (
          <OrdersPage
            key={`bandeja-${viewResetToken}`}
            operador={operador}
            pedidos={pedidosFiltrados}
            lista={pedidosListaOrdenada}
            grupos={pedidosPorEstado}
            counts={pedidosConteoPorEstado}
            total={totalPedidosConteo}
            misCount={misPedidosConteo}
            todasCount={todasPedidosConteo}
            busqueda={busqueda}
            estado={estado}
            servicio={servicio}
            scope={alcancePedidos}
            period={periodoPedidos}
            view={vistaPedidos}
            loading={loading}
            clock={pedidosClock}
            canViewAll={Boolean(puedeVerTodasLasOrdenes)}
            collapsed={pedidosEstadosColapsados}
            onBusqueda={setBusqueda}
            onEstado={setEstado}
            onServicio={setServicio}
            onScope={setAlcancePedidos}
            onPeriod={setPeriodoPedidos}
            onView={setVistaPedidos}
            onRefresh={() => void cargarPedidos()}
            onToggleGroup={toggleEstadoPedido}
            onSelect={setSeleccionado}
            classNameFor={(pedido, base) => disponibilidadPedidoClass(pedido, base, false, pedidoAtrasado(pedido))}
            blockedByOther={pedidoBloqueadoPorOtro}
            ownedByMe={pedidoTomadoPorMi}
          />
        )}
      </main>
      {puedeCrear && (vista === 'inicio' || vista === 'home-test' || (vista === 'bandeja' && !seleccionado)) && (
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
        <Modal
          title="Pedido creado"
          subtitle="La operacion fue registrada correctamente"
          onClose={() => {
            setPedidoPagoModal(null);
            setPedidoCreadoUploadError(null);
            setPedidoCreadoUploadProgress(null);
            retryPedidoCreadoUploadRef.current = null;
          }}
          className="order-created-modal"
        >
          <div className="payment-instructions-modal order-created-view">
            <section className="order-created-hero">
              <span className="order-created-success-icon" aria-hidden="true">
                <CheckCircle2 size={28} />
              </span>
              <div className="order-created-hero-copy">
                <span className="order-created-eyebrow">Operacion registrada</span>
                <strong>{pedidoPagoModal.monto_pago} {pedidoPagoModal.moneda_pago}</strong>
                <small>Codigo {pedidoPagoModal.codigo_operacion}</small>
              </div>
              <span className="status pendiente_pago">Pendiente de pago</span>
            </section>

            <section className="order-created-section" aria-labelledby="order-created-payment-title">
              <header className="order-created-section-heading">
                <div>
                  <span className="order-created-section-icon"><WalletCards size={18} /></span>
                  <div>
                    <h3 id="order-created-payment-title">Datos para el pago</h3>
                    <p>Comparte estos datos con el cliente.</p>
                  </div>
                </div>
              </header>
              <div className="payment-data-grid">
                <div className="payment-data-item">
                  <span>Metodo</span>
                  <strong>{pedidoPagoModal.datos_pago?.metodo_pago ?? 'Por confirmar'}</strong>
                </div>
                <div className="payment-data-item">
                  <span>{pedidoPagoModal.datos_pago?.metodo_pago?.toLowerCase().includes('pix') ? 'Llave Pix' : 'Cuenta'}</span>
                  <button className="copy-field-button" type="button" onClick={() => void copiarPago(pedidoPagoModal.datos_pago?.cuenta_pago)}>
                    <strong>{pedidoPagoModal.datos_pago?.cuenta_pago ?? 'Por confirmar'}</strong>
                    <Copy size={16} />
                  </button>
                </div>
                <div className="payment-data-item">
                  <span>Titular</span>
                  <button className="copy-field-button" type="button" onClick={() => void copiarPago(pedidoPagoModal.datos_pago?.titular_pago)}>
                    <strong>{pedidoPagoModal.datos_pago?.titular_pago ?? 'El Jireh'}</strong>
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            </section>

            <section className="payment-already-paid">
              <span className="payment-already-paid-icon"><Upload size={20} /></span>
              <div>
                <strong>¿El cliente ya pagó?</strong>
                <small>Sube el comprobante para confirmar el pago inmediatamente.</small>
              </div>
              <button className="primary-button" type="button" onClick={seleccionarComprobantePedidoCreado} disabled={confirmandoPagoCreado}>
                {confirmandoPagoCreado ? <RefreshCw className="button-spinner" size={16} /> : <Upload size={16} />}
                {confirmandoPagoCreado ? 'Subiendo...' : 'Subir comprobante'}
              </button>
              <UploadStatus
                active={confirmandoPagoCreado}
                error={pedidoCreadoUploadError}
                progress={pedidoCreadoUploadProgress}
                label="Subiendo comprobante"
                onRetry={retryPedidoCreadoUploadRef.current ?? undefined}
              />
              <input
                ref={comprobantePedidoCreadoInputRef}
                type="file"
                accept="image/*,.pdf"
                className="visually-hidden-file"
                onChange={handleComprobantePedidoCreado}
              />
            </section>

            <section className="order-created-actions" aria-label="Acciones del pedido">
              <div className="order-created-share-actions">
                <button className="primary-button" type="button" onClick={() => abrirUrlPago(pedidoPagoModal.whatsapp_pago_url)} disabled={!pedidoPagoModal.whatsapp_pago_url}>
                  <MessageCircle size={17} /> Enviar al cliente
                </button>
                <button className="ghost-button" type="button" onClick={abrirMensajeGrupoPedido} disabled={!pedidoPagoModal.whatsapp_grupo_pedidos_url}>
                  <UsersRound size={17} /> Enviar al grupo
                </button>
              </div>
              <div className="order-created-secondary-actions">
                <button className="ghost-button" type="button" onClick={() => void copiarPago(pedidoPagoModal.mensaje_pago_cliente)}>
                  <Copy size={16} /> Copiar mensaje
                </button>
                <button className="ghost-button" type="button" onClick={verPedidoCreado}>
                  <ClipboardList size={16} /> Ver pedido
                </button>
              </div>
            </section>
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
            <button className="primary-button" type="button" onClick={continuarPedidoConfirmado}>
              Continuar pedido
            </button>
          </div>
        </Modal>
      )}
      <nav className={`bottom-nav${puedeAdmin ? ' has-admin' : ''}`} aria-label="Navegacion principal">
        <button className={vista === 'inicio' ? 'active' : ''} onClick={() => navegar('inicio')}><Home size={20} /> Inicio</button>
        <button className={vista === 'bandeja' ? 'active' : ''} onClick={() => navegar('bandeja')}><ClipboardList size={20} /> Pedidos</button>
        <button className={vista === 'reportes' ? 'active' : ''} onClick={() => navegar('reportes')} disabled={!puedeReportes}><BarChart3 size={20} /> Reportes</button>
        {puedeAdmin && <button className={vista === 'admin' ? 'active' : ''} onClick={() => navegar('admin')}><Settings size={20} /> Admin</button>}
        <button className={vista === 'perfil' ? 'active' : ''} onClick={() => navegar('perfil')}><UserCircle size={20} /> Perfil</button>
      </nav>
    </div>
  );
}
