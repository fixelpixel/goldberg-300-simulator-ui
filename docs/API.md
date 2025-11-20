# Virtual Goldberg 300 – API

Версия: v0.1

Этот документ описывает внешний API между Web-UI и backend-gateway.

## 1. Транспорт

Используется WebSocket-соединение (один канал) между браузером и сервером.

Альтернативно / дополнительно могут быть реализованы REST-эндпоинты для запросов к журналам (циклы, ошибки).

## 2. Формат сообщений WebSocket

Общий формат JSON:

```json
{
  "type": "<string>",
  "payload": { }
}
```

### 2.1. Сообщения от сервера к клиенту

#### `state`

Полное состояние стерилизатора.

```json
{
  "type": "state",
  "payload": {
    "chamber": {
      "pressureMPa": 0.12,
      "temperatureC": 134.2
    },
    "generator": {
      "pressureMPa": 0.25,
      "temperatureC": 145.0,
      "waterLevelPercent": 80
    },
    "jacket": {
      "pressureMPa": 0.21
    },
    "door": {
      "locked": true,
      "open": false
    },
    "cycle": {
      "active": true,
      "currentPhase": "STERILIZATION",
      "phaseElapsedSec": 120,
      "phaseTotalSec": 300,
      "totalElapsedSecSec": 420,
      "currentProgram": {
        "id": "prog_134_5",
        "name": "Инструменты 134°C / 5 мин",
        "setTempC": 134,
        "sterilizationTimeSec": 300,
        "preVacuumCount": 3,
        "dryingTimeSec": 600
      }
    },
    "errors": [],
    "warnings": [],
    "lastCompletedCycles": []
  }
}
```

#### `cycle_completed`

Отправляется при завершении цикла (успешно или с ошибкой).

```json
{
  "type": "cycle_completed",
  "payload": {
    "cycle": { /* CycleSummary */ }
  }
}
```

#### `error`

Отправляется при возникновении критической ошибки.

```json
{
  "type": "error",
  "payload": {
    "code": "OVERPRESSURE",
    "message": "Избыточное давление в камере"
  }
}
```

### 2.2. Сообщения от клиента к серверу

#### `command`

Команда оператора.

Общий формат:

```json
{
  "type": "command",
  "payload": {
    "kind": "<string>",
    "params": { }
  }
}
```

Поддерживаемые `kind`:

- `start_cycle`
- `stop_cycle`
- `open_door`
- `close_door`
- `start_vacuum_test`
- `reset_errors`

##### Примеры

Старт цикла:

```json
{
  "type": "command",
  "payload": {
    "kind": "start_cycle",
    "params": {
      "programId": "prog_134_5"
    }
  }
}
```

Останов цикла:

```json
{
  "type": "command",
  "payload": {
    "kind": "stop_cycle",
    "params": {}
  }
}
```

Открытие двери:

```json
{
  "type": "command",
  "payload": {
    "kind": "open_door",
    "params": {}
  }
}
```

Запуск вакуум-теста:

```json
{
  "type": "command",
  "payload": {
    "kind": "start_vacuum_test",
    "params": {
      "stabilizationTimeSec": 300,
      "testTimeSec": 600
    }
  }
}
```

## 3. REST-API (опционально)

### 3.1. `GET /api/cycles`

Возвращает список завершённых циклов с пагинацией.

Параметры (query):

- `limit` (по умолчанию 50)
- `offset` (по умолчанию 0)
- фильтры по дате и статусу – по необходимости

Ответ:

```json
{
  "items": [
    {
      "id": "c_001",
      "startedAt": 1710000000000,
      "endedAt": 1710000600000,
      "programId": "prog_134_5",
      "programName": "Инструменты 134°C / 5 мин",
      "success": true,
      "maxTemperatureC": 136.1,
      "maxPressureMPa": 0.23,
      "errors": []
    }
  ],
  "total": 1
}
```

### 3.2. `GET /api/errors`

Возвращает журнал ошибок.

Структура аналогична `GET /api/cycles`, но для `ErrorEvent`.

---

## 4. Расширение API

- Возможна реализация аутентификации (токен в заголовках или при установлении WebSocket).
- Можно добавить отдельные команды / сообщения для:
  - изменения конфигурации программ;
  - калибровки датчиков;
  - режимов сервисного доступа.
