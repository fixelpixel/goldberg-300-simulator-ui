# Goldberg 300 Simulator – Tech Lead README

## 1. Назначение проекта

Цель репозитория — прототип цифрового двойника парового стерилизатора **GOLDBERG 300**:

1. **Ядро (core-sterilizer)** – модель стерилизатора + state-machine цикла.
2. **Симуляция (io-simulation)** – упрощённая физика камеры/парогенератора.
3. **Web UI (apps/web-ui)** – интерфейс оператора (React SPA).
4. **Gateway (server-gateway)** – WebSocket/Node-шлюз (для будущей работы с ПЛК).

Проект задуман так, чтобы:

- сейчас работать в режиме **полной симуляции** (всё крутится локально),
- в будущем быть расширенным до режима **LIVE** с реальным ПЛК (Panasonic FP0R, Modbus).

Документация по архитектуре: `docs/ARCHITECTURE.md`.

---

## 2. Архитектура и структура репозитория

Монорепо:

```text
.
├─ apps/
│  └─ web-ui/             # React SPA интерфейс оператора
│
├─ packages/
│  ├─ core-sterilizer/    # Доменная модель + движок стерилизатора
│  ├─ io-simulation/      # Реализация SterilizerIO для симуляции
│  └─ io-modbus/          # Заглушка под Modbus-адаптер (для ПЛК)
│
├─ server-gateway/        # Node.js WebSocket-gateway (симуляция/в будущем live)
│
└─ docs/                  # Проектные документы и прототип UI
   ├─ ARCHITECTURE.md
   ├─ API.md
   ├─ ERRORS.md
   ├─ PROGRAMS.md
   └─ ui/goldberg300.html
```

### Ключевые компоненты

- **`packages/core-sterilizer/index.ts`**
  - Типы: `Phase`, `SterilizerState`, `ProgramConfig`, `ErrorEvent`, `CycleSummary` и т.д.
  - Интерфейс I/O: `SterilizerIO` (сенсоры + исполнительные механизмы).
  - Функция `createSterilizerEngine(options: EngineOptions): SterilizerEngine`.
  - Методы `SterilizerEngine`:
    - `getState()`
    - `tick(dtMs)`
    - `startCycle(programId)`
    - `stopCycle()`
    - `openDoor()`, `closeDoor()`
    - `startVacuumTest(...)`
    - `resetErrors()`

- **`packages/io-simulation/index.ts`**
  - Класс `SimulationIO implements SterilizerIO`.
  - Внутренний `InternalPhysicalState` + метод `stepPhysics(dtSec)`.
  - Условная модель:
    - нагрев/охлаждение парогенератора,
    - рост/падение давления,
    - предвакуум, сброс, охлаждение.

- **`apps/web-ui/src/engineClient.ts`**
  - Описаны программы `PROGRAMS` (+ `PROGRAM_DETAILS`).
  - Хук `useEngineSimulation()`:
    - создаёт `SimulationIO` + `createSterilizerEngine`,
    - каждую `~200ms` вызывает `engine.tick(...)`,
    - кладёт в React `SterilizerState` + возвращает `controls` (start/stop/open/close/reset).

- **`apps/web-ui/src/GoldbergSterilizerUI.tsx`**
  - Основной UI.
  - Подключается к `useEngineSimulation()`:
    - читает `state` (температуры, давления, статус, активная программа),
    - вызывает `controls.startCycle(programId)` и др.
  - Экраны: главный мониторинг, программы, тесты, журналы, сервис.

- **`server-gateway/src/index.ts`**
  - HTTP + `WebSocketServer`.
  - Создаёт `engine = createSterilizerEngine({ io: new SimulationIO(), programs })`.
  - Таймер: каждые 200ms → `engine.tick()` → рассылка `{"type": "state", "payload": SterilizerState}` всем клиентам.
  - Обрабатывает команды от клиента: `start_cycle`, `stop_cycle`, `open_door`, `close_door`, `start_vacuum_test`, `reset_errors`.

---

## 3. Режимы работы

### 3.1. Текущий основной режим — **Local Simulation**

- Симуляция полностью происходит в браузере.
- Связка:
  - `apps/web-ui` → `useEngineSimulation` → `core-sterilizer` + `io-simulation`.
- `server-gateway` можно не запускать.

**Назначение**: демо/POC, презентации, быстрый UX/логический фронт без реального железа.

### 3.2. Планируемый режим — **Remote / Gateway**

- Движок + I/O крутятся на сервере.
- Web UI общается по WebSocket:
  - сервер → клиент: `{"type":"state","payload": SterilizerState}`
  - клиент → сервер: `{"type":"command","payload": { "kind": "...", "params": {...} }}` (см. `docs/API.md`).

В этом режиме `io-modbus` предполагается как адаптер к реальному ПЛК.

---

## 4. Быстрый старт для разработки

### 4.1. Только UI + локальная симуляция

```bash
cd apps/web-ui
npm install
npm run dev
```

- Откроется интерфейс стерилизатора.
- Данные (T/P/фазы) идут от `core-sterilizer` + `SimulationIO`, крутящихся в браузере.

### 4.2. Запуск gateway (симуляция на сервере)

(Сейчас – опционально, для экспериментов)

```bash
  cd server-gateway
  npm install
  npm run build
  npm start
  # WebSocket на ws://localhost:8090
```

По умолчанию gateway тоже использует `SimulationIO`.  
Подключение UI к gateway пока не включено по умолчанию, но заготовлено в архитектуре — см. `docs/API.md`.

### 4.3. Docker / docker-compose

Корень:

```bash
docker compose up --build
```

> TODO: при необходимости донастроить сервисы в `docker-compose.yml` (UI + gateway + будущий PLC-симулятор / БД).

---

## 5. Как развивать дальше (ключевые точки для техлида)

### 5.1. Уточнение логики цикла (state-machine)

Файл: `packages/core-sterilizer/index.ts`

План для доработки:

- Задать для каждой фазы:
  - условия входа (T/P, время, состояние двери),
  - целевое время/условия выхода,
  - действия над I/O (какие клапаны/насосы/нагрев включены).
- Довести заполнение `CycleSummary`:
  - `startedAt`, `endedAt`,
  - `maxTemperatureC`, `maxPressureMPa`,
  - список ошибок за цикл.

### 5.2. Журналы в UI

Файл: `apps/web-ui/src/GoldbergSterilizerUI.tsx`

- Подвязать экраны «Журнал циклов» и «Журнал ошибок» к:
  - `state.lastCompletedCycles`,
  - `state.errors`.
- Добавить фильтрацию по датам/программе (по мере необходимости).

### 5.3. Интеграция с ПЛК (Modbus)

Файл: `packages/io-modbus/index.ts`

- Заполнить `ModbusConfig.registers` реальными адресами регистров (после анализа ПЛК).
- Реализовать:
  - чтение регистров (давление, температура, уровни, состояния двери),
  - запись coils/holding-регистров (клапаны, насосы, ТЭНы, блокировка двери).
- Подключить `ModbusIO` вместо `SimulationIO` в `server-gateway`.

---

## 6. Ссылки для ориентира

- Архитектура проекта: `docs/ARCHITECTURE.md`
- WebSocket/REST API: `docs/API.md`
- Список ошибок: `docs/ERRORS.md`
- Программы стерилизации: `docs/PROGRAMS.md`
- Прототип UI (Canvas → HTML): `docs/ui/goldberg300.html`

---

## 7. TL;DR для входа в проект

1. **Понять домен** → `docs/ARCHITECTURE.md`, `docs/PROGRAMS.md`.  
2. **Потрогать симуляцию** → `apps/web-ui`, `npm run dev`.  
3. **Почитать ядро** → `packages/core-sterilizer/index.ts` (интерфейсы + state-machine).  
4. **Решить, что делаем дальше**:
   - либо углубляем физику/циклы/журналы,
   - либо готовим `io-modbus` и `server-gateway` к работе с реальным железом.
