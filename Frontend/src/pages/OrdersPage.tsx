import { CalendarRange, CheckCircle2, ChevronDown, ClipboardList, Clock3, LayoutGrid, LayoutList, ListFilter, RefreshCw, Search, X } from 'lucide-react';
import { useState } from 'react';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { FloatingSelect } from '../components/FloatingSelect';
import { Modal } from '../components/Modal';
import { PageLoader } from '../components/PageLoader';
import type { Operador, PedidoResumen } from '../types/api';
import { formatearNumeroTarjeta } from '../utils/tarjetas';
import './orders/OrdersPage.css';

export type OrdersScope = 'mis' | 'todas';
export type OrdersPeriod = 'hoy' | 'ayer' | '7_dias' | 'mes' | 'todos';
export type OrdersView = 'lista' | 'kanban';
export type OrdersGroup = { value: string; label: string; orden: number; pedidos: PedidoResumen[] };

const estados = [
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

function estadoLabel(value: string) {
  if (value === 'en_operacion') return 'Pago confirmado';
  return estados.find((item) => item.value === value)?.label ?? value.replaceAll('_', ' ');
}

function detalleValor(pedido: PedidoResumen, key: string) {
  const value = pedido.detalle?.[key];
  if (value === null || value === undefined || value === '') return null;
  if (key === 'numero_tarjeta') return formatearNumeroTarjeta(String(value));
  return String(value);
}

function monedaEntrega(pedido: PedidoResumen) {
  if (pedido.servicio === 'divisa') return detalleValor(pedido, 'tipo_tarjeta') ?? 'DIVISA';
  if (pedido.servicio === 'otros') return pedido.moneda_pago;
  return 'CUP';
}

function tasaAplicada(pedido: PedidoResumen) {
  return pedido.servicio === 'saldo' ? pedido.monto_pago : pedido.tasa_final;
}

function resumen(pedido: PedidoResumen) {
  const fields = pedido.servicio === 'transferencia'
    ? [{ label: 'Tarjeta', value: detalleValor(pedido, 'numero_tarjeta') }, { label: 'Telefono', value: detalleValor(pedido, 'telefono_destinatario') }]
    : pedido.servicio === 'efectivo'
      ? [{ label: 'Telefono', value: detalleValor(pedido, 'telefono_destinatario') }, { label: 'Monto CUP', value: detalleValor(pedido, 'monto_cup') }]
      : pedido.servicio === 'saldo'
        ? [{ label: 'Telefono', value: detalleValor(pedido, 'telefono_destinatario') }, { label: 'Saldo', value: detalleValor(pedido, 'saldo_cup') }]
        : [{ label: 'Telefono', value: detalleValor(pedido, 'telefono_destinatario') }, { label: 'Tarjeta', value: detalleValor(pedido, 'numero_tarjeta') }];
  return fields.filter((field) => field.value).slice(0, 2);
}

function parseBackendTime(value?: string) {
  if (!value) return Number.NaN;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  return Date.parse(normalized);
}

function tiempoRelativo(value: string | undefined, now: number) {
  if (!value) return null;
  const parsed = parseBackendTime(value);
  if (Number.isNaN(parsed)) return null;
  const diff = Math.max(0, now - parsed);
  const minutes = Math.floor(diff / 60000);
  return `${minutes} min`;
}

function minutosPedido(value: string | undefined, now: number) {
  if (!value) return 0;
  const parsed = parseBackendTime(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.floor((now - parsed) / 60000));
}

function pedidoAtrasado(pedido: PedidoResumen, now: number) {
  if (pedido.estado === 'completado' || pedido.estado === 'cancelado') return false;
  return minutosPedido(pedido.created_at, now) >= 10;
}

function etiquetaTiempoPedido(pedido: PedidoResumen, now: number) {
  const tiempo = tiempoRelativo(pedido.created_at, now);
  if (!tiempo) return null;
  return pedidoAtrasado(pedido, now) ? `Atrasado ${tiempo}` : tiempo;
}

export function OrdersPage(props: {
  operador: Operador;
  pedidos: PedidoResumen[];
  lista: PedidoResumen[];
  grupos: OrdersGroup[];
  counts: Map<string, number>;
  total: number;
  misCount: number;
  todasCount: number;
  busqueda: string;
  estado: string;
  servicio: string;
  scope: OrdersScope;
  period: OrdersPeriod;
  view: OrdersView;
  loading: boolean;
  clock: number;
  canViewAll: boolean;
  collapsed: Set<string>;
  onBusqueda: (value: string) => void;
  onEstado: (value: string) => void;
  onServicio: (value: string) => void;
  onScope: (value: OrdersScope) => void;
  onPeriod: (value: OrdersPeriod) => void;
  onView: (value: OrdersView) => void;
  onRefresh: () => void;
  onToggleGroup: (value: string) => void;
  onSelect: (codigo: string) => void;
  classNameFor: (pedido: PedidoResumen, base: string) => string;
  blockedByOther: (pedido: PedidoResumen) => boolean;
  ownedByMe: (pedido: PedidoResumen) => boolean;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = Number(Boolean(props.estado))
    + Number(Boolean(props.servicio))
    + Number(props.canViewAll ? props.scope !== 'todas' : props.scope !== 'mis')
    + Number(props.period !== 'hoy');

  function clearFilters() {
    props.onEstado('');
    props.onServicio('');
    props.onScope(props.canViewAll ? 'todas' : 'mis');
    props.onPeriod('hoy');
  }

  function applyHeroFilter(scope: OrdersScope, estado: string) {
    props.onScope(scope);
    props.onEstado(estado);
    props.onServicio('');
    props.onBusqueda('');
  }

  const scopeTodos = props.canViewAll ? 'todas' : 'mis';
  const todosScopeCount = props.canViewAll ? props.todasCount : props.misCount;

  const orderCardMeta = (pedido: PedidoResumen) => (
    <>
      {pedido.redirigido_a_operador_id && <small className={pedido.redirigido_a_operador_id === props.operador.id ? 'order-redirect-chip own inline' : 'order-redirect-chip inline'}>Para {pedido.redirigido_a_operador_nombre ?? 'operador'}</small>}
      {props.ownedByMe(pedido) && <small className="order-taken-chip owned inline">Lo tienes tu</small>}
      {props.blockedByOther(pedido) && <small className="order-taken-chip blocked inline">Atendido por {pedido.operador_asignado_nombre ?? 'operador'}</small>}
    </>
  );

  return (
    <section className="content-grid orders-content-grid app-page-width">
      <div className="list-panel orders-list-panel">
        <header className="orders-page-hero">
          <div className="orders-page-hero-copy">
            <span className="orders-page-eyebrow">Centro de operaciones</span>
            <h2>Pedidos</h2>
            <p>Consulta, filtra y gestiona el flujo completo de las operaciones.</p>
          </div>
          <button className="admin-refresh-button orders-refresh-button orders-hero-refresh-button" type="button" onClick={props.onRefresh} title="Actualizar pedidos" aria-label="Actualizar pedidos" disabled={props.loading}><RefreshCw size={18} /></button>
          <div className="orders-page-metrics" aria-label="Resumen de pedidos">
            <button type="button" className={props.scope === scopeTodos && !props.estado && !props.servicio ? 'active' : ''} onClick={() => applyHeroFilter(scopeTodos, '')}><ClipboardList size={18} /><small>Todos</small><strong>{todosScopeCount}</strong></button>
            <button type="button" className={props.estado === 'en_proceso' && !props.servicio ? 'active' : ''} onClick={() => applyHeroFilter(props.canViewAll ? 'todas' : 'mis', 'en_proceso')}><Clock3 size={18} /><small>En proceso</small><strong>{(props.counts.get('pendiente_pago') ?? 0) + (props.counts.get('pago_confirmado') ?? 0)}</strong></button>
            {/* <button type="button" className={props.estado === 'completado' && !props.servicio ? 'active' : ''} onClick={() => applyHeroFilter(props.canViewAll ? 'todas' : 'mis', 'completado')}><CheckCircle2 size={18} /><small>Completados</small><strong>{props.counts.get('completado') ?? 0}</strong></button> */}
          </div>
        </header>

        <section className="orders-command-panel" aria-label="Busqueda y filtros de pedidos">
          <div className="filters orders-toolbar-row">
            <div className="orders-top-actions">
              <button type="button" className={activeFilters ? 'view-toggle single-view-toggle orders-filter-toggle active' : 'view-toggle single-view-toggle orders-filter-toggle'} onClick={() => setFiltersOpen(true)} title="Filtrar pedidos" aria-label="Filtrar pedidos"><ListFilter size={18} />{activeFilters > 0 && <span>{activeFilters}</span>}</button>
              <label className="search-box orders-search-box">
                <Search size={18} />
                <input value={props.busqueda} onChange={(event) => props.onBusqueda(event.target.value)} placeholder="Buscar codigo, tarjeta o telefono" aria-label="Buscar pedidos" />
                {props.busqueda && (
                  <button className="orders-search-clear" type="button" onClick={() => props.onBusqueda('')} title="Borrar busqueda" aria-label="Borrar busqueda">
                    <X size={16} />
                  </button>
                )}
              </label>
              <button type="button" className="view-toggle single-view-toggle orders-view-toggle" onClick={() => props.onView(props.view === 'lista' ? 'kanban' : 'lista')} title={props.view === 'lista' ? 'Cambiar a cuadricula' : 'Cambiar a lista'} aria-label={props.view === 'lista' ? 'Cambiar a cuadricula' : 'Cambiar a lista'}>{props.view === 'lista' ? <LayoutGrid size={18} /> : <LayoutList size={18} />}</button>
            </div>
          </div>
        </section>
        {filtersOpen && (
          <Modal title="Filtrar pedidos" subtitle={`${props.total} pedidos disponibles`} onClose={() => setFiltersOpen(false)} className="orders-filter-modal">
            <div className="orders-filter-modal-content">
              <section className="orders-filter-section orders-filter-scope-section">
                <header className="orders-filter-section-header">
                  <h3>Alcance</h3>
                </header>
                <div className="orders-filter-options two-columns orders-scope-chips">
                  <button type="button" className={props.scope === scopeTodos ? 'active' : ''} onClick={() => props.onScope(scopeTodos)}><ClipboardList size={17} /><span>Todos</span><strong>{todosScopeCount}</strong></button>
                </div>
              </section>

              <section className="orders-filter-section orders-filter-selects">
                <div className="order-filter-field order-filter-floating orders-period-action"><h3>Fecha</h3><FloatingSelect value={props.period} onChange={(value) => props.onPeriod(value as OrdersPeriod)} options={[{ value: 'hoy', label: 'Hoy', icon: <CalendarRange size={17} /> }, { value: 'ayer', label: 'Ayer', icon: <CalendarRange size={17} /> }, { value: '7_dias', label: '7 dias', icon: <CalendarRange size={17} /> }, { value: 'mes', label: 'Este mes', icon: <CalendarRange size={17} /> }, { value: 'todos', label: 'Todos', icon: <CalendarRange size={17} /> }]} ariaLabel="Filtrar pedidos por fecha" align="left" buttonClassName="order-filter-button" /></div>
                <div className="order-filter-field order-filter-floating orders-service-action"><h3>Servicio</h3><FloatingSelect value={props.servicio} onChange={props.onServicio} options={servicios.map((item) => ({ value: item.value, label: item.value ? item.label : 'Todos los servicios' }))} ariaLabel="Filtrar por servicio" align="right" buttonClassName="order-filter-button" /></div>
              </section>

              <section className="orders-filter-section">
                <header className="orders-filter-section-header">
                  <h3>Estado</h3>
                </header>
                <div className="orders-filter-options status-options status-filters">
                  <button type="button" className={!props.estado ? 'active' : ''} onClick={() => props.onEstado('')}><span>Todos</span><strong>{props.total}</strong></button>
                  {estados.map((item) => <button type="button" key={item.value} className={props.estado === item.value ? `${item.value} active` : item.value} onClick={() => props.onEstado(item.value)}><span>{item.label}</span><strong>{props.counts.get(item.value) ?? 0}</strong></button>)}
                </div>
              </section>

              <div className="orders-filter-modal-actions">
                <button className="ghost-button" type="button" onClick={clearFilters} disabled={activeFilters === 0}>Limpiar</button>
                <button className="primary-button" type="button" onClick={() => setFiltersOpen(false)}>Ver pedidos</button>
              </div>
            </div>
          </Modal>
        )}
        <nav className="orders-status-chips orders-status-quickbar" aria-label="Filtrar pedidos por estado">
          <button type="button" className={!props.estado ? 'active' : ''} onClick={() => props.onEstado('')}><span>Todos</span><strong>{props.total}</strong></button>
          {estados.map((item) => <button type="button" key={item.value} className={props.estado === item.value ? `${item.value} active` : item.value} onClick={() => props.onEstado(item.value)}><span>{item.label}</span><strong>{props.counts.get(item.value) ?? 0}</strong></button>)}
        </nav>
        {props.loading && <PageLoader label="Cargando pedidos" inline />}
        {props.pedidos.length === 0 && !props.loading && <DismissibleNotice className="notice">No hay pedidos para estos filtros</DismissibleNotice>}

        {props.view === 'lista' ? (
          <div className="chat-order-list">
            {props.lista.map((pedido) => <button key={pedido.codigo_operacion} className={props.classNameFor(pedido, 'chat-order-card')} onClick={() => props.onSelect(pedido.codigo_operacion)} disabled={props.blockedByOther(pedido)}>
              <span className="chat-card-main"><span className="pedido-card-head"><strong>{pedido.servicio}</strong><small>{pedido.codigo_operacion} {etiquetaTiempoPedido(pedido, props.clock) ? <span className={pedidoAtrasado(pedido, props.clock) ? 'order-delay-chip delayed inline' : 'order-delay-chip inline'}>{etiquetaTiempoPedido(pedido, props.clock)}</span> : null}</small></span><span className="pedido-card-fields compact">{resumen(pedido).map((field) => <span className="pedido-card-field" key={field.label}><small>{field.label}</small><strong>{field.value}</strong></span>)}</span></span>
              <span className="chat-card-side"><span className={`status ${pedido.estado}`}>{estadoLabel(pedido.estado)}</span>{orderCardMeta(pedido)}<strong>{pedido.monto_pago} {pedido.moneda_pago}</strong><small>Recibe {pedido.monto_resultado} {monedaEntrega(pedido)}</small></span>
            </button>)}
          </div>
        ) : (
          <div className="pedido-board">
            {props.grupos.map((grupo) => {
              const colapsado = props.collapsed.has(grupo.value);
              return <section className={colapsado ? 'pedido-column collapsed' : 'pedido-column'} key={grupo.value} style={{ order: grupo.orden }}>
                <header className="pedido-column-header"><button className="pedido-column-toggle" type="button" onClick={() => props.onToggleGroup(grupo.value)} aria-expanded={!colapsado}><ChevronDown className={colapsado ? 'collapsed' : ''} size={18} /><span className={`status ${grupo.value}`}>{grupo.label}</span></button><strong>{grupo.pedidos.length}</strong></header>
                {!colapsado && <div className="pedido-list">{grupo.pedidos.map((pedido) => <button key={pedido.codigo_operacion} className={props.classNameFor(pedido, 'pedido-row')} onClick={() => props.onSelect(pedido.codigo_operacion)} disabled={props.blockedByOther(pedido)}>
                  <span className="kanban-card-top"><span className="pedido-card-head"><strong>{pedido.servicio}</strong><small>{pedido.codigo_operacion} {etiquetaTiempoPedido(pedido, props.clock) ? <span className={pedidoAtrasado(pedido, props.clock) ? 'order-delay-chip delayed inline' : 'order-delay-chip inline'}>{etiquetaTiempoPedido(pedido, props.clock)}</span> : null}</small>{orderCardMeta(pedido)}</span><strong>{pedido.monto_pago} {pedido.moneda_pago}</strong></span>
                  <span className="pedido-card-fields compact">{resumen(pedido).map((field) => <span className="pedido-card-field" key={field.label}><small>{field.label}</small><strong>{field.value}</strong></span>)}</span>
                  <span className="pedido-card-pay compact-pay"><small>Recibe {pedido.monto_resultado} {monedaEntrega(pedido)}</small><small>Tasa {tasaAplicada(pedido)}</small></span>
                </button>)}</div>}
              </section>;
            })}
          </div>
        )}
      </div>
    </section>
  );
}
