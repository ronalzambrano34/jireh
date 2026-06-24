import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const ERROR_TOAST_DURATION_MS = 7000;
export const INFO_TOAST_DURATION_MS = 4500;
export const PROFILE_TOAST_DURATION_MS = 7000;

export type FloatingToastKind = 'success' | 'error';

type ToastMessageProps = {
  kind: FloatingToastKind;
  message: ReactNode;
  onClose: () => void;
};

type FloatingToastProps = {
  children: ReactNode;
  kind?: FloatingToastKind;
  onDismiss?: () => void;
  durationMs?: number;
  ariaLive?: 'polite' | 'assertive' | 'off';
};

export function ToastMessage({ kind, message, onClose }: ToastMessageProps) {
  return (
    <div className={`app-toast ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      <button type="button" onClick={onClose} title="Cerrar notificacion" aria-label="Cerrar notificacion">
        <X size={16} />
      </button>
    </div>
  );
}

export function FloatingToast({
  children,
  kind = 'error',
  onDismiss,
  durationMs = kind === 'error' ? ERROR_TOAST_DURATION_MS : INFO_TOAST_DURATION_MS,
  ariaLive = 'polite',
}: FloatingToastProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
  }, [children, kind]);

  useEffect(() => {
    if (!durationMs || hidden) return undefined;
    const timeoutId = window.setTimeout(() => {
      if (onDismiss) {
        onDismiss();
      } else {
        setHidden(true);
      }
    }, durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [children, durationMs, hidden, kind, onDismiss]);

  if (hidden) return null;

  const toast = (
    <div className="app-toast-stack" aria-live={ariaLive}>
      <ToastMessage kind={kind} message={children} onClose={onDismiss ?? (() => setHidden(true))} />
    </div>
  );

  return createPortal(toast, document.body);
}
