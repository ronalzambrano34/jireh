import { CalendarRange, ChevronDown, ClipboardList, LayoutGrid, LayoutList, RefreshCw, Search, UserCircle } from 'lucide-react';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { FloatingSelect } from '../components/FloatingSelect';
import { PageLoader } from '../components/PageLoader';
import type { Operador, PedidoResumen } from '../types/api';
import { formatearNumeroTarjeta } from '../utils/tarjetas';
import './orders/OrdersPage.css';

export type OrdersScope = 'mis' | 'todas';
export type OrdersPeriod = 'hoy' | '7_dias' | 'mes' | 'todos';
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

function tiempoRelativo(value: string | undefined, now: number) {
  if (!value) return null;
  const diff = Math.max(0, now - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'hace instantes';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
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
  const orderCardMeta = (pedido: PedidoResumen) => (
    <>
      {pedido.redirigido_a_operador_id && <small className={pedido.redirigido_a_operador_id === props.operador.id ? 'order-redirect-chip own inline' : 'order-redirect-chip inline'}>Para {pedido.redirigido_a_operador_nombre ?? 'operador'}</small>}
      {props.ownedByMe(pedido) && <small className="order-taken-chip owned inline">Lo tienes tu</small>}
      {props.blockedByOther(pedido) && <small className="order-taken-chip blocked inline">Atendido por {pedido.operador_asignado_nombre ?? 'operador'}</small>}
    </>
  );

  return (
    <section className="content-grid orders-content-grid">
      <div className="list-panel orders-list-panel">
        <div className="filters orders-toolbar-row">
          <label className="search-box orders-search-box"><Search size={18} /><input value={props.busqueda} onChange={(event) => props.onBusqueda(event.target.value)} placeholder="Buscar codigo, tarjeta o telefono" /></label>
        </div>
        <div className="status-filters orders-scope-chips" aria-label="Alcance de ordenes">
          <button type="button" className={props.scope === 'mis' ? 'active scope-my-orders' : 'scope-my-orders'} onClick={() => props.onScope('mis')}><UserCircle size={16} /><span>Mis pedidos</span><strong>{props.misCount}</strong></button>
          {props.canViewAll && <button type="button" className={props.scope === 'todas' ? 'active' : ''} onClick={() => props.onScope('todas')}><ClipboardList size={16} /><span>Todas</span><strong>{props.todasCount}</strong></button>}
          <div className="orders-top-actions">
            <div className="order-filter-field order-filter-floating orders-period-action">
              <FloatingSelect value={props.period} onChange={(value) => props.onPeriod(value as OrdersPeriod)} options={[{ value: 'hoy', label: 'Hoy', icon: <CalendarRange size={17} /> }, { value: '7_dias', label: '7 dias', icon: <CalendarRange size={17} /> }, { value: 'mes', label: 'Este mes', icon: <CalendarRange size={17} /> }, { value: 'todos', label: 'Todos', icon: <CalendarRange size={17} /> }]} ariaLabel="Filtrar pedidos por fecha" align="left" buttonClassName="order-filter-button" />
            </div>
            <div className="order-filter-field order-filter-floating orders-service-action">
              <FloatingSelect value={props.servicio} onChange={props.onServicio} options={servicios.map((item) => ({ value: item.value, label: item.value ? item.label : 'Todos los servicios' }))} ariaLabel="Filtrar por servicio" align="right" buttonClassName="order-filter-button" />
            </div>
            <button type="button" className="view-toggle single-view-toggle" onClick={() => props.onView(props.view === 'lista' ? 'kanban' : 'lista')} title={props.view === 'lista' ? 'Cambiar a cuadricula' : 'Cambiar a lista'} aria-label={props.view === 'lista' ? 'Cambiar a cuadricula' : 'Cambiar a lista'}>{props.view === 'lista' ? <LayoutGrid size={18} /> : <LayoutList size={18} />}</button>
            <button className="icon-button orders-refresh-button" onClick={props.onRefresh} title="Actualizar pedidos" aria-label="Actualizar pedidos" disabled={props.loading}><RefreshCw size={18} /></button>
          </div>
        </div>
        <div className="status-filters orders-status-chips" aria-label="Filtros rapidos por estado">
          <button type="button" className={!props.estado ? 'active' : ''} onClick={() => props.onEstado('')}><span>Todos</span><strong>{props.total}</strong></button>
          {estados.map((item) => <button type="button" key={item.value} className={props.estado === item.value ? `active ${item.value}` : item.value} onClick={() => props.onEstado(item.value)}><span>{item.label}</span><strong>{props.counts.get(item.value) ?? 0}</strong></button>)}
        </div>
        {props.loading && <PageLoader label="Cargando pedidos" inline />}
        {props.pedidos.length === 0 && !props.loading && <DismissibleNotice className="notice">No hay pedidos para estos filtros</DismissibleNotice>}

        {props.view === 'lista' ? (
          <div className="chat-order-list">
            {props.lista.map((pedido) => <button key={pedido.codigo_operacion} className={props.classNameFor(pedido, 'chat-order-card')} onClick={() => props.onSelect(pedido.codigo_operacion)} disabled={props.blockedByOther(pedido)}>
              <span className="chat-card-main"><span className="pedido-card-head"><strong>{pedido.servicio}</strong><small>{pedido.codigo_operacion} {tiempoRelativo(pedido.created_at, props.clock) ? `- ${tiempoRelativo(pedido.created_at, props.clock)}` : ''}</small></span><span className="pedido-card-fields compact">{resumen(pedido).map((field) => <span className="pedido-card-field" key={field.label}><small>{field.label}</small><strong>{field.value}</strong></span>)}</span></span>
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
                  <span className="kanban-card-top"><span className="pedido-card-head"><strong>{pedido.servicio}</strong><small>{pedido.codigo_operacion} {tiempoRelativo(pedido.created_at, props.clock) ? `- ${tiempoRelativo(pedido.created_at, props.clock)}` : ''}</small>{orderCardMeta(pedido)}</span><strong>{pedido.monto_pago} {pedido.moneda_pago}</strong></span>
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
