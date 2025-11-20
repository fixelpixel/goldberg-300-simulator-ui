// io-modbus/index.ts
// Заготовка под реализацию SterilizerIO для работы с реальным ПЛК по Modbus.

import type { SterilizerIO } from '../core-sterilizer';

export interface ModbusConfig {
  host: string;
  port: number;
  unitId: number;

  // mapping регистров: здесь только пример, реальные адреса должны быть
  // заполнены по документации или результатам реверса.
  registers: {
    chamberPressureReg: number;
    chamberTemperatureReg: number;
    generatorPressureReg: number;
    generatorTemperatureReg: number;
    jacketPressureReg: number;
    waterLevelReg: number;
    doorOpenReg: number;
    doorLockedReg: number;

    // Coils / holding регистры для исполнительных механизмов
    heaterCoil: number;
    steamInletCoil: number;
    steamExhaustCoil: number;
    vacuumPumpCoil: number;
    waterPumpCoil: number;
    doorLockCoil: number;
  };
}

export class ModbusIO implements SterilizerIO {
  private config: ModbusConfig;
  // здесь должен быть реальный клиент modbus-serial или jsmodbus
  // private client: ModbusClient;

  constructor(config: ModbusConfig) {
    this.config = config;
    // TODO: инициализировать Modbus-клиент
  }

  async readSensors() {
    // TODO: считать регистры из ПЛК и привести к физическим величинам.
    // Пока возвращаем заглушку.
    return {
      chamberPressureMPa: 0,
      chamberTemperatureC: 20,
      generatorPressureMPa: 0,
      generatorTemperatureC: 20,
      jacketPressureMPa: 0,
      waterLevelPercent: 100,
      doorOpen: false,
      doorLocked: true,
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
    // TODO: записать соответствующие coils/holding-регистры
    console.log('ModbusIO.writeActuators', cmd);
  }
}
