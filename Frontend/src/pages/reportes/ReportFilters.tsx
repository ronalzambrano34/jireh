import { Banknote, BriefcaseBusiness, CalendarRange, CircleDot, Coins, Download, Landmark, Smartphone, UserRound, WalletCards } from 'lucide-react';
import type { MetodoPago, MetodoPagoCuenta, Operador } from '../../types/api';
import { FloatingSelect } from '../../components/FloatingSelect';

export const reportPeriods = [
  { value: 'todo', label: 'Periodo' },
  { value: 'hoy', label: 'HOY' },
  { value: 'ayer', label: 'AYER' },
  { value: 'semana', label: 'SEMANA' },
  { value: 'mes', label: 'MES' },
  { value: 'personalizado', label: 'PERSONALIZADO' },
] as const;

export type ReportPeriod = typeof reportPeriods[number]['value'];

export type ReportFilterState = {
  fecha_desde: string;
  fecha_hasta: string;
  estado: string;
  servicio: string;
  moneda_pago: string;
  operador_id: string;
  metodo_pago_id: string;
  cuenta_pago_id: string;
};

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

const monedas = ['', 'BRL', 'UYU', 'USD', 'EUR'];

function servicioIcon(value: string) {
  if (value === 'transferencia' || value === 'divisa') return <WalletCards size={17} />;
  if (value === 'efectivo') return <Banknote size={17} />;
  if (value === 'saldo') return <Smartphone size={17} />;
  return <BriefcaseBusiness size={17} />;
}

type ReportFiltersProps = {
  periodo: ReportPeriod;
  filters: ReportFilterState;
  operadores: Operador[];
  operadoresLoading: boolean;
  metodosPago: MetodoPago[];
  cuentasPago: MetodoPagoCuenta[];
  loading: boolean;
  onPeriodoChange: (value: ReportPeriod) => void;
  onChange: (field: keyof ReportFilterState, value: string) => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
};

export function ReportFilters(props: ReportFiltersProps) {
  const selectClass = 'report-filter-field report-filter-floating';

  return (
    <div className="filters report-filters">
      <div className={selectClass}>
        <FloatingSelect value={props.periodo} onChange={(value) => props.onPeriodoChange(value as ReportPeriod)} options={reportPeriods.map((item) => ({ value: item.value, label: item.value === 'todo' ? 'Todos los periodos' : item.label, icon: <CalendarRange size={17} /> }))} ariaLabel="Filtrar por periodo" align="left" buttonClassName="filter-modal-button" />
      </div>
      {props.periodo === 'personalizado' && (
        <>
          <label className="report-filter-field"><CalendarRange className="report-filter-icon" size={17} /><input aria-label="Desde" type="date" value={props.filters.fecha_desde} onChange={(event) => props.onChange('fecha_desde', event.target.value)} /></label>
          <label className="report-filter-field"><CalendarRange className="report-filter-icon" size={17} /><input aria-label="Hasta" type="date" value={props.filters.fecha_hasta} onChange={(event) => props.onChange('fecha_hasta', event.target.value)} /></label>
        </>
      )}
      <div className={selectClass}>
        <FloatingSelect value={props.filters.estado} onChange={(value) => props.onChange('estado', value)} options={estados.map((item) => ({ value: item.value, label: item.value ? item.label : 'Todos los estados', icon: <CircleDot size={17} /> }))} ariaLabel="Filtrar por estado" align="left" buttonClassName="filter-modal-button" />
      </div>
      <div className={selectClass}>
        <FloatingSelect value={props.filters.servicio} onChange={(value) => props.onChange('servicio', value)} options={servicios.map((item) => ({ value: item.value, label: item.value ? item.label : 'Todos los servicios', icon: servicioIcon(item.value) }))} ariaLabel="Filtrar por servicio" align="left" buttonClassName="filter-modal-button" />
      </div>
      <div className={selectClass}>
        <FloatingSelect value={props.filters.moneda_pago} onChange={(value) => props.onChange('moneda_pago', value)} options={monedas.map((value) => ({ value, label: value || 'Todas las monedas', icon: <Coins size={17} /> }))} ariaLabel="Filtrar por moneda" align="left" buttonClassName="filter-modal-button" />
      </div>
      <div className={`${selectClass} report-filter-field-wide`}>
        <FloatingSelect value={props.filters.operador_id} onChange={(value) => props.onChange('operador_id', value)} options={[{ value: '', label: 'Todos los operadores', icon: <UserRound size={17} /> }, ...props.operadores.map((item) => ({ value: String(item.id), label: item.nombre, description: item.codigo_operador, icon: <UserRound size={17} /> }))]} disabled={props.operadoresLoading} placeholder={props.operadoresLoading ? 'Cargando operadores' : 'Operador'} ariaLabel="Filtrar por operador" align="left" buttonClassName="filter-modal-button" />
      </div>
      <div className={selectClass}>
        <FloatingSelect value={props.filters.metodo_pago_id} onChange={(value) => props.onChange('metodo_pago_id', value)} options={[{ value: '', label: 'Todos los metodos', icon: <WalletCards size={17} /> }, ...props.metodosPago.map((metodo) => ({ value: String(metodo.id), label: metodo.nombre, description: metodo.moneda, icon: <WalletCards size={17} /> }))]} ariaLabel="Filtrar por metodo de pago" align="left" buttonClassName="filter-modal-button" />
      </div>
      <div className={selectClass}>
        <FloatingSelect value={props.filters.cuenta_pago_id} onChange={(value) => props.onChange('cuenta_pago_id', value)} options={[{ value: '', label: 'Todas las cuentas', icon: <Landmark size={17} /> }, ...props.cuentasPago.filter((cuenta) => !props.filters.metodo_pago_id || String(cuenta.metodo_pago_id) === props.filters.metodo_pago_id).map((cuenta) => ({ value: String(cuenta.id), label: cuenta.alias, description: props.metodosPago.find((metodo) => metodo.id === cuenta.metodo_pago_id)?.nombre, icon: <Landmark size={17} /> }))]} ariaLabel="Filtrar por cuenta de pago" align="left" buttonClassName="filter-modal-button" />
      </div>
      <div className="report-filter-actions">
        <button type="button" className="ghost-button" onClick={props.onExportCsv} disabled={props.loading}><Download size={18} /> CSV resumen</button>
        <button type="button" className="ghost-button" onClick={props.onExportExcel} disabled={props.loading}><Download size={18} /> Excel de operaciones</button>
      </div>
    </div>
  );
}
