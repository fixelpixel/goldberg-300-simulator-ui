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

export interface ProgramOverride {
  setTempC?: number;
  sterilizationTimeSec?: number;
  preVacuumCount?: number;
  dryingTimeSec?: number;
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
  | 'POWER_ERROR'
  | 'USER_STOP';

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
  durationSec: number;
  programId: string;
  programName: string;
  result: 'success' | 'error' | 'aborted';
  success: boolean;
  primaryErrorCode?: ErrorCode;
  maxTemperatureC: number;
  maxPressureMPa: number;
  errors: ErrorEvent[];
}

export interface VacuumTestResult {
  id: string;
  startedAt: number;
  endedAt: number;
  result: 'PASS' | 'FAIL';
  leakRateMPaPerMin: number;
}

export interface VacuumTestState {
  active: boolean;
  phase: 'IDLE' | 'STABILIZE' | 'TEST';
  elapsedSec: number;
  stabilizationTimeSec: number;
  testTimeSec: number;
  startedAt: number | null;
  basePressureMPa: number | null;
  result?: 'PASS' | 'FAIL';
  leakRateMPaPerMin?: number;
}

export interface SterilizerState {
  chamber: ChamberState;
  generator: GeneratorState;
  jacket: JacketState;
  door: DoorState;
  cycle: CycleRuntime;
  errors: ErrorEvent[];
  warnings: ErrorEvent[];
  errorHistory: ErrorEvent[];
  lastCompletedCycles: CycleSummary[];
  vacuumTest: VacuumTestState;
  lastVacuumTests: VacuumTestResult[];
  programOverrides: Record<string, ProgramOverride>;
  calibrationOffsets: {
    chamberTempOffsetC: number;
    chamberPressureOffset: number;
    generatorTempOffsetC: number;
    generatorPressureOffset: number;
  };
  powerFailure: {
    pending: boolean;
    message?: string;
  };
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

  setManualActuators?(cmd: {
    heaterOn?: boolean | null;
    steamInletValveOpen?: boolean | null;
    steamExhaustValveOpen?: boolean | null;
    vacuumPumpOn?: boolean | null;
  }): void;
}

export interface SterilizerEngine {
  getState(): SterilizerState;
  tick(dtMs: number): Promise<void>;

  startCycle(programId: string): Promise<void>;
  stopCycle(): Promise<void>;
  openDoor(): Promise<void>;
  closeDoor(): Promise<void>;

  startVacuumTest(config: { stabilizationTimeSec: number; testTimeSec: number }): Promise<void>;
  setProgramOverride(programId: string, override: ProgramOverride): void;
  setCalibrationOffsets(offsets: Partial<SterilizerState['calibrationOffsets']>): void;
  resetCalibrationOffsets(): void;
  powerFail(message?: string): void;
  continueAfterPower(): void;
  abortAfterPower(): void;
  setManualActuators(cmd: {
    heaterOn?: boolean | null;
    steamInletValveOpen?: boolean | null;
    steamExhaustValveOpen?: boolean | null;
    vacuumPumpOn?: boolean | null;
  }): void;

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
    errorHistory: [],
    lastCompletedCycles: [],
    vacuumTest: {
      active: false,
      phase: 'IDLE',
      elapsedSec: 0,
      stabilizationTimeSec: 300,
      testTimeSec: 300,
      startedAt: null,
      basePressureMPa: null,
    },
    lastVacuumTests: [],
    programOverrides: {},
    calibrationOffsets: {
      chamberTempOffsetC: 0,
      chamberPressureOffset: 0,
      generatorTempOffsetC: 0,
      generatorPressureOffset: 0,
    },
    powerFailure: {
      pending: false,
    },
  };

let lastTickMs = now();
let currentProgram: ProgramConfig | null = null;
let completedPrevacuums = 0;
let currentCycleStart = 0;
let maxTemp = 0;
let maxPressure = 0;
  let sterilizationTempLowSec = 0;
let currentVacuumStartPressure = 0;
let pausedCycle: CycleRuntime | null = null;

  function recordCycle(result: 'success' | 'error' | 'aborted', primaryErrorCode?: ErrorCode) {
    if (!state.cycle.currentProgram) return;
    const endedAt = now();
    const durationSec = Math.max(0, (endedAt - currentCycleStart) / 1000);
    const success = result === 'success';
    const summary: CycleSummary = {
      id: `c_${state.lastCompletedCycles.length + 1}_${Date.now()}`,
      startedAt: currentCycleStart,
      endedAt,
      durationSec,
      programId: state.cycle.currentProgram.id,
      programName: state.cycle.currentProgram.name,
      result,
      success,
      primaryErrorCode,
      maxTemperatureC: maxTemp,
      maxPressureMPa: maxPressure,
      errors: [...state.errors],
    };
    state.lastCompletedCycles = [summary, ...state.lastCompletedCycles].slice(0, 50);
  }

  async function syncSensors() {
    const sensors = await io.readSensors();
    const cOff = state.calibrationOffsets;
    state = {
      ...state,
      chamber: {
        pressureMPa: sensors.chamberPressureMPa + cOff.chamberPressureOffset,
        temperatureC: sensors.chamberTemperatureC + cOff.chamberTempOffsetC,
      },
      generator: {
        pressureMPa: sensors.generatorPressureMPa + cOff.generatorPressureOffset,
        temperatureC: sensors.generatorTemperatureC + cOff.generatorTempOffsetC,
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
    state.errorHistory = [evt, ...state.errorHistory].slice(0, 100);
    state.cycle.currentPhase = 'ERROR';
    state.cycle.active = false;
    recordCycle('error', code);
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

    // 2a. Вакуум-тест (упрощённая логика)
    if (state.vacuumTest.active && !state.cycle.active) {
      state.vacuumTest.elapsedSec += dtSec;
      if (state.vacuumTest.phase === 'STABILIZE' && state.vacuumTest.elapsedSec >= state.vacuumTest.stabilizationTimeSec) {
        state.vacuumTest.phase = 'TEST';
        state.vacuumTest.elapsedSec = 0;
        currentVacuumStartPressure = state.chamber.pressureMPa;
        state.vacuumTest.basePressureMPa = currentVacuumStartPressure;
      } else if (state.vacuumTest.phase === 'TEST' && state.vacuumTest.elapsedSec >= state.vacuumTest.testTimeSec) {
        const durationMin = state.vacuumTest.testTimeSec / 60;
        const leakRate = durationMin > 0 ? Math.max(0, (state.chamber.pressureMPa - currentVacuumStartPressure) / durationMin) : 0;
        const pass = leakRate <= 0.005; // простое допущение
        const result: VacuumTestResult = {
          id: `vt_${Date.now()}`,
          startedAt: state.vacuumTest.startedAt || now(),
          endedAt: now(),
          result: pass ? 'PASS' : 'FAIL',
          leakRateMPaPerMin: leakRate,
        };
        state.lastVacuumTests = [result, ...state.lastVacuumTests].slice(0, 20);
        state.vacuumTest = {
          active: false,
          phase: 'IDLE',
          elapsedSec: 0,
          stabilizationTimeSec: state.vacuumTest.stabilizationTimeSec,
          testTimeSec: state.vacuumTest.testTimeSec,
          startedAt: null,
          basePressureMPa: null,
          result: result.result,
          leakRateMPaPerMin: leakRate,
        };
        await io.writeActuators({ vacuumPumpOn: false, steamExhaustValveOpen: false, steamInletValveOpen: false });
      } else if (state.vacuumTest.phase === 'STABILIZE') {
        // держим вакуум
        await io.writeActuators({ vacuumPumpOn: true, steamExhaustValveOpen: true, steamInletValveOpen: false, heaterOn: false });
      } else if (state.vacuumTest.phase === 'TEST') {
        // во время теста держим закрытым
        await io.writeActuators({ vacuumPumpOn: false, steamExhaustValveOpen: false, steamInletValveOpen: false, heaterOn: false });
      }
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
            recordCycle('success');
          }
          break;
        }
        default:
          break;
      }
    }

    // 4. проверки ошибок (если не в ERROR)
    if (state.cycle.currentPhase !== 'ERROR') {
      if (state.chamber.pressureMPa > 0.35) {
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
      const base = programs.find((p) => p.id === programId) || null;
      const override = state.programOverrides[programId] || {};
      const program = base
        ? { ...base, ...override }
        : null;
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
      state.powerFailure = { pending: false };
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
      recordCycle('aborted', 'USER_STOP');
    },

    async openDoor() {
      // В реальной реализации должны быть проверки на давление/температуру
      await io.writeActuators({ doorLockOn: false });
    },

    async closeDoor() {
      await io.writeActuators({ doorLockOn: true });
    },

    async startVacuumTest(config: { stabilizationTimeSec: number; testTimeSec: number }) {
      if (state.cycle.active) return;
      state.vacuumTest = {
        active: true,
        phase: 'STABILIZE',
        elapsedSec: 0,
        stabilizationTimeSec: config.stabilizationTimeSec,
        testTimeSec: config.testTimeSec,
        startedAt: now(),
        basePressureMPa: null,
      };
      await io.writeActuators({ vacuumPumpOn: true, steamExhaustValveOpen: true, steamInletValveOpen: false, heaterOn: false });
    },

    setProgramOverride(programId: string, override: ProgramOverride) {
      state.programOverrides = {
        ...state.programOverrides,
        [programId]: { ...(state.programOverrides[programId] || {}), ...override },
      };
    },

    setCalibrationOffsets(offsets: Partial<SterilizerState['calibrationOffsets']>) {
      state.calibrationOffsets = { ...state.calibrationOffsets, ...offsets };
    },

    resetCalibrationOffsets() {
      state.calibrationOffsets = {
        chamberTempOffsetC: 0,
        chamberPressureOffset: 0,
        generatorTempOffsetC: 0,
        generatorPressureOffset: 0,
      };
    },

    powerFail(message?: string) {
      if (!state.cycle.active) return;
      pausedCycle = { ...state.cycle };
      state.cycle.active = false;
      state.powerFailure = { pending: true, message };
    },

    continueAfterPower() {
      if (!state.powerFailure.pending || !pausedCycle) return;
      state.cycle = { ...pausedCycle };
      state.cycle.active = true;
      state.powerFailure = { pending: false };
      pausedCycle = null;
    },

    abortAfterPower() {
      if (!state.powerFailure.pending) return;
      state.powerFailure = { pending: false };
      pausedCycle = null;
      recordCycle('aborted', 'POWER_ERROR');
      state.cycle.active = false;
      state.cycle.currentPhase = 'IDLE';
      state.cycle.currentProgram = null;
    },

    resetErrors() {
      state.errors = [];
      // ошибки остаются в errorHistory
      if (state.cycle.currentPhase === 'ERROR') {
        state.cycle.currentPhase = 'IDLE';
        state.cycle.active = false;
      }
    },

    setManualActuators(cmd) {
      io.setManualActuators?.(cmd);
    },
  };
}
