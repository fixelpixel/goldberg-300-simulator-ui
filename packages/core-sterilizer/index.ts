// core-sterilizer/index.ts
// Ядро виртуального стерилизатора GOLDBERG 300.
// Здесь описывается доменная модель, интерфейсы и базовая реализация движка.

export type Phase =
  | 'IDLE'
  | 'PREHEAT'
  | 'PREVACUUM'
  | 'HEAT_UP'
  | 'STERILIZATION'
  | 'DRYING'
  | 'DEPRESSURIZE'
  | 'COOLING'
  | 'COMPLETE'
  | 'ERROR';

export interface ChamberState {
  pressureMPa: number;
  temperatureC: number;
}

export interface GeneratorState {
  pressureMPa: number;
  temperatureC: number;
  waterLevelPercent: number;
}

export interface JacketState {
  pressureMPa: number;
}

export interface DoorState {
  locked: boolean;
  open: boolean;
}

export interface ProgramConfig {
  id: string;
  name: string;
  setTempC: number;
  sterilizationTimeSec: number;
  preVacuumCount: number;
  dryingTimeSec: number;
}

export interface CycleRuntime {
  active: boolean;
  currentPhase: Phase;
  phaseElapsedSec: number;
  phaseTotalSec: number;
  totalElapsedSecSec: number;
  currentProgram: ProgramConfig | null;
}

export type ErrorCode =
  | 'HEATING_TIMEOUT'
  | 'OVERPRESSURE'
  | 'OVERTEMP'
  | 'NO_WATER'
  | 'VACUUM_FAIL'
  | 'SENSOR_FAILURE'
  | 'DOOR_OPEN'
  | 'POWER_ERROR';

export interface ErrorEvent {
  id: string;
  code: ErrorCode;
  message: string;
  timestamp: number;
}

export interface CycleSummary {
  id: string;
  startedAt: number;
  endedAt: number;
  programId: string;
  programName: string;
  success: boolean;
  maxTemperatureC: number;
  maxPressureMPa: number;
  errors: ErrorEvent[];
}

export interface SterilizerState {
  chamber: ChamberState;
  generator: GeneratorState;
  jacket: JacketState;
  door: DoorState;
  cycle: CycleRuntime;
  errors: ErrorEvent[];
  warnings: ErrorEvent[];
  lastCompletedCycles: CycleSummary[];
}

const PHASE_DEFAULTS: Record<Phase, number> = {
  IDLE: 0,
  PREHEAT: 60,
  PREVACUUM: 20,
  HEAT_UP: 90,
  STERILIZATION: 300,
  DRYING: 60,
  DEPRESSURIZE: 20,
  COOLING: 40,
  COMPLETE: 0,
  ERROR: 0,
};

// Интерфейс ввода/вывода - абстрагирует датчики и исполнительные механизмы.
export interface SterilizerIO {
  readSensors(): Promise<{
    chamberPressureMPa: number;
    chamberTemperatureC: number;
    generatorPressureMPa: number;
    generatorTemperatureC: number;
    jacketPressureMPa: number;
    waterLevelPercent: number;
    doorOpen: boolean;
    doorLocked: boolean;
  }>;

  writeActuators(cmd: {
    heaterOn?: boolean;
    steamInletValveOpen?: boolean;
    steamExhaustValveOpen?: boolean;
    vacuumPumpOn?: boolean;
    waterPumpOn?: boolean;
    doorLockOn?: boolean;
  }): Promise<void>;
}

export interface SterilizerEngine {
  getState(): SterilizerState;
  tick(dtMs: number): Promise<void>;

  startCycle(programId: string): Promise<void>;
  stopCycle(): Promise<void>;
  openDoor(): Promise<void>;
  closeDoor(): Promise<void>;

  startVacuumTest(config: { stabilizationTimeSec: number; testTimeSec: number }): Promise<void>;

  resetErrors(): void;
}

export interface EngineOptions {
  io: SterilizerIO;
  programs: ProgramConfig[];
  now?: () => number;
}

// Простая базовая реализация движка. Логика фаз и физики должна
// постепенно наполняться в соответствии с ARCHITECTURE.md.
export function createSterilizerEngine(options: EngineOptions): SterilizerEngine {
  const { io, programs } = options;
  const now = options.now ?? (() => Date.now());

  let state: SterilizerState = {
    chamber: { pressureMPa: 0, temperatureC: 20 },
    generator: { pressureMPa: 0, temperatureC: 20, waterLevelPercent: 100 },
    jacket: { pressureMPa: 0 },
    door: { locked: false, open: true },
    cycle: {
      active: false,
      currentPhase: 'IDLE',
      phaseElapsedSec: 0,
      phaseTotalSec: 0,
      totalElapsedSecSec: 0,
      currentProgram: null,
    },
    errors: [],
    warnings: [],
    lastCompletedCycles: [],
  };

let lastTickMs = now();
let currentProgram: ProgramConfig | null = null;
let completedPrevacuums = 0;
let currentCycleStart = 0;
let maxTemp = 0;
let maxPressure = 0;
let sterilizationTempLowSec = 0;

  function recordCycle(success: boolean) {
    if (!state.cycle.currentProgram) return;
    const summary: CycleSummary = {
      id: `c_${state.lastCompletedCycles.length + 1}_${Date.now()}`,
      startedAt: currentCycleStart,
      endedAt: now(),
      programId: state.cycle.currentProgram.id,
      programName: state.cycle.currentProgram.name,
      success,
      maxTemperatureC: maxTemp,
      maxPressureMPa: maxPressure,
      errors: [...state.errors],
    };
    state.lastCompletedCycles = [summary, ...state.lastCompletedCycles].slice(0, 50);
  }

  async function syncSensors() {
    const sensors = await io.readSensors();
    state = {
      ...state,
      chamber: {
        pressureMPa: sensors.chamberPressureMPa,
        temperatureC: sensors.chamberTemperatureC,
      },
      generator: {
        pressureMPa: sensors.generatorPressureMPa,
        temperatureC: sensors.generatorTemperatureC,
        waterLevelPercent: sensors.waterLevelPercent,
      },
      jacket: {
        pressureMPa: sensors.jacketPressureMPa,
      },
      door: {
        locked: sensors.doorLocked,
        open: sensors.doorOpen,
      },
    };
  }

  function validateSensors() {
    const { chamber, generator } = state;
    const invalid =
      !Number.isFinite(chamber.pressureMPa) ||
      !Number.isFinite(chamber.temperatureC) ||
      !Number.isFinite(generator.pressureMPa) ||
      !Number.isFinite(generator.temperatureC) ||
      generator.waterLevelPercent < 0 ||
      generator.waterLevelPercent > 110 ||
      chamber.pressureMPa < -0.2 ||
      chamber.pressureMPa > 0.5 ||
      generator.pressureMPa < -0.2 ||
      generator.pressureMPa > 0.5 ||
      chamber.temperatureC < -10 ||
      chamber.temperatureC > 200 ||
      generator.temperatureC < -10 ||
      generator.temperatureC > 200;
    if (invalid) {
      pushError('SENSOR_FAILURE', 'Некорректные показания датчиков');
    }
  }

  function pushError(code: ErrorCode, message: string) {
    if (state.cycle.currentPhase === 'ERROR') return;
    const evt: ErrorEvent = {
      id: `e_${state.errors.length + 1}_${Date.now()}`,
      code,
      message,
      timestamp: now(),
    };
    state.errors = [...state.errors, evt];
    state.cycle.currentPhase = 'ERROR';
    state.cycle.active = false;
    recordCycle(false);
  }

  async function tick(dtMs: number) {
    // 1. Синхронизация с датчиками
    await syncSensors();
    validateSensors();

    const dtSec = dtMs / 1000;

    // 2. Обновление таймеров фазы/цикла
    if (state.cycle.active) {
      state.cycle.phaseElapsedSec += dtSec;
      state.cycle.totalElapsedSecSec += dtSec;
      maxTemp = Math.max(maxTemp, state.chamber.temperatureC);
      maxPressure = Math.max(maxPressure, state.chamber.pressureMPa);
    }

    // 3. Упрощённая машина состояний для демо
    const program = currentProgram;
    const setPhase = async (phase: Phase, totalSec = 0) => {
      state.cycle.currentPhase = phase;
      state.cycle.phaseElapsedSec = 0;
      state.cycle.phaseTotalSec = totalSec || PHASE_DEFAULTS[phase] || 0;
      if (phase === 'PREVACUUM') completedPrevacuums += 1;
    };

    if (state.cycle.active && program) {
      switch (state.cycle.currentPhase) {
        case 'PREHEAT': {
          await io.writeActuators({ heaterOn: true, steamInletValveOpen: false, vacuumPumpOn: false, steamExhaustValveOpen: false });
          if (state.generator.temperatureC >= Math.max(100, program.setTempC - 5) || state.cycle.phaseElapsedSec > PHASE_DEFAULTS.PREHEAT) {
            completedPrevacuums = 0;
            await setPhase('PREVACUUM', PHASE_DEFAULTS.PREVACUUM);
          }
          break;
        }
        case 'PREVACUUM': {
          await io.writeActuators({ vacuumPumpOn: true, steamExhaustValveOpen: true, steamInletValveOpen: false, heaterOn: false });
          if (state.cycle.phaseElapsedSec > state.cycle.phaseTotalSec) {
            if (completedPrevacuums >= program.preVacuumCount) {
              await setPhase('HEAT_UP', PHASE_DEFAULTS.HEAT_UP);
            } else {
              await setPhase('PREVACUUM', PHASE_DEFAULTS.PREVACUUM);
            }
          }
          break;
        }
        case 'HEAT_UP': {
          await io.writeActuators({ steamInletValveOpen: true, heaterOn: true, vacuumPumpOn: false, steamExhaustValveOpen: false });
          const reachedTemp = state.chamber.temperatureC >= program.setTempC - 2;
          if (reachedTemp || state.cycle.phaseElapsedSec > state.cycle.phaseTotalSec) {
            await setPhase('STERILIZATION', program.sterilizationTimeSec);
          }
          break;
        }
        case 'STERILIZATION': {
          await io.writeActuators({
            steamInletValveOpen: state.chamber.temperatureC < program.setTempC,
            heaterOn: true,
            vacuumPumpOn: false,
            steamExhaustValveOpen: false,
          });
          if (state.chamber.temperatureC < program.setTempC - 3) {
            sterilizationTempLowSec += dtSec;
          } else {
            sterilizationTempLowSec = 0;
          }
          if (state.cycle.phaseElapsedSec >= program.sterilizationTimeSec) {
            await setPhase('DRYING', program.dryingTimeSec || 30);
            sterilizationTempLowSec = 0;
          }
          break;
        }
        case 'DRYING': {
          await io.writeActuators({ vacuumPumpOn: true, steamExhaustValveOpen: true, heaterOn: false, steamInletValveOpen: false });
          if (state.cycle.phaseElapsedSec >= (program.dryingTimeSec || 30)) {
            await setPhase('DEPRESSURIZE', PHASE_DEFAULTS.DEPRESSURIZE);
          }
          break;
        }
        case 'DEPRESSURIZE': {
          await io.writeActuators({ steamExhaustValveOpen: true, vacuumPumpOn: false, steamInletValveOpen: false, heaterOn: false });
          if (state.chamber.pressureMPa <= 0.02 || state.cycle.phaseElapsedSec > 20) {
            await setPhase('COOLING', 20);
          }
          break;
        }
        case 'COOLING': {
          await io.writeActuators({ heaterOn: false, steamInletValveOpen: false, steamExhaustValveOpen: false, vacuumPumpOn: false });
          if (state.chamber.temperatureC <= 60 || state.cycle.phaseElapsedSec > 40) {
            await setPhase('COMPLETE', 0);
            state.cycle.active = false;
            recordCycle(true);
          }
          break;
        }
        default:
          break;
      }
    }

    // 4. проверки ошибок (если не в ERROR)
    if (state.cycle.currentPhase !== 'ERROR') {
      if (state.chamber.pressureMPa > 0.32) {
        pushError('OVERPRESSURE', 'Избыточное давление в камере');
      }
      if (state.generator.waterLevelPercent < 5) {
        pushError('NO_WATER', 'Недостаточно воды в парогенераторе');
      }

      if (currentProgram) {
        if (state.chamber.temperatureC > currentProgram.setTempC + 8) {
          pushError('OVERTEMP', 'Превышение температуры в камере');
        }
        if (
          state.cycle.currentPhase === 'HEAT_UP' &&
          state.cycle.phaseElapsedSec > state.cycle.phaseTotalSec + 30 &&
          state.chamber.temperatureC < currentProgram.setTempC - 5
        ) {
          pushError('HEATING_TIMEOUT', 'Не достигнута температура стерилизации');
        }
        if (
          state.cycle.currentPhase === 'PREVACUUM' &&
          state.cycle.phaseElapsedSec > state.cycle.phaseTotalSec + 5 &&
          state.chamber.pressureMPa > 0.05
        ) {
          pushError('VACUUM_FAIL', 'Не удалось достичь вакуума');
        }
        if (
          state.cycle.currentPhase === 'DRYING' &&
          state.cycle.phaseElapsedSec > state.cycle.phaseTotalSec + 60
        ) {
          pushError('HEATING_TIMEOUT', 'Сушка превысила допустимое время');
        }
        if (state.cycle.currentPhase === 'STERILIZATION' && sterilizationTempLowSec > 30) {
          pushError('HEATING_TIMEOUT', 'Температура стерилизации держится ниже нормы');
        }
      }
      if (state.cycle.active && state.door.open) {
        pushError('DOOR_OPEN', 'Дверь открыта во время цикла');
      }
    }

    lastTickMs = now();
  }

  return {
    getState() {
      return state;
    },

    async tick(externalDtMs?: number) {
      const current = now();
      const dtMs = externalDtMs ?? current - lastTickMs;
      await tick(dtMs);
    },

    async startCycle(programId: string) {
      const program = programs.find((p) => p.id === programId) || null;
      if (!program) {
        throw new Error(`Program not found: ${programId}`);
      }
      if (!state.door.locked || state.door.open) {
        pushError('DOOR_OPEN', 'Дверь открыта или не заблокирована');
        return;
      }
      currentProgram = program;
      completedPrevacuums = 0;
      currentCycleStart = now();
      maxTemp = 0;
      maxPressure = 0;
      state.errors = [];
      state.cycle = {
        active: true,
        currentPhase: 'PREHEAT',
        phaseElapsedSec: 0,
        phaseTotalSec: 0,
        totalElapsedSecSec: 0,
        currentProgram: program,
      };
    },

    async stopCycle() {
      state.cycle.active = false;
      state.cycle.currentPhase = 'DEPRESSURIZE';
      state.cycle.phaseElapsedSec = 0;
      // TODO: инициировать последовательность безопасного сброса давления
      const summary: CycleSummary | null = state.cycle.currentProgram
        ? {
            id: `c_${state.lastCompletedCycles.length + 1}_${Date.now()}`,
            startedAt: currentCycleStart,
            endedAt: now(),
            programId: state.cycle.currentProgram.id,
            programName: state.cycle.currentProgram.name,
            success: false,
            maxTemperatureC: maxTemp,
            maxPressureMPa: maxPressure,
            errors: [...state.errors, { id: 'user_stop', code: 'POWER_ERROR', message: 'Остановлено пользователем', timestamp: now() }],
          }
        : null;
      if (summary) {
        state.lastCompletedCycles = [summary, ...state.lastCompletedCycles].slice(0, 20);
      }
    },

    async openDoor() {
      // В реальной реализации должны быть проверки на давление/температуру
      await io.writeActuators({ doorLockOn: false });
    },

    async closeDoor() {
      await io.writeActuators({ doorLockOn: true });
    },

    async startVacuumTest(config: { stabilizationTimeSec: number; testTimeSec: number }) {
      // TODO: реализовать отдельную ветку state-machine для вакуум-теста
      console.log('Vacuum test requested', config);
    },

    resetErrors() {
      state.errors = [];
      if (state.cycle.currentPhase === 'ERROR') {
        state.cycle.currentPhase = 'IDLE';
        state.cycle.active = false;
      }
    },
  };
}
