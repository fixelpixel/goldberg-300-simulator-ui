// io-simulation/index.ts
// Реализация SterilizerIO для режима симуляции (без реального оборудования).

import type { PhaseTargets, SterilizerIO } from '../core-sterilizer';

export interface InternalPhysicalState {
  chamberPressureMPa: number;
  chamberTemperatureC: number;
  generatorPressureMPa: number;
  generatorTemperatureC: number;
  jacketPressureMPa: number;
  waterLevelPercent: number;
  doorOpen: boolean;
  doorLocked: boolean;

  heaterOn: boolean;
  steamInletValveOpen: boolean;
  steamExhaustValveOpen: boolean;
  vacuumPumpOn: boolean;
  waterPumpOn: boolean;
}

export class SimulationIO implements SterilizerIO {
  private physical: InternalPhysicalState;
  private lastDt = 0;
  private ambientTemp = 22;
  private manualOverrides: {
    heaterOn?: boolean;
    steamInletValveOpen?: boolean;
    steamExhaustValveOpen?: boolean;
    vacuumPumpOn?: boolean;
  } = {};
  private baseTargets: PhaseTargets = {
    chamberTempC: 25,
    generatorTempC: 30,
    chamberPressureMPa: 0.005,
  };

  private getActiveTargets(): PhaseTargets {
    let target = { ...this.baseTargets };
    if (this.manualOverrides.heaterOn) {
      target.generatorTempC = Math.max(target.generatorTempC, 150);
    }
    if (this.manualOverrides.steamInletValveOpen) {
      target.chamberPressureMPa = Math.max(target.chamberPressureMPa, 0.28);
      target.chamberTempC = Math.max(target.chamberTempC, target.generatorTempC - 5);
    }
    if (this.manualOverrides.vacuumPumpOn) {
      target.chamberPressureMPa = Math.min(target.chamberPressureMPa, 0.005);
    }
    return target;
  }

  constructor(initial?: Partial<InternalPhysicalState>) {
    this.physical = {
      chamberPressureMPa: 0,
      chamberTemperatureC: 20,
      generatorPressureMPa: 0,
      generatorTemperatureC: 20,
      jacketPressureMPa: 0,
      waterLevelPercent: 100,
      doorOpen: true,
      doorLocked: false,
      heaterOn: false,
      steamInletValveOpen: false,
      steamExhaustValveOpen: false,
      vacuumPumpOn: false,
      waterPumpOn: false,
      ...initial,
    };
  }

  // Приближённое давление насыщенного пара (МПа) в зависимости от температуры °C.
  private saturatedSteamPressure(tempC: number) {
    // Упрощённая аппроксимация: 100°C ≈ 0.1 МПа, 134°C ≈ 0.3 МПа
    if (tempC <= 100) return 0;
    const ratio = (tempC - 100) / 34; // 0..1 при 100..134
    return Math.min(0.35, 0.1 + ratio * 0.2);
  }

  // В реальном цикле это должен вызывать движок, обновляя физику.
  // Здесь оставлено как простая точка расширения.
  public stepPhysics(dtSec: number) {
    const p = this.physical;
    this.lastDt = dtSec;
    const targets = this.getActiveTargets();
    const approach = (current: number, target: number, rate: number) => {
      const diff = target - current;
      if (Math.abs(diff) <= rate * dtSec) return target;
      return current + Math.sign(diff) * rate * dtSec;
    };

    const heaterActive = p.heaterOn || this.manualOverrides.heaterOn;
    const generatorRate = heaterActive ? 6 : 2;
    p.generatorTemperatureC = approach(p.generatorTemperatureC, targets.generatorTempC, generatorRate);

    const chamberHeatRate = targets.chamberTempC > p.chamberTemperatureC ? 3 : 1.5;
    p.chamberTemperatureC = approach(p.chamberTemperatureC, targets.chamberTempC, chamberHeatRate);

    const pressureRate = 0.06;
    p.chamberPressureMPa = approach(p.chamberPressureMPa, targets.chamberPressureMPa, pressureRate);

    p.generatorTemperatureC = Math.max(20, Math.min(180, p.generatorTemperatureC));
    p.chamberTemperatureC = Math.max(20, Math.min(170, p.chamberTemperatureC));
    p.chamberPressureMPa = Math.max(0.0005, Math.min(0.35, p.chamberPressureMPa));

    if (heaterActive) {
      p.waterLevelPercent = Math.max(0, p.waterLevelPercent - 0.02 * dtSec);
    } else {
      p.generatorTemperatureC = approach(p.generatorTemperatureC, this.ambientTemp, 0.5);
    }

    if (p.waterLevelPercent < 0) p.waterLevelPercent = 0;
  }

  async readSensors() {
    return {
      chamberPressureMPa: this.physical.chamberPressureMPa,
      chamberTemperatureC: this.physical.chamberTemperatureC,
      generatorPressureMPa: this.physical.generatorPressureMPa,
      generatorTemperatureC: this.physical.generatorTemperatureC,
      jacketPressureMPa: this.physical.jacketPressureMPa,
      waterLevelPercent: this.physical.waterLevelPercent,
      doorOpen: this.physical.doorOpen,
      doorLocked: this.physical.doorLocked,
    };
  }

  async writeActuators(cmd: {
    heaterOn?: boolean;
    steamInletValveOpen?: boolean;
    steamExhaustValveOpen?: boolean;
    vacuumPumpOn?: boolean;
    waterPumpOn?: boolean;
    doorLockOn?: boolean;
    phaseTargets?: PhaseTargets;
  }) {
    if (typeof cmd.heaterOn === 'boolean') this.physical.heaterOn = cmd.heaterOn;
    if (typeof cmd.steamInletValveOpen === 'boolean') this.physical.steamInletValveOpen = cmd.steamInletValveOpen;
    if (typeof cmd.steamExhaustValveOpen === 'boolean') this.physical.steamExhaustValveOpen = cmd.steamExhaustValveOpen;
    if (typeof cmd.vacuumPumpOn === 'boolean') this.physical.vacuumPumpOn = cmd.vacuumPumpOn;
    if (typeof cmd.waterPumpOn === 'boolean') this.physical.waterPumpOn = cmd.waterPumpOn;

    if (typeof cmd.doorLockOn === 'boolean') {
      this.physical.doorLocked = cmd.doorLockOn;
      this.physical.doorOpen = !cmd.doorLockOn && this.physical.doorOpen;
    }

    if (this.manualOverrides.heaterOn !== undefined) this.physical.heaterOn = this.manualOverrides.heaterOn;
    if (this.manualOverrides.steamInletValveOpen !== undefined) this.physical.steamInletValveOpen = this.manualOverrides.steamInletValveOpen;
    if (this.manualOverrides.steamExhaustValveOpen !== undefined) this.physical.steamExhaustValveOpen = this.manualOverrides.steamExhaustValveOpen;
    if (this.manualOverrides.vacuumPumpOn !== undefined) this.physical.vacuumPumpOn = this.manualOverrides.vacuumPumpOn;

    if (cmd.phaseTargets) {
      this.baseTargets = cmd.phaseTargets;
    }
  }

  setManualActuators(cmd: {
    heaterOn?: boolean | null;
    steamInletValveOpen?: boolean | null;
    steamExhaustValveOpen?: boolean | null;
    vacuumPumpOn?: boolean | null;
  }) {
    const update = (key: keyof typeof this.manualOverrides, value: boolean | null | undefined) => {
      if (value === null) {
        delete this.manualOverrides[key];
      } else if (typeof value === 'boolean') {
        this.manualOverrides[key] = value;
      }
    };
    update('heaterOn', cmd.heaterOn);
    update('steamInletValveOpen', cmd.steamInletValveOpen);
    update('steamExhaustValveOpen', cmd.steamExhaustValveOpen);
    update('vacuumPumpOn', cmd.vacuumPumpOn);
  }
}
