import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, BarChart3, BriefcaseBusiness, ChevronDown, CircleDot, ClipboardList, Copy, Edit3, HelpCircle, Home, KeyRound, LayoutGrid, LayoutList, LogOut, Menu, Palette, Percent, Plus, RefreshCw, Search, Settings, ShieldCheck, Smartphone, UserCircle, WalletCards, WifiOff, X } from 'lucide-react';
import { actualizarMiPerfil, apiAssetUrl, cambiarMiPassword, clearToken, getMe, getToken, listarPedidos, subirMiFotoPerfil } from './api/client';
import type { Operador, PedidoResumen } from './types/api';
import { LoginPage } from './pages/LoginPage';
import { PedidoDetallePanel } from './pages/PedidoDetallePanel';
import { DivisaForm } from './pages/DivisaForm';
import { EfectivoForm } from './pages/EfectivoForm';
import { SaldoForm } from './pages/SaldoForm';
import { TransferenciaForm } from './pages/TransferenciaForm';
import { ReportesPage } from './pages/ReportesPage';
import { AdminCatalogosPage } from './pages/AdminCatalogosPage';
import { InicioPage } from './pages/InicioPage';
import { PageLoader } from './components/PageLoader';
import { PasswordField } from './components/PasswordField';
import { FloatingSelect } from './components/FloatingSelect';
import logoJireh from './assets/brand/logo-jireh.jpeg';

const estados = [
  { value: '', label: 'Estado' },
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pago_confirmado', label: 'Pago confirmado' },
  { value: 'en_operacion', label: 'En operacion' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const servicios = [
  { value: '', label: 'Servicio' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'saldo', label: 'Saldo' },
  { value: 'divisa', label: 'Divisa' },
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

const THEME_KEY = 'jireh.theme';
const DARK_THEME_OPTIONS: Array<{ value: Exclude<AppTheme, 'light'>; label: string }> = [
  { value: 'dark-sidebar', label: 'Oscuro menu' },
  { value: 'dark-deep', label: 'Oscuro profundo' },
];

const estadosBandeja = estados.filter((item) => item.value);

function estadoLabel(value: string) {
  return estados.find((item) => item.value === value)?.label ?? value.replaceAll('_', ' ');
}

function servicioIcon(value: string, size = 18) {
  if (value === 'transferencia') return <WalletCards size={size} />;
  if (value === 'efectivo') return <Banknote size={size} />;
  if (value === 'saldo') return <Smartphone size={size} />;
  if (value === 'divisa') return <WalletCards size={size} />;
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

function detalleValor(pedido: PedidoResumen, key: string) {
  const value = pedido.detalle?.[key];
  if (value === null || value === undefined || value === '') return null;
  return String(value);
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
      { label: 'Documento', value: detalleValor(pedido, 'documento_identidad_url') },
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
      { label: 'Monto divisa', value: detalleValor(pedido, 'monto_divisa') ?? String(pedido.monto_resultado) },
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

function minutosDesde(value?: string | null, nowMs = Date.now()) {
  if (!value) return null;
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return null;
  return Math.max(0, Math.floor((nowMs - fecha.getTime()) / 60000));
}

function pedidoEnOperacionRetrasado(pedido: PedidoResumen, nowMs: number) {
  if (pedido.estado !== 'en_operacion') return false;
  const minutos = minutosDesde(pedido.fecha_en_operacion ?? pedido.asignado_en ?? pedido.updated_at ?? pedido.created_at, nowMs);
  return minutos !== null && minutos >= 10;
}

function tiempoEnOperacionLabel(pedido: PedidoResumen, nowMs: number) {
  if (pedido.estado !== 'en_operacion') return null;
  const base = pedido.fecha_en_operacion ?? pedido.asignado_en ?? pedido.updated_at ?? pedido.created_at;
  const minutos = minutosDesde(base, nowMs);
  if (minutos === null) return null;
  return `${minutos} min en operacion`;
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
  const [estado, setEstado] = useState('');
  const [servicio, setServicio] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [vista, setVista] = useState<'inicio' | 'bandeja' | 'crear' | 'reportes' | 'admin' | 'perfil'>('inicio');
  const [vistaPedidos, setVistaPedidos] = useState<'lista' | 'kanban'>('kanban');
  const [servicioCrear, setServicioCrear] = useState<'transferencia' | 'efectivo' | 'saldo' | 'divisa'>('transferencia');
  const [crearDraft, setCrearDraft] = useState<CrearPedidoDraft>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pedidosClock, setPedidosClock] = useState(() => Date.now());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [pedidosEstadosColapsados, setPedidosEstadosColapsados] = useState<Set<string>>(() => new Set());
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

  const puedeCrear = useMemo(
    () => operador?.permisos.includes('pedidos:crear') || operador?.permisos.includes('pedidos:gestionar') || operador?.permisos.includes('empresa:control_total'),
    [operador],
  );

  const puedeReportes = useMemo(
    () => operador?.permisos.includes('pedidos:gestionar') || operador?.permisos.includes('empresa:control_total'),
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
      if (estado && pedido.estado !== estado) return false;
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
      counts.set(pedido.estado, (counts.get(pedido.estado) ?? 0) + 1);
    }

    return counts;
  }, [busqueda, pedidos, servicio]);

  const totalPedidosConteo = useMemo(() => {
    return Array.from(pedidosConteoPorEstado.values()).reduce((total, count) => total + count, 0);
  }, [pedidosConteoPorEstado]);

  const pedidosPorEstado = useMemo(() => {
    return estadosBandeja
      .filter((item) => !estado || item.value === estado)
      .map((item, index) => ({
        ...item,
        orden: index,
        pedidos: pedidosFiltrados.filter((pedido) => pedido.estado === item.value),
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

  function abrirCrear(servicio: 'transferencia' | 'efectivo' | 'saldo' | 'divisa', draft: CrearPedidoDraft = {}) {
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
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setQuickCreateOpen(false);
  }

  async function cargarPedidos() {
    setLoading(true);
    setError(null);
    try {
      setPedidos(await listarPedidos({ limit: 200 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!getToken()) return;
    getMe()
      .then(setOperador)
      .catch(() => {
        clearToken();
        setOperador(null);
      });
  }, []);

  useEffect(() => {
    if (operador) void cargarPedidos();
  }, [operador]);

  useEffect(() => {
    const interval = window.setInterval(() => setPedidosClock(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);


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

  return (
    <div className="app-shell">
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
            <h1>{vista === 'inicio' ? 'Inicio' : vista === 'crear' ? 'Nuevo pedido' : vista === 'reportes' ? 'Reportes' : vista === 'admin' ? 'Administracion' : vista === 'perfil' ? 'Perfil' : 'Pedidos'}</h1>
            <p>{vista === 'inicio' ? 'Tasas activas y accesos rapidos' : vista === 'crear' ? 'Registro rapido para operacion interna' : vista === 'reportes' ? 'Resumen operativo por filtros' : vista === 'admin' ? 'Catalogos operativos' : vista === 'perfil' ? 'Datos del operador activo' : 'Seguimiento simple, familiar y movil'}</p>
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
                      <Settings size={18} /> Configuracion
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
        ) : vista === 'admin' ? (
          <AdminCatalogosPage />
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
                <button className="icon-button" onClick={() => navigator.clipboard.writeText(operador.codigo_operador)} title="Copiar codigo" aria-label="Copiar codigo"><Copy size={18} /></button>
              </div>
            </div>

            {(profileMessage || profileError) && (
              <div className={profileError ? 'profile-feedback error' : 'profile-feedback success'}>
                {profileError || profileMessage}
              </div>
            )}

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
                    <a className="support-whatsapp-link support-whatsapp-link-br" href="https://wa.me/554891233191?text=Ayuda" target="_blank" rel="noreferrer">
                      <WhatsAppIcon />
                      <span>
                        <strong>Brasil</strong>
                        <small>+55 48 9123-3191</small>
                      </span>
                    </a>
                    <a className="support-whatsapp-link support-whatsapp-link-uy" href="https://wa.me/59894207862?text=Ayuda" target="_blank" rel="noreferrer">
                      <WhatsAppIcon />
                      <span>
                        <strong>Uruguay</strong>
                        <small>+598 94 207 862</small>
                      </span>
                    </a>
                  </div>
                  <div className="profile-support-panel profile-support-panel-list">
                    <a className="support-whatsapp-link support-whatsapp-link-br" href="https://wa.me/554891233191?text=Ayuda" target="_blank" rel="noreferrer">
                      <WhatsAppIcon />
                      <span>
                        <strong>Soporte Brasil</strong>
                        <small>+55 48 9123-3191</small>
                      </span>
                    </a>
                    <a className="support-whatsapp-link support-whatsapp-link-uy" href="https://wa.me/59894207862?text=Ayuda" target="_blank" rel="noreferrer">
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
            </div>
            {servicioCrear === 'transferencia' && (
              <TransferenciaForm operadorId={operador.id} initialData={crearDraft} onCreated={(codigo) => { setSeleccionado(codigo); setVista('bandeja'); void cargarPedidos(); }} />
            )}
            {servicioCrear === 'efectivo' && (
              <EfectivoForm operadorId={operador.id} initialData={crearDraft} onCreated={(codigo) => { setSeleccionado(codigo); setVista('bandeja'); void cargarPedidos(); }} />
            )}
            {servicioCrear === 'saldo' && (
              <SaldoForm operadorId={operador.id} initialData={crearDraft} onCreated={(codigo) => { setSeleccionado(codigo); setVista('bandeja'); void cargarPedidos(); }} />
            )}
            {servicioCrear === 'divisa' && (
              <DivisaForm operadorId={operador.id} initialData={crearDraft} onCreated={(codigo) => { setSeleccionado(codigo); setVista('bandeja'); void cargarPedidos(); }} />
            )}
          </section>
        ) : (
          <>
            <section className="content-grid orders-content-grid">
              <div className="list-panel orders-list-panel">
                <div className="filters orders-toolbar-row">
                  <label className="search-box orders-search-box">
                    <Search size={18} />
                    <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar codigo, tarjeta o telefono" />
                  </label>
                </div>
                <div className="orders-filter-grid" aria-label="Filtros de pedidos">
                  <div className="order-filter-field order-filter-floating">
                    <FloatingSelect
                      value={servicio}
                      onChange={setServicio}
                      options={servicios.map((item) => ({
                        value: item.value,
                        label: item.value ? item.label : 'Todos los servicios',
                        icon: servicioIcon(item.value, 17),
                      }))}
                      ariaLabel="Filtrar por servicio"
                      align="left"
                      buttonClassName="order-filter-button"
                    />
                  </div>
                  <div className="order-filter-field order-filter-floating">
                    <FloatingSelect
                      value={estado}
                      onChange={setEstado}
                      options={estados.map((item) => ({
                        value: item.value,
                        label: item.value ? item.label : 'Todos los estados',
                        icon: <CircleDot size={17} />,
                      }))}
                      ariaLabel="Filtrar por estado"
                      align="left"
                      buttonClassName="order-filter-button"
                    />
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
                {error && <div className="notice error">{error}</div>}
                {loading && <PageLoader label="Cargando pedidos" inline />}
                {pedidosFiltrados.length === 0 && !loading && <div className="notice">No hay pedidos para estos filtros</div>}
                <div className="orders-view-mode-row">
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
                {vistaPedidos === 'lista' ? (
                  <div className="chat-order-list">
                    {pedidosListaOrdenada.map((pedido) => {
                      const retrasado = pedidoEnOperacionRetrasado(pedido, pedidosClock);
                      const tiempoOperacion = tiempoEnOperacionLabel(pedido, pedidosClock);
                      return (
                      <button
                        key={pedido.codigo_operacion}
                        className={[seleccionado === pedido.codigo_operacion ? 'chat-order-card selected' : 'chat-order-card', retrasado ? 'order-delayed' : ''].filter(Boolean).join(' ')}
                        onClick={() => setSeleccionado(pedido.codigo_operacion)}
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
                          {tiempoOperacion && <small className={retrasado ? 'order-delay-chip delayed' : 'order-delay-chip'}>{retrasado ? 'Retrasado' : tiempoOperacion}</small>}
                          {pedido.redirigido_a_operador_id && <small className={pedido.redirigido_a_operador_id === operador.id ? 'order-redirect-chip own' : 'order-redirect-chip'}>Para {pedido.redirigido_a_operador_nombre ?? 'operador'}</small>}
                          {pedido.lock_activo && <small className="order-taken-chip">Tomada por {pedido.operador_asignado_nombre ?? 'operador'}</small>}
                          <strong>{pedido.monto_pago} {pedido.moneda_pago}</strong>
                          <small>Recibe {pedido.monto_resultado}</small>
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
                            const retrasado = pedidoEnOperacionRetrasado(pedido, pedidosClock);
                            const tiempoOperacion = tiempoEnOperacionLabel(pedido, pedidosClock);
                            return (
                            <button
                              key={pedido.codigo_operacion}
                              className={[seleccionado === pedido.codigo_operacion ? 'pedido-row selected' : 'pedido-row', retrasado ? 'order-delayed' : ''].filter(Boolean).join(' ')}
                              onClick={() => setSeleccionado(pedido.codigo_operacion)}
                            >
                              <span className="kanban-card-top">
                                <span className="pedido-card-head">
                                  <strong>{pedido.servicio}</strong>
                                  <small>{pedido.codigo_operacion} {tiempoRelativo(pedido.created_at, pedidosClock) ? `- ${tiempoRelativo(pedido.created_at, pedidosClock)}` : ''}</small>
                                  {tiempoOperacion && <small className={retrasado ? 'order-delay-chip delayed inline' : 'order-delay-chip inline'}>{retrasado ? `Retrasado · ${tiempoOperacion}` : tiempoOperacion}</small>}
                                  {pedido.redirigido_a_operador_id && <small className={pedido.redirigido_a_operador_id === operador.id ? 'order-redirect-chip own inline' : 'order-redirect-chip inline'}>Para {pedido.redirigido_a_operador_nombre ?? 'operador'}</small>}
                                  {pedido.lock_activo && <small className="order-taken-chip inline">Tomada por {pedido.operador_asignado_nombre ?? 'operador'}</small>}
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
                                <small>Recibe {pedido.monto_resultado}</small>
                                <small>Tasa {pedido.tasa_final}</small>
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
            <PedidoDetallePanel codigo={seleccionado} operadorId={operador.id} onChanged={cargarPedidos} onClose={() => setSeleccionado(null)} />
          </>
        )}
      </main>
      {puedeCrear && (vista === 'inicio' || vista === 'bandeja') && (
        <div className={quickCreateOpen ? 'floating-create-wrap open' : 'floating-create-wrap'}>
          {quickCreateOpen && <button className="floating-create-backdrop" aria-label="Cerrar menu de creacion" onClick={() => setQuickCreateOpen(false)} />}
          {quickCreateOpen && (
            <div className="floating-create-menu" role="menu" aria-label="Crear pedido">
              <button type="button" role="menuitem" onClick={() => abrirCrear('transferencia')}><WalletCards size={18} /> Transferenciaaa</button>
              <button type="button" role="menuitem" onClick={() => abrirCrear('efectivo')}><Banknote size={18} /> Efectivo</button>
              <button type="button" role="menuitem" onClick={() => abrirCrear('saldo')}><Smartphone size={18} /> Saldo</button>
              <button type="button" role="menuitem" onClick={() => abrirCrear('divisa')}><WalletCards size={18} /> Divisa</button>
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
      <nav className="bottom-nav" aria-label="Navegacion principal">
        <button className={vista === 'inicio' ? 'active' : ''} onClick={() => navegar('inicio')}><Home size={20} /> Inicio</button>
        <button className={vista === 'bandeja' ? 'active' : ''} onClick={() => navegar('bandeja')}><ClipboardList size={20} /> Pedidos</button>
        <button className={vista === 'reportes' ? 'active' : ''} onClick={() => navegar('reportes')} disabled={!puedeReportes}><BarChart3 size={20} /> Reportes</button>
        <button className={vista === 'perfil' ? 'active' : ''} onClick={() => navegar('perfil')}><UserCircle size={20} /> Perfil</button>
      </nav>
    </div>
  );
}
