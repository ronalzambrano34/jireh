import { ImagePlus, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChangeEventHandler, FormEventHandler, ReactNode } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { FloatingToast } from './FloatingToast';
import { PageLoader } from './PageLoader';
import { UploadStatus } from './UploadStatus';

type CreateOrderFormShellProps = {
  children: ReactNode;
  error: string | null;
  loading: boolean;
  loadingLabel: string;
  submitLabel: string;
  comprobante: File | null;
  onComprobanteChange: ChangeEventHandler<HTMLInputElement>;
  uploadActive?: boolean;
  uploadError?: string | null;
  uploadProgress?: number | null;
  uploadLabel?: string;
  onRetryUpload?: () => void;
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
  uploadActive,
  uploadError,
  uploadProgress,
  uploadLabel,
  onRetryUpload,
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

  return (
    <form className="create-form-panel" onSubmit={onSubmit} noValidate>
      <div className="form-flow">{children}</div>
      {error && (
        <FloatingToast kind={error.includes('cola local') ? 'success' : 'error'} onDismiss={onDismissError}>{error}</FloatingToast>
      )}
      {offline && (
        <div className="notice warning compact-notice create-offline-notice">
          <WifiOff size={17} />
          <span>Sin conexion. Puedes guardar el pedido en cola si no tiene archivos adjuntos; se enviara al reconectar.</span>
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
        <UploadStatus
          active={uploadActive}
          error={uploadError}
          progress={uploadProgress}
          label={uploadLabel ?? 'Subiendo comprobante'}
          onRetry={onRetryUpload}
        />
      </div>
      {loading && <PageLoader label={loadingLabel} inline />}
      <button className="primary-button create-submit-button" type="submit" disabled={loading}>
        {offline ? 'Guardar en cola' : loading ? 'Creando...' : submitLabel}
      </button>
    </form>
  );
}
