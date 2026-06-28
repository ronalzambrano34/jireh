import { useEffect, useState } from 'react';

function readDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

export function useDocumentVisible() {
  const [visible, setVisible] = useState(readDocumentVisible);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    function handleVisibilityChange() {
      setVisible(readDocumentVisible());
    }

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return visible;
}
