# Virtual Goldberg 300 – Архитектура проекта

**Версия документа:** v0.1  
**Дата:** _(заполни)_  

## 0. Паспорт проекта

- **Название:** Virtual Goldberg 300 – цифровой двойник парового стерилизатора + новая система управления
- **Цель:**
  1. Создать виртуальный (симуляционный) паровой стерилизатор GOLDBERG 300 с реалистичным поведением.
  2. Реализовать современный SPA-интерфейс оператора/инженера (React).
  3. Построить модульную архитектуру, которую можно подключить к реальному ПЛК (Panasonic FP0R) через Modbus.

---

## 1. Область применения и сценарии

### 1.1. Режимы работы

1. **Simulation (демо/обучение)**  
   - Запуск в браузере на обычном ПК.  
   - Пользователь выбирает программу, запускает цикл.  
   - UI показывает динамику давления, температуры, смену фаз, ошибки.  
   - Ведутся журналы циклов и ошибок.

2. **Live (работа с реальным оборудованием, будущая фаза)**  
   - Тот же UI.  
   - Данные берутся с ПЛК по Modbus через Node-backend.  
   - Команды из UI транслируются в реальные выходы ПЛК.

### 1.2. Пользователи

- **Оператор (медперсонал):** выбор программы, запуск/остановка, просмотр статуса.  
- **Инженер/сервис:** проверка системы, сервисный режим, калибровки.  
- **Руководство/закупки:** просмотр демо, журналов, отчётов.

---

## 2. Высокоуровневая архитектура

```text
[React SPA (UI)]  <---- WebSocket / in-process ---->  [Core Engine]
                                                        |
                                                        +-- SimulationIO (фаза 1–2)
                                                        |
                                                        +-- ModbusIO (фаза 3, связь с PLC)
```

### 2.1. Компоненты

1. **Frontend (UI)**
   - Фреймворк: React + TypeScript.
   - Основной компонент: `GoldbergSterilizerUI`.
   - Отвечает за:
     - отрисовку экранов (мониторинг, программы, тесты, журналы, сервис и т.д.);
     - обработку действий пользователя;
     - подписку на состояние стерилизатора.

2. **Core Engine (ядро стерилизатора)**
   - Чистая TypeScript-библиотека, без привязки к DOM/React.
   - Отвечает за:
     - модель состояния стерилизатора;
     - машину состояний (state machine) цикла;
     - симуляцию давления, температуры, вакуума;
     - генерацию ошибок и логов;
     - абстракцию ввода/вывода через интерфейс `SterilizerIO`.

3. **Backend Gateway (фаза 3)**
   - Node.js + TypeScript, лёгкий сервер (Fastify/Express).
   - Режимы:
     - `SIMULATION`: Core Engine крутится на сервере, UI получает состояние по WebSocket.
     - `LIVE`: Core Engine работает как тонкий слой над сигналами ПЛК.
   - Реализация адаптера `ModbusIO` (через `modbus-serial`/`jsmodbus`).

---

## 3. Технический стек

### 3.1. Frontend

- React 18+
- TypeScript
- Vite / CRA / Next.js — по выбору команды
- Tailwind CSS (или аналог utility-классов)
- State-management:
  - React Context + `useReducer` **или**
  - Zustand / Redux Toolkit (на выбор)
- Коммуникация с ядром:
  - Фаза 1: движок живёт в браузере, прямые вызовы.
  - Фаза 3: WebSocket/SSE к backend-gateway.

### 3.2. Backend (фаза 3)

- Node.js 20+
- TypeScript
- Fastify или Express
- WebSocket (библиотека `ws`)
- Modbus-клиент: `modbus-serial` или `jsmodbus`
- БД:
  - POC: SQLite
  - Прод: PostgreSQL (таблицы циклов, ошибок, сервисных событий)

---

## 4. Модель домена

### 4.1. Типы и интерфейсы

```ts
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
  pressureMPa: number;    // давление в камере
  temperatureC: number;   // температура в камере
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
  timestamp: number; // ms since epoch
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
```

### 4.2. Интерфейс движка

```ts
export interface SterilizerEngine {
  /** Текущее состояние */
  getState(): SterilizerState;

  /** Обновление состояния; вызывается каждые dtMs миллисекунд */
  tick(dtMs: number): void;

  /** Команды оператора */
  startCycle(programId: string): void;
  stopCycle(): void;
  openDoor(): void;
  closeDoor(): void;

  /** Запуск вакуум-теста */
  startVacuumTest(config: VacuumTestConfig): void;

  /** Сервис */
  resetErrors(): void;
}
```

---

## 5. IO-слой (адаптеры)

### 5.1. Общий интерфейс

```ts
export interface SterilizerIO {
  /** Чтение датчиков в физических величинах */
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

  /** Управление исполнительными механизмами */
  writeActuators(cmd: {
    heaterOn?: boolean;
    steamInletValveOpen?: boolean;
    steamExhaustValveOpen?: boolean;
    vacuumPumpOn?: boolean;
    waterPumpOn?: boolean;
    doorLockOn?: boolean;
    // при необходимости дополнять
  }): Promise<void>;
}
```

### 5.2. Реализация `SimulationIO`

- Не использует внешнее оборудование.
- Хранит внутреннее «физическое» состояние.
- `readSensors()` возвращает значения из внутреннего состояния.
- `writeActuators()` меняет флаги (`heaterOn`, `vacuumPumpOn` и т.п.), которые учитываются в `tick()`.

### 5.3. Реализация `ModbusIO` (фаза 3)

- Конфигурация: mapping сигналов ↔ Modbus-регистры/коилы.
- `readSensors()`:
  - читает заданные регистры;
  - масштабирует сырые значения в физические величины (например, 0–4095 → 0–0.3 МПа).
- `writeActuators()`:
  - устанавливает соответствующие Modbus-coils/holding-регистр.

---

## 6. Машина состояний цикла

### 6.1. Фазы

Упрощённый сценарий:

1. `IDLE`  
   Ожидание: программа выбрана, дверь закрыта и заблокирована, нет ошибок.  
   → `PREHEAT`.

2. `PREHEAT` (прогрев)  
   - Нагрев парогенератора до рабочих параметров (T, P).  
   - Переход в `PREVACUUM` при достижении порогов и минимального времени прогрева.

3. `PREVACUUM` (предвакуум(ы))  
   - Включение вакуумного насоса, закрытие паровых клапанов.  
   - Снижение давления в камере до заданного уровня.  
   - Повтор `preVacuumCount` раз.  
   - → `HEAT_UP`.

4. `HEAT_UP` (нагрев)  
   - Подача пара в камеру.  
   - Цель: `chamberTemperatureC → setTempC` с ограничением давления.  
   - При достижении температуры и стабилизации → `STERILIZATION`.

5. `STERILIZATION` (выдержка)  
   - Поддержание температуры вокруг `setTempC`.  
   - Отсчёт `sterilizationTimeSec`.  
   - Контроль, что T не падает ниже допустимого.  
   - По окончании времени → `DRYING` или `DEPRESSURIZE` (по настройкам программы).

6. `DRYING` (сушка)  
   - Вакуум + возможно подогрев рубашки.  
   - Отсчёт `dryingTimeSec`.  
   - → `DEPRESSURIZE`.

7. `DEPRESSURIZE` (сброс давления)  
   - Открытие сбросного клапана.  
   - Плавное снижение давления до безопасного.  
   - → `COOLING`.

8. `COOLING` (охлаждение)  
   - Охлаждение камеры до безопасной температуры (например, < 60 °C).  
   - → `COMPLETE`.

9. `COMPLETE`  
   - Цикл завершён, дверь можно разблокировать.  
   - Формируется запись в журнале циклов.

10. Любая фаза → `ERROR`, если сработала критическая ошибка.

### 6.2. Примеры проверок ошибок

- `OVERPRESSURE` — давление выше максимума.
- `HEATING_TIMEOUT` — не достигнута целевая температура за время `HEATUP_TIMEOUT`.
- `NO_WATER` — уровни воды ниже порога при включённых ТЭНах.
- `VACUUM_FAIL` — не достигнут заданный вакуум за этап `PREVACUUM`.
- `SENSOR_FAILURE` — некорректные/нестабильные значения датчика.
- `DOOR_OPEN` — попытка старта при открытой двери и т.п.

---

## 7. Физическая симуляция (упрощённая модель)

Раз в `tick(dtSec)` обновляем внутреннее физическое состояние.

Пример псевдокода:

```ts
function updatePhysics(dtSec: number, physical: InternalPhysicalState, actuators: ActuatorState) {
  // Парогенератор
  if (actuators.heaterOn && physical.generatorWaterLevelPercent > 0) {
    physical.generatorTemperatureC += kGenHeat * dtSec;
  } else:
    physical.generatorTemperatureC -= kGenCool * dtSec;
  }

  physical.generatorTemperatureC = clamp(physical.generatorTemperatureC, 20, 160);
  physical.generatorPressureMPa = saturatedSteamPressure(physical.generatorTemperatureC);

  // Камера при подаче пара
  if (actuators.steamInletValveOpen) {
    physical.chamberPressureMPa += kChamberFill * (physical.generatorPressureMPa - physical.chamberPressureMPa) * dtSec;
    physical.chamberTemperatureC += kChamberHeat * dtSec;
  }

  // Вакуум
  if (actuators.vacuumPumpOn) {
    physical.chamberPressureMPa -= kVacuum * dtSec;
  }

  // Сброс
  if (actuators.steamExhaustValveOpen) {
    physical.chamberPressureMPa -= kExhaust * dtSec;
  }

  // Охлаждение камеры
  physical.chamberTemperatureC -= kChamberCool * dtSec;
}
```

Коэффициенты `k*` подбираются эмпирически, чтобы графики выглядели правдоподобно (выход на 134 °C за разумное время, реалистичное падение давления и т.д.).

---

## 8. Интеграция с UI

### 8.1. Вариант А: движок в браузере (POC)

- В React создаётся `SterilizerEngine` (через `createSterilizerEngine(SimulationIO)`).
- Запускается таймер (100–200 мс):
  - `engine.tick(dt)`;
  - новое `SterilizerState` кладётся в глобальный стор (Context/Zustand).
- Компоненты UI (`MetricCard`, экраны программ, журналов и т.д.) читают нужные поля из стора.

### 8.2. Вариант B: движок на backend-gateway

- Браузер подключается к серверу по WebSocket.
- Протокол:

```jsonc
// сервер -> клиент
{ "type": "state", "payload": { /* SterilizerState */ } }

// клиент -> сервер
{ "type": "command", "payload": { "kind": "start_cycle", "programId": "prog_134_5" } }
```

- На сервере:
  - отдельный таймер вызывает `engine.tick(dt)`;
  - периодически рассылается состояние (`state` сообщений).

---

## 9. Журналы и отчёты

### 9.1. Журнал циклов

Структура `CycleSummary` (см. выше).  

- В POC хранится в памяти (массив).  
- В проде — таблица `cycles` в БД (SQLite/Postgres):

Минимальные поля:

- `id`
- `started_at`
- `ended_at`
- `program_id`
- `program_name`
- `success`
- `max_temp_c`
- `max_pressure_mpa`
- `errors_json` (или отдельная таблица связей).

### 9.2. Журнал ошибок

Использует `ErrorEvent`.  

- В POC — массив в состоянии.  
- В проде — таблица `errors` (id, timestamp, code, message, cycle_id?).

UI-экраны «Журнал циклов» и «Журнал ошибок» работают поверх этих моделей.

---

## 10. Структура репозитория (рекомендация)

```text
/virtual-goldberg-300
  /apps
    /web-ui              # React SPA
  /packages
    /core-sterilizer     # ядро симуляции + доменная модель
    /io-simulation       # реализация SimulationIO
    /io-modbus           # реализация ModbusIO (фаза 3)
    /server-gateway      # Node.js backend (фаза 3)
  /docs
    ARCHITECTURE.md      # этот файл
    API.md               # спецификация REST/WebSocket API (TODO)
    ERRORS.md            # коды ошибок (TODO)
    PROGRAMS.md          # описание стандартных программ стерилизации (TODO)
```

---

## 11. Roadmap

### Фаза 1 — POC (1–2 недели)

- Вынести ядро в `core-sterilizer` с `SimulationIO`.
- Подключить существующий React UI к реальному `SterilizerState`.
- Реализовать базовые фазы цикла и пару типовых ошибок.
- Добавить журнал циклов и ошибок (in-memory).

### Фаза 2 — Production-ready симуляция (2–3 недели)

- Стабилизировать публичный API ядра.
- Отшлифовать модель физики (реалистичные графики T/P).
- Очистить и документировать журнал циклов/ошибок.
- Дописать `API.md`, `ERRORS.md`, `PROGRAMS.md`.

### Фаза 3 — Пилот с реальным ПЛК (3–5 недель)

- Реализовать `io-modbus` и `server-gateway`.
- Настроить mapping Modbus-регистров под FP0R.
- Запустить UI в режиме `LIVE` на реальном GOLDBERG 300.
- Собрать обратную связь от операторов и сервиса.
