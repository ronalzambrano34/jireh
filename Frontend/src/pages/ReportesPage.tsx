import { useEffect, useState } from 'react';
import { Banknote, BriefcaseBusiness, CalendarRange, CircleDot, Coins, Download, Smartphone, UserRound, WalletCards } from 'lucide-react';
import { descargarReporteCsv, listarOperadores, obtenerReporte } from '../api/client';
import type { Operador, ReporteGeneral, ReporteGrupo } from '../types/api';
import { PageLoader } from '../components/PageLoader';
import { FloatingSelect } from '../components/FloatingSelect';

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
        <div className="report-filter-field report-filter-floating">
          <FloatingSelect
            value={periodo}
            onChange={(value) => updatePeriodo(value as PeriodoReporte)}
            options={periodos.map((item) => ({ value: item.value, label: item.value === 'todo' ? 'Todos los periodos' : item.label, icon: <CalendarRange size={17} /> }))}
            ariaLabel="Filtrar por periodo"
            align="left"
            buttonClassName="filter-modal-button"
          />
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
        <div className="report-filter-field report-filter-floating">
          <FloatingSelect
            value={filters.estado}
            onChange={(value) => update('estado', value)}
            options={estados.map((item) => ({ value: item.value, label: item.value ? item.label : 'Todos los estados', icon: <CircleDot size={17} /> }))}
            ariaLabel="Filtrar por estado"
            align="left"
            buttonClassName="filter-modal-button"
          />
        </div>
        <div className="report-filter-field report-filter-floating">
          <FloatingSelect
            value={filters.servicio}
            onChange={(value) => update('servicio', value)}
            options={servicios.map((item) => ({ value: item.value, label: item.value ? item.label : 'Todos los servicios', icon: servicioIcon(item.value, 17) }))}
            ariaLabel="Filtrar por servicio"
            align="left"
            buttonClassName="filter-modal-button"
          />
        </div>
        <div className="report-filter-field report-filter-floating">
          <FloatingSelect
            value={filters.moneda_pago}
            onChange={(value) => update('moneda_pago', value)}
            options={monedas.map((item) => ({ value: item.value, label: item.value ? item.label : 'Todas las monedas', icon: <Coins size={17} /> }))}
            ariaLabel="Filtrar por moneda"
            align="left"
            buttonClassName="filter-modal-button"
          />
        </div>
        <div className="report-filter-field report-filter-field-wide report-filter-floating">
          <FloatingSelect
            value={filters.operador_id}
            onChange={(value) => update('operador_id', value)}
            options={[{ value: '', label: 'Todos los operadores', icon: <UserRound size={17} /> }, ...operadores.map((item) => ({ value: String(item.id), label: item.nombre, description: item.codigo_operador, icon: <UserRound size={17} /> }))]}
            disabled={operadoresLoading}
            placeholder={operadoresLoading ? 'Cargando operadores' : 'Operador'}
            ariaLabel="Filtrar por operador"
            align="left"
            buttonClassName="filter-modal-button"
          />
        </div>
        <div className="report-filter-actions">
          <button type="button" className="ghost-button" onClick={exportarCsv} disabled={loading}>
            <Download size={18} /> CSV
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {loading && !reporte && <PageLoader label="Buscando datos del reporte" inline />}
      {loading && reporte && <PageLoader label="Actualizando reporte" inline />}
      {!loading && !error && !reporte && (
        <div className="notice warning">No se pudo mostrar el reporte todavia. Prueba otro periodo o actualiza la pantalla.</div>
      )}

      {reporte && (
        <div className={loading ? 'report-loaded is-refreshing' : 'report-loaded'}>
          <div className="report-summary">
            <div><span>Pedidos</span><strong>{reporte.resumen.total_pedidos}</strong></div>
            <div><span>Monto pago</span><strong>{money(reporte.resumen.monto_pago_total)}</strong></div>
            <div><span>Monto resultado</span><strong>{money(reporte.resumen.monto_resultado_total)}</strong></div>
            <div><span>Ganancia</span><strong>{money(reporte.resumen.ganancia_total)}</strong></div>
          </div>

          <div className="report-grid">
            <ReportTable title="Por dias" rows={reporte.por_dia} />
            <ReportTable title="Por estado" rows={reporte.por_estado} />
            <ReportTable title="Por servicio" rows={reporte.por_servicio} />
            <ReportTable title="Por moneda" rows={reporte.por_moneda} />
            <ReportTable title="Por metodo de pago" rows={reporte.por_metodo_pago} />
            <ReportTable title="Por operador" rows={reporte.por_operador} />
          </div>
        </div>
      )}

    </section>
  );
}
