import { lazy } from 'react';
import type { PedidoDetalle } from '../types/api';
import './create/CreateOrderPage.css';

const TransferenciaForm = lazy(() => import('./TransferenciaForm').then((module) => ({ default: module.TransferenciaForm })));
const EfectivoForm = lazy(() => import('./EfectivoForm').then((module) => ({ default: module.EfectivoForm })));
const SaldoForm = lazy(() => import('./SaldoForm').then((module) => ({ default: module.SaldoForm })));
const DivisaForm = lazy(() => import('./DivisaForm').then((module) => ({ default: module.DivisaForm })));
const OtrosForm = lazy(() => import('./OtrosForm').then((module) => ({ default: module.OtrosForm })));

export type CreateService = 'transferencia' | 'efectivo' | 'saldo' | 'divisa' | 'otros';

export type CreateOrderDraft = {
  monto_pago?: string;
  moneda_pago?: string;
  paquete_saldo_id?: string;
  monto_divisa?: string;
  tipo_tarjeta?: string;
};

export function CreateOrderPage({
  service,
  draft,
  operadorId,
  onServiceChange,
  onCreated,
}: {
  service: CreateService;
  draft: CreateOrderDraft;
  operadorId: number;
  onServiceChange: (service: CreateService) => void;
  onCreated: (pedido: PedidoDetalle) => void;
}) {
  const services: { value: CreateService; label: string }[] = [
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'saldo', label: 'Saldo' },
    { value: 'divisa', label: 'Divisa' },
    { value: 'otros', label: 'Otros' },
  ];

  return (
    <section className="create-stack">
      <div className="service-tabs">
        {services.map((item) => (
          <button type="button" className={service === item.value ? 'active' : ''} onClick={() => onServiceChange(item.value)} key={item.value}>
            {item.label}
          </button>
        ))}
      </div>
      {service === 'transferencia' && <TransferenciaForm operadorId={operadorId} initialData={draft} onCreated={onCreated} />}
      {service === 'efectivo' && <EfectivoForm operadorId={operadorId} initialData={draft} onCreated={onCreated} />}
      {service === 'saldo' && <SaldoForm operadorId={operadorId} initialData={draft} onCreated={onCreated} />}
      {service === 'divisa' && <DivisaForm operadorId={operadorId} initialData={draft} onCreated={onCreated} />}
      {service === 'otros' && <OtrosForm operadorId={operadorId} onCreated={onCreated} />}
    </section>
  );
}
