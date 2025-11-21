
// new_screens_skeleton.tsx
// Skeleton JSX for SERVICE, ERROR_LOG, VACUUM_TEST, SYSTEM_CHECK screens
// to be integrated into apps/web-ui/src/GoldbergSterilizerUI.tsx

import React from "react";

// 1. Screen type (extend existing union in GoldbergSterilizerUI if needed)
export type ScreenType =
  | "MAIN"
  | "PROGRAMS"
  | "REPORTS"
  | "SERVICE"
  | "ERROR_LOG"
  | "VACUUM_TEST"
  | "SYSTEM_CHECK";

// 2. Common props shared by simple screens
interface BaseScreenProps {
  onBack: () => void;
}

// 3. SERVICE screen (menu of service/test functions)

export interface ServiceScreenProps extends BaseScreenProps {
  onOpenVacuumTest: () => void;
  onOpenSystemCheck: () => void;
  onOpenSettings: () => void;
  onOpenErrorLog: () => void;
  // onOpenCalibration: () => void; // reserved for future
}

export const ServiceScreen: React.FC<ServiceScreenProps> = ({
  onBack,
  onOpenVacuumTest,
  onOpenSystemCheck,
  onOpenSettings,
  onOpenErrorLog,
}) => {
  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-50 p-4 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-wide">
          Сервис и тесты
        </h1>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm"
          onClick={onBack}
        >
          ← На главный экран
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <button
          type="button"
          className="flex flex-col items-start justify-between rounded-2xl bg-slate-900 border border-slate-700 px-4 py-3 hover:border-sky-500"
          onClick={onOpenVacuumTest}
        >
          <span className="text-base font-medium">Вакуум-тест</span>
          <span className="text-xs text-slate-400 mt-1">
            Проверка герметичности камеры (переход на отдельный экран
            VACUUM_TEST).
          </span>
        </button>

        <button
          type="button"
          className="flex flex-col items-start justify-between rounded-2xl bg-slate-900 border border-slate-700 px-4 py-3 hover:border-sky-500"
          onClick={onOpenSystemCheck}
        >
          <span className="text-base font-medium">Проверка системы</span>
          <span className="text-xs text-slate-400 mt-1">
            Диагностический просмотр всех датчиков и исполнительных механизмов.
          </span>
        </button>

        <button
          type="button"
          className="flex flex-col items-start justify-between rounded-2xl bg-slate-900 border border-slate-700 px-4 py-3 hover:border-sky-500"
          onClick={onOpenSettings}
        >
          <span className="text-base font-medium">Настройки</span>
          <span className="text-xs text-slate-400 mt-1">
            Общие параметры стерилизатора (дата/время, опции и др.).
          </span>
        </button>

        <button
          type="button"
          className="flex flex-col items-start justify-between rounded-2xl bg-slate-900 border border-slate-700 px-4 py-3 hover:border-sky-500"
          onClick={onOpenErrorLog}
        >
          <span className="text-base font-medium">Журнал ошибок</span>
          <span className="text-xs text-slate-400 mt-1">
            История аварий и предупреждений (переход на экран ERROR_LOG).
          </span>
        </button>
      </div>

      {/* Placeholder for future items, e.g. Calibration */}
      <div className="mt-4 text-xs text-slate-500">
        Дополнительные сервисные функции (калибровка, обновление ПО и т.п.)
        могут быть добавлены здесь позже.
      </div>
    </div>
  );
};

// 4. ERROR_LOG screen (history of errors)

export interface ErrorLogScreenProps extends BaseScreenProps {
  // Placeholder: later pass real errorHistory from core
  errorHistory?: Array<{
    id: string;
    timestamp: string; // ISO or formatted
    code: string;
    message: string;
  }>;
}

export const ErrorLogScreen: React.FC<ErrorLogScreenProps> = ({
  onBack,
  errorHistory = [],
}) => {
  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-50 p-4 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-wide">Журнал ошибок</h1>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm"
          onClick={onBack}
        >
          ← Назад
        </button>
      </div>

      <div className="mt-2 flex-1 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="grid grid-cols-4 gap-0 px-4 py-2 text-xs font-medium uppercase text-slate-400 border-b border-slate-800">
          <div>Время</div>
          <div>Код</div>
          <div>Описание</div>
          <div>Цикл / контекст</div>
        </div>
        <div className="max-h-full overflow-y-auto text-sm">
          {errorHistory.length === 0 ? (
            <div className="px-4 py-4 text-slate-500 text-sm">
              Ошибок пока нет. Все аварии и предупреждения будут отображаться
              здесь, когда история будет реализована в ядре.
            </div>
          ) : (
            errorHistory.map((err) => (
              <div
                key={err.id}
                className="grid grid-cols-4 gap-0 px-4 py-2 border-b border-slate-800 text-xs"
              >
                <div className="text-slate-300">{err.timestamp}</div>
                <div className="font-mono text-amber-300">{err.code}</div>
                <div className="text-slate-200">{err.message}</div>
                <div className="text-slate-400">—</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// 5. VACUUM_TEST screen

export interface VacuumTestScreenProps extends BaseScreenProps {
  // Placeholder fields for future connection with core
  stabilizationTimeSec?: number;
  testTimeSec?: number;
  resultText?: string | null;
  onStartTest?: () => void;
}

export const VacuumTestScreen: React.FC<VacuumTestScreenProps> = ({
  onBack,
  stabilizationTimeSec = 300,
  testTimeSec = 300,
  resultText = null,
  onStartTest,
}) => {
  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-50 p-4 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-wide">Вакуум-тест</h1>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm"
          onClick={onBack}
        >
          ← Назад
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-200">
            Параметры теста
          </h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Время стабилизации</span>
              <span className="font-mono">
                {Math.round(stabilizationTimeSec / 60)} мин
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Время теста</span>
              <span className="font-mono">
                {Math.round(testTimeSec / 60)} мин
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Значения параметров пока зашиты как заглушка. После реализации
              логики в ядре здесь будут отображаться реальные параметры теста.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-200">
            Результат теста
          </h2>
          <div className="flex-1 flex flex-col items-start justify-center gap-2 text-sm">
            {resultText ? (
              <span className="text-lg font-semibold">
                {resultText /* e.g. 'Тест пройден' / 'Тест не пройден' */}
              </span>
            ) : (
              <span className="text-slate-500">
                Тест ещё не выполнялся. После запуска здесь отобразится
                результат.
              </span>
            )}
          </div>
          <button
            type="button"
            className="mt-2 inline-flex items-center justify-center rounded-xl px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-50"
            onClick={onStartTest}
          >
            Запустить тест
          </button>
        </div>
      </div>
    </div>
  );
};

// 6. SYSTEM_CHECK screen

export interface SystemCheckScreenProps extends BaseScreenProps {
  // Placeholder: pass SterilizerState or derived fields when ready
  chamberTempC?: number;
  chamberPressureMPa?: number;
  generatorTempC?: number;
  generatorPressureMPa?: number;
  jacketTempC?: number;
  waterLevelPercent?: number;
  doorOpen?: boolean;
  doorLocked?: boolean;
  // Add other boolean flags as needed (pump, valves, etc.)
}

export const SystemCheckScreen: React.FC<SystemCheckScreenProps> = ({
  onBack,
  chamberTempC = 0,
  chamberPressureMPa = 0,
  generatorTempC = 0,
  generatorPressureMPa = 0,
  jacketTempC = 0,
  waterLevelPercent = 0,
  doorOpen = false,
  doorLocked = false,
}) => {
  const doorStatusLabel = doorLocked
    ? "Заблокирована"
    : doorOpen
    ? "Открыта"
    : "Закрыта";

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-50 p-4 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-wide">
          Проверка системы
        </h1>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm"
          onClick={onBack}
        >
          ← Назад
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Камера</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Температура</span>
            <span className="font-mono text-lg">
              {chamberTempC.toFixed(1)} °C
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Давление</span>
            <span className="font-mono text-lg">
              {chamberPressureMPa.toFixed(3)} МПа
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-200">
            Парогенератор
          </h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Температура</span>
            <span className="font-mono text-lg">
              {generatorTempC.toFixed(1)} °C
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Давление</span>
            <span className="font-mono text-lg">
              {generatorPressureMPa.toFixed(3)} МПа
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Служебные</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Рубашка (температура)</span>
            <span className="font-mono text-lg">
              {jacketTempC.toFixed(1)} °C
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Уровень воды</span>
            <span className="font-mono text-lg">
              {waterLevelPercent.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Дверь</span>
            <span className="font-mono text-lg">{doorStatusLabel}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-500">
        Дополнительные диагностические индикаторы (насос, клапаны, датчики) можно
        добавить как отдельные блоки или таблицу, когда будут доступны флаги из
        SterilizerState.
      </div>
    </div>
  );
};

// 7. Example of how to plug screens into GoldbergSterilizerUI
// (pseudo-code fragment, NOT a full component)

/*
const [currentScreen, setCurrentScreen] = useState<ScreenType>("MAIN");

return (
  <div className="h-full w-full">
    {currentScreen === "MAIN" && (
      <MainDashboard
        // existing props
        onOpenService={() => setCurrentScreen("SERVICE")}
        onOpenPrograms={() => setCurrentScreen("PROGRAMS")}
        onOpenReports={() => setCurrentScreen("REPORTS")}
      />
    )}

    {currentScreen === "SERVICE" && (
      <ServiceScreen
        onBack={() => setCurrentScreen("MAIN")}
        onOpenVacuumTest={() => setCurrentScreen("VACUUM_TEST")}
        onOpenSystemCheck={() => setCurrentScreen("SYSTEM_CHECK")}
        onOpenSettings={() => {/* setCurrentScreen("SETTINGS") *-/}}
        onOpenErrorLog={() => setCurrentScreen("ERROR_LOG")}
      />
    )}

    {currentScreen === "ERROR_LOG" && (
      <ErrorLogScreen
        onBack={() => setCurrentScreen("SERVICE")}
        errorHistory={[]} // TODO: pass from core
      />
    )}

    {currentScreen === "VACUUM_TEST" && (
      <VacuumTestScreen
        onBack={() => setCurrentScreen("SERVICE")}
        // TODO: connect to core vacuum-test state
      />
    )}

    {currentScreen === "SYSTEM_CHECK" && (
      <SystemCheckScreen
        onBack={() => setCurrentScreen("SERVICE")}
        // TODO: map SterilizerState fields
      />
    )}
  </div>
);
*/
