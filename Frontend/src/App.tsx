import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, Columns3, Home, LayoutList, LogOut, Menu, Plus, RefreshCw, Search, Settings, UserCircle, WifiOff, X } from 'lucide-react';
import { clearToken, getMe, getToken, listarPedidos } from './api/client';
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
import logoJireh from './assets/brand/logo-jireh.jpeg';

const estados = [
  { value: '', label: 'Todos' },
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pago_confirmado', label: 'Pago confirmado' },
  { value: 'en_operacion', label: 'En operacion' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const servicios = [
  { value: '', label: 'Todos los servicios' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'saldo', label: 'Saldo' },
  { value: 'divisa', label: 'Divisa' },
];

const estadosBandeja = estados.filter((item) => item.value);

function estadoLabel(value: string) {
  return estados.find((item) => item.value === value)?.label ?? value.replaceAll('_', ' ');
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

function tiempoRelativo(value?: string) {
  if (!value) return null;
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return null;

  const diffMs = Date.now() - fecha.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return 'hace instantes';
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `hace ${diffHoras} h`;

  const diffDias = Math.floor(diffHoras / 24);
  return `hace ${diffDias} d`;
}

export function App() {
  const [operador, setOperador] = useState<Operador | null>(null);
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [estado, setEstado] = useState('');
  const [servicio, setServicio] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [vista, setVista] = useState<'inicio' | 'bandeja' | 'crear' | 'reportes' | 'admin' | 'perfil'>('inicio');
  const [vistaPedidos, setVistaPedidos] = useState<'lista' | 'kanban'>('lista');
  const [servicioCrear, setServicioCrear] = useState<'transferencia' | 'efectivo' | 'saldo' | 'divisa'>('transferencia');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const pedidosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return pedidos;

    return pedidos.filter((pedido) => {
      const detalle = pedido.detalle ? Object.values(pedido.detalle).join(' ') : '';
      return [
        pedido.codigo_operacion,
        pedido.servicio,
        pedido.estado,
        pedido.moneda_pago,
        detalle,
      ].join(' ').toLowerCase().includes(term);
    });
  }, [busqueda, pedidos]);

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

  function navegar(nextVista: typeof vista) {
    setVista(nextVista);
    setMobileMenuOpen(false);
  }

  function abrirCrear(servicio: 'transferencia' | 'efectivo' | 'saldo' | 'divisa') {
    setServicioCrear(servicio);
    setVista('crear');
    setMobileMenuOpen(false);
  }

  async function cargarPedidos() {
    setLoading(true);
    setError(null);
    try {
      setPedidos(await listarPedidos({ estado: estado || undefined, servicio: servicio || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  }

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
  }, [operador, estado, servicio]);

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
          <button className={vista === 'crear' ? 'active' : ''} onClick={() => abrirCrear(servicioCrear)} disabled={!puedeCrear}><Plus size={18} /> Crear</button>
          <button className={vista === 'reportes' ? 'active' : ''} onClick={() => navegar('reportes')} disabled={!puedeReportes}><BarChart3 size={18} /> Reportes</button>
          <button className={vista === 'admin' ? 'active' : ''} onClick={() => navegar('admin')} disabled={!puedeAdmin}><Settings size={18} /> Admin</button>
          <button className={vista === 'perfil' ? 'active' : ''} onClick={() => navegar('perfil')}><UserCircle size={18} /> Perfil</button>
        </nav>
        <button className="ghost-button" onClick={() => { clearToken(); setOperador(null); setMobileMenuOpen(false); }}>
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
          <button className="header-brand" onClick={() => navegar('inicio')} title="Ir al dashboard">
            <img src={logoJireh} alt="El Jireh"/>
            <span>EL JIREH</span>
          </button>
          <div className="toolbar-title">
            <h1>{vista === 'inicio' ? 'Inicio' : vista === 'crear' ? 'Nuevo pedido' : vista === 'reportes' ? 'Reportes' : vista === 'admin' ? 'Administracion' : vista === 'perfil' ? 'Perfil' : 'Bandeja de pedidos'}</h1>
            <p>{vista === 'inicio' ? 'Tasas activas y accesos rapidos' : vista === 'crear' ? 'Registro rapido para operacion interna' : vista === 'reportes' ? 'Resumen operativo por filtros' : vista === 'admin' ? 'Catalogos operativos' : vista === 'perfil' ? 'Datos del operador activo' : 'Seguimiento simple, familiar y movil'}</p>
          </div>
          <div className="toolbar-actions">
            {vista === 'bandeja' && (
              <button className="icon-button" onClick={cargarPedidos} title="Actualizar pedidos">
                <RefreshCw size={18} />
              </button>
            )}
            <button className="icon-button mobile-menu-button" onClick={() => setMobileMenuOpen(true)} title="Abrir menu">
              <Menu size={20} />
            </button>
          </div>
          {(vista === 'crear' || vista === 'reportes' || vista === 'admin' || vista === 'perfil') && (
            <button className="primary-button toolbar-back-button" onClick={() => navegar('bandeja')}>
              Ver pedidos
            </button>
          )}
        </header>

        {vista === 'inicio' ? (
          <InicioPage onCreate={abrirCrear} />
        ) : vista === 'admin' ? (
          <AdminCatalogosPage />
        ) : vista === 'reportes' ? (
          <ReportesPage />
        ) : vista === 'perfil' ? (
          <section className="profile-panel">
            <div className="profile-avatar"><UserCircle size={34} /></div>
            <div>
              <h2>{operador.nombre}</h2>
              <p>{operador.telefono}</p>
            </div>
            <dl className="profile-data">
              <div><dt>Codigo</dt><dd>{operador.codigo_operador}</dd></div>
              <div><dt>Rol</dt><dd>{operador.rol}</dd></div>
              <div><dt>Estado</dt><dd>{operador.activo ? 'Activo' : 'Inactivo'}</dd></div>
            </dl>
            <button className="ghost-button danger-action" onClick={() => { clearToken(); setOperador(null); }}>
              <LogOut size={18} /> Salir
            </button>
          </section>
        ) : vista === 'crear' ? (
          <section className="create-stack">
            <div className="service-tabs">
              <button
                type="button"
                className={servicioCrear === 'transferencia' ? 'active' : ''}
                onClick={() => setServicioCrear('transferencia')}
              >
                Transferencia
              </button>
              <button
                type="button"
                className={servicioCrear === 'efectivo' ? 'active' : ''}
                onClick={() => setServicioCrear('efectivo')}
              >
                Efectivo
              </button>
              <button
                type="button"
                className={servicioCrear === 'saldo' ? 'active' : ''}
                onClick={() => setServicioCrear('saldo')}
              >
                Saldo
              </button>
              <button
                type="button"
                className={servicioCrear === 'divisa' ? 'active' : ''}
                onClick={() => setServicioCrear('divisa')}
              >
                Divisa
              </button>
            </div>
            {servicioCrear === 'transferencia' && (
              <TransferenciaForm operadorId={operador.id} onCreated={(codigo) => { setSeleccionado(codigo); setVista('bandeja'); void cargarPedidos(); }} />
            )}
            {servicioCrear === 'efectivo' && (
              <EfectivoForm operadorId={operador.id} onCreated={(codigo) => { setSeleccionado(codigo); setVista('bandeja'); void cargarPedidos(); }} />
            )}
            {servicioCrear === 'saldo' && (
              <SaldoForm operadorId={operador.id} onCreated={(codigo) => { setSeleccionado(codigo); setVista('bandeja'); void cargarPedidos(); }} />
            )}
            {servicioCrear === 'divisa' && (
              <DivisaForm operadorId={operador.id} onCreated={(codigo) => { setSeleccionado(codigo); setVista('bandeja'); void cargarPedidos(); }} />
            )}
          </section>
        ) : (
          <>
            <section className="content-grid orders-content-grid">
              <div className="list-panel orders-list-panel">
                <div className="filters orders-toolbar-row">
                  <div className="view-toggle" aria-label="Vista de pedidos">
                    <button type="button" className={vistaPedidos === 'lista' ? 'active' : ''} onClick={() => setVistaPedidos('lista')} title="Vista lista">
                      <LayoutList size={18} /> Lista
                    </button>
                    <button type="button" className={vistaPedidos === 'kanban' ? 'active' : ''} onClick={() => setVistaPedidos('kanban')} title="Vista Kanban">
                      <Columns3 size={18} /> Kanban
                    </button>
                  </div>
                  <label className="search-box orders-search-box">
                    <Search size={18} />
                    <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar codigo, tarjeta o telefono" />
                  </label>
                </div>
                <div className="service-filters" aria-label="Filtros por servicio">
                  {servicios.map((item) => (
                    <button
                      key={item.value || 'todos-servicios'}
                      type="button"
                      className={servicio === item.value ? 'active' : ''}
                      onClick={() => setServicio(item.value)}
                    >
                      {item.value ? item.label : 'Todos'}
                    </button>
                  ))}
                </div>
                <div className="status-filters" aria-label="Filtros por estado">
                  {estados.map((item) => (
                    <button
                      key={item.value || 'todos'}
                      type="button"
                      className={estado === item.value ? 'active' : ''}
                      onClick={() => setEstado(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {error && <div className="notice error">{error}</div>}
                {loading && <div className="notice">Cargando pedidos...</div>}
                {pedidosFiltrados.length === 0 && !loading && <div className="notice">No hay pedidos para estos filtros</div>}
                {vistaPedidos === 'lista' ? (
                  <div className="chat-order-list">
                    {pedidosFiltrados.map((pedido) => (
                      <button
                        key={pedido.codigo_operacion}
                        className={seleccionado === pedido.codigo_operacion ? 'chat-order-card selected' : 'chat-order-card'}
                        onClick={() => setSeleccionado(pedido.codigo_operacion)}
                      >
                        <span className="chat-card-main">
                          <span className="pedido-card-head">
                            <strong>{pedido.servicio}</strong>
                            <small>{pedido.codigo_operacion} {tiempoRelativo(pedido.created_at) ? `- ${tiempoRelativo(pedido.created_at)}` : ''}</small>
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
                          <strong>{pedido.monto_pago} {pedido.moneda_pago}</strong>
                          <small>Recibe {pedido.monto_resultado}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pedido-board">
                    {pedidosPorEstado.map((grupo) => (
                      <section className="pedido-column" key={grupo.value} style={{ order: grupo.orden }}>
                        <header className="pedido-column-header">
                          <span className={`status ${grupo.value}`}>{grupo.label}</span>
                          <strong>{grupo.pedidos.length}</strong>
                        </header>
                        <div className="pedido-list">
                          {grupo.pedidos.map((pedido) => (
                            <button
                              key={pedido.codigo_operacion}
                              className={seleccionado === pedido.codigo_operacion ? 'pedido-row selected' : 'pedido-row'}
                              onClick={() => setSeleccionado(pedido.codigo_operacion)}
                            >
                              <span className="kanban-card-top">
                                <span className="pedido-card-head">
                                  <strong>{pedido.servicio}</strong>
                                  <small>{pedido.codigo_operacion} {tiempoRelativo(pedido.created_at) ? `- ${tiempoRelativo(pedido.created_at)}` : ''}</small>
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
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </section>
            <PedidoDetallePanel codigo={seleccionado} operadorId={operador.id} onChanged={cargarPedidos} onClose={() => setSeleccionado(null)} />
          </>
        )}
      </main>
      {puedeCrear && vista !== 'crear' && (
        <button className="floating-create" onClick={() => abrirCrear('transferencia')} title="Nuevo pedido">
          <Plus size={24} />
        </button>
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
