import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createSterilizerEngine,
  type ProgramConfig,
  type SterilizerEngine,
  type SterilizerState,
} from '@core';
import { SimulationIO, type InternalPhysicalState } from '@sim';

// Набор программ, синхронный с ядром и UI.
export const PROGRAMS: ProgramConfig[] = [
  {
    id: 'prog_134_5',
    name: 'Инструменты 134°C / 5 мин',
    setTempC: 134,
    sterilizationTimeSec: 5 * 60,
    preVacuumCount: 3,
    dryingTimeSec: 10 * 60,
  },
  {
    id: 'prog_121_20_textile',
    name: 'Текстиль 121°C / 20 мин',
    setTempC: 121,
    sterilizationTimeSec: 20 * 60,
    preVacuumCount: 4,
    dryingTimeSec: 15 * 60,
  },
  {
    id: 'prog_134_fast',
    name: 'Быстрый цикл 134°C',
    setTempC: 134,
    sterilizationTimeSec: 3 * 60,
    preVacuumCount: 3,
    dryingTimeSec: 5 * 60,
  },
  {
    id: 'prog_121_delicate',
    name: 'Деликатная 121°C',
    setTempC: 121,
    sterilizationTimeSec: 15 * 60,
    preVacuumCount: 2,
    dryingTimeSec: 5 * 60,
  },
  {
    id: 'prog_bowie_dick',
    name: 'Bowie–Dick тест',
    setTempC: 134,
    sterilizationTimeSec: 3 * 60,
    preVacuumCount: 3,
    dryingTimeSec: 0,
  },
];

export const PROGRAM_DETAILS: Record<string, { desc: string; phases: string[] }> = {
  prog_134_5: {
    desc: 'Упакованные инструменты, полная загрузка',
    phases: ['3x Вакуум', 'Нагрев', 'Стерилизация', 'Сушка'],
  },
  prog_121_20_textile: {
    desc: 'Пористые материалы, ткани, халаты',
    phases: ['4x Вакуум', 'Нагрев', 'Стерилизация', 'Сушка'],
  },
  prog_134_fast: {
    desc: 'Неупакованные инструменты (Flash)',
    phases: ['3x Вакуум', 'Нагрев', 'Стерилизация', 'Сушка'],
  },
  prog_121_delicate: {
    desc: 'Резина, пластик, термочувствительные материалы',
    phases: ['2x Вакуум', 'Нагрев', 'Стерилизация', 'Сушка'],
  },
  prog_bowie_dick: {
    desc: 'Тест проникновения пара',
    phases: ['3x Вакуум', 'Нагрев', 'Выдержка'],
  },
};

type EngineControls = {
  startCycle: (programId: string) => Promise<void>;
  stopCycle: () => Promise<void>;
  openDoor: () => Promise<void>;
  closeDoor: () => Promise<void>;
  resetErrors: () => void;
};

export type EngineMode = 'local' | 'remote';
type ConnectionStatus = 'local' | 'connecting' | 'connected' | 'disconnected' | 'fallback';

export function useEngineSimulation(mode: EngineMode = 'local', wsUrl = 'ws://localhost:8090') {
  const engineRef = useRef<SterilizerEngine | null>(null);
  const simRef = useRef<SimulationIO | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<SterilizerState | null>(null);
  const [ready, setReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('local');

  const programs = useMemo(() => PROGRAMS, []);

  useEffect(() => {
    let cleanupLocal: (() => void) | undefined;

    const startLocalSim = () => {
      const initialPhysical: Partial<InternalPhysicalState> = {
        doorLocked: true,
        doorOpen: false,
        chamberTemperatureC: 25,
        generatorTemperatureC: 25,
      };
      const io = new SimulationIO(initialPhysical);
      simRef.current = io;

      const engine = createSterilizerEngine({
        io,
        programs,
      });
      engineRef.current = engine;
      setReady(true);
      setState(engine.getState());
      setConnectionStatus(mode === 'remote' ? 'fallback' : 'local');

      let last = performance.now();
      const interval = setInterval(() => {
        const now = performance.now();
        const dtSec = (now - last) / 1000;
        last = now;

        simRef.current?.stepPhysics(dtSec);
        engineRef.current
          ?.tick(dtSec * 1000)
          .then(() => {
            const snapshot = engineRef.current ? JSON.parse(JSON.stringify(engineRef.current.getState())) : null;
            setState(snapshot);
          })
          .catch((err) => console.error('Engine tick error', err));
      }, 200);

      cleanupLocal = () => clearInterval(interval);
    };

    // Очистка перед сменой режима
    engineRef.current = null;
    simRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setReady(false);
    setState(null);

    if (mode !== 'local') {
      setConnectionStatus('connecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        setReady(true);
      };
      ws.onclose = () => {
        setConnectionStatus('fallback');
        startLocalSim();
      };
      ws.onerror = () => {
        setConnectionStatus('disconnected');
        startLocalSim();
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'state') {
            setState(data.payload as SterilizerState);
          }
        } catch (e) {
          console.warn('WS parse error', e);
        }
      };
      return () => {
        ws.close();
        if (cleanupLocal) cleanupLocal();
      };
    }

    // Local simulation
    setConnectionStatus('local');
    startLocalSim();
    return () => {
      if (cleanupLocal) cleanupLocal();
    };
  }, [mode, wsUrl, programs]);

  const controls: EngineControls = useMemo(
    () => ({
      startCycle: async (programId: string) => {
        if (mode === 'remote' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'command', payload: { kind: 'start_cycle', params: { programId } } }));
          return;
        }
        return engineRef.current?.startCycle(programId) ?? Promise.resolve();
      },
      stopCycle: async () => {
        if (mode === 'remote' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'command', payload: { kind: 'stop_cycle', params: {} } }));
          return;
        }
        return engineRef.current?.stopCycle() ?? Promise.resolve();
      },
      openDoor: async () => {
        if (mode === 'remote' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'command', payload: { kind: 'open_door', params: {} } }));
          return;
        }
        return engineRef.current?.openDoor() ?? Promise.resolve();
      },
      closeDoor: async () => {
        if (mode === 'remote' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'command', payload: { kind: 'close_door', params: {} } }));
          return;
        }
        return engineRef.current?.closeDoor() ?? Promise.resolve();
      },
      resetErrors: () => {
        if (mode === 'remote' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'command', payload: { kind: 'reset_errors', params: {} } }));
          return;
        }
        engineRef.current?.resetErrors();
      },
    }),
    [mode],
  );

  return { state, programs, controls, ready, connectionStatus };
}
