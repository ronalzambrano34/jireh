import { useEffect, useMemo, useState } from 'react';
import { LogOut, Plus, RefreshCw } from 'lucide-react';
import { clearToken, getMe, getToken, listarPedidos } from './api/client';
import type { Operador, PedidoResumen } from './types/api';
import { LoginPage } from './pages/LoginPage';
import { PedidoDetallePanel } from './pages/PedidoDetallePanel';
import { TransferenciaForm } from './pages/TransferenciaForm';

const estados = [
  { value: '', label: 'Todos' },
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pago_confirmado', label: 'Pago confirmado' },
  { value: 'en_operacion', label: 'En operacion' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

export function App() {
  const [operador, setOperador] = useState<Operador | null>(null);
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [estado, setEstado] = useState('');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [vista, setVista] = useState<'bandeja' | 'crear'>('bandeja');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeCrear = useMemo(
    () => operador?.permisos.includes('pedidos:crear') || operador?.permisos.includes('pedidos:gestionar') || operador?.permisos.includes('empresa:control_total'),
    [operador],
  );

  async function cargarPedidos() {
    setLoading(true);
    setError(null);
    try {
      setPedidos(await listarPedidos({ estado: estado || undefined }));
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
  }, [operador, estado]);

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
        </nav>
        <button className="ghost-button" onClick={() => { clearToken(); setOperador(null); }}>
          <LogOut size={18} /> Salir
        </button>
      </aside>

      <main className="workspace">
        <header className="toolbar">
          <div>
            <h1>{vista === 'crear' ? 'Nueva transferencia' : 'Bandeja de pedidos'}</h1>
            <p>{vista === 'crear' ? 'Registro rapido para operacion interna' : 'Seguimiento de operaciones por estado'}</p>
          </div>
          {vista === 'bandeja' && (
            <button className="icon-button" onClick={cargarPedidos} title="Actualizar pedidos">
              <RefreshCw size={18} />
            </button>
          )}
          {vista === 'crear' && (
            <button className="primary-button" onClick={() => setVista('bandeja')}>
              Ver pedidos
            </button>
          )}
        </header>

        {vista === 'crear' ? (
          <TransferenciaForm operadorId={operador.id} onCreated={(codigo) => { setSeleccionado(codigo); setVista('bandeja'); void cargarPedidos(); }} />
        ) : (
          <section className="content-grid">
            <div className="list-panel">
              <div className="filters">
                <select value={estado} onChange={(event) => setEstado(event.target.value)}>
                  {estados.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {puedeCrear && (
                  <button className="primary-button" onClick={() => setVista('crear')}>
                    <Plus size={18} /> Transferencia
                  </button>
                )}
              </div>
              {error && <div className="notice error">{error}</div>}
              {loading && <div className="notice">Cargando pedidos...</div>}
              <div className="pedido-list">
                {pedidos.map((pedido) => (
                  <button
                    key={pedido.codigo_operacion}
                    className={seleccionado === pedido.codigo_operacion ? 'pedido-row selected' : 'pedido-row'}
                    onClick={() => setSeleccionado(pedido.codigo_operacion)}
                  >
                    <span>
                      <strong>{pedido.codigo_operacion}</strong>
                      <small>{pedido.servicio} · {pedido.moneda_pago}</small>
                    </span>
                    <span className={`status ${pedido.estado}`}>{pedido.estado}</span>
                  </button>
                ))}
              </div>
            </div>
            <PedidoDetallePanel codigo={seleccionado} onChanged={cargarPedidos} />
          </section>
        )}
      </main>
    </div>
  );
}
