import React, { useEffect, useMemo, useState } from 'react';
import { 
  Activity, 
  Thermometer, 
  Gauge, 
  Settings, 
  FileText, 
  AlertTriangle, 
  Wrench, 
  Play, 
  Square, 
  DoorOpen, 
  ArrowLeft, 
  CheckCircle, 
  Power,
  Clock,
  AlertOctagon,
  Lock,
  History,
  Zap,
  Tags
} from 'lucide-react';
import { useEngineSimulation, PROGRAM_DETAILS, type EngineMode } from './engineClient';
import { ERROR_MAP } from './errorDictionary';

// --- Types & Enums ---

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

type SystemState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';

// --- Helper Functions ---

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
  DEPRESSURIZE: 'Сброс давления',
  COOLING: 'Охлаждение',
  COMPLETE: 'Завершено',
  ERROR: 'Ошибка',
  IDLE: 'Ожидание',
};

// --- Theme Engine ---

const getTheme = (state: SystemState) => {
  switch (state) {
    case 'RUNNING':
      return {
        main: 'bg-emerald-600',
        light: 'bg-emerald-50',
        text: 'text-emerald-700',
        accent: 'text-emerald-600',
        border: 'border-emerald-200',
        statusLabel: 'ИДЁТ ЦИКЛ',
        icon: Activity,
        animate: false
      };
    case 'PAUSED': // Not currently used by engine but kept for compatibility
      return {
        main: 'bg-amber-500',
        light: 'bg-amber-50',
        text: 'text-amber-800',
        accent: 'text-amber-600',
        border: 'border-amber-200',
        statusLabel: 'ПАУЗА',
        icon: Lock,
        animate: true
      };
    case 'ERROR':
      return {
        main: 'bg-red-600',
        light: 'bg-red-50',
        text: 'text-red-700',
        accent: 'text-red-600',
        border: 'border-red-200',
        statusLabel: 'АВАРИЯ',
        icon: AlertTriangle,
        animate: true
      };
    case 'COMPLETED':
      return {
        main: 'bg-blue-600',
        light: 'bg-blue-50',
        text: 'text-blue-700',
        accent: 'text-blue-600',
        border: 'border-blue-200',
        statusLabel: 'ЦИКЛ ЗАВЕРШЕН',
        icon: CheckCircle,
        animate: false
      };
    case 'IDLE':
    default:
      return {
        main: 'bg-slate-700',
        light: 'bg-slate-100',
        text: 'text-slate-600',
        accent: 'text-cyan-600',
        border: 'border-slate-200',
        statusLabel: 'ГОТОВ',
        icon: Power,
        animate: false
      };
  }
};

// --- Components ---

const BigMetric = ({ label, value, unit, active = false, alert = false }: any) => (
  <div className={`flex-1 bg-white rounded-2xl p-6 shadow-sm border-2 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${active ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-slate-200'} ${alert ? 'animate-pulse border-red-500 bg-red-50' : ''}`}>
    <span className={`text-sm font-bold uppercase tracking-wider z-10 ${alert ? 'text-red-600' : 'text-slate-500'}`}>{label}</span>
    <div className="text-right z-10">
      <div className={`text-[4.5rem] xl:text-[5.5rem] leading-none font-bold font-mono tracking-tighter ${alert ? 'text-red-600' : 'text-slate-800'}`}>
        {value}
      </div>
      <div className="text-2xl font-bold text-slate-400 mt-1">{unit}</div>
    </div>
    <div className="absolute bottom-2 left-4 opacity-[0.03] pointer-events-none">
       {unit === '°C' ? <Thermometer size={140} /> : <Gauge size={140} />}
    </div>
  </div>
);

const QuickActionCard = ({ title, subtitle, icon: Icon, onClick, colorClass = "bg-white hover:border-cyan-400" }: any) => (
  <button onClick={onClick} className={`text-left p-6 rounded-2xl border-2 border-slate-200 shadow-sm transition-all hover:shadow-lg active:scale-95 flex items-start gap-4 h-full w-full group ${colorClass}`}>
    <div className="p-3 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors">
      <Icon size={32} />
    </div>
    <div>
      <div className="font-bold text-lg text-slate-800 group-hover:text-cyan-700 leading-tight">{title}</div>
      <div className="text-sm text-slate-500 font-medium mt-1">{subtitle}</div>
    </div>
  </button>
);

// --- Main App ---

export default function GoldbergSterilizerUI() {
  const [engineMode] = useState<EngineMode>('local');
  const { state, programs, controls, ready, connectionStatus } = useEngineSimulation(engineMode);
  
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('MAIN');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  
  // Modals
  const [showStopModal, setShowStopModal] = useState(false);
  const [showDoorModal, setShowDoorModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  
  // DateTime
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Derived State
  const currentProgram = useMemo(() => {
    const id = state?.cycle.currentProgram?.id || selectedProgramId || programs[0]?.id;
    return programs.find((p) => p.id === id) || programs[0];
  }, [programs, selectedProgramId, state?.cycle.currentProgram]);

  const programMeta = PROGRAM_DETAILS[currentProgram?.id ?? ''] ?? { desc: '', phases: [] };
  const standardPrograms = useMemo(
    () => programs.filter((p) => !p.id.includes('bowie') && !p.id.includes('test')),
    [programs]
  );
  const specialPrograms = useMemo(
    () => programs.filter((p) => p.id.includes('bowie') || p.id.includes('test')),
    [programs]
  );

  const systemState: SystemState = useMemo(() => {
    if (state?.errors?.length) return 'ERROR';
    if (state?.cycle.currentPhase === 'COMPLETE') return 'COMPLETED';
    if (state?.cycle.active) return 'RUNNING';
    return 'IDLE';
  }, [state]);

  const theme = getTheme(systemState);

  // Simulation Data Mapping
  const camTemp = formatNum(state?.chamber.temperatureC, 1, true);
  const camPress = formatNum(state?.chamber.pressureMPa, 3);
  const doorLocked = state?.door.locked || (state?.chamber.pressureMPa ?? 0) > 0.11;
  const doorOpen = !!state?.door.open;
  
  // Timer & Progress
  const phaseTotalSec = state?.cycle.phaseTotalSec || 1;
  const phaseElapsedSec = state?.cycle.phaseElapsedSec || 0;
  const timeLeft = Math.max(0, phaseTotalSec - phaseElapsedSec);
  const progress = Math.min(100, (phaseElapsedSec / phaseTotalSec) * 100);
  const currentPhaseName = state?.cycle.currentPhase || 'IDLE';
  const currentPhaseLabel = phaseNameMap[currentPhaseName] || currentPhaseName;

  const defaultPhaseSec = {
    PREHEAT: 60,
    PREVACUUM: 20,
    HEAT_UP: 90,
    DRYING: 60,
    DEPRESSURIZE: 20,
    COOLING: 40,
  };
  const plannedTotalSec = useMemo(() => {
    if (!currentProgram) return 0;
    const preheat = defaultPhaseSec.PREHEAT;
    const prevac = defaultPhaseSec.PREVACUUM * (currentProgram.preVacuumCount ?? 1);
    const heat = defaultPhaseSec.HEAT_UP;
    const steril = currentProgram.sterilizationTimeSec ?? 0;
    const dry = currentProgram.dryingTimeSec ?? defaultPhaseSec.DRYING;
    const depress = defaultPhaseSec.DEPRESSURIZE;
    const cool = defaultPhaseSec.COOLING;
    return preheat + prevac + heat + steril + dry + depress + cool;
  }, [currentProgram]);

  const totalElapsed = state?.cycle.totalElapsedSecSec ?? 0;
  const totalRemaining = Math.max(0, plannedTotalSec - totalElapsed);

  const getDoorStatus = () => {
    if (doorLocked) return { status: 'LOCKED', label: 'БЛОК', color: 'text-red-500 border-red-200 bg-red-50', icon: Lock };
    if (doorOpen) return { status: 'OPEN', label: 'ОТКРЫТА', color: 'text-amber-600 border-amber-200 bg-amber-50', icon: DoorOpen };
    return { status: 'CLOSED', label: 'ЗАКРЫТА', color: 'text-slate-600 border-slate-300 bg-slate-50', icon: Square };
  };
  
  const doorState = getDoorStatus();

  const hazard = state?.errors?.[0];
   const hazardInfo = hazard ? ERROR_MAP[hazard.code] : null;
   const [pendingProgramId, setPendingProgramId] = useState<string | null>(null);

  const errorHistory = useMemo(
    () =>
      (state?.errors ?? []).map((err, idx) => ({
        id: `${err.code}-${idx}`,
        timestamp: dateTime.toLocaleString('ru-RU'),
        code: err.code,
        message: err.message,
      })),
    [state?.errors, dateTime]
  );

  // Actions
  const startCycle = (programId: string) => {
    if (doorOpen || state?.errors?.length) return;
    setPendingProgramId(programId);
    setShowStartModal(true);
  };

  const stopCycle = () => {
    controls.stopCycle();
    setShowStopModal(false);
  };

  const toggleDoor = () => {
    if (doorLocked) return;
    if (doorOpen) controls.closeDoor();
    else controls.openDoor();
    setShowDoorModal(false);
  };

  const triggerResetErrors = () => {
    controls.resetErrors();
  };

  const confirmStart = () => {
    const id = pendingProgramId || currentProgram.id;
    controls.startCycle(id);
    setShowStartModal(false);
    setPendingProgramId(null);
    setCurrentScreen('MAIN');
  };

  // --- Sub-Components ---

  const DashboardRunning = () => {
    return (
      <div className="h-full grid grid-cols-12 gap-6">
        <div className="col-span-4 flex flex-col gap-6">
           <BigMetric label="Температура" value={camTemp} unit="°C" active={true} />
           <BigMetric label="Давление" value={camPress} unit="МПа" active={true} alert={(state?.chamber.pressureMPa ?? 0) > 0.240} />
        </div>

        <div className="col-span-8 bg-slate-900 rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden shadow-inner border border-slate-700">
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>
           <div className="text-center py-4 z-10">
              <div className="text-slate-400 font-bold uppercase tracking-widest mb-2 animate-pulse">Осталось времени (фаза)</div>
              <div className="text-[8rem] leading-none font-mono font-bold text-white tracking-tighter tabular-nums">
                {secondsToText(timeLeft)}
              </div>
              <div className="mt-3 text-slate-200 text-xl font-semibold tracking-tight">
                До окончания цикла: <span className="font-black text-white">{secondsToText(totalRemaining)}</span>
              </div>
           </div>

           <div className="z-10">
              <div className="flex justify-between text-slate-400 text-sm font-bold uppercase mb-4 px-2">
                {/* Simplified phase display since we don't have full phase list in state strictly ordered without logic */}
                <span>Старт</span>
                <span>Процесс</span>
                <span className="text-emerald-400">{currentPhaseLabel}</span>
                <span>Завершение</span>
              </div>
              <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000 ease-linear" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="mt-4 text-center">
                <span className="inline-block px-4 py-2 rounded bg-emerald-900/50 border border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-wider">
                   Текущая фаза: {currentPhaseLabel}
                </span>
              </div>
           </div>
        </div>
      </div>
    );
  };

  // SERVICE SCREEN
  const ServiceScreen = () => (
    <div className="flex flex-col h-full w-full bg-white text-slate-900 rounded-2xl p-6 gap-6 border border-slate-200">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-wide text-slate-800">Сервис и тесты</h1>
        <button onClick={() => setCurrentScreen('MAIN')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm text-slate-700 font-bold">
          ← На главный экран
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => setCurrentScreen('VACUUM_TEST')} className="flex flex-col items-start justify-between rounded-2xl bg-slate-50 border-2 border-slate-200 px-4 py-3 hover:border-cyan-500 hover:shadow">
          <span className="text-base font-semibold text-slate-800">Вакуум-тест</span>
          <span className="text-xs text-slate-500 mt-1">Проверка герметичности камеры.</span>
        </button>
        <button onClick={() => setCurrentScreen('SYSTEM_CHECK')} className="flex flex-col items-start justify-between rounded-2xl bg-slate-50 border-2 border-slate-200 px-4 py-3 hover:border-cyan-500 hover:shadow">
          <span className="text-base font-semibold text-slate-800">Проверка системы</span>
          <span className="text-xs text-slate-500 mt-1">Диагностика датчиков и исполнительных механизмов.</span>
        </button>
        <button onClick={() => setCurrentScreen('ERROR_LOG')} className="flex flex-col items-start justify-between rounded-2xl bg-slate-50 border-2 border-slate-200 px-4 py-3 hover:border-cyan-500 hover:shadow">
          <span className="text-base font-semibold text-slate-800">Журнал ошибок</span>
          <span className="text-xs text-slate-500 mt-1">История аварий и предупреждений.</span>
        </button>
        <button className="flex flex-col items-start justify-between rounded-2xl bg-slate-50 border-2 border-slate-100 px-4 py-3 text-left cursor-not-allowed opacity-70">
          <span className="text-base font-semibold text-slate-500">Настройки (скоро)</span>
          <span className="text-xs text-slate-400 mt-1">Дата/время, опции — плановый пункт бэклога.</span>
        </button>
      </div>
    </div>
  );

  // ERROR LOG SCREEN
  const ErrorLogScreen = () => (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-50 rounded-2xl p-6 gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-wide">Журнал ошибок</h1>
        <button onClick={() => setCurrentScreen('SERVICE')} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">
          ← Назад
        </button>
      </div>
      <div className="flex-1 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="grid grid-cols-4 gap-0 px-4 py-2 text-xs font-medium uppercase text-slate-400 border-b border-slate-800">
          <div>Время</div>
          <div>Код</div>
          <div>Описание</div>
          <div>Цикл / контекст</div>
        </div>
        <div className="h-full overflow-y-auto text-sm">
          {errorHistory.length === 0 ? (
            <div className="px-4 py-4 text-slate-500 text-sm">
              Ошибок пока нет. История будет заполняться после добавления errorHistory в ядро.
            </div>
          ) : (
            errorHistory.map((err) => (
              <div key={err.id} className="grid grid-cols-4 gap-0 px-4 py-2 border-b border-slate-800 text-xs">
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

  // VACUUM TEST SCREEN (placeholder)
  const VacuumTestScreen = () => (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-50 rounded-2xl p-6 gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-wide">Вакуум-тест</h1>
        <button onClick={() => setCurrentScreen('SERVICE')} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">
          ← Назад
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-200">Параметры теста</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Время стабилизации</span>
            <span className="font-mono">5 мин</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Время теста</span>
            <span className="font-mono">5 мин</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Параметры пока заглушки; после реализации логики в core здесь будут реальные значения.</p>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-200">Результат теста</h2>
          <div className="flex-1 flex flex-col justify-center text-sm text-slate-400">
            Тест ещё не выполнялся. После запуска здесь появится результат.
          </div>
          <button
            type="button"
            onClick={() => controls.startVacuumTest?.()}
            className="mt-2 inline-flex items-center justify-center rounded-xl px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-50"
          >
            Запустить тест
          </button>
        </div>
      </div>
    </div>
  );

  // SYSTEM CHECK SCREEN (placeholder)
  const SystemCheckScreen = () => {
    const doorStatusLabel = doorLocked ? 'Заблокирована' : doorOpen ? 'Открыта' : 'Закрыта';
    return (
      <div className="flex flex-col h-full w-full bg-slate-950 text-slate-50 rounded-2xl p-6 gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-wide">Проверка системы</h1>
          <button onClick={() => setCurrentScreen('SERVICE')} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">
            ← Назад
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Камера</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Температура</span>
              <span className="font-mono text-lg">{(state?.chamber.temperatureC ?? 0).toFixed(1)} °C</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Давление</span>
              <span className="font-mono text-lg">{(state?.chamber.pressureMPa ?? 0).toFixed(3)} МПа</span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Парогенератор</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Температура</span>
              <span className="font-mono text-lg">{(state?.generator.temperatureC ?? 0).toFixed(1)} °C</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Давление</span>
              <span className="font-mono text-lg">{(state?.generator.pressureMPa ?? 0).toFixed(3)} МПа</span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Служебные</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Рубашка (температура)</span>
              <span className="font-mono text-lg">{(state?.jacket.temperatureC ?? 0).toFixed(1)} °C</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Уровень воды</span>
              <span className="font-mono text-lg">{(state?.waterLevelPercent ?? 0).toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Дверь</span>
              <span className="font-mono text-lg">{doorStatusLabel}</span>
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Дополнительные диагностические индикаторы (насос, клапаны и т.п.) появятся после экспорта флагов из core.
        </div>
      </div>
    );
  };

  // --- Main Layout ---

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans select-none overflow-hidden">
      
      {/* TOP BAR */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30">
         <div className="flex items-center gap-4">
            <div className="text-2xl font-black tracking-tighter text-slate-800">
              GOLDBERG <span className="text-cyan-600">300</span>
            </div>
            {currentScreen !== 'MAIN' && (
              <button onClick={() => setCurrentScreen('MAIN')} className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg text-slate-600 font-bold hover:bg-slate-200 transition-colors ml-4">
                <ArrowLeft size={16} /> Назад
              </button>
            )}
         </div>
         <div className="flex items-center gap-6">
           <div className="text-right">
             <div className="text-xl font-mono font-bold text-slate-700 leading-none">
               {dateTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
             </div>
             <div className="text-xs font-bold text-slate-400 uppercase">
               {dateTime.toLocaleDateString('ru-RU')}
             </div>
           </div>
         </div>
      </header>

      {/* STATUS BANNER */}
      <div className={`h-20 shrink-0 ${theme.main} text-white flex items-center px-8 justify-between shadow-md transition-colors duration-500 relative overflow-hidden z-20`}>
         <div className={`flex items-center gap-6 z-10 ${theme.animate ? 'animate-pulse' : ''}`}>
            <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
               <theme.icon size={32} />
            </div>
            <div>
               <div className="text-xs font-bold opacity-80 uppercase tracking-wider">Статус системы</div>
               <div className="text-3xl font-black tracking-wide uppercase">{theme.statusLabel}</div>
            </div>
         </div>
         
         <div className="text-right z-10 opacity-90">
            <div className="text-xs font-bold uppercase tracking-wider opacity-70">Текущая программа</div>
            <div className="flex flex-col items-end">
              <span className="text-xl font-bold">{currentProgram?.name ?? 'Не выбрана'}</span>
              <span className="text-sm font-mono bg-black/20 px-2 py-0.5 rounded inline-block mt-1">
                {currentProgram?.setTempC ? `${currentProgram.setTempC}°C` : '--'} / {secondsToText(currentProgram?.sterilizationTimeSec)}
              </span>
            </div>
         </div>
         
         {systemState === 'RUNNING' && <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-10"></div>}
      </div>

      {/* CONTENT AREA */}
      <main className="flex-1 p-6 overflow-hidden bg-slate-50 relative">
        {currentScreen === 'MAIN' ? (
          systemState === 'RUNNING' || systemState === 'ERROR' || systemState === 'COMPLETED' ? <DashboardRunning /> : (
            <div className="h-full grid grid-cols-12 gap-6">
              {/* Idle Dashboard */}
              <div className="col-span-5 flex flex-col gap-6">
                <BigMetric label="Температура" value={camTemp} unit="°C" />
                <BigMetric label="Давление" value={camPress} unit="МПа" />
              </div>

              <div className="col-span-7 flex flex-col gap-6">
                <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                    <Zap className="text-amber-500" size={20} />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Быстрый запуск</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <button onClick={() => { setPendingProgramId(programs[0]?.id); setShowStartModal(true); }} className="bg-emerald-50 border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-100 rounded-xl p-5 text-left transition-all group active:scale-95">
                       <div className="flex justify-between items-start mb-2">
                         <span className="font-bold text-emerald-800 text-lg group-hover:text-emerald-900">{programs[0]?.name}</span>
                         <Play className="text-emerald-600 bg-emerald-200 rounded-full p-1 box-content" size={16} fill="currentColor" />
                       </div>
                       <div className="text-emerald-600/70 font-medium text-sm">Основной режим</div>
                     </button>
                     <button onClick={() => { setPendingProgramId('prog_134_fast'); setShowStartModal(true); }} className="bg-slate-50 border-2 border-slate-100 hover:border-cyan-400 hover:bg-white rounded-xl p-5 text-left transition-all group">
                       <div className="font-bold text-slate-700 text-lg mb-1 group-hover:text-cyan-700">Быстрая 134°C</div>
                       <div className="text-slate-400 text-sm">Быстрый режим</div>
                     </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 flex-1">
                  <QuickActionCard title="Выбор Программы" subtitle="Каталог режимов" icon={FileText} onClick={() => setCurrentScreen('PROGRAMS')} />
                  <QuickActionCard title="Журналы" subtitle="История циклов" icon={History} onClick={() => setCurrentScreen('REPORTS')} />
                  <QuickActionCard title="Сервис" subtitle="Тесты и настройки" icon={Wrench} onClick={() => setCurrentScreen('SERVICE')} />
                  <QuickActionCard title="Журнал ошибок" subtitle="Нет уведомлений" icon={AlertTriangle} onClick={() => setCurrentScreen('ERROR_LOG')} />
                </div>
              </div>
            </div>
          )
        ) : currentScreen === 'PROGRAMS' ? (
           /* Categorized Program Screen */
           <div className="h-full flex flex-col">
              <h2 className="text-2xl font-bold text-slate-700 mb-6 flex items-center gap-2"><Tags /> Каталог программ</h2>
              <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">
                 <div className="flex flex-col h-full">
                   <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-3 pl-1">Основные режимы</h3>
                   <div className="flex-1 overflow-y-auto pr-2">
                     <div className="grid grid-cols-2 gap-4">
                       {standardPrograms.map((p) => (
                         <button
                           key={p.id}
                           onClick={() => { setSelectedProgramId(p.id); startCycle(p.id); }}
                           className="bg-white border-2 border-slate-200 hover:border-cyan-500 p-6 rounded-xl text-left group transition-all h-full flex flex-col"
                         >
                            <div className="flex justify-between items-start mb-2">
                              <div className="text-xl font-bold text-slate-800 group-hover:text-cyan-700 leading-tight">{p.name}</div>
                            </div>
                            <div className="text-slate-500 text-sm mb-4 flex-1">{PROGRAM_DETAILS[p.id]?.desc}</div>
                            <div className="flex gap-2 mt-auto">
                              <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">{p.setTempC}°C</span>
                              <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">{secondsToText(p.sterilizationTimeSec)}</span>
                            </div>
                         </button>
                       ))}
                       {!standardPrograms.length && (
                         <div className="col-span-2 text-center text-slate-400 py-6">Нет основных режимов</div>
                       )}
                     </div>
                   </div>
                 </div>

                 <div className="flex flex-col h-full">
                   <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-3 pl-1">Сервисные и тестовые</h3>
                   <div className="flex-1 overflow-y-auto pr-2">
                     <div className="grid grid-cols-1 gap-4">
                       {specialPrograms.map((p) => (
                         <button
                           key={p.id}
                           onClick={() => { setSelectedProgramId(p.id); startCycle(p.id); }}
                           className="bg-white border-2 border-slate-200 hover:border-cyan-500 p-6 rounded-xl text-left group transition-all h-full flex flex-col"
                         >
                            <div className="flex justify-between items-start mb-2">
                              <div className="text-xl font-bold text-slate-800 group-hover:text-cyan-700 leading-tight">{p.name}</div>
                              <Wrench size={16} className="text-slate-300" />
                            </div>
                            <div className="text-slate-500 text-sm mb-4 flex-1">{PROGRAM_DETAILS[p.id]?.desc}</div>
                            <div className="flex gap-2 mt-auto">
                              <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">{p.setTempC}°C</span>
                              <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">{secondsToText(p.sterilizationTimeSec)}</span>
                            </div>
                         </button>
                       ))}
                       {!specialPrograms.length && (
                         <div className="text-center text-slate-400 py-6">Нет сервисных режимов</div>
                       )}
                     </div>
                   </div>
                </div>
             </div>
           </div>
        ) : currentScreen === 'REPORTS' ? (
             <div className="h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                   <h2 className="text-2xl font-bold text-slate-700 flex items-center gap-2"><History /> Журнал циклов</h2>
                </div>
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                   <div className="overflow-y-auto h-full">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase text-xs z-10">
                        <tr>
                          <th className="p-4">ID</th>
                          <th className="p-4">Программа</th>
                          <th className="p-4">Статус</th>
                          <th className="p-4">Макс T/P</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(state?.lastCompletedCycles ?? []).map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="p-4 font-mono text-slate-600">{c.id}</td>
                            <td className="p-4 font-semibold text-slate-700">{c.programName}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${c.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {c.success ? 'Успех' : 'Ошибка'}
                              </span>
                            </td>
                            <td className="p-4 text-slate-600">
                              {c.maxTemperatureC?.toFixed?.(1) ?? '--'}° / {c.maxPressureMPa?.toFixed?.(3) ?? '--'} МПа
                            </td>
                          </tr>
                        ))}
                        {(!state?.lastCompletedCycles?.length) && (
                           <tr><td colSpan={4} className="p-8 text-center text-slate-400">История пуста</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>
        ) : currentScreen === 'SERVICE' ? (
            <ServiceScreen />
        ) : currentScreen === 'ERROR_LOG' ? (
            <ErrorLogScreen />
        ) : currentScreen === 'VACUUM_TEST' ? (
            <VacuumTestScreen />
        ) : currentScreen === 'SYSTEM_CHECK' ? (
            <SystemCheckScreen />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
               <div className="text-6xl text-slate-200 mb-4 font-black">TODO</div>
               <button onClick={() => setCurrentScreen('MAIN')} className="text-slate-400 font-bold hover:text-cyan-600">Вернуться на главный экран</button>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM ACTION BAR */}
      <footer className="h-24 bg-white border-t border-slate-200 shadow-[0_-5px_25px_rgba(0,0,0,0.05)] flex items-center px-6 gap-4 shrink-0 z-30">
        {currentScreen !== 'MAIN' && (
          <button
            onClick={() => setCurrentScreen('MAIN')}
            className="h-16 px-5 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center gap-2 transition-all active:scale-95"
          >
            <ArrowLeft size={18} /> Назад
          </button>
        )}
        {/* SMART DOOR BUTTON */}
        <button 
          onClick={() => setShowDoorModal(true)}
          disabled={systemState === 'RUNNING' || doorState.status === 'LOCKED'}
          className={`h-16 px-8 min-w-[140px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 font-bold transition-all active:scale-95 ${doorState.color} ${doorState.status === 'LOCKED' ? 'opacity-100 cursor-not-allowed' : 'hover:shadow-md'}`}
        >
          <doorState.icon size={24} />
          <div className="flex flex-col items-center leading-none">
             <span className="text-[10px] uppercase tracking-wider opacity-70">Дверь</span>
             <span className="text-xs font-black">{doorState.label}</span>
          </div>
        </button>

        <div className="flex-1"></div>

        {/* MAIN START/STOP BUTTON WITH WARNING */}
        {systemState === 'RUNNING' ? (
          <button 
            onClick={() => setShowStopModal(true)}
            className="h-16 w-full max-w-md bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg flex items-center justify-center gap-4 transition-all font-black text-2xl tracking-widest uppercase active:scale-[0.99]"
          >
            <Square size={24} fill="currentColor" /> СТОП
          </button>
        ) : (
          <div className="flex flex-col items-center w-full max-w-md relative group">
            <button 
              onClick={() => { setPendingProgramId(currentProgram.id); setShowStartModal(true); }}
              disabled={systemState === 'ERROR' || doorOpen}
              className={`h-16 w-full rounded-xl shadow-lg flex items-center justify-center gap-4 transition-all font-black text-2xl tracking-widest uppercase active:scale-[0.99] z-10 ${systemState === 'ERROR' || doorOpen ? 'bg-slate-200 cursor-not-allowed text-slate-400 shadow-none' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
            >
              <Play size={28} fill="currentColor" /> СТАРТ
            </button>
            {/* WARNING TEXT */}
            {doorOpen && systemState === 'IDLE' && (
              <span className="absolute -bottom-6 text-red-500 text-[10px] font-bold uppercase tracking-widest animate-pulse whitespace-nowrap">
                 Закройте дверь, чтобы запустить цикл
              </span>
            )}
          </div>
        )}
      </footer>

      {/* OVERLAYS */}
      
      {/* 1. ERROR OVERLAY (Enhanced) */}
      {hazard && (
        <div className="fixed inset-0 z-[60] bg-red-900/95 backdrop-blur-md flex flex-col items-center justify-center text-white animate-in fade-in p-8">
           <AlertOctagon size={100} className="mb-6 animate-pulse text-red-100" />
           <div className="text-5xl font-black uppercase tracking-widest mb-2">АВАРИЯ</div>
           <div className="text-xl font-mono bg-red-950/50 px-6 py-2 rounded mb-8 border border-red-800">{hazard.code}: {hazardInfo?.title || hazard.message}</div>
           
           <div className="bg-white/10 p-6 rounded-xl max-w-2xl text-center mb-8 border border-white/20">
              <div className="text-red-200 uppercase text-xs font-bold tracking-widest mb-2">Рекомендация оператору</div>
              <div className="text-xl leading-relaxed font-medium">
                {hazardInfo?.operatorAction ? (
                    <ul className="list-none">
                        {hazardInfo.operatorAction.map((item, idx) => (
                        <li key={idx}>{item}</li>
                        ))}
                    </ul>
                ) : (
                    hazard.message
                )}
              </div>
           </div>

           <button onClick={triggerResetErrors} className="px-12 py-5 bg-white text-red-900 font-black text-xl rounded-xl hover:bg-red-50 shadow-xl uppercase tracking-wider transition-transform active:scale-95">
             Я понял, сбросить
           </button>
        </div>
      )}

      {/* 2. DOOR MODAL */}
      {showDoorModal && (
         <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
              <h3 className="text-2xl font-bold text-slate-800 mb-4">{doorOpen ? 'Закрыть дверь?' : 'Открыть дверь?'}</h3>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => setShowDoorModal(false)} className="p-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Отмена</button>
                 <button onClick={toggleDoor} className="p-4 rounded-xl font-bold text-white bg-cyan-600 hover:bg-cyan-700 shadow-lg">
                    {doorOpen ? 'Закрыть' : 'Открыть'}
                 </button>
              </div>
           </div>
        </div>
     )}

      {/* 3. STOP CONFIRMATION */}
      {showStopModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center border-4 border-red-100">
             <h3 className="text-3xl font-black text-slate-800 mb-2">ПРЕРВАТЬ ЦИКЛ?</h3>
             <p className="text-slate-500 text-lg mb-8">Стерильность не будет достигнута.</p>
             <div className="flex gap-4">
               <button onClick={() => setShowStopModal(false)} className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 text-lg">Отмена</button>
               <button onClick={stopCycle} className="flex-1 py-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg text-lg">ДА, СТОП</button>
             </div>
          </div>
        </div>
      )}

      {/* 4. START CONFIRMATION */}
      {showStartModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center border-4 border-emerald-100">
             <h3 className="text-3xl font-black text-slate-800 mb-2">Запустить программу?</h3>
             <p className="text-slate-600 text-lg mb-8">
               {pendingProgramId ? programs.find(p => p.id === pendingProgramId)?.name : currentProgram?.name}
             </p>
             <div className="flex gap-4">
               <button onClick={() => { setShowStartModal(false); setPendingProgramId(null); }} className="flex-1 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 text-lg">Отмена</button>
               <button onClick={confirmStart} className="flex-1 py-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg text-lg">Старт</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
