import { ImagePlus, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChangeEventHandler, FormEvent, FormEventHandler, ReactNode } from 'react';
import { offlineCriticalActionMessage } from '../api/client';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { FloatingToast } from './FloatingToast';
import { PageLoader } from './PageLoader';

type CreateOrderFormShellProps = {
  children: ReactNode;
  error: string | null;
  loading: boolean;
  loadingLabel: string;
  submitLabel: string;
  comprobante: File | null;
  onComprobanteChange: ChangeEventHandler<HTMLInputElement>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onDismissError: () => void;
};

export function CreateOrderFormShell({
  children,
  error,
  loading,
  loadingLabel,
  submitLabel,
  comprobante,
  onComprobanteChange,
  onSubmit,
  onDismissError,
}: CreateOrderFormShellProps) {
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null);
  const online = useOnlineStatus();
  const offline = !online;

  useEffect(() => {
    if (!comprobante?.type.startsWith('image/')) {
      setComprobantePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(comprobante);
    setComprobantePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [comprobante]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (offline) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  }

  return (
    <form className="create-form-panel" onSubmit={handleSubmit} noValidate>
      <div className="form-flow">{children}</div>
      {error && (
        <FloatingToast onDismiss={onDismissError}>{error}</FloatingToast>
      )}
      {offline && (
        <div className="notice warning compact-notice create-offline-notice">
          <WifiOff size={17} />
          <span>{offlineCriticalActionMessage()}</span>
        </div>
      )}
      <div className="payment-proof-container">
        <label className="payment-proof-field">
          <span>Comprobante de pago</span>
          <span className="document-upload-field">
            <span className="document-preview">
              {comprobantePreview
                ? <img src={comprobantePreview} alt="Vista previa del comprobante" />
                : <ImagePlus size={24} />}
            </span>
            <span>
              <strong>{comprobante?.name ?? 'Seleccionar comprobante'}</strong>
              <small>Opcional. Si lo adjuntas, el pago quedara confirmado al crear el pedido.</small>
            </span>
            <input type="file" accept="image/*,.pdf" onChange={onComprobanteChange} />
          </span>
        </label>
      </div>
      {loading && <PageLoader label={loadingLabel} inline />}
      <button className="primary-button create-submit-button" type="submit" disabled={loading || offline}>
        {offline ? 'Sin conexion' : loading ? 'Creando...' : submitLabel}
      </button>
    </form>
  );
}
