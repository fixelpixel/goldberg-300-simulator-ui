import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  DoorOpen,
  Gauge,
  History,
  Lock,
  Play,
  Power,
  Square,
  Tags,
  Thermometer,
  Zap,
  FileText,
  Wrench,
} from 'lucide-react';
import { useEngineSimulation, PROGRAM_DETAILS, type EngineMode } from './engineClient';
import { ERROR_MAP } from './errorDictionary';

type SystemState = 'IDLE' | 'RUNNING' | 'ERROR' | 'COMPLETED';
type ScreenType =
  | 'MAIN'
  | 'PROGRAMS'
  | 'VACUUM_TEST'
  | 'SYSTEM_CHECK'
  | 'PROGRAM_SETUP'
  | 'SPECIAL_PROGRAMS'
  | 'REPORTS'
  | 'ERROR_LOG'
  | 'SERVICE';

const themeByState: Record<
  SystemState,
  { main: string; text: string; light: string; status: string; icon: any }
> = {
  RUNNING: {
    main: 'bg-emerald-600',
    text: 'text-emerald-700',
    light: 'bg-emerald-50',
    status: 'ИДЁТ ЦИКЛ',
    icon: Activity,
  },
  ERROR: {
    main: 'bg-red-600',
    text: 'text-red-700',
    light: 'bg-red-50',
    status: 'АВАРИЯ',
    icon: AlertTriangle,
  },
  COMPLETED: {
    main: 'bg-blue-600',
    text: 'text-blue-700',
    light: 'bg-blue-50',
    status: 'ЦИКЛ ЗАВЕРШЕН',
    icon: CheckCircle,
  },
  IDLE: {
    main: 'bg-slate-700',
    text: 'text-slate-600',
    light: 'bg-slate-100',
    status: 'ГОТОВ',
    icon: Power,
  },
};

const formatNum = (v?: number, digits = 1, pad = false) =>
  v === undefined ? '--' : pad ? v.toFixed(digits).padStart(5, '0') : v.toFixed(digits);

const secondsToText = (sec?: number) => {
  if (!sec || !Number.isFinite(sec)) return '--:--';
  const clamped = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(clamped / 60)).padStart(2, '0');
  const s = String(clamped % 60).padStart(2, '0');
  return `${m}:${s}`;
};

const phaseNameMap: Record<string, string> = {
  PREHEAT: 'Прогрев',
  PREVACUUM: 'Предвакуум',
  HEAT_UP: 'Нагрев',
  STERILIZATION: 'Стерилизация',
  DRYING: 'Сушка',
  DEPRESSURIZE: 'Сброс',
  COOLING: 'Охлаждение',
  COMPLETE: 'Завершено',
  ERROR: 'Ошибка',
  IDLE: 'Ожидание',
};

function BigMetric({
  label,
  value,
  unit,
  active,
  alert = false,
}: {
  label: string;
  value: string;
  unit: string;
  active?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={`flex-1 bg-white rounded-2xl p-6 shadow-sm border-2 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
        active ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-slate-200'
      } ${alert ? 'animate-pulse border-red-500 bg-red-50' : ''}`}
    >
      <span
        className={`text-sm font-bold uppercase tracking-wider z-10 ${
          alert ? 'text-red-600' : 'text-slate-500'
        }`}
      >
        {label}
      </span>
      <div className="text-right z-10">
        <div
          className={`text-[4.8rem] leading-none font-bold font-mono tracking-tighter ${
            alert ? 'text-red-600' : 'text-slate-800'
          }`}
        >
          {value}
        </div>
        <div className="text-2xl font-bold text-slate-400 mt-1">{unit}</div>
      </div>
      <div className="absolute bottom-2 left-4 opacity-[0.03] pointer-events-none">
        {unit.includes('°C') ? <Thermometer size={140} /> : <Gauge size={140} />}
      </div>
    </div>
  );
}

export default function GoldbergSterilizerUI() {
  const [engineMode] = useState<EngineMode>('local');
  const { state, programs, controls, ready, connectionStatus } = useEngineSimulation(engineMode);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [showStopModal, setShowStopModal] = useState(false);
  const [showDoorModal, setShowDoorModal] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('MAIN');

  const currentProgram = useMemo(() => {
    const id = state?.cycle.currentProgram?.id || selectedProgramId || programs[0]?.id;
    return programs.find((p) => p.id === id) || programs[0];
  }, [programs, selectedProgramId, state?.cycle.currentProgram]);

  const programMeta = PROGRAM_DETAILS[currentProgram?.id ?? ''] ?? { desc: '', phases: [] };

  const systemState: SystemState = useMemo(() => {
    if (state?.errors?.length) return 'ERROR';
    if (state?.cycle.currentPhase === 'COMPLETE') return 'COMPLETED';
    if (state?.cycle.active) return 'RUNNING';
    return 'IDLE';
  }, [state]);

  const theme = themeByState[systemState];

  const doorLocked = state?.door.locked || (state?.chamber.pressureMPa ?? 0) > 0.11;
  const doorOpen = !!state?.door.open;

  const phaseName =
    phaseNameMap[state?.cycle.currentPhase ?? 'IDLE'] || (state?.cycle.currentPhase ?? '');
  const phaseProgress =
    state && state.cycle.phaseTotalSec > 0
      ? Math.min(1, state.cycle.phaseElapsedSec / state.cycle.phaseTotalSec)
      : 0;
  const timeLeftPhase = state?.cycle.phaseTotalSec
    ? state.cycle.phaseTotalSec - state.cycle.phaseElapsedSec
    : undefined;

  const handleStart = () => {
    if (!currentProgram || !ready || doorOpen || state?.errors?.length) return;
    controls.startCycle(currentProgram.id);
  };
  const handleStop = () => setShowStopModal(true);

  const toggleDoor = () => {
    if (doorLocked) return;
    if (doorOpen) {
      controls.closeDoor();
    } else {
      controls.openDoor();
    }
  };

  const hazard = state?.errors?.[0];
  const hazardInfo = hazard ? ERROR_MAP[hazard.code] : undefined;

  const ScreenMain = () => (
    <div className="p-6 grid grid-cols-12 gap-6">
      <div className="col-span-8 flex flex-col gap-6">
        <div className="flex gap-4">
          <BigMetric
            label="Камера T"
            value={formatNum(state?.chamber.temperatureC, 1, true)}
            unit="°C"
            active={systemState === 'RUNNING'}
            alert={systemState === 'ERROR'}
          />
          <BigMetric
            label="Камера P"
            value={formatNum(state?.chamber.pressureMPa, 3)}
            unit="МПа"
            active={systemState === 'RUNNING'}
          />
        </div>
        <div className="flex gap-4">
          <BigMetric
            label="Парогенератор T"
            value={formatNum(state?.generator.temperatureC, 1, true)}
            unit="°C"
          />
          <BigMetric
            label="Парогенератор P"
            value={formatNum(state?.generator.pressureMPa, 3)}
            unit="МПа"
          />
        </div>

        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-lg flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm uppercase tracking-widest text-white/60">Текущая программа</div>
              <div className="text-2xl font-bold truncate max-w-xl">{currentProgram?.name}</div>
              <div className="text-sm text-white/70 max-w-xl">{programMeta.desc}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentScreen('PROGRAMS')}
                className="px-4 py-2 bg-white text-slate-900 rounded-lg font-semibold flex items-center gap-2"
              >
                <Tags size={16} /> Программы
              </button>
              <button
                onClick={() => setCurrentScreen('REPORTS')}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg font-semibold text-white flex items-center gap-2"
              >
                <History size={16} /> Журнал
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-2xl p-4">
              <div className="text-xs uppercase text-white/60 font-semibold mb-1">Осталось времени</div>
              <div className="text-4xl font-mono font-bold">{secondsToText(timeLeftPhase)}</div>
              <div className="text-sm text-white/60">Фаза: {phaseName}</div>
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{ width: `${Math.round(phaseProgress * 100)}%` }}
                />
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4">
              <div className="text-xs uppercase text-white/60 font-semibold mb-1">Давление камеры</div>
              <div className="text-3xl font-mono font-bold">{formatNum(state?.chamber.pressureMPa, 3)}</div>
              <div className="text-sm text-white/60">Безопасно до 0.11 МПа</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4">
              <div className="text-xs uppercase text-white/60 font-semibold mb-1">Уровень воды</div>
              <div className="text-3xl font-mono font-bold">
                {state?.generator.waterLevelPercent ?? '--'}%
              </div>
              <div className="text-sm text-white/60">Заправить при &lt; 20%</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleStart}
              disabled={!ready || doorOpen || !!state?.errors?.length || systemState === 'RUNNING'}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 text-lg shadow-lg"
            >
              <Play size={24} /> Старт
            </button>
            <button
              onClick={handleStop}
              disabled={!ready || !state?.cycle.active}
              className="flex-1 bg-slate-800 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 text-lg shadow-lg"
            >
              <Square size={24} /> Стоп
            </button>
            <button
              onClick={() => setShowDoorModal(true)}
              disabled={!ready || doorLocked}
              className="w-40 bg-white text-slate-900 border border-slate-200 rounded-2xl font-semibold flex flex-col items-center justify-center gap-1 py-2 hover:shadow-sm disabled:opacity-50"
            >
              <DoorOpen size={22} />
              <span className="text-xs uppercase tracking-wider">Дверь</span>
              <span className="text-[10px] text-slate-500">
                {doorLocked ? 'Заблокирована' : doorOpen ? 'Открыта' : 'Закрыта'}
              </span>
            </button>
          </div>
        </div>

        <div className="col-span-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => setCurrentScreen('PROGRAMS')}
              className="p-4 rounded-2xl border-2 border-slate-200 bg-white shadow-sm flex items-center justify-between hover:border-cyan-400"
            >
              <div>
                <div className="text-xs uppercase font-semibold text-slate-500">Программы</div>
                <div className="font-bold text-lg text-slate-800">Выбор и редактирование</div>
              </div>
              <Tags />
            </button>
            <button
              onClick={() => setCurrentScreen('REPORTS')}
              className="p-4 rounded-2xl border-2 border-slate-200 bg-white shadow-sm flex items-center justify-between hover:border-cyan-400"
            >
              <div>
                <div className="text-xs uppercase font-semibold text-slate-500">Журналы</div>
                <div className="font-bold text-lg text-slate-800">Циклы и ошибки</div>
              </div>
              <FileText />
            </button>
            <button
              onClick={() => setCurrentScreen('SYSTEM_CHECK')}
              className="p-4 rounded-2xl border-2 border-slate-200 bg-white shadow-sm flex items-center justify-between hover:border-cyan-400"
            >
              <div>
                <div className="text-xs uppercase font-semibold text-slate-500">Системная проверка</div>
                <div className="font-bold text-lg text-slate-800">Датчики и приводы</div>
              </div>
              <Activity />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const ScreenPrograms = () => (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setCurrentScreen('MAIN')}
          className="p-2 rounded-full bg-slate-100 hover:bg-slate-200"
        >
          <ArrowLeft />
        </button>
        <div>
          <div className="text-xs uppercase text-slate-500 font-semibold">Программы</div>
          <div className="text-2xl font-bold text-slate-800">Выбор программы</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-4">
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-2">
            {programs.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProgramId(p.id)}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  p.id === currentProgram?.id
                    ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-500'
                    : 'border-slate-200 hover:border-cyan-400'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="font-bold text-slate-800">{p.name}</div>
                  <div className="text-sm font-mono text-slate-500">{p.setTempC ?? ''}°C</div>
                </div>
                <div className="text-sm text-slate-500">{PROGRAM_DETAILS[p.id]?.desc ?? ''}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs uppercase text-slate-500 font-bold mb-2">Фазы программы</div>
          <div className="flex flex-col gap-2">
            {programMeta.phases?.map((ph, idx) => (
              <div
                key={`${ph}-${idx}`}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  idx === 0 ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    idx === 0 ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="font-semibold text-slate-700">{ph}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const ScreenReports = () => (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setCurrentScreen('MAIN')}
          className="p-2 rounded-full bg-slate-100 hover:bg-slate-200"
        >
          <ArrowLeft />
        </button>
        <div>
          <div className="text-xs uppercase text-slate-500 font-semibold">Журналы</div>
          <div className="text-2xl font-bold text-slate-800">Циклы и ошибки</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-sm font-bold text-slate-700 mb-3">Журнал циклов</div>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="p-2">№</th>
                  <th className="p-2">Программа</th>
                  <th className="p-2">Статус</th>
                  <th className="p-2">T/P макс</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(state?.lastCompletedCycles ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="p-2 font-mono text-slate-600">{c.id}</td>
                    <td className="p-2 text-slate-700">{c.programName}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                          c.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {c.success ? 'Успех' : 'Ошибка'}
                      </span>
                    </td>
                    <td className="p-2 text-slate-600">
                      {c.maxTemperatureC?.toFixed?.(1) ?? '--'}° / {c.maxPressureMPa?.toFixed?.(3) ?? '--'} МПа
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-sm font-bold text-slate-700 mb-3">Журнал ошибок</div>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="p-2">Время</th>
                  <th className="p-2">Код</th>
                  <th className="p-2">Описание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(state?.errors ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="p-2 font-mono text-slate-600">
                      {new Date(e.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="p-2 font-mono text-red-600 font-bold">{e.code}</td>
                    <td className="p-2 text-slate-700">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScreen = () => {
    switch (currentScreen) {
      case 'PROGRAMS':
        return <ScreenPrograms />;
      case 'REPORTS':
        return <ScreenReports />;
      default:
        return <ScreenMain />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* Status Banner */}
      <div className={`${theme.main} text-white py-4 px-6 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded-lg p-2">
            <theme.icon size={32} />
          </div>
          <div>
            <div className="text-sm uppercase font-bold tracking-widest">{theme.status}</div>
            <div className="text-xl font-semibold">{currentProgram?.name ?? 'Программа не выбрана'}</div>
            <div className="text-sm text-white/80">
              Состояние: {phaseName} • Соединение:{' '}
              {connectionStatus === 'local'
                ? 'Local'
                : connectionStatus === 'connected'
                ? 'Remote OK'
                : connectionStatus === 'fallback'
                ? 'Fallback'
                : connectionStatus}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-3xl font-bold">
              {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs uppercase">
              {new Date().toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
        </div>
      </div>

      {renderScreen()}

      {/* Stop modal */}
      {showStopModal && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <Square size={28} />
              <div className="text-xl font-bold">Остановить цикл?</div>
            </div>
            <p className="text-slate-600 mb-6">
              Цикл будет прерван, камера перейдёт к сбросу давления. Продолжить?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="py-3 rounded-xl border border-slate-200 font-semibold text-slate-700"
                onClick={() => setShowStopModal(false)}
              >
                Отмена
              </button>
              <button
                className="py-3 rounded-xl bg-red-600 text-white font-semibold shadow"
                onClick={() => {
                  controls.stopCycle();
                  setShowStopModal(false);
                }}
              >
                Остановить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Door modal */}
      {showDoorModal && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 text-slate-700 mb-4">
              <DoorOpen size={28} />
              <div className="text-xl font-bold">Дверь камеры</div>
            </div>
            <p className="text-slate-600 mb-6">
              {doorLocked
                ? 'Дверь заблокирована по давлению или состоянию цикла.'
                : 'Открыть/закрыть дверь? Убедитесь в безопасном давлении.'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="py-3 rounded-xl border border-slate-200 font-semibold text-slate-700"
                onClick={() => setShowDoorModal(false)}
              >
                Отмена
              </button>
              <button
                className="py-3 rounded-xl bg-blue-600 text-white font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={doorLocked}
                onClick={() => {
                  toggleDoor();
                  setShowDoorModal(false);
                }}
              >
                {doorOpen ? 'Закрыть' : 'Открыть'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {hazard && (
        <div className="fixed inset-0 bg-red-900/80 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-red-200">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <AlertOctagon size={32} />
              <div>
                <div className="text-sm uppercase tracking-widest font-bold">Авария</div>
                <div className="text-2xl font-bold">Код: {hazard.code}</div>
              </div>
            </div>
            <p className="text-slate-700 text-lg mb-2">{hazardInfo?.title ?? hazard.message}</p>
            {hazardInfo?.operatorAction && (
              <ul className="text-sm text-slate-700 mb-4 list-disc list-inside space-y-1">
                {hazardInfo.operatorAction.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                onClick={() => controls.resetErrors()}
              >
                Сбросить ошибку
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
