import { useEffect, useState } from 'react';
import { Banknote, BriefcaseBusiness, CalendarRange, CircleDot, Coins, Download, Landmark, MinusCircle, Smartphone, UserRound, WalletCards } from 'lucide-react';
import { crearExtraccionCuenta, descargarOperacionesExcel, descargarReporteCsv, listarCuentasMetodoPago, listarExtraccionesCuenta, listarMetodosPago, listarOperadores, listarSaldosCuenta, obtenerReporte } from '../api/client';
import type { ExtraccionCuenta, MetodoPago, MetodoPagoCuenta, Operador, ReporteGeneral, ReporteGrupo, SaldoCuenta } from '../types/api';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { PageLoader } from '../components/PageLoader';
import { FloatingSelect } from '../components/FloatingSelect';

const estados = [
  { value: '', label: 'Estado' },
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pago_confirmado', label: 'Pago confirmado' },
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
  { value: 'otros', label: 'Otros' },
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

function ReportBarChart({ title, rows }: { title: string; rows: ReporteGrupo[] }) {
  const maxValue = Math.max(...rows.map((row) => row.cantidad), 1);

  return (
    <section className="report-chart">
      <h2>{title}</h2>
      {rows.length === 0 && <div className="empty-row">Sin datos para los filtros seleccionados</div>}
      <div className="report-chart-bars">
        {rows.map((row) => (
          <div className="report-chart-row" key={`${title}-${row.clave ?? 'sin-clave'}`}>
            <span className="report-chart-label">{row.clave ?? 'Sin dato'}</span>
            <div className="report-chart-track" aria-label={`${row.clave}: ${row.cantidad} pedidos`}>
              <div
                className="report-chart-fill"
                style={{ width: `${Math.max((row.cantidad / maxValue) * 100, 3)}%` }}
              />
            </div>
            <strong>{row.cantidad}</strong>
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
    metodo_pago_id: '',
    cuenta_pago_id: '',
  }));
  const [reporte, setReporte] = useState<ReporteGeneral | null>(null);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [operadoresLoading, setOperadoresLoading] = useState(false);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [cuentasPago, setCuentasPago] = useState<MetodoPagoCuenta[]>([]);
  const [saldosCuenta, setSaldosCuenta] = useState<SaldoCuenta[]>([]);
  const [extracciones, setExtracciones] = useState<ExtraccionCuenta[]>([]);
  const [extraccion, setExtraccion] = useState({ cuenta_pago_id: '', monto: '', motivo: '' });
  const [guardandoExtraccion, setGuardandoExtraccion] = useState(false);
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
    listarMetodosPago()
      .then(async (metodos) => {
        setMetodosPago(metodos);
        const cuentas = await Promise.all(
          metodos.map((metodo) => listarCuentasMetodoPago(metodo.id, false)),
        );
        setCuentasPago(cuentas.flat());
      })
      .catch(() => {
        setMetodosPago([]);
        setCuentasPago([]);
      });
  }, []);

  useEffect(() => {
    let active = true;

    async function cargarReporteActual() {
      setLoading(true);
      setError(null);
      try {
        const data = await obtenerReporte(filters);
        const [saldos, movimientos] = await Promise.all([
          listarSaldosCuenta({
            metodo_pago_id: filters.metodo_pago_id,
            cuenta_pago_id: filters.cuenta_pago_id,
          }),
          listarExtraccionesCuenta(filters.cuenta_pago_id),
        ]);
        if (active) {
          setReporte(data);
          setSaldosCuenta(saldos);
          setExtracciones(movimientos);
        }
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
    setFilters((current) => ({
      ...current,
      [field]: value,
      ...(field === 'metodo_pago_id' ? { cuenta_pago_id: '' } : {}),
    }));
  }

  async function registrarExtraccion() {
    if (!extraccion.cuenta_pago_id || Number(extraccion.monto) <= 0 || !extraccion.motivo.trim()) {
      setError('Selecciona una cuenta, escribe un monto valido y el motivo');
      return;
    }
    setGuardandoExtraccion(true);
    setError(null);
    try {
      await crearExtraccionCuenta({
        cuenta_pago_id: Number(extraccion.cuenta_pago_id),
        monto: Number(extraccion.monto),
        motivo: extraccion.motivo.trim(),
      });
      setExtraccion({ cuenta_pago_id: '', monto: '', motivo: '' });
      setSaldosCuenta(await listarSaldosCuenta({
        metodo_pago_id: filters.metodo_pago_id,
        cuenta_pago_id: filters.cuenta_pago_id,
      }));
      setExtracciones(await listarExtraccionesCuenta(filters.cuenta_pago_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la extraccion');
    } finally {
      setGuardandoExtraccion(false);
    }
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

  async function exportarExcel() {
    setError(null);
    try {
      const blob = await descargarOperacionesExcel(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `operaciones_${filters.fecha_desde || 'inicio'}_${filters.fecha_hasta || 'hoy'}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el Excel');
    }
  }

  async function exportarCsv() {
    setError(null);
    try {
      const blob = await descargarReporteCsv(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_resumen_${filters.fecha_desde || 'inicio'}_${filters.fecha_hasta || 'hoy'}.csv`;
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
        <div className="report-filter-field report-filter-floating">
          <FloatingSelect
            value={filters.metodo_pago_id}
            onChange={(value) => update('metodo_pago_id', value)}
            options={[
              { value: '', label: 'Todos los metodos', icon: <WalletCards size={17} /> },
              ...metodosPago.map((metodo) => ({
                value: String(metodo.id),
                label: metodo.nombre,
                description: metodo.moneda,
                icon: <WalletCards size={17} />,
              })),
            ]}
            ariaLabel="Filtrar por metodo de pago"
            align="left"
            buttonClassName="filter-modal-button"
          />
        </div>
        <div className="report-filter-field report-filter-floating">
          <FloatingSelect
            value={filters.cuenta_pago_id}
            onChange={(value) => update('cuenta_pago_id', value)}
            options={[
              { value: '', label: 'Todas las cuentas', icon: <Landmark size={17} /> },
              ...cuentasPago
                .filter((cuenta) => !filters.metodo_pago_id || String(cuenta.metodo_pago_id) === filters.metodo_pago_id)
                .map((cuenta) => ({
                  value: String(cuenta.id),
                  label: cuenta.alias,
                  description: metodosPago.find((metodo) => metodo.id === cuenta.metodo_pago_id)?.nombre,
                  icon: <Landmark size={17} />,
                })),
            ]}
            ariaLabel="Filtrar por cuenta de pago"
            align="left"
            buttonClassName="filter-modal-button"
          />
        </div>
        <div className="report-filter-actions">
          <button type="button" className="ghost-button" onClick={exportarCsv} disabled={loading}>
            <Download size={18} /> CSV resumen
          </button>
          <button type="button" className="ghost-button" onClick={exportarExcel} disabled={loading}>
            <Download size={18} /> Excel de operaciones
          </button>
        </div>
      </div>

      {error && <DismissibleNotice className="notice error" role="alert">{error}</DismissibleNotice>}
      {loading && !reporte && <PageLoader label="Buscando datos del reporte" inline />}
      {loading && reporte && <PageLoader label="Actualizando reporte" inline />}
      {!loading && !error && !reporte && (
        <DismissibleNotice className="notice warning">No se pudo mostrar el reporte todavia. Prueba otro periodo o actualiza la pantalla.</DismissibleNotice>
      )}

      {reporte && (
        <div className={loading ? 'report-loaded is-refreshing' : 'report-loaded'}>
          <div className="report-summary">
            <div><span>Pedidos</span><strong>{reporte.resumen.total_pedidos}</strong></div>
            <div><span>Monto pago</span><strong>{money(reporte.resumen.monto_pago_total)}</strong></div>
            <div><span>Monto resultado</span><strong>{money(reporte.resumen.monto_resultado_total)}</strong></div>
            <div><span>Ganancia</span><strong>{money(reporte.resumen.ganancia_total)}</strong></div>
          </div>

          <section className="report-table account-balance-section">
            <h2>Saldos por cuenta</h2>
            <div className="data-table">
              <div className="data-row header">
                <span>Cuenta</span>
                <span>Ingresos</span>
                <span>Extracciones</span>
                <span>Saldo</span>
              </div>
              {saldosCuenta.map((saldo) => (
                <div className="data-row" key={saldo.cuenta_pago_id}>
                  <span>{saldo.metodo_pago} - {saldo.alias} ({saldo.moneda})</span>
                  <span>{money(saldo.ingresos)}</span>
                  <span>{money(saldo.extracciones)}</span>
                  <strong>{money(saldo.saldo)}</strong>
                </div>
              ))}
            </div>
            <div className="withdrawal-form">
              <FloatingSelect
                value={extraccion.cuenta_pago_id}
                onChange={(value) => setExtraccion((current) => ({ ...current, cuenta_pago_id: value }))}
                options={[
                  { value: '', label: 'Cuenta a extraer', icon: <Landmark size={17} /> },
                  ...saldosCuenta.map((saldo) => ({
                    value: String(saldo.cuenta_pago_id),
                    label: `${saldo.metodo_pago} - ${saldo.alias}`,
                    description: `Disponible: ${money(saldo.saldo)} ${saldo.moneda}`,
                    icon: <Landmark size={17} />,
                  })),
                ]}
                ariaLabel="Cuenta para extraccion"
              />
              <input
                value={extraccion.monto}
                onChange={(event) => setExtraccion((current) => ({ ...current, monto: event.target.value }))}
                inputMode="decimal"
                placeholder="Monto"
              />
              <input
                value={extraccion.motivo}
                onChange={(event) => setExtraccion((current) => ({ ...current, motivo: event.target.value }))}
                placeholder="Motivo de la extraccion"
              />
              <button type="button" className="ghost-button" onClick={registrarExtraccion} disabled={guardandoExtraccion}>
                <MinusCircle size={18} /> {guardandoExtraccion ? 'Registrando...' : 'Registrar extraccion'}
              </button>
            </div>
          </section>

          <section className="report-table">
            <h2>Ultimas extracciones</h2>
            <div className="data-table">
              <div className="data-row header">
                <span>Fecha</span>
                <span>Cuenta</span>
                <span>Monto</span>
                <span>Motivo</span>
              </div>
              {extracciones.length === 0 && <div className="empty-row">Sin extracciones registradas</div>}
              {extracciones.map((movimiento) => {
                const cuenta = cuentasPago.find((item) => item.id === movimiento.cuenta_pago_id);
                return (
                  <div className="data-row" key={movimiento.id}>
                    <span>{new Date(movimiento.created_at).toLocaleString('es-UY')}</span>
                    <span>{cuenta?.alias ?? `Cuenta ${movimiento.cuenta_pago_id}`}</span>
                    <span>{money(movimiento.monto)}</span>
                    <span>{movimiento.motivo}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="report-grid">
            <ReportBarChart title="Pedidos por dia" rows={reporte.por_dia} />
            <ReportBarChart title="Pedidos por estado" rows={reporte.por_estado} />
            <ReportBarChart title="Pedidos por tipo" rows={reporte.por_servicio} />
            <ReportTable title="Por moneda" rows={reporte.por_moneda} />
            <ReportTable title="Por metodo de pago" rows={reporte.por_metodo_pago} />
            <ReportTable title="Por cuenta de pago" rows={reporte.por_cuenta_pago} />
            <ReportTable title="Por operador" rows={reporte.por_operador} />
          </div>
        </div>
      )}

    </section>
  );
}
