import type { FormEventHandler, ReactNode } from 'react';
import { DismissibleNotice } from './DismissibleNotice';
import { PageLoader } from './PageLoader';

type CreateOrderFormShellProps = {
  children: ReactNode;
  error: string | null;
  loading: boolean;
  loadingLabel: string;
  submitLabel: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onDismissError: () => void;
};

export function CreateOrderFormShell({
  children,
  error,
  loading,
  loadingLabel,
  submitLabel,
  onSubmit,
  onDismissError,
}: CreateOrderFormShellProps) {
  return (
    <form className="form-panel create-form-panel" onSubmit={onSubmit} noValidate>
      <div className="form-flow">{children}</div>
      {error && (
        <DismissibleNotice className="notice error" role="alert" onDismiss={onDismissError}>
          {error}
        </DismissibleNotice>
      )}
      {loading && <PageLoader label={loadingLabel} inline />}
      <button className="primary-button create-submit-button" type="submit" disabled={loading}>
        {loading ? 'Creando...' : submitLabel}
      </button>
    </form>
  );
}
