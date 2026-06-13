import { useEffect, useState } from 'react';
import { Landmark, MinusCircle } from 'lucide-react';
import { crearExtraccionCuenta, descargarOperacionesExcel, descargarReporteCsv, listarCuentasMetodoPago, listarExtraccionesCuenta, listarMetodosPago, listarOperadores, listarSaldosCuenta, obtenerReporte } from '../api/client';
import type { ExtraccionCuenta, MetodoPago, MetodoPagoCuenta, Operador, ReporteGeneral, SaldoCuenta } from '../types/api';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { PageLoader } from '../components/PageLoader';
import { FloatingSelect } from '../components/FloatingSelect';
import { ReportFilters, type ReportFilterState, type ReportPeriod } from './reportes/ReportFilters';
import { ReportBarChart, ReportSummary, ReportTable, reportMoney } from './reportes/ReportViews';
import './reportes/ReportesPage.css';

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function rangoPeriodo(periodo: ReportPeriod) {
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

export function ReportesPage() {
  const [periodo, setPeriodo] = useState<ReportPeriod>('mes');
  const [filters, setFilters] = useState<ReportFilterState>(() => ({
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

  function update(field: keyof ReportFilterState, value: string) {
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

  function updatePeriodo(value: ReportPeriod) {
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
      <ReportFilters
        periodo={periodo}
        filters={filters}
        operadores={operadores}
        operadoresLoading={operadoresLoading}
        metodosPago={metodosPago}
        cuentasPago={cuentasPago}
        loading={loading}
        onPeriodoChange={updatePeriodo}
        onChange={update}
        onExportCsv={() => void exportarCsv()}
        onExportExcel={() => void exportarExcel()}
      />

      {error && <DismissibleNotice className="notice error" role="alert">{error}</DismissibleNotice>}
      {loading && !reporte && <PageLoader label="Buscando datos del reporte" inline />}
      {loading && reporte && <PageLoader label="Actualizando reporte" inline />}
      {!loading && !error && !reporte && (
        <DismissibleNotice className="notice warning">No se pudo mostrar el reporte todavia. Prueba otro periodo o actualiza la pantalla.</DismissibleNotice>
      )}

      {reporte && (
        <div className={loading ? 'report-loaded is-refreshing' : 'report-loaded'}>
          <ReportSummary resumen={reporte.resumen} />

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
                  <span data-label="Cuenta">{saldo.metodo_pago} - {saldo.alias} ({saldo.moneda})</span>
                  <span data-label="Ingresos">{reportMoney(saldo.ingresos)}</span>
                  <span data-label="Extracciones">{reportMoney(saldo.extracciones)}</span>
                  <strong data-label="Saldo">{reportMoney(saldo.saldo)}</strong>
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
                    description: `Disponible: ${reportMoney(saldo.saldo)} ${saldo.moneda}`,
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
                    <span data-label="Fecha">{new Date(movimiento.created_at).toLocaleString('es-UY')}</span>
                    <span data-label="Cuenta">{cuenta?.alias ?? `Cuenta ${movimiento.cuenta_pago_id}`}</span>
                    <span data-label="Monto">{reportMoney(movimiento.monto)}</span>
                    <span data-label="Motivo">{movimiento.motivo}</span>
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
