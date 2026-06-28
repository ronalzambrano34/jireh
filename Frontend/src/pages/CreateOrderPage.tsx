import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { PedidoDetalle } from '../types/api';
import { Modal } from '../components/Modal';
import {
  borrarBorradorNuevoPedido,
  borradorNuevoPedidoTieneContenido,
  leerBorradorNuevoPedidoGuardado,
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
type DraftDecision = 'pending' | 'continue' | 'new';

const serviceLabels: Record<CreateService, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  saldo: 'Saldo',
  divisa: 'Divisa',
  otros: 'Otros',
};

const draftFieldLabels: Record<string, string> = {
  monto_pago: 'Monto',
  moneda_pago: 'Moneda',
  numero_tarjeta: 'Tarjeta',
  telefono_destinatario: 'Telefono destino',
  nombre_cliente: 'Cliente',
  numero_telefono_cliente: 'Telefono cliente',
  observaciones: 'Observaciones',
};

function formatearFechaBorrador(value?: string) {
  if (!value) return 'Guardado recientemente';
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return 'Guardado recientemente';
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

function resumenBorrador(draft?: NuevoPedidoDraft | null) {
  if (!draft) return [];
  return Object.entries(draft)
    .filter(([key, value]) => Boolean(value?.trim()) && key in draftFieldLabels)
    .slice(0, 4)
    .map(([key, value]) => ({
      label: draftFieldLabels[key],
      value: value ?? '',
    }));
}

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
  const [draftDecision, setDraftDecision] = useState<DraftDecision>('continue');
  const savedDraftEntry = useMemo(
    () => leerBorradorNuevoPedidoGuardado(operadorId, service),
    [draftVersion, operadorId, service],
  );
  const savedDraft = savedDraftEntry?.data ?? null;
  const hasSavedDraft = Boolean(savedDraftEntry && borradorNuevoPedidoTieneContenido(savedDraftEntry.data));
  const parentDraft = useMemo(
    () => (ignoredDraftSignature === draftSignature ? null : draft),
    [draft, draftSignature, ignoredDraftSignature],
  );
  const initialData = useMemo(
    () => {
      if (draftDecision === 'pending') return {};
      if (draftDecision === 'continue' && savedDraft) return mezclarBorradoresNuevoPedido(savedDraft);
      return mezclarBorradoresNuevoPedido(parentDraft);
    },
    [draftDecision, parentDraft, savedDraft],
  );
  const [draftSaved, setDraftSaved] = useState(() => draftDecision !== 'pending' && borradorNuevoPedidoTieneContenido(initialData));
  const promptOpen = draftDecision === 'pending' && hasSavedDraft;
  const formKey = `${operadorId}:${service}:${draftVersion}:${draftDecision}:${ignoredDraftSignature ?? 'active'}`;
  const draftSummary = useMemo(() => resumenBorrador(savedDraft), [savedDraft]);

  useEffect(() => {
    setIgnoredDraftSignature(null);
    setDraftDecision(hasSavedDraft ? 'pending' : 'continue');
  }, [draftSignature, hasSavedDraft, operadorId, savedDraftEntry?.updatedAt, service]);

  useEffect(() => {
    setDraftSaved(draftDecision !== 'pending' && borradorNuevoPedidoTieneContenido(initialData));
  }, [draftDecision, initialData]);

  const handleDraftSavedChange = useCallback((saved: boolean) => {
    setDraftSaved(saved);
  }, []);

  function descartarBorrador() {
    borrarBorradorNuevoPedido(operadorId, service);
    setIgnoredDraftSignature(draftSignature);
    setDraftDecision('new');
    setDraftSaved(false);
    setDraftVersion((version) => version + 1);
  }

  function continuarBorrador() {
    setDraftDecision('continue');
    setDraftSaved(true);
  }

  function empezarPedidoNuevo() {
    borrarBorradorNuevoPedido(operadorId, service);
    setDraftDecision('new');
    setDraftSaved(false);
    setDraftVersion((version) => version + 1);
  }

  const services: { value: CreateService; label: string }[] = Object.entries(serviceLabels)
    .map(([value, label]) => ({ value: value as CreateService, label }));

  return (
    <section className="create-stack app-page-width">
      {promptOpen && (
        <Modal
          title="Pedido incompleto"
          subtitle={`${serviceLabels[service]} · ${formatearFechaBorrador(savedDraftEntry?.updatedAt)}`}
          onClose={continuarBorrador}
          className="create-draft-modal"
        >
          <div className="create-draft-choice">
            <p>Hay una creacion de pedido guardada en este dispositivo.</p>
            {draftSummary.length > 0 && (
              <div className="create-draft-summary">
                {draftSummary.map((item) => (
                  <span key={item.label}>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
            )}
            <div className="create-draft-actions">
              <button className="ghost-button" type="button" onClick={empezarPedidoNuevo}>Nuevo pedido</button>
              <button className="primary-button" type="button" onClick={continuarBorrador}>Continuar</button>
            </div>
          </div>
        </Modal>
      )}
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
      {!promptOpen && service === 'transferencia' && <TransferenciaForm key={formKey} operadorId={operadorId} initialData={initialData} onDraftSavedChange={handleDraftSavedChange} onCreated={onCreated} />}
      {!promptOpen && service === 'efectivo' && <EfectivoForm key={formKey} operadorId={operadorId} initialData={initialData} onDraftSavedChange={handleDraftSavedChange} onCreated={onCreated} />}
      {!promptOpen && service === 'saldo' && <SaldoForm key={formKey} operadorId={operadorId} initialData={initialData} onDraftSavedChange={handleDraftSavedChange} onCreated={onCreated} />}
      {!promptOpen && service === 'divisa' && <DivisaForm key={formKey} operadorId={operadorId} initialData={initialData} onDraftSavedChange={handleDraftSavedChange} onCreated={onCreated} />}
      {!promptOpen && service === 'otros' && <OtrosForm key={formKey} operadorId={operadorId} initialData={initialData} onDraftSavedChange={handleDraftSavedChange} onCreated={onCreated} />}
    </section>
  );
}
