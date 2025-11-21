// io-simulation/index.ts
// Реализация SterilizerIO для режима симуляции (без реального оборудования).

import type { SterilizerIO } from '../core-sterilizer';

const HEATER_POWER_W = 6000;
const WATER_CAPACITY_KG = 8; // эквивалентно ~8 литрам
const SPECIFIC_HEAT_WATER = 4186; // Дж/(кг·К)
const LATENT_HEAT = 2257000; // Дж/кг

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
      let energyJ = HEATER_POWER_W * dtSec;
      const currentMassKg = Math.max(0.1, (p.waterLevelPercent / 100) * WATER_CAPACITY_KG);

      if (p.generatorTemperatureC < 100 && energyJ > 0) {
        const neededToBoil = Math.max(0, 100 - p.generatorTemperatureC) * currentMassKg * SPECIFIC_HEAT_WATER;
        const used = Math.min(neededToBoil, energyJ);
        p.generatorTemperatureC += used / (currentMassKg * SPECIFIC_HEAT_WATER);
        energyJ -= used;
      }

      if (energyJ > 0 && p.waterLevelPercent > 0) {
        const steamMass = energyJ / LATENT_HEAT;
        const percentLoss = (steamMass / WATER_CAPACITY_KG) * 100;
        p.waterLevelPercent = Math.max(0, p.waterLevelPercent - percentLoss);
        // лёгкий перегрев пара
        p.generatorTemperatureC = Math.min(160, p.generatorTemperatureC + steamMass * 10);
      }
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
    const valveArea = 0.001; // м² ~ 10 см²
    const dischargeCoeff = 0.7;
    const steamDensity = 0.6; // кг/м³ при 0.3 МПа
    const chamberVolume = 0.05; // м³ (50 литров)

    if (p.steamInletValveOpen) {
      const pressureDiff = Math.max(0, p.generatorPressureMPa - p.chamberPressureMPa) * 1e6; // Па
      if (pressureDiff > 0) {
        const flowRate = valveArea * dischargeCoeff * Math.sqrt((2 * pressureDiff) / steamDensity); // м³/с
        const massFlow = flowRate * steamDensity; // кг/с
        const deltaPressure = (massFlow * dtSec) / chamberVolume; // кг/м³ ≈ Па
        p.chamberPressureMPa += (deltaPressure / 1e6);
      }
    }

    const chamberMassKg = 20; // масса стенок+загрузки
    const chamberHeatCapacity = 500; // Дж/(кг·К)
    const heatTransferCoeff = 500; // Вт/(м²·К)
    const chamberArea = 1.5; // м²

    if (p.steamInletValveOpen) {
      const tempDiff = Math.max(0, p.generatorTemperatureC - p.chamberTemperatureC);
      const heatFlux = heatTransferCoeff * chamberArea * tempDiff; // Вт
      const tempRise = (heatFlux * dtSec) / (chamberMassKg * chamberHeatCapacity);
      p.chamberTemperatureC += tempRise;
    }

    // Вакуум
    if (p.vacuumPumpOn) {
      const pumpSpeed = 0.02; // м³/с
      const chamberVolume = 0.05; // м³
      const pumpingRate = pumpSpeed / chamberVolume;
      p.chamberPressureMPa *= Math.exp(-pumpingRate * dtSec);
    }

    // Сброс
    if (p.steamExhaustValveOpen) {
      p.chamberPressureMPa -= 0.12 * dtSec;
    }

    // Охлаждение камеры
    const ambientTransfer = 50; // Вт/(м²·К)
    const ambientArea = 1.5;
    const ambientHeatFlux = ambientTransfer * ambientArea * (p.chamberTemperatureC - this.ambientTemp);
    const ambientCool = (ambientHeatFlux * dtSec) / (chamberMassKg * chamberHeatCapacity);
    p.chamberTemperatureC -= ambientCool;

    if (p.chamberTemperatureC < 20) p.chamberTemperatureC = 20;
    if (p.chamberPressureMPa < 0.0001) p.chamberPressureMPa = 0.0001;
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
