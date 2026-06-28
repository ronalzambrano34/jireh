import { createElement, useEffect, useState } from 'react';
import { FloatingSelect } from './FloatingSelect';
import { listarCuentasMetodoPagoDedup } from '../api/dedupedReads';
import type { MetodoPago, MetodoPagoCuenta } from '../types/api';
import { isAbortError, useAbortableEffect } from '../hooks/useAbortableEffect';
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
  const [cuentasState, setCuentasState] = useState<{ metodoId: string; items: MetodoPagoCuenta[] }>({
    metodoId: '',
    items: [],
  });
  const cuentas = cuentasState.metodoId === value ? cuentasState.items : [];

  useAbortableEffect((signal) => {
    let active = true;
    if (!value || !onCuentaChange) {
      setCuentasState({ metodoId: '', items: [] });
      onCuentaChange?.('');
      return () => { active = false; };
    }

    onCuentaChange('');
    listarCuentasMetodoPagoDedup(Number(value), false, { signal })
      .then((data) => {
        if (!active) return;
        setCuentasState({ metodoId: value, items: data });
      })
      .catch((err) => {
        if (isAbortError(err)) return;
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
          placeholder="Cuenta de pago"
          ariaLabel="Cuenta de pago"
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
