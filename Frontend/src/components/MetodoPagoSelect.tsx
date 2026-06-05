import { createElement, useEffect, useState } from 'react';
import { FloatingSelect } from './FloatingSelect';
import { listarCuentasMetodoPago } from '../api/client';
import type { MetodoPago, MetodoPagoCuenta } from '../types/api';
import { metodoPagoVisual } from '../utils/metodosPago';

type MetodoPagoSelectProps = {
  value: string;
  metodos: MetodoPago[];
  onChange: (value: string) => void;
  cuentaValue?: string;
  onCuentaChange?: (value: string) => void;
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

export function MetodoPagoSelect({
  value,
  metodos,
  onChange,
  cuentaValue = '',
  onCuentaChange,
  disabled,
  emptyLabel,
}: MetodoPagoSelectProps) {
  const [cuentas, setCuentas] = useState<MetodoPagoCuenta[]>([]);

  useEffect(() => {
    let active = true;
    if (!value || !onCuentaChange) {
      setCuentas([]);
      onCuentaChange?.('');
      return () => { active = false; };
    }

    onCuentaChange('');
    listarCuentasMetodoPago(Number(value), false)
      .then((data) => {
        if (!active) return;
        setCuentas(data);
        const actualExiste = data.some((cuenta) => String(cuenta.id) === cuentaValue);
        if (!actualExiste) {
          const predeterminada = data.find((cuenta) => cuenta.predeterminada) ?? data[0];
          onCuentaChange(predeterminada ? String(predeterminada.id) : '');
        }
      })
      .catch(() => {
        if (active) {
          setCuentas([]);
          onCuentaChange('');
        }
      });

    return () => { active = false; };
  }, [value]);

  return (
    <span className="payment-method-select">
      <FloatingSelect
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={emptyLabel}
        ariaLabel="Metodo de pago"
        options={metodos.length === 0 ? [{ value: '', label: emptyLabel, disabled: true }] : metodos.map((metodo) => ({ value: String(metodo.id), label: metodo.nombre, description: metodo.moneda, icon: metodoPagoIcon(metodo) }))}
        align="left"
      />
      {cuentas.length > 0 && onCuentaChange && (
        <FloatingSelect
          value={cuentaValue}
          onChange={onCuentaChange}
          disabled={disabled}
          placeholder="Cuenta de cobro"
          ariaLabel="Cuenta de cobro"
          options={cuentas.map((cuenta) => ({
            value: String(cuenta.id),
            label: cuenta.alias,
            description: cuenta.titular,
          }))}
          align="left"
        />
      )}
    </span>
  );
}
