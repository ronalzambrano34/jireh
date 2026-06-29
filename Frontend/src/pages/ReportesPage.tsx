import { useRef, useState } from 'react';
import { CalendarRange, Download, Landmark, MinusCircle } from 'lucide-react';
import { crearExtraccionCuenta, descargarOperacionesExcel, descargarReporteCsv, listarExtraccionesCuenta, listarSaldosCuenta, obtenerReporte } from '../api/client';
import {
  listarCuentasMetodoPagoDedup,
  listarExtraccionesCuentaDedup,
  listarMetodosPagoDedup,
  listarOperadoresDedup,
  listarSaldosCuentaDedup,
  obtenerReporteDedup,
} from '../api/dedupedReads';
import type { ExtraccionCuenta, MetodoPago, MetodoPagoCuenta, Operador, ReporteGeneral, SaldoCuenta } from '../types/api';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { FloatingToast } from '../components/FloatingToast';
import { Modal } from '../components/Modal';
import { PageLoader } from '../components/PageLoader';
import { FloatingSelect } from '../components/FloatingSelect';
import { isAbortError, useAbortableEffect } from '../hooks/useAbortableEffect';
import { ReportFilters, reportPeriods, type ReportFilterState, type ReportPeriod } from './reportes/ReportFilters';
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
  const [exportando, setExportando] = useState<'csv' | 'excel' | null>(null);
  const [exportModal, setExportModal] = useState<'csv' | 'excel' | null>(null);
  const [exportPeriodo, setExportPeriodo] = useState<ReportPeriod>('mes');
  const [exportFilters, setExportFilters] = useState<ReportFilterState>(() => filters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardandoExtraccionRef = useRef(false);
  const exportandoRef = useRef(false);

  async function cargarOperadores(signal?: AbortSignal) {
    setOperadoresLoading(true);
    try {
      setOperadores(await listarOperadoresDedup(true, { signal }));
    } catch (err) {
      if (!isAbortError(err)) setError(err instanceof Error ? err.message : 'No se pudieron cargar los operadores');
    } finally {
      if (!signal?.aborted) setOperadoresLoading(false);
    }
  }

  useAbortableEffect((signal) => {
    void cargarOperadores(signal);
    listarMetodosPagoDedup(undefined, false, { signal })
      .then(async (metodos) => {
        setMetodosPago(metodos);
        const cuentas = await Promise.all(
          metodos.map((metodo) => listarCuentasMetodoPagoDedup(metodo.id, false, { signal })),
        );
        setCuentasPago(cuentas.flat());
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los metodos de pago');
      });
  }, []);

  useAbortableEffect((signal) => {
    let active = true;

    async function cargarReporteActual() {
      setLoading(true);
      setError(null);
      try {
        const data = await obtenerReporteDedup(filters, { signal });
        const [saldos, movimientos] = await Promise.all([
          listarSaldosCuentaDedup({
            metodo_pago_id: filters.metodo_pago_id,
            cuenta_pago_id: filters.cuenta_pago_id,
          }, { signal }),
          listarExtraccionesCuentaDedup(filters.cuenta_pago_id, { signal }),
        ]);
        if (active) {
          setReporte(data);
          setSaldosCuenta(saldos);
          setExtracciones(movimientos);
        }
      } catch (err) {
        if (active && !isAbortError(err)) setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte');
      } finally {
        if (active && !signal.aborted) setLoading(false);
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
    if (guardandoExtraccionRef.current) return;
    if (!extraccion.cuenta_pago_id || Number(extraccion.monto) <= 0 || !extraccion.motivo.trim()) {
      setError('Selecciona una cuenta, escribe un monto valido y el motivo');
      return;
    }
    guardandoExtraccionRef.current = true;
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
      guardandoExtraccionRef.current = false;
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

  function abrirModalExportacion(tipo: 'csv' | 'excel') {
    setExportModal(tipo);
    setExportPeriodo(periodo);
    setExportFilters(filters);
  }

  function cerrarModalExportacion() {
    if (exportando) return;
    setExportModal(null);
  }

  function updateExportPeriodo(value: ReportPeriod) {
    setExportPeriodo(value);
    if (value !== 'personalizado') {
      setExportFilters((current) => ({
        ...current,
        ...rangoPeriodo(value),
      }));
    }
  }

  function updateExportFilter(field: keyof ReportFilterState, value: string) {
    setExportFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validarRangoExportacion(filtrosExportacion: ReportFilterState) {
    if (
      filtrosExportacion.fecha_desde
      && filtrosExportacion.fecha_hasta
      && filtrosExportacion.fecha_desde > filtrosExportacion.fecha_hasta
    ) {
      setError('La fecha inicial no puede ser mayor que la fecha final');
      return false;
    }

    return true;
  }

  async function exportarExcel(filtrosExportacion = exportFilters) {
    if (exportandoRef.current) return;
    if (!validarRangoExportacion(filtrosExportacion)) return;
    exportandoRef.current = true;
    setExportando('excel');
    setError(null);
    try {
      const blob = await descargarOperacionesExcel(filtrosExportacion);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `operaciones_${filtrosExportacion.fecha_desde || 'inicio'}_${filtrosExportacion.fecha_hasta || 'hoy'}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setExportModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el Excel');
    } finally {
      exportandoRef.current = false;
      setExportando(null);
    }
  }

  async function exportarCsv(filtrosExportacion = exportFilters) {
    if (exportandoRef.current) return;
    if (!validarRangoExportacion(filtrosExportacion)) return;
    exportandoRef.current = true;
    setExportando('csv');
    setError(null);
    try {
      const blob = await descargarReporteCsv(filtrosExportacion);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_resumen_${filtrosExportacion.fecha_desde || 'inicio'}_${filtrosExportacion.fecha_hasta || 'hoy'}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setExportModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el CSV');
    } finally {
      exportandoRef.current = false;
      setExportando(null);
    }
  }

  return (
    <section className="reports-page app-page-width">
      <ReportFilters
        periodo={periodo}
        filters={filters}
        operadores={operadores}
        operadoresLoading={operadoresLoading}
        metodosPago={metodosPago}
        cuentasPago={cuentasPago}
        loading={loading || exportando !== null}
        onPeriodoChange={updatePeriodo}
        onChange={update}
        onExportCsv={() => abrirModalExportacion('csv')}
        onExportExcel={() => abrirModalExportacion('excel')}
      />

      {error && <FloatingToast onDismiss={() => setError(null)}>{error}</FloatingToast>}
      {exportModal && (
        <Modal
          title={exportModal === 'csv' ? 'Descargar CSV' : 'Descargar Excel'}
          subtitle="Selecciona el periodo de descarga"
          onClose={cerrarModalExportacion}
          className="report-download-modal"
        >
          <div className="report-download-form">
            <div className="report-download-period">
              <FloatingSelect
                value={exportPeriodo}
                onChange={(value) => updateExportPeriodo(value as ReportPeriod)}
                options={reportPeriods.map((item) => ({
                  value: item.value,
                  label: item.value === 'todo' ? 'Todos los periodos' : item.label,
                  icon: <CalendarRange size={17} />,
                }))}
                ariaLabel="Periodo de descarga"
                align="left"
                buttonClassName="filter-modal-button"
              />
            </div>
            <div className="report-download-dates">
              <label>
                Desde
                <input
                  type="date"
                  value={exportFilters.fecha_desde}
                  onChange={(event) => updateExportFilter('fecha_desde', event.target.value)}
                  disabled={exportPeriodo !== 'personalizado'}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={exportFilters.fecha_hasta}
                  onChange={(event) => updateExportFilter('fecha_hasta', event.target.value)}
                  disabled={exportPeriodo !== 'personalizado'}
                />
              </label>
            </div>
            <div className="report-download-actions">
              <button className="ghost-button" type="button" onClick={cerrarModalExportacion} disabled={exportando !== null}>
                Cancelar
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => exportModal === 'csv' ? void exportarCsv() : void exportarExcel(exportFilters)}
                disabled={exportando !== null}
              >
                <Download size={17} />
                {exportando ? 'Descargando...' : 'Descargar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
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
