import { type DependencyList, useEffect } from 'react';
import { isAbortError } from '../api/client';

type AbortableCleanup = void | (() => void);

export function useAbortableEffect(effect: (signal: AbortSignal) => AbortableCleanup, deps: DependencyList) {
  useEffect(() => {
    const controller = new AbortController();
    const cleanup = effect(controller.signal);

    return () => {
      cleanup?.();
      controller.abort();
    };
  }, deps);
}

export { isAbortError };
