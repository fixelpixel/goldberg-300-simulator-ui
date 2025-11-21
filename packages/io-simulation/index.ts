// io-simulation/index.ts
// Реализация SterilizerIO для режима симуляции (без реального оборудования).

import type { SterilizerIO } from '../core-sterilizer';

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

    // Простейшая модель нагрева парогенератора
    if (p.heaterOn && p.waterLevelPercent > 0) {
      p.generatorTemperatureC += 2.0 * dtSec;
      p.waterLevelPercent -= 0.03 * dtSec; // расход воды при нагреве
    } else {
      // медленное охлаждение к окружающей температуре
      const cool = (p.generatorTemperatureC - this.ambientTemp) * 0.01 * dtSec;
      p.generatorTemperatureC -= cool;
    }

    if (p.generatorTemperatureC < 20) p.generatorTemperatureC = 20;
    if (p.generatorTemperatureC > 160) p.generatorTemperatureC = 160;

    // Условная зависимость давления пара от температуры
    p.generatorPressureMPa = this.saturatedSteamPressure(p.generatorTemperatureC);

    // Заполнение камеры паром
    if (p.steamInletValveOpen) {
      const delta = (p.generatorPressureMPa - p.chamberPressureMPa) * 0.55 * dtSec;
      p.chamberPressureMPa += delta;
      // нагрев камеры стремится к температуре генератора
      const target = Math.max(p.chamberTemperatureC, p.generatorTemperatureC - 5);
      p.chamberTemperatureC += (target - p.chamberTemperatureC) * 0.04 * dtSec;
    }

    // Вакуум
    if (p.vacuumPumpOn) {
      p.chamberPressureMPa -= 0.08 * dtSec;
    }

    // Сброс
    if (p.steamExhaustValveOpen) {
      p.chamberPressureMPa -= 0.12 * dtSec;
    }

    // Охлаждение камеры
    p.chamberTemperatureC -= 0.45 * dtSec;

    if (p.chamberTemperatureC < 20) p.chamberTemperatureC = 20;
    if (p.chamberPressureMPa < -0.1) p.chamberPressureMPa = -0.1;
    if (p.chamberPressureMPa > 0.35) p.chamberPressureMPa = 0.35;

    if (p.waterLevelPercent < 0) p.waterLevelPercent = 0;

    // Лёгкая утечка к атмосфере/окружающей среде
    p.chamberPressureMPa += (0 - p.chamberPressureMPa) * 0.01 * dtSec;
    p.chamberTemperatureC += (this.ambientTemp - p.chamberTemperatureC) * 0.01 * dtSec;
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
  }
}
