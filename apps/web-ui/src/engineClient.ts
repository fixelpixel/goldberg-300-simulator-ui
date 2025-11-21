import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createSterilizerEngine,
  type ProgramConfig,
  type SterilizerEngine,
  type SterilizerState,
} from '@core';
import { SimulationIO, type InternalPhysicalState } from '@sim';
import { engineStore } from './store';

// Набор программ, синхронный с ядром и UI.
export const PROGRAMS: ProgramConfig[] = [
  {
    id: 'prog_p1_134_5',
    name: 'P1 Инструменты 134°C / 5 мин',
    setTempC: 134,
    sterilizationTimeSec: 5 * 60,
    preVacuumCount: 3,
    dryingTimeSec: 10 * 60,
  },
  {
    id: 'prog_p2_134_7',
    name: 'P2 Инструменты 134°C / 7 мин',
    setTempC: 134,
    sterilizationTimeSec: 7 * 60,
    preVacuumCount: 3,
    dryingTimeSec: 12 * 60,
  },
  {
    id: 'prog_p3_121_20',
    name: 'P3 Текстиль 121°C / 20 мин',
    setTempC: 121,
    sterilizationTimeSec: 20 * 60,
    preVacuumCount: 4,
    dryingTimeSec: 15 * 60,
  },
  {
    id: 'prog_p4_134_10',
    name: 'P4 Текстиль 134°C / 10 мин',
    setTempC: 134,
    sterilizationTimeSec: 10 * 60,
    preVacuumCount: 4,
    dryingTimeSec: 15 * 60,
  },
  {
    id: 'prog_p5_121_liquids',
    name: 'P5 Жидкости 121°C / 30 мин',
    setTempC: 121,
    sterilizationTimeSec: 30 * 60,
    preVacuumCount: 1,
    dryingTimeSec: 0,
  },
  {
    id: 'prog_p6_121_delicate',
    name: 'P6 Деликатные 121°C / 15 мин',
    setTempC: 121,
    sterilizationTimeSec: 15 * 60,
    preVacuumCount: 2,
    dryingTimeSec: 5 * 60,
  },
  {
    id: 'prog_p7_134_rubber',
    name: 'P7 Резина/силикон 134°C / 10 мин',
    setTempC: 134,
    sterilizationTimeSec: 10 * 60,
    preVacuumCount: 3,
    dryingTimeSec: 8 * 60,
  },
  {
    id: 'prog_p8_134_prion',
    name: 'P8 Прион 134°C / 18 мин',
    setTempC: 134,
    sterilizationTimeSec: 18 * 60,
    preVacuumCount: 3,
    dryingTimeSec: 20 * 60,
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
  prog_p1_134_5: {
    desc: 'Упакованные инструменты, стандартная нагрузка',
    phases: ['3x Вакуум', 'Нагрев', 'Стерилизация', 'Сушка'],
  },
  prog_p2_134_7: {
    desc: 'Инструменты 134°C с увеличенной выдержкой',
    phases: ['3x Вакуум', 'Нагрев', 'Стерилизация', 'Сушка'],
  },
  prog_p3_121_20: {
    desc: 'Текстиль/пористые материалы 121°C',
    phases: ['4x Вакуум', 'Нагрев', 'Стерилизация', 'Сушка'],
  },
  prog_p4_134_10: {
    desc: 'Текстиль 134°C быстрая стерилизация',
    phases: ['4x Вакуум', 'Нагрев', 'Стерилизация', 'Сушка'],
  },
  prog_p5_121_liquids: {
    desc: 'Жидкости/лабы 121°C, без сушки',
    phases: ['Удаление воздуха', 'Нагрев', 'Стерилизация', 'Охлаждение'],
  },
  prog_p6_121_delicate: {
    desc: 'Деликатные материалы 121°C',
    phases: ['2x Вакуум', 'Нагрев', 'Стерилизация', 'Сушка'],
  },
  prog_p7_134_rubber: {
    desc: 'Резина/силикон 134°C',
    phases: ['3x Вакуум', 'Нагрев', 'Стерилизация', 'Сушка'],
  },
  prog_p8_134_prion: {
    desc: 'Прион/длинная выдержка 134°C',
    phases: ['3x Вакуум', 'Нагрев', 'Стерилизация', 'Сушка'],
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
  startVacuumTest: (cfg?: { stabilizationTimeSec: number; testTimeSec: number }) => Promise<void>;
  setProgramOverride: (programId: string, override: Partial<ProgramConfig>) => void;
  setCalibrationOffsets: (offsets: Partial<{ chamberTempOffsetC: number; chamberPressureOffset: number; generatorTempOffsetC: number; generatorPressureOffset: number }>) => void;
  resetCalibrationOffsets: () => void;
  continueAfterPower: () => void;
  abortAfterPower: () => void;
};

export type EngineMode = 'local' | 'remote';
type ConnectionStatus = 'local' | 'connecting' | 'connected' | 'disconnected' | 'fallback';

export function useEngineSimulation(
  mode: EngineMode = 'local',
  wsUrl = 'ws://localhost:8090',
  opts?: { shouldUpdate?: () => boolean },
) {
  const engineRef = useRef<SterilizerEngine | null>(null);
  const simRef = useRef<SimulationIO | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<SterilizerState | null>(null);
  const [ready, setReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('local');
  const lastStateStrRef = useRef<string>('');
  const lastSentAtRef = useRef<number>(0);
  const shouldUpdateRef = useRef<() => boolean>(() => true);

  // обновляем ссылку на правило обновления без пересоздания эффекта
  shouldUpdateRef.current = opts?.shouldUpdate ?? (() => true);

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
            const snap = engine.getState();
            setState(snap);
            engineStore.setSnapshot(snap);
      setConnectionStatus(mode === 'remote' ? 'fallback' : 'local');

      let last = performance.now();
      const interval = setInterval(() => {
        const now = performance.now();
        const dtSec = (now - last) / 1000;
        last = now;

        const allow = shouldUpdateRef.current ? shouldUpdateRef.current() : true;
        if (!allow) return;

        simRef.current?.stepPhysics(dtSec);
        engineRef.current
          ?.tick(dtSec * 1000)
          .then(() => {
            const snapshot = engineRef.current ? JSON.parse(JSON.stringify(engineRef.current.getState())) : null;
            if (snapshot) {
              const nowMs = Date.now();
              const sig = makeSignature(snapshot);
              if (sig !== lastStateStrRef.current && nowMs - lastSentAtRef.current > 1000) {
                lastStateStrRef.current = sig;
                lastSentAtRef.current = nowMs;
                setState(snapshot);
                engineStore.setSnapshot(snapshot);
              }
            }
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
      startVacuumTest: async (cfg) => {
        const payload = cfg ?? { stabilizationTimeSec: 300, testTimeSec: 300 };
        if (mode === 'remote' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'command', payload: { kind: 'start_vacuum_test', params: payload } }));
          return;
        }
        return engineRef.current?.startVacuumTest(payload) ?? Promise.resolve();
      },
      setProgramOverride: (programId, override) => {
        engineRef.current?.setProgramOverride(programId, override);
      },
      setCalibrationOffsets: (offsets) => {
        engineRef.current?.setCalibrationOffsets(offsets);
      },
      resetCalibrationOffsets: () => {
        engineRef.current?.resetCalibrationOffsets();
      },
      continueAfterPower: () => {
        engineRef.current?.continueAfterPower();
      },
      abortAfterPower: () => {
        engineRef.current?.abortAfterPower();
      },
    }),
    [mode],
  );

  return { state, programs, controls, ready, connectionStatus };
}
  const makeSignature = (s: SterilizerState) => {
    const round = (v: number | undefined, d = 1) =>
      typeof v === 'number' ? Number(v.toFixed(d)) : 0;
    return JSON.stringify({
      chamber: {
        p: round(s.chamber.pressureMPa, 3),
        t: round(s.chamber.temperatureC, 1),
      },
      generator: {
        p: round(s.generator.pressureMPa, 3),
        t: round(s.generator.temperatureC, 1),
        w: Math.round(s.generator.waterLevelPercent ?? 0),
      },
      jacket: round(s.jacket.pressureMPa, 3),
      door: s.door,
      cycle: {
        active: s.cycle.active,
        phase: s.cycle.currentPhase,
        phaseElapsedSec: Math.floor(s.cycle.phaseElapsedSec),
        phaseTotalSec: Math.floor(s.cycle.phaseTotalSec),
        totalElapsedSecSec: Math.floor(s.cycle.totalElapsedSecSec ?? 0),
        programId: s.cycle.currentProgram?.id,
      },
      errors: s.errors?.map((e) => e.code).join(','),
      power: s.powerFailure?.pending,
      historyCount: s.lastCompletedCycles?.length ?? 0,
    });
  };
