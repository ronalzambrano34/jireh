import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { PedidoDetalle } from '../types/api';
import {
  borrarBorradorNuevoPedido,
  borradorNuevoPedidoTieneContenido,
  leerBorradorNuevoPedido,
  mezclarBorradoresNuevoPedido,
  type NuevoPedidoDraft,
  type NuevoPedidoServicio,
} from '../utils/borradoresPedido';
import './create/CreateOrderPage.css';

const TransferenciaForm = lazy(() => import('./TransferenciaForm').then((module) => ({ default: module.TransferenciaForm })));
const EfectivoForm = lazy(() => import('./EfectivoForm').then((module) => ({ default: module.EfectivoForm })));
const SaldoForm = lazy(() => import('./SaldoForm').then((module) => ({ default: module.SaldoForm })));
const DivisaForm = lazy(() => import('./DivisaForm').then((module) => ({ default: module.DivisaForm })));
const OtrosForm = lazy(() => import('./OtrosForm').then((module) => ({ default: module.OtrosForm })));

export type CreateService = NuevoPedidoServicio;

export type CreateOrderDraft = NuevoPedidoDraft;

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
  onCreated: (pedido: PedidoDetalle, pagoConfirmado: boolean, advertencia?: string) => void;
}) {
  const [draftVersion, setDraftVersion] = useState(0);
  const draftSignature = useMemo(() => JSON.stringify(draft ?? {}), [draft]);
  const [ignoredDraftSignature, setIgnoredDraftSignature] = useState<string | null>(null);
  const savedDraft = useMemo(
    () => leerBorradorNuevoPedido(operadorId, service),
    [draftVersion, operadorId, service],
  );
  const initialData = useMemo(
    () => mezclarBorradoresNuevoPedido(savedDraft, ignoredDraftSignature === draftSignature ? null : draft),
    [draft, draftSignature, ignoredDraftSignature, savedDraft],
  );
  const [draftSaved, setDraftSaved] = useState(() => borradorNuevoPedidoTieneContenido(initialData));
  const formKey = `${operadorId}:${service}:${draftVersion}:${ignoredDraftSignature ?? 'active'}`;

  useEffect(() => {
    setIgnoredDraftSignature(null);
  }, [draftSignature, operadorId, service]);

  useEffect(() => {
    setDraftSaved(borradorNuevoPedidoTieneContenido(initialData));
  }, [initialData]);

  const handleDraftSavedChange = useCallback((saved: boolean) => {
    setDraftSaved(saved);
  }, []);

  function descartarBorrador() {
    borrarBorradorNuevoPedido(operadorId, service);
    setIgnoredDraftSignature(draftSignature);
    setDraftSaved(false);
    setDraftVersion((version) => version + 1);
  }

  const services: { value: CreateService; label: string }[] = [
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'saldo', label: 'Saldo' },
    { value: 'divisa', label: 'Divisa' },
    { value: 'otros', label: 'Otros' },
  ];

  return (
    <section className="create-stack app-page-width">
      <div className="service-tabs">
        {services.map((item) => (
          <button type="button" className={service === item.value ? 'active' : ''} onClick={() => onServiceChange(item.value)} key={item.value}>
            {item.label}
          </button>
        ))}
      </div>
      {draftSaved && (
        <div className="notice success compact-notice create-draft-notice" role="status">
          <span>Borrador guardado localmente</span>
          <button type="button" onClick={descartarBorrador}>Descartar</button>
        </div>
      )}
      {service === 'transferencia' && <TransferenciaForm key={formKey} operadorId={operadorId} initialData={initialData} onDraftSavedChange={handleDraftSavedChange} onCreated={onCreated} />}
      {service === 'efectivo' && <EfectivoForm key={formKey} operadorId={operadorId} initialData={initialData} onDraftSavedChange={handleDraftSavedChange} onCreated={onCreated} />}
      {service === 'saldo' && <SaldoForm key={formKey} operadorId={operadorId} initialData={initialData} onDraftSavedChange={handleDraftSavedChange} onCreated={onCreated} />}
      {service === 'divisa' && <DivisaForm key={formKey} operadorId={operadorId} initialData={initialData} onDraftSavedChange={handleDraftSavedChange} onCreated={onCreated} />}
      {service === 'otros' && <OtrosForm key={formKey} operadorId={operadorId} initialData={initialData} onDraftSavedChange={handleDraftSavedChange} onCreated={onCreated} />}
    </section>
  );
}
