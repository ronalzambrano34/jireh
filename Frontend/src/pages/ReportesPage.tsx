import { FormEvent, useEffect, useState } from 'react';
import { BriefcaseBusiness, CalendarRange, CircleDot, Coins, Download, RefreshCw, UserRound } from 'lucide-react';
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
  const [periodo, setPeriodo] = useState<PeriodoReporte>('todo');
  const [filters, setFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    estado: '',
    servicio: '',
    moneda_pago: '',
    operador_id: '',
  });
  const [reporte, setReporte] = useState<ReporteGeneral | null>(null);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [operadoresLoading, setOperadoresLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      setReporte(await obtenerReporte(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte');
    } finally {
      setLoading(false);
    }
  }

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
    void cargar();
    void cargarOperadores();
  }, []);

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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void cargar();
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
      <form className="filters report-filters" onSubmit={handleSubmit}>
        <label className="report-filter-field">
          <CalendarRange className="report-filter-icon" size={17} />
          <select aria-label="Periodo" value={periodo} onChange={(event) => updatePeriodo(event.target.value as PeriodoReporte)}>
            {periodos.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
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
        <label className="report-filter-field">
          <CircleDot className="report-filter-icon" size={17} />
          <select aria-label="Estado" value={filters.estado} onChange={(event) => update('estado', event.target.value)}>
            {estados.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="report-filter-field">
          <BriefcaseBusiness className="report-filter-icon" size={17} />
          <select aria-label="Servicio" value={filters.servicio} onChange={(event) => update('servicio', event.target.value)}>
            {servicios.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="report-filter-field">
          <Coins className="report-filter-icon" size={17} />
          <select aria-label="Moneda" value={filters.moneda_pago} onChange={(event) => update('moneda_pago', event.target.value)}>
            <option value="">Moneda</option>
            <option value="BRL">BRL</option>
            <option value="UYU">UYU</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="report-filter-field">
          <UserRound className="report-filter-icon" size={17} />
          <select aria-label="Operador" value={filters.operador_id} onChange={(event) => update('operador_id', event.target.value)} disabled={operadoresLoading}>
            <option value="">Operador</option>
            {operadores.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} ({item.codigo_operador})
              </option>
            ))}
          </select>
        </label>
        <div className="report-filter-actions">
          <button className="primary-button" disabled={loading}>
            <RefreshCw size={18} /> {loading ? 'Cargando...' : 'Aplicar'}
          </button>
          <button type="button" className="ghost-button" onClick={exportarCsv} disabled={loading}>
            <Download size={18} /> CSV
          </button>
        </div>
      </form>

      {error && <div className="notice error">{error}</div>}

      {reporte && (
        <>
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
        </>
      )}
    </section>
  );
}
