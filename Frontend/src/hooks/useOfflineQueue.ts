import { useEffect, useState } from 'react';
import { OFFLINE_QUEUE_EVENT, listarOfflineQueue, syncOfflineQueue } from '../utils/offlineQueue';

export function useOfflineQueue(enabled = true) {
  const [pendingCount, setPendingCount] = useState(() => listarOfflineQueue().length);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    let cancelled = false;
    const refresh = () => setPendingCount(listarOfflineQueue().length);
    const sync = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        refresh();
        return;
      }
      setSyncing(true);
      try {
        await syncOfflineQueue();
      } finally {
        if (!cancelled) {
          refresh();
          setSyncing(false);
        }
      }
    };

    window.addEventListener(OFFLINE_QUEUE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('online', sync);
    refresh();
    void sync();

    return () => {
      cancelled = true;
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('online', sync);
    };
  }, [enabled]);

  return { pendingCount, syncing };
}
