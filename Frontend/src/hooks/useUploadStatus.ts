import { useRef, useState } from 'react';

export function useUploadStatus(defaultLabel = 'Subiendo archivo') {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [label, setLabel] = useState(defaultLabel);
  const retryRef = useRef<(() => void) | null>(null);

  function start(nextLabel = defaultLabel) {
    setLabel(nextLabel);
    setActive(true);
    setProgress(0);
    setError(null);
    retryRef.current = null;
  }

  function fail(message: string, retry?: () => void) {
    setActive(false);
    setError(message);
    retryRef.current = retry ?? null;
  }

  function finish() {
    setActive(false);
    setProgress(null);
    setError(null);
    retryRef.current = null;
  }

  function reset() {
    setActive(false);
    setProgress(null);
    setError(null);
    retryRef.current = null;
  }

  return {
    active,
    error,
    progress,
    label,
    retryRef,
    start,
    fail,
    finish,
    reset,
    setProgress,
  };
}
