import type { CalculoOperacionResponse } from '../types/api';

type CalculoPreviewProps = {
  calculo: CalculoOperacionResponse | null;
  loading?: boolean;
  error?: string | null;
  monedaResultado?: string;
  tasaLabel?: string;
};

function formatValue(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return Number(value).toLocaleString('es-UY', { maximumFractionDigits: 2 });
}

export function CalculoPreview({ calculo, loading, error, monedaResultado = 'CUP', tasaLabel = 'Tasa aplicada' }: CalculoPreviewProps) {
  return (
    <div className={error ? 'payment-preview error' : 'payment-preview'}>
      <div>
        <span>Recibe destinatario</span>
        <strong>{loading ? 'Calculando...' : calculo ? `${formatValue(calculo.monto_resultado)} ${monedaResultado}` : '-'}</strong>
      </div>
      <div>
        <span>{tasaLabel}</span>
        <strong>{loading ? '-' : formatValue(calculo?.tasa_final ?? calculo?.tasa)}</strong>
      </div>
      {error && <small>{error}</small>}
    </div>
  );
}
