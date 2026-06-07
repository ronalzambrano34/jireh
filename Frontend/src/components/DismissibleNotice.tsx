import { ReactNode, useEffect, useState } from 'react';
import { X } from 'lucide-react';

type DismissibleNoticeProps = {
  children: ReactNode;
  className?: string;
  role?: 'alert' | 'status';
  onDismiss?: () => void;
};

export function DismissibleNotice({ children, className = 'notice', role = 'status', onDismiss }: DismissibleNoticeProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
  }, [children]);

  if (hidden) return null;

  return (
    <div className={`${className} dismissible-notice`} role={role}>
      <span className="dismissible-notice-content">{children}</span>
      <button
        type="button"
        onClick={() => {
          setHidden(true);
          onDismiss?.();
        }}
        title="Cerrar notificacion"
        aria-label="Cerrar notificacion"
      >
        <X size={15} />
      </button>
    </div>
  );
}
