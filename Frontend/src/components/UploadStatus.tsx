import { RotateCcw } from 'lucide-react';

export function UploadStatus({
  active,
  error,
  progress,
  label = 'Subiendo archivo',
  retryLabel = 'Reintentar',
  onRetry,
}: {
  active?: boolean;
  error?: string | null;
  progress?: number | null;
  label?: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  if (!active && !error) return null;

  const percent = Math.max(0, Math.min(100, progress ?? 0));

  return (
    <div className={error ? 'upload-status error' : 'upload-status'} role={error ? 'alert' : 'status'}>
      <div className="upload-status-head">
        <span>{error ? error : `${label} ${percent}%`}</span>
        {error && onRetry && (
          <button className="ghost-button upload-retry-button" type="button" onClick={onRetry}>
            <RotateCcw size={15} /> {retryLabel}
          </button>
        )}
      </div>
      {!error && (
        <div className="upload-progress-track" aria-hidden="true">
          <span style={{ width: `${Math.max(4, percent)}%` }} />
        </div>
      )}
    </div>
  );
}
