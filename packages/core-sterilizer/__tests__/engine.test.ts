import { describe, expect, it } from 'vitest';
import { createSterilizerEngine } from '../index';
import { SimulationIO } from '../../io-simulation';

const PROGRAM = {
  id: 'prog_test',
  name: 'Тест 134°C',
  setTempC: 134,
  sterilizationTimeSec: 300,
  preVacuumCount: 1,
  dryingTimeSec: 60,
};

describe('createSterilizerEngine', () => {
  it('должен стартовать цикл при закрытой двери', async () => {
    const io = new SimulationIO({ doorLocked: true, doorOpen: false });
    const engine = createSterilizerEngine({ io, programs: [PROGRAM] });

    await engine.startCycle(PROGRAM.id);
    const state = engine.getState();

    expect(state.cycle.active).toBe(true);
    expect(state.cycle.currentPhase).toBe('PREHEAT');
    expect(state.cycle.currentProgram?.id).toBe(PROGRAM.id);
  });

  it('возвращает ошибку при старте с открытой дверью', async () => {
    const io = new SimulationIO({ doorLocked: false, doorOpen: true });
    const engine = createSterilizerEngine({ io, programs: [PROGRAM] });

    await engine.startCycle(PROGRAM.id);
    const state = engine.getState();

    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.errors[0].code).toBe('DOOR_OPEN');
    expect(state.cycle.active).toBe(false);
  });
});
