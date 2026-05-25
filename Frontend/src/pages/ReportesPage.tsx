import { useEffect, useState } from 'react';
import { Banknote, BriefcaseBusiness, CalendarRange, ChevronDown, CircleDot, Coins, Download, Smartphone, UserRound, WalletCards, X } from 'lucide-react';
import { descargarReporteCsv, listarOperadores, obtenerReporte } from '../api/client';
import type { Operador, ReporteGeneral, ReporteGrupo } from '../types/api';

const estados = [
  { value: '', label: 'Estado' },
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pago_confirmado', label: 'Pago confirmado' },
  { value: 'en_operacion', label: 'En operacion' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'error', label: 'Error' },
];

const servicios = [
  { value: '', label: 'Servicio' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'saldo', label: 'Saldo' },
  { value: 'divisa', label: 'Divisa' },
];

const periodos = [
  { value: 'todo', label: 'Periodo' },
  { value: 'hoy', label: 'HOY' },
  { value: 'ayer', label: 'AYER' },
  { value: 'semana', label: 'SEMANA' },
  { value: 'mes', label: 'MES' },
  { value: 'personalizado', label: 'PERSONALIZADO' },
] as const;

type PeriodoReporte = typeof periodos[number]['value'];

const monedas = [
  { value: '', label: 'Moneda' },
  { value: 'BRL', label: 'BRL' },
  { value: 'UYU', label: 'UYU' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
];

function servicioIcon(value: string, size = 18) {
  if (value === 'transferencia') return <WalletCards size={size} />;
  if (value === 'efectivo') return <Banknote size={size} />;
  if (value === 'saldo') return <Smartphone size={size} />;
  if (value === 'divisa') return <WalletCards size={size} />;
  return <BriefcaseBusiness size={size} />;
}

function optionLabel<T extends { value: string; label: string }>(items: readonly T[], value: string, fallback: string) {
  return items.find((item) => item.value === value)?.label ?? fallback;
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function rangoPeriodo(periodo: PeriodoReporte) {
  const hoy = new Date();
  const inicio = new Date(hoy);
  const fin = new Date(hoy);

  if (periodo === 'todo' || periodo === 'personalizado') {
    return { fecha_desde: '', fecha_hasta: '' };
  }

  if (periodo === 'ayer') {
    inicio.setDate(hoy.getDate() - 1);
    fin.setDate(hoy.getDate() - 1);
  }

  if (periodo === 'semana') {
    inicio.setDate(hoy.getDate() - 6);
  }

  if (periodo === 'mes') {
    inicio.setDate(hoy.getDate() - 29);
  }

  return {
    fecha_desde: dateInputValue(inicio),
    fecha_hasta: dateInputValue(fin),
  };
}

function money(value: number) {
  return new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 }).format(value);
}

function ReportSkeleton() {
  return (
    <>
      <div className="report-summary report-summary-loading" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => <div key={item}><span /><strong /></div>)}
      </div>
      <div className="report-grid report-grid-loading" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <section className="report-table report-table-skeleton" key={item}>
            <h2 />
            <div className="data-table">
              {[0, 1, 2, 3].map((row) => <div className="data-row" key={row}><span /><span /><span /><span /></div>)}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function ReportTable({ title, rows }: { title: string; rows: ReporteGrupo[] }) {
  return (
    <section className="report-table">
      <h2>{title}</h2>
      <div className="data-table">
        <div className="data-row header">
          <span>Clave</span>
          <span>Cantidad</span>
          <span>Monto pago</span>
          <span>Ganancia</span>
        </div>
        {rows.length === 0 && <div className="empty-row">Sin datos para los filtros seleccionados</div>}
        {rows.map((row) => (
          <div className="data-row" key={`${title}-${row.clave ?? 'sin-clave'}`}>
            <span>{row.clave ?? 'Sin dato'}</span>
            <span>{row.cantidad}</span>
            <span>{money(row.monto_pago)}</span>
            <span>{money(row.ganancia)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReportesPage() {
  const [periodo, setPeriodo] = useState<PeriodoReporte>('mes');
  const [filters, setFilters] = useState(() => ({
    ...rangoPeriodo('mes'),
    estado: '',
    servicio: '',
    moneda_pago: '',
    operador_id: '',
  }));
  const [reporte, setReporte] = useState<ReporteGeneral | null>(null);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [operadoresLoading, setOperadoresLoading] = useState(false);
  const [periodoSheetOpen, setPeriodoSheetOpen] = useState(false);
  const [estadoSheetOpen, setEstadoSheetOpen] = useState(false);
  const [servicioSheetOpen, setServicioSheetOpen] = useState(false);
  const [monedaSheetOpen, setMonedaSheetOpen] = useState(false);
  const [operadorSheetOpen, setOperadorSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargarOperadores() {
    setOperadoresLoading(true);
    try {
      setOperadores(await listarOperadores(true));
    } catch {
      setOperadores([]);
    } finally {
      setOperadoresLoading(false);
    }
  }

  useEffect(() => {
    void cargarOperadores();
  }, []);

  useEffect(() => {
    let active = true;

    async function cargarReporteActual() {
      setLoading(true);
      setError(null);
      try {
        const data = await obtenerReporte(filters);
        if (active) setReporte(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte');
      } finally {
        if (active) setLoading(false);
      }
    }

    void cargarReporteActual();

    return () => {
      active = false;
    };
  }, [filters]);

  function update(field: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function updatePeriodo(value: PeriodoReporte) {
    setPeriodo(value);
    if (value !== 'personalizado') {
      setFilters((current) => ({
        ...current,
        ...rangoPeriodo(value),
      }));
    }
  }

  function cerrarFiltros() {
    setPeriodoSheetOpen(false);
    setEstadoSheetOpen(false);
    setServicioSheetOpen(false);
    setMonedaSheetOpen(false);
    setOperadorSheetOpen(false);
  }

  async function exportarCsv() {
    setError(null);
    try {
      const blob = await descargarReporteCsv(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'reporte_resumen.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el CSV');
    }
  }

  return (
    <section className="reports-page">
      <div className="filters report-filters">
        <div className="report-filter-field">
          <CalendarRange className="report-filter-icon" size={17} />
          <button type="button" className="filter-modal-button" onClick={() => setPeriodoSheetOpen(true)} aria-haspopup="dialog" aria-expanded={periodoSheetOpen}>
            <span>{periodo === 'todo' ? 'Periodo' : optionLabel(periodos, periodo, 'Periodo')}</span>
            <ChevronDown className="filter-modal-caret" size={17} />
          </button>
        </div>
        {periodo === 'personalizado' && (
          <>
            <label className="report-filter-field">
              <CalendarRange className="report-filter-icon" size={17} />
              <input aria-label="Desde" type="date" value={filters.fecha_desde} onChange={(event) => update('fecha_desde', event.target.value)} />
            </label>
            <label className="report-filter-field">
              <CalendarRange className="report-filter-icon" size={17} />
              <input aria-label="Hasta" type="date" value={filters.fecha_hasta} onChange={(event) => update('fecha_hasta', event.target.value)} />
            </label>
          </>
        )}
        <div className="report-filter-field">
          <CircleDot className="report-filter-icon" size={17} />
          <button type="button" className="filter-modal-button" onClick={() => setEstadoSheetOpen(true)} aria-haspopup="dialog" aria-expanded={estadoSheetOpen}>
            <span>{filters.estado ? optionLabel(estados, filters.estado, 'Estado') : 'Estado'}</span>
            <ChevronDown className="filter-modal-caret" size={17} />
          </button>
        </div>
        <div className="report-filter-field">
          <span className="report-filter-icon">{servicioIcon(filters.servicio, 17)}</span>
          <button type="button" className="filter-modal-button" onClick={() => setServicioSheetOpen(true)} aria-haspopup="dialog" aria-expanded={servicioSheetOpen}>
            <span>{filters.servicio ? optionLabel(servicios, filters.servicio, 'Servicio') : 'Servicio'}</span>
            <ChevronDown className="filter-modal-caret" size={17} />
          </button>
        </div>
        <div className="report-filter-field">
          <Coins className="report-filter-icon" size={17} />
          <button type="button" className="filter-modal-button" onClick={() => setMonedaSheetOpen(true)} aria-haspopup="dialog" aria-expanded={monedaSheetOpen}>
            <span>{filters.moneda_pago || 'Moneda'}</span>
            <ChevronDown className="filter-modal-caret" size={17} />
          </button>
        </div>
        <div className="report-filter-field report-filter-field-wide">
          <UserRound className="report-filter-icon" size={17} />
          <button type="button" className="filter-modal-button" onClick={() => setOperadorSheetOpen(true)} aria-haspopup="dialog" aria-expanded={operadorSheetOpen} disabled={operadoresLoading}>
            <span>{filters.operador_id ? operadores.find((item) => String(item.id) === filters.operador_id)?.nombre ?? 'Operador' : 'Operador'}</span>
            <ChevronDown className="filter-modal-caret" size={17} />
          </button>
        </div>
        <div className="report-filter-actions">
          <button type="button" className="ghost-button" onClick={exportarCsv} disabled={loading}>
            <Download size={18} /> CSV
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {loading && (
        <div className="notice report-loading-notice">
          {reporte ? 'Actualizando reporte...' : 'Buscando datos del reporte...'}
        </div>
      )}
      {!loading && !error && !reporte && (
        <div className="notice warning">No se pudo mostrar el reporte todavia. Prueba otro periodo o actualiza la pantalla.</div>
      )}

      {loading && !reporte && <ReportSkeleton />}

      {reporte && (
        <div className={loading ? 'report-loaded is-refreshing' : 'report-loaded'}>
          <div className="report-summary">
            <div><span>Pedidos</span><strong>{reporte.resumen.total_pedidos}</strong></div>
            <div><span>Monto pago</span><strong>{money(reporte.resumen.monto_pago_total)}</strong></div>
            <div><span>Monto resultado</span><strong>{money(reporte.resumen.monto_resultado_total)}</strong></div>
            <div><span>Ganancia</span><strong>{money(reporte.resumen.ganancia_total)}</strong></div>
          </div>

          <div className="report-grid">
            <ReportTable title="Por dia" rows={reporte.por_dia} />
            <ReportTable title="Por estado" rows={reporte.por_estado} />
            <ReportTable title="Por servicio" rows={reporte.por_servicio} />
            <ReportTable title="Por moneda" rows={reporte.por_moneda} />
            <ReportTable title="Por metodo de pago" rows={reporte.por_metodo_pago} />
            <ReportTable title="Por operador" rows={reporte.por_operador} />
          </div>
        </div>
      )}

      {periodoSheetOpen && (
        <div className="bottom-sheet-layer" role="presentation">
          <button className="bottom-sheet-backdrop" aria-label="Cerrar filtro de periodo" onClick={cerrarFiltros} />
          <section className="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Filtrar reportes por periodo">
            <header className="bottom-sheet-header"><strong>Periodo</strong><button className="icon-button" type="button" onClick={cerrarFiltros} title="Cerrar" aria-label="Cerrar"><X size={18} /></button></header>
            <div className="bottom-sheet-options">
              {periodos.map((item) => (
                <button key={item.value} type="button" className={periodo === item.value ? 'active' : ''} onClick={() => { updatePeriodo(item.value); cerrarFiltros(); }}>
                  <CalendarRange size={18} /><span>{item.value === 'todo' ? 'Todos' : item.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {estadoSheetOpen && (
        <div className="bottom-sheet-layer" role="presentation">
          <button className="bottom-sheet-backdrop" aria-label="Cerrar filtro de estado" onClick={cerrarFiltros} />
          <section className="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Filtrar reportes por estado">
            <header className="bottom-sheet-header"><strong>Estado</strong><button className="icon-button" type="button" onClick={cerrarFiltros} title="Cerrar" aria-label="Cerrar"><X size={18} /></button></header>
            <div className="bottom-sheet-options">
              {estados.map((item) => (
                <button key={item.value || 'todos-estados'} type="button" className={filters.estado === item.value ? 'active' : ''} onClick={() => { update('estado', item.value); cerrarFiltros(); }}>
                  <CircleDot size={18} /><span>{item.value ? item.label : 'Todos'}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {servicioSheetOpen && (
        <div className="bottom-sheet-layer" role="presentation">
          <button className="bottom-sheet-backdrop" aria-label="Cerrar filtro de servicio" onClick={cerrarFiltros} />
          <section className="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Filtrar reportes por servicio">
            <header className="bottom-sheet-header"><strong>Servicio</strong><button className="icon-button" type="button" onClick={cerrarFiltros} title="Cerrar" aria-label="Cerrar"><X size={18} /></button></header>
            <div className="bottom-sheet-options">
              {servicios.map((item) => (
                <button key={item.value || 'todos-servicios'} type="button" className={filters.servicio === item.value ? 'active' : ''} onClick={() => { update('servicio', item.value); cerrarFiltros(); }}>
                  {servicioIcon(item.value, 18)}<span>{item.value ? item.label : 'Todos'}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {monedaSheetOpen && (
        <div className="bottom-sheet-layer" role="presentation">
          <button className="bottom-sheet-backdrop" aria-label="Cerrar filtro de moneda" onClick={cerrarFiltros} />
          <section className="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Filtrar reportes por moneda">
            <header className="bottom-sheet-header"><strong>Moneda</strong><button className="icon-button" type="button" onClick={cerrarFiltros} title="Cerrar" aria-label="Cerrar"><X size={18} /></button></header>
            <div className="bottom-sheet-options">
              {monedas.map((item) => (
                <button key={item.value || 'todas-monedas'} type="button" className={filters.moneda_pago === item.value ? 'active' : ''} onClick={() => { update('moneda_pago', item.value); cerrarFiltros(); }}>
                  <Coins size={18} /><span>{item.value ? item.label : 'Todos'}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {operadorSheetOpen && (
        <div className="bottom-sheet-layer" role="presentation">
          <button className="bottom-sheet-backdrop" aria-label="Cerrar filtro de operador" onClick={cerrarFiltros} />
          <section className="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Filtrar reportes por operador">
            <header className="bottom-sheet-header"><strong>Operador</strong><button className="icon-button" type="button" onClick={cerrarFiltros} title="Cerrar" aria-label="Cerrar"><X size={18} /></button></header>
            <div className="bottom-sheet-options">
              <button type="button" className={filters.operador_id === '' ? 'active' : ''} onClick={() => { update('operador_id', ''); cerrarFiltros(); }}><UserRound size={18} /><span>Todos</span></button>
              {operadores.map((item) => (
                <button key={item.id} type="button" className={filters.operador_id === String(item.id) ? 'active' : ''} onClick={() => { update('operador_id', String(item.id)); cerrarFiltros(); }}>
                  <UserRound size={18} /><span>{item.nombre} ({item.codigo_operador})</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
