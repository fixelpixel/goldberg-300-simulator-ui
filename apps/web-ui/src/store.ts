import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { SterilizerState } from '@core';

type Snapshot = SterilizerState | null;

class EngineStore {
  private snapshot: Snapshot = null;
  private listeners = new Set<() => void>();

  setSnapshot(next: Snapshot) {
    this.snapshot = next;
    for (const l of this.listeners) l();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;
}

export const engineStore = new EngineStore();

// Hooks-селекторы
export function useSensors() {
  return useSyncExternalStore(
    engineStore.subscribe,
    () => {
      const s = engineStore.getSnapshot();
      return s
        ? {
            chamber: s.chamber,
            generator: s.generator,
            jacket: s.jacket,
            door: s.door,
          }
        : null;
    },
    () => null,
  );
}

export function useCycle() {
  return useSyncExternalStore(
    engineStore.subscribe,
    () => {
      const s = engineStore.getSnapshot();
      return s ? s.cycle : null;
    },
    () => null,
  );
}

export function useErrors() {
  return useSyncExternalStore(
    engineStore.subscribe,
    () => {
      const s = engineStore.getSnapshot();
      return s ? { errors: s.errors, errorHistory: s.errorHistory } : { errors: [], errorHistory: [] };
    },
    () => ({ errors: [], errorHistory: [] }),
  );
}

export function useHistory() {
  return useSyncExternalStore(
    engineStore.subscribe,
    () => engineStore.getSnapshot()?.lastCompletedCycles ?? [],
    () => [],
  );
}

export function useVacuumTest() {
  return useSyncExternalStore(
    engineStore.subscribe,
    () => {
      const s = engineStore.getSnapshot();
      return s ? { vacuumTest: s.vacuumTest, lastVacuumTests: s.lastVacuumTests } : null;
    },
    () => null,
  );
}

export function usePower() {
  return useSyncExternalStore(
    engineStore.subscribe,
    () => engineStore.getSnapshot()?.powerFailure ?? { pending: false },
    () => ({ pending: false }),
  );
}

// Хук для установки снапшота один раз из симуляции
export function useStoreBridge(state: SterilizerState | null) {
  const prev = useRef<Snapshot>(null);
  useEffect(() => {
    if (state !== prev.current) {
      prev.current = state;
      engineStore.setSnapshot(state);
    }
  }, [state]);
}
