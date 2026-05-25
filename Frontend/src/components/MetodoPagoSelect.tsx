import type { MetodoPago } from '../types/api';
import { metodoPagoVisual } from '../utils/metodosPago';

type MetodoPagoSelectProps = {
  value: string;
  metodos: MetodoPago[];
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyLabel: string;
};

export function MetodoPagoSelect({ value, metodos, onChange, disabled, emptyLabel }: MetodoPagoSelectProps) {
  const selected = metodos.find((metodo) => String(metodo.id) === value);
  const visual = metodoPagoVisual(selected);

  return (
    <span className="payment-method-select">
      <span className="payment-method-logo" aria-hidden="true">
        {visual.src ? <img src={visual.src} alt="" /> : <span>{visual.initials}</span>}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)} required disabled={disabled}>
        {metodos.length === 0 && <option value="">{emptyLabel}</option>}
        {metodos.map((metodo) => (
          <option key={metodo.id} value={metodo.id}>{metodo.nombre} · {metodo.moneda}</option>
        ))}
      </select>
    </span>
  );
}
