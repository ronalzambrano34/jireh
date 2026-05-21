import { useEffect, useMemo, useState } from 'react';
import { LogOut, Plus, RefreshCw } from 'lucide-react';
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

export function App() {
  const [operador, setOperador] = useState<Operador | null>(null);
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [estado, setEstado] = useState('');
  const [servicio, setServicio] = useState('');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [vista, setVista] = useState<'bandeja' | 'crear' | 'reportes' | 'admin'>('bandeja');
  const [servicioCrear, setServicioCrear] = useState<'transferencia' | 'efectivo' | 'saldo' | 'divisa'>('transferencia');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const pedidosPorEstado = useMemo(() => {
    return estadosBandeja
      .filter((item) => !estado || item.value === estado)
      .map((item) => ({
        ...item,
        pedidos: pedidos.filter((pedido) => pedido.estado === item.value),
      }))
      .filter((grupo) => grupo.pedidos.length > 0 || Boolean(estado));
  }, [estado, pedidos]);

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

  if (!operador) {
    return <LoginPage onLogin={setOperador} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">Jireh</div>
          <div className="operator">{operador.nombre}</div>
        </div>
        <nav className="nav-stack">
          <button className={vista === 'bandeja' ? 'active' : ''} onClick={() => setVista('bandeja')}>Pedidos</button>
          <button className={vista === 'crear' ? 'active' : ''} onClick={() => setVista('crear')} disabled={!puedeCrear}>Crear</button>
          <button className={vista === 'reportes' ? 'active' : ''} onClick={() => setVista('reportes')} disabled={!puedeReportes}>Reportes</button>
          <button className={vista === 'admin' ? 'active' : ''} onClick={() => setVista('admin')} disabled={!puedeAdmin}>Admin</button>
        </nav>
        <button className="ghost-button" onClick={() => { clearToken(); setOperador(null); }}>
          <LogOut size={18} /> Salir
        </button>
      </aside>

      <main className="workspace">
        <header className="toolbar">
          <div>
            <h1>{vista === 'crear' ? 'Nuevo pedido' : vista === 'reportes' ? 'Reportes' : vista === 'admin' ? 'Administracion' : 'Bandeja de pedidos'}</h1>
            <p>{vista === 'crear' ? 'Registro rapido para operacion interna' : vista === 'reportes' ? 'Resumen operativo por filtros' : vista === 'admin' ? 'Catalogos operativos' : 'Seguimiento de operaciones por estado'}</p>
          </div>
          {vista === 'bandeja' && (
            <button className="icon-button" onClick={cargarPedidos} title="Actualizar pedidos">
              <RefreshCw size={18} />
            </button>
          )}
          {(vista === 'crear' || vista === 'reportes' || vista === 'admin') && (
            <button className="primary-button" onClick={() => setVista('bandeja')}>
              Ver pedidos
            </button>
          )}
        </header>

        {vista === 'admin' ? (
          <AdminCatalogosPage />
        ) : vista === 'reportes' ? (
          <ReportesPage />
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
                <div className="filters">
                  <select value={estado} onChange={(event) => setEstado(event.target.value)}>
                    {estados.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <select value={servicio} onChange={(event) => setServicio(event.target.value)}>
                    {servicios.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  {puedeCrear && (
                    <button className="primary-button" onClick={() => setVista('crear')}>
                      <Plus size={18} /> Crear pedido
                    </button>
                  )}
                </div>
                {error && <div className="notice error">{error}</div>}
                {loading && <div className="notice">Cargando pedidos...</div>}
                {pedidosPorEstado.length === 0 && !loading && <div className="notice">No hay pedidos para estos filtros</div>}
                <div className="pedido-board">
                  {pedidosPorEstado.map((grupo) => (
                    <section className="pedido-column" key={grupo.value}>
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
                            <span className="pedido-card-head">
                              <strong>{pedido.servicio}</strong>
                              <small>{pedido.codigo_operacion}</small>
                            </span>
                            <span className="pedido-card-fields">
                              {camposTarjetaPedido(pedido).filter((field) => field.value).map((field) => (
                                <span className="pedido-card-field" key={field.label}>
                                  <small>{field.label}</small>
                                  <strong>{field.value}</strong>
                                </span>
                              ))}
                            </span>
                            <span className="pedido-card-pay">
                              <small>Pago</small>
                              <strong>{pedido.monto_pago} {pedido.moneda_pago}</strong>
                              <small>Tasa {pedido.tasa_final}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </section>
            <PedidoDetallePanel codigo={seleccionado} onChanged={cargarPedidos} onClose={() => setSeleccionado(null)} />
          </>
        )}
      </main>
    </div>
  );
}
