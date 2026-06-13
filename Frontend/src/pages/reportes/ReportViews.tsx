import type { ReporteGrupo, ReporteResumen } from '../../types/api';

export function reportMoney(value: number) {
  return new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 }).format(value);
}

export function ReportSummary({ resumen }: { resumen: ReporteResumen }) {
  return (
    <div className="report-summary">
      <div><span>Pedidos</span><strong>{resumen.total_pedidos}</strong></div>
      <div><span>Monto pago</span><strong>{reportMoney(resumen.monto_pago_total)}</strong></div>
      <div><span>Monto resultado</span><strong>{reportMoney(resumen.monto_resultado_total)}</strong></div>
      <div><span>Ganancia</span><strong>{reportMoney(resumen.ganancia_total)}</strong></div>
    </div>
  );
}

export function ReportTable({ title, rows }: { title: string; rows: ReporteGrupo[] }) {
  return (
    <section className="report-table">
      <h2>{title}</h2>
      <div className="data-table">
        <div className="data-row header">
          <span>Clave</span><span>Cantidad</span><span>Monto pago</span><span>Ganancia</span>
        </div>
        {rows.length === 0 && <div className="empty-row">Sin datos para los filtros seleccionados</div>}
        {rows.map((row) => (
          <div className="data-row" key={`${title}-${row.clave ?? 'sin-clave'}`}>
            <span>{row.clave ?? 'Sin dato'}</span>
            <span>{row.cantidad}</span>
            <span>{reportMoney(row.monto_pago)}</span>
            <span>{reportMoney(row.ganancia)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReportBarChart({ title, rows }: { title: string; rows: ReporteGrupo[] }) {
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
              <div className="report-chart-fill" style={{ width: `${Math.max((row.cantidad / maxValue) * 100, 3)}%` }} />
            </div>
            <strong>{row.cantidad}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
