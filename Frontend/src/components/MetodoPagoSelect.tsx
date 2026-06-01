import { createElement } from 'react';
import { FloatingSelect } from './FloatingSelect';
import type { MetodoPago } from '../types/api';
import { metodoPagoVisual } from '../utils/metodosPago';

type MetodoPagoSelectProps = {
  value: string;
  metodos: MetodoPago[];
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyLabel: string;
};

function metodoPagoIcon(metodo: MetodoPago) {
  const visual = metodoPagoVisual(metodo);
  return (
    <span className="payment-method-logo payment-method-logo-option">
      {visual.src ? <img src={visual.src} alt="" /> : visual.Icon ? createElement(visual.Icon, { size: 18, strokeWidth: 2.4 }) : <span>{visual.initials}</span>}
    </span>
  );
}

export function MetodoPagoSelect({ value, metodos, onChange, disabled, emptyLabel }: MetodoPagoSelectProps) {
  const selected = metodos.find((metodo) => String(metodo.id) === value);
  const visual = metodoPagoVisual(selected);

  return (
    <span className="payment-method-select">
      <span className="payment-method-logo" aria-hidden="true">
        {visual.src ? <img src={visual.src} alt="" /> : visual.Icon ? createElement(visual.Icon, { size: 22, strokeWidth: 2.4 }) : <span>{visual.initials}</span>}
      </span>
      <FloatingSelect
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={emptyLabel}
        ariaLabel="Metodo de pago"
        options={metodos.length === 0 ? [{ value: '', label: emptyLabel, disabled: true }] : metodos.map((metodo) => ({ value: String(metodo.id), label: metodo.nombre, description: metodo.moneda, icon: metodoPagoIcon(metodo) }))}
        align="left"
      />
    </span>
  );
}
