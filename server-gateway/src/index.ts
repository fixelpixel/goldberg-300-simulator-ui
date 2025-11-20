// server-gateway/src/index.ts
// Backend-gateway: поднимает WebSocket-сервер и оборачивает SterilizerEngine.

import http from 'http';
import { WebSocketServer } from 'ws';
import { createSterilizerEngine, type ProgramConfig } from '@goldberg/core-sterilizer';
import { SimulationIO } from '@goldberg/io-simulation';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

// Примеры программ; в реальном проекте можно загрузить из config / БД.
const programs: ProgramConfig[] = [
  {
    id: 'prog_134_5',
    name: 'Инструменты 134°C / 5 мин',
    setTempC: 134,
    sterilizationTimeSec: 5 * 60,
    preVacuumCount: 3,
    dryingTimeSec: 10 * 60,
  },
];

const io = new SimulationIO();
const engine = createSterilizerEngine({ io, programs });

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
  // Отправляем текущее состояние сразу при подключении
  socket.send(JSON.stringify({ type: 'state', payload: engine.getState() }));

  socket.on('message', async (data) => {
    try {
      const msg = JSON.parse(String(data));
      if (msg.type === 'command') {
        const { kind, params } = msg.payload || {};
        switch (kind) {
          case 'start_cycle':
            await engine.startCycle(params?.programId ?? programs[0]?.id ?? '');
            break;
          case 'stop_cycle':
            await engine.stopCycle();
            break;
          case 'open_door':
            await engine.openDoor();
            break;
          case 'close_door':
            await engine.closeDoor();
            break;
          case 'start_vacuum_test':
            await engine.startVacuumTest({
              stabilizationTimeSec: params?.stabilizationTimeSec ?? 300,
              testTimeSec: params?.testTimeSec ?? 600,
            });
            break;
          case 'reset_errors':
            engine.resetErrors();
            break;
          default:
            console.warn('Unknown command kind', kind);
        }
      }
    } catch (err) {
      console.error('Error handling message', err);
    }
  });
});

// Периодический тик двигателя и рассылка состояния
setInterval(async () => {
  await engine.tick(200);
  const state = engine.getState();
  const payload = JSON.stringify({ type: 'state', payload: state });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}, 200);

server.listen(PORT, () => {
  console.log(`Virtual Goldberg 300 gateway listening on port ${PORT}`);
});
