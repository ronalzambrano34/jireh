import { ImagePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChangeEventHandler, FormEventHandler, ReactNode } from 'react';
import { DismissibleNotice } from './DismissibleNotice';
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
    <form className="form-panel create-form-panel" onSubmit={onSubmit} noValidate>
      <div className="form-flow">{children}</div>
      {error && (
        <DismissibleNotice className="notice error" role="alert" onDismiss={onDismissError}>
          {error}
        </DismissibleNotice>
      )}
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
      {loading && <PageLoader label={loadingLabel} inline />}
      <button className="primary-button create-submit-button" type="submit" disabled={loading}>
        {loading ? 'Creando...' : submitLabel}
      </button>
    </form>
  );
}
