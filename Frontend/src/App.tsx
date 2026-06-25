import { lazy, type ChangeEvent, type FormEvent, type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, BarChart3, BriefcaseBusiness, CheckCircle2, ClipboardList, Copy, Home, LogOut, Menu, MessageCircle, Plus, RefreshCw, Settings, ShieldCheck, Smartphone, Sparkles, Upload, UserCircle, UsersRound, WalletCards, WifiOff, X } from 'lucide-react';
import { actualizarEstado, actualizarMiPerfil, cambiarMiPassword, clearToken, getMe, getToken, listarPedidos, obtenerEstadoConfiguracionInicial, subirArchivo, subirMiFotoPerfil } from './api/client';
import type { Operador, PedidoDetalle, PedidoResumen } from './types/api';
import { LoginPage } from './pages/LoginPage';
import { Modal } from './components/Modal';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { UserHeaderMenu } from './components/UserHeaderMenu';
import { ERROR_TOAST_DURATION_MS, INFO_TOAST_DURATION_MS, PROFILE_TOAST_DURATION_MS, ToastMessage } from './components/FloatingToast';
import { NotificationBell, defaultNotificationSoundPreferences, notificationKindLabels, type AppNotification, type AppNotificationKind, type NotificationSoundPreferences } from './components/NotificationBell';
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
type PeriodoPedidos = 'hoy' | '7_dias' | 'mes' | 'todos';
type ServicioCrear = 'transferencia' | 'efectivo' | 'saldo' | 'divisa' | 'otros';
type AppView = 'inicio' | 'home-test' | 'bandeja' | 'crear' | 'reportes' | 'admin' | 'setup' | 'perfil';
type PendingAuthAction =
  | { type: 'crear'; servicio: ServicioCrear; draft: CrearPedidoDraft }
  | { type: 'rastrear'; codigo: string }
  | null;

const THEME_KEY = 'jireh.theme';
const VIEW_KEY = 'jireh.view';
const APP_VIEWS = new Set<AppView>(['inicio', 'home-test', 'bandeja', 'crear', 'reportes', 'admin', 'setup', 'perfil']);
const estadosBandeja = estados.filter((item) => item.value);
const PULL_REFRESH_THRESHOLD = 64;
const EXIT_BACK_WINDOW_MS = 2000;
const NOTIFICATION_LIMIT = 50;
const ORDER_DELAY_MINUTES = 10;

type WebAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function vistaGuardada(): AppView {
  if (typeof sessionStorage === 'undefined') return 'inicio';
  const saved = sessionStorage.getItem(VIEW_KEY) as AppView | null;
  return saved && APP_VIEWS.has(saved) ? saved : 'inicio';
}

function intervaloRefrescoPedidos() {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  }).connection;

  if (connection?.saveData || connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') {
    return 60000;
  }
  return 30000;
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

function notificationStorageKey(operadorId: number) {
  return `jireh.notifications.${operadorId}`;
}

function notificationPreferencesStorageKey(operadorId: number) {
  return `jireh.notificationPreferences.${operadorId}`;
}

function normalizeNotificationPreferences(value: unknown): NotificationSoundPreferences {
  return {
    ...defaultNotificationSoundPreferences,
    ...(value && typeof value === 'object' ? value as Partial<NotificationSoundPreferences> : {}),
  };
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

function parseBackendTime(value?: string | null) {
  if (!value) return Number.NaN;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  return Date.parse(normalized);
}

export function App() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof localStorage === 'undefined') return 'dark-sidebar';
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light') return 'light';
    if (saved === 'dark-deep' || saved === 'dark-sidebar') return 'dark-sidebar';
    if (saved === 'dark' || saved === 'dark-vscode' || saved === 'dark-pro') return 'dark-sidebar';
    return 'dark-sidebar';
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
  const [vistaPedidos, setVistaPedidos] = useState<'lista' | 'kanban'>('kanban');
  const [servicioCrear, setServicioCrear] = useState<ServicioCrear>('transferencia');
  const [crearDraft, setCrearDraft] = useState<CrearPedidoDraft>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
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
  const copyToastTimeoutRef = useRef<number | null>(null);
  const comprobantePedidoCreadoInputRef = useRef<HTMLInputElement | null>(null);
  const profileMessageTimeoutRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const profileErrorTimeoutRef = useRef<number | null>(null);
  const pullStartRef = useRef<{ x: number; y: number } | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [notificaciones, setNotificaciones] = useState<AppNotification[]>([]);
  const [notificationSoundPreferences, setNotificationSoundPreferences] = useState<NotificationSoundPreferences>(defaultNotificationSoundPreferences);
  const historyViewRef = useRef<AppView>(vista);
  const handlingPopStateRef = useRef(false);
  const lastExitBackRef = useRef(0);
  const notificationAudioContextRef = useRef<AudioContext | null>(null);
  const notificacionesRef = useRef<AppNotification[]>([]);
  const notificationSnapshotReadyRef = useRef(false);
  const knownPedidoCodesRef = useRef<Set<string>>(new Set());
  const knownTransferKeysRef = useRef<Map<string, string>>(new Map());
  const delayedNotificationCodesRef = useRef<Set<string>>(new Set());

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

    const currentIds = new Set(notificacionesRef.current.map((item) => item.id));
    const incoming = items.filter((item) => !currentIds.has(item.id));
    const shouldPlaySound = incoming.some((item) => notificationSoundPreferences[item.kind] !== false);
    setNotificaciones((current) => {
      const ids = new Set(current.map((item) => item.id));
      const nuevas = items.filter((item) => !ids.has(item.id));
      if (!nuevas.length) return current;
      return [...nuevas, ...current].slice(0, NOTIFICATION_LIMIT);
    });
    if (shouldPlaySound) reproducirSonidoNotificacion();
  }, [notificationSoundPreferences, reproducirSonidoNotificacion]);

  const revisarNotificacionesPedidos = useCallback((data: PedidoResumen[]) => {
    if (!operador) return;

    const nextCodes = new Set<string>();
    const nextTransferKeys = new Map<string, string>();
    const nuevas: AppNotification[] = [];
    const now = Date.now();

    for (const pedido of data) {
      const codigo = pedido.codigo_operacion;
      const disponibleParaNotificar = pedidoDisponibleParaNotificacion(pedido);
      if (disponibleParaNotificar) nextCodes.add(codigo);

      const transferKey = pedido.redirigido_a_operador_id
        ? `${pedido.redirigido_a_operador_id}:${pedido.redirigido_por_operador_id ?? ''}:${pedido.redirigido_en ?? ''}`
        : '';
      if (transferKey) nextTransferKeys.set(codigo, transferKey);

      const createdAt = parseBackendTime(pedido.created_at);
      const confirmedAt = Number.isNaN(parseBackendTime(pedido.fecha_pago_confirmado)) ? createdAt : parseBackendTime(pedido.fecha_pago_confirmado);
      const transferAt = Number.isNaN(parseBackendTime(pedido.redirigido_en)) ? now : parseBackendTime(pedido.redirigido_en);
      const confirmadoReciente = Number.isNaN(confirmedAt) || now - confirmedAt <= 30 * 60 * 1000;
      const transferidoReciente = Number.isNaN(transferAt) || now - transferAt <= 30 * 60 * 1000;
      const transferidoAMi = pedido.redirigido_a_operador_id === operador.id;
      const estaAtrasado = disponibleParaNotificar
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
    guardarMonedaPedidoPreferida(draft.moneda_pago);
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
    sessionStorage.removeItem('jireh.adminTema');
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
    setAlcancePedidos('mis');
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
    setNotificaciones((current) => current.filter((item) => item.id !== id));
  }

  function limpiarNotificaciones() {
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
      if (!pedidoActual || !pedidoDisponibleParaNotificacion(pedidoActual)) return;
      setSeleccionado(notificacion.codigo);
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
      revisarNotificacionesPedidos(data);
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
  }, [alcancePedidos, aplicarPedidosPorAlcance, puedeVerTodasLasOrdenes, periodoPedidos, revisarNotificacionesPedidos]);

  const refrescarPedidosSilencioso = useCallback(async () => {
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
    } catch {
      // El refresco silencioso no debe interrumpir al operador si falla una vuelta.
    }
  }, [aplicarPedidosPorAlcance, puedeVerTodasLasOrdenes, periodoPedidos, revisarNotificacionesPedidos]);

  useEffect(() => {
    if (!puedeVerTodasLasOrdenes && alcancePedidos === 'todas') {
      setAlcancePedidos('mis');
    }
  }, [alcancePedidos, puedeVerTodasLasOrdenes]);


  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    sessionStorage.setItem(VIEW_KEY, vista);
  }, [vista]);

  useEffect(() => {
    const mobileBreakpoint = window.matchMedia('(max-width: 920px)');
    const closeMenuOnBreakpointChange = () => setMobileMenuOpen(false);

    mobileBreakpoint.addEventListener('change', closeMenuOnBreakpointChange);
    return () => mobileBreakpoint.removeEventListener('change', closeMenuOnBreakpointChange);
  }, []);

  useEffect(() => {
    const initialView = historyViewRef.current;
    window.history.replaceState({ ...window.history.state, jirehExitGuard: true }, '');
    window.history.pushState({ jirehView: initialView }, '');

    function handlePopState(event: PopStateEvent) {
      const state = event.state as { jirehView?: AppView; jirehExitGuard?: boolean } | null;
      const historyView = state?.jirehView;

      if (historyView && APP_VIEWS.has(historyView)) {
        handlingPopStateRef.current = true;
        historyViewRef.current = historyView;
        setVista(historyView);
        setMobileMenuOpen(false);
        setQuickCreateOpen(false);
        return;
      }

      if (!state?.jirehExitGuard) return;

      if (historyViewRef.current !== 'inicio') {
        lastExitBackRef.current = 0;
        handlingPopStateRef.current = true;
        historyViewRef.current = 'inicio';
        window.history.pushState({ jirehView: 'inicio' }, '');
        setVista('inicio');
        setMobileMenuOpen(false);
        setQuickCreateOpen(false);
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
    if (!operador) {
      setNotificaciones([]);
      setNotificationSoundPreferences(defaultNotificationSoundPreferences);
      notificacionesRef.current = [];
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

    try {
      const saved = localStorage.getItem(notificationStorageKey(operador.id));
      const parsed = saved ? JSON.parse(saved) : [];
      setNotificaciones(Array.isArray(parsed) ? parsed.slice(0, NOTIFICATION_LIMIT) : []);
    } catch {
      setNotificaciones([]);
    }

    try {
      const savedPreferences = localStorage.getItem(notificationPreferencesStorageKey(operador.id));
      setNotificationSoundPreferences(normalizeNotificationPreferences(savedPreferences ? JSON.parse(savedPreferences) : null));
    } catch {
      setNotificationSoundPreferences(defaultNotificationSoundPreferences);
    }
  }, [operador]);

  useEffect(() => {
    notificacionesRef.current = notificaciones;
    if (!operador) return;
    localStorage.setItem(notificationStorageKey(operador.id), JSON.stringify(notificaciones.slice(0, NOTIFICATION_LIMIT)));
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
    if (!operador || !online) return undefined;
    const interval = window.setInterval(() => {
      void refrescarPedidosSilencioso();
    }, intervaloRefrescoPedidos());
    return () => window.clearInterval(interval);
  }, [online, operador, refrescarPedidosSilencioso]);

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
    if (!operador) return;
    setProfileNombre(operador.nombre);
  }, [operador]);

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

        {vista === 'inicio' ? (
          <InicioPage canSyncTasas={puedeSincronizarTasas} onCreate={abrirCrear} onTrackPedido={rastrearPedido} />
        ) : vista === 'home-test' ? (
          <HomeTestPage canSyncTasas={puedeSincronizarTasas} onCreate={abrirCrear} onTrackPedido={rastrearPedido} />
        ) : vista === 'setup' ? (
          <SetupInicialPage onComplete={() => navegar('inicio')} onOpenAdmin={() => navegar('admin')} />
        ) : vista === 'admin' ? (
          <AdminCatalogosPage />
        ) : vista === 'reportes' ? (
          <ReportesPage />
        ) : vista === 'perfil' ? (
          <ProfilePage
            operador={operador}
            section={profileSection}
            nombre={profileNombre}
            password={profilePassword}
            theme={theme}
            notificationSoundPreferences={notificationSoundPreferences}
            saving={profileSaving}
            photoSaving={profilePhotoSaving}
            onSectionChange={abrirPerfilSeccion}
            onNombreChange={setProfileNombre}
            onPasswordChange={setProfilePassword}
            onThemeChange={setTheme}
            onNotificationSoundChange={cambiarSonidoNotificacion}
            onPhoto={(file) => void subirFotoPerfil(file)}
            onSaveProfile={guardarPerfil}
            onSavePassword={guardarPassword}
            onCopyCode={() => void copiarPago(operador.codigo_operador)}
            onCopyPhone={() => void copiarPago(operador.telefono)}
            onCopyReferralCode={() => void copiarPago(operador.codigo_operador)}
            onLogout={cerrarSesion}
          />
        ) : vista === 'crear' ? (
          <CreateOrderPage service={servicioCrear} draft={crearDraft} operadorId={operador.id} onServiceChange={(service) => { setServicioCrear(service); setCrearDraft({}); }} onCreated={finalizarCreacionPedido} />
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
          onClose={() => setPedidoPagoModal(null)}
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
