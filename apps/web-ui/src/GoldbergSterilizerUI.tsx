import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Tags,
  Droplet,
  Flame,
  ShieldAlert
} from 'lucide-react';
import { useEngineSimulation, PROGRAM_DETAILS, type EngineMode } from './engineClient';
import { ERROR_MAP } from './errorDictionary';
import { useAudioNotifications } from './hooks/useAudioNotifications';

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
  | 'SERVICE'
  | 'SETTINGS'
  | 'CALIBRATION';

type SystemState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
type CalibrationOffsets = {
  chamberTempOffsetC: number;
  chamberPressureOffset: number;
  generatorTempOffsetC: number;
  generatorPressureOffset: number;
};

// Универсальная модалка с цифровым набором
const DialPadModal = ({
  open,
  label,
  initialValue,
  onSubmit,
  onClose,
}: {
  open: boolean;
  label: string;
  initialValue: string;
  onSubmit: (val: number) => void;
  onClose: () => void;
}) => {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  const handleClick = (d: string) => {
    setValue((prev) => (prev.length > 8 ? prev : prev + d));
  };
  const handleErase = () => setValue((prev) => prev.slice(0, -1));
  const handleClear = () => setValue('');
  const submit = () => {
    const num = Number(value);
    onSubmit(Number.isFinite(num) ? num : 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <div className="text-sm font-semibold text-slate-600 mb-2">{label}</div>
        <div className="text-2xl font-mono tracking-[0.3em] bg-slate-100 border-2 border-slate-200 rounded-xl px-5 py-3 text-center mb-4">
          {value || '—'}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9','0','00','.'].map((d) => (
            <button
              key={d}
              onClick={() => handleClick(d)}
              className="h-10 rounded-xl bg-slate-100 hover:bg-cyan-50 border border-slate-200 text-lg font-bold text-slate-800 transition-colors"
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleClear} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">Сброс</button>
          <button onClick={handleErase} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">⌫</button>
          <button onClick={submit} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-500">OK</button>
        </div>
        <button onClick={onClose} className="mt-2 w-full py-2 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300">Отмена</button>
      </div>
    </div>
  );
};

// --- Helper Functions ---

const formatNum = (v?: number, digits = 1, pad = false) =>
  v === undefined ? '--' : pad ? v.toFixed(digits) : v.toFixed(digits);

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
  <button onClick={onClick} className={`text-left p-6 rounded-2xl border-2 border-slate-200 shadow-sm transition-shadow hover:shadow-lg flex items-start gap-4 h-full w-full group ${colorClass} transform-none active:transform-none`}>
    <div className="p-3 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors">
      <Icon size={32} />
    </div>
    <div>
      <div className="font-bold text-lg text-slate-800 group-hover:text-cyan-700 leading-tight">{title}</div>
      <div className="text-sm text-slate-500 font-medium mt-1">{subtitle}</div>
    </div>
  </button>
);

// PIN keypad isolated to avoid parent re-renders
const PinPad = React.memo(function PinPad({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('');
  const handlePinClick = (digit: string) => {
    if (pin.length >= 4) return;
    setPin((prev) => prev + digit);
  };
  const handleErase = () => setPin((prev) => prev.slice(0, -1));
  const handleCancel = () => setPin('');
  const handleSubmit = () => {
    if (pin === '1111') onSuccess();
  };
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3">
      <div className="text-xs font-semibold text-slate-600">PIN для редактирования (1111)</div>
      <div className="text-2xl font-mono tracking-[0.3em] bg-slate-100 border-2 border-slate-200 rounded-xl px-5 py-2 w-48 text-center">
        {pin.padEnd(4, '•')}
      </div>
      <div className="grid grid-cols-3 gap-2 w-52">
        {['1','2','3','4','5','6','7','8','9','С','0','⌫'].map(key => (
          <button
            key={key}
            onClick={() => {
              if (key === 'С') { handleCancel(); return; }
              if (key === '⌫') { handleErase(); return; }
              handlePinClick(key);
            }}
            className="h-10 rounded-xl bg-slate-100 hover:bg-cyan-50 border border-slate-200 text-lg font-bold text-slate-800 transition-colors"
          >
            {key === 'С' ? 'Сброс' : key}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={handleSubmit} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-500 text-sm">Ввод</button>
        <button onClick={handleCancel} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 text-sm">Отмена</button>
      </div>
    </div>
  );
});

// --- Main App ---

export default function GoldbergSterilizerUI() {
  const [engineMode] = useState<EngineMode>('local');
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('MAIN');
  const { state, programs, controls, ready, connectionStatus } = useEngineSimulation(engineMode, 'ws://localhost:8090', {
    shouldUpdate: () => !['PROGRAM_SETUP', 'CALIBRATION', 'SETTINGS'].includes(currentScreen),
  });
  
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [programTab, setProgramTab] = useState<'standard' | 'special'>('standard');
  
  // Modals
  const [showStopModal, setShowStopModal] = useState(false);
  const [showDoorModal, setShowDoorModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [phaseToast, setPhaseToast] = useState<string | null>(null);
  const [doorToast, setDoorToast] = useState<string | null>(null);
  const { playNotification } = useAudioNotifications();
  const prevReadyRef = useRef(false);
  const prevCycleActiveRef = useRef(false);
  const prevSystemStateRef = useRef<SystemState>('IDLE');
  const prevHazardIdRef = useRef<string | null>(null);
  const prevDoorLockedRef = useRef(false);
  const prevWaterLevelRef = useRef<number>(state?.generator.waterLevelPercent ?? 100);
  const prevPowerPendingRef = useRef<boolean>(state?.powerFailure?.pending ?? false);
  const prevVacuumTestIdRef = useRef<string | null>(null);
  
  // DateTime
  const [dateTime, setDateTime] = useState(new Date());

  const isInteractiveScreen = useMemo(
    () => ['PROGRAM_SETUP', 'CALIBRATION', 'SETTINGS'].includes(currentScreen),
    [currentScreen]
  );

  useEffect(() => {
    if (isInteractiveScreen) return;
    const timer = setInterval(() => setDateTime(new Date()), 5000);
    return () => clearInterval(timer);
  }, [isInteractiveScreen]);

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
  const camTemp = formatNum(state?.chamber.temperatureC, 1, false);
  const camPress = state ? (state.chamber.pressureMPa * 10000).toFixed(0) : '--'; // мбар ≈ MPa * 10000
  const doorLocked = state?.door.locked || (state?.chamber.pressureMPa ?? 0) > 0.11;
  const doorOpen = !!state?.door.open;
  
  // Phase change toast
  const hazard = state?.errors?.[0];
  const hazardInfo = hazard ? ERROR_MAP[hazard.code] : null;
  const [pendingProgramId, setPendingProgramId] = useState<string | null>(null);

  useEffect(() => {
    if (!state?.cycle.currentPhase) return;
    setPhaseToast(`Фаза: ${phaseNameMap[state.cycle.currentPhase] || state.cycle.currentPhase}`);
    const t = setTimeout(() => setPhaseToast(null), 2000);
    return () => clearTimeout(t);
  }, [state?.cycle.currentPhase]);

  // Door change toast
  useEffect(() => {
    if (doorOpen) setDoorToast('Дверь открыта');
    else if (doorLocked) setDoorToast('Дверь заблокирована');
    else setDoorToast('Дверь закрыта');
    const t = setTimeout(() => setDoorToast(null), 2000);
    return () => clearTimeout(t);
  }, [doorOpen, doorLocked]);

  useEffect(() => {
    if (ready && systemState === 'IDLE' && !prevReadyRef.current) {
      playNotification('system_ready');
    }
    prevReadyRef.current = ready;
  }, [ready, systemState, playNotification]);

  useEffect(() => {
    const active = !!state?.cycle.active;
    if (active && !prevCycleActiveRef.current) {
      playNotification('cycle_start');
    }
    prevCycleActiveRef.current = active;
  }, [state?.cycle.active, playNotification]);

  useEffect(() => {
    if (systemState === 'COMPLETED' && prevSystemStateRef.current !== 'COMPLETED') {
      playNotification('cycle_complete_ok');
    }
    prevSystemStateRef.current = systemState;
  }, [systemState, playNotification]);

  useEffect(() => {
    if (hazard && prevHazardIdRef.current !== hazard.id) {
      if (hazard.code === 'OVERPRESSURE' || hazard.code === 'OVERTEMP') {
        playNotification('overtemp_overpressure_alarm');
      } else if (hazard.code === 'NO_WATER') {
        playNotification('water_empty_alarm');
      } else if (hazard.code === 'VACUUM_FAIL') {
        playNotification('vacuum_error');
      } else if (hazard.code === 'SENSOR_FAILURE') {
        playNotification('sensor_error');
      } else if (hazard.code === 'DOOR_OPEN') {
        playNotification('door_fault');
      } else {
        playNotification('cycle_failed_error');
      }
      prevHazardIdRef.current = hazard.id;
    }
    if (!hazard) {
      prevHazardIdRef.current = null;
    }
  }, [hazard, playNotification]);

  useEffect(() => {
    if (doorLocked && !prevDoorLockedRef.current && (state?.chamber.pressureMPa ?? 0) > 0.05) {
      playNotification('door_locked_overpressure');
    }
    prevDoorLockedRef.current = doorLocked;
  }, [doorLocked, playNotification, state?.chamber.pressureMPa]);

  useEffect(() => {
    const level = state?.generator.waterLevelPercent ?? 100;
    if (level < 5 && prevWaterLevelRef.current >= 5) {
      playNotification('water_empty_alarm');
    } else if (level < 15 && prevWaterLevelRef.current >= 15) {
      playNotification('water_low_warning');
    }
    prevWaterLevelRef.current = level;
  }, [state?.generator.waterLevelPercent, playNotification]);

  useEffect(() => {
    const pending = !!state?.powerFailure?.pending;
    if (!pending && prevPowerPendingRef.current) {
      playNotification('power_restored');
    }
    prevPowerPendingRef.current = pending;
  }, [state?.powerFailure?.pending, playNotification]);

  useEffect(() => {
    const last = state?.lastVacuumTests?.[0];
    if (!last) return;
    if (prevVacuumTestIdRef.current === last.id) return;
    prevVacuumTestIdRef.current = last.id;
    if (last.result === 'PASS') {
      playNotification('vacuum_test_passed');
    } else if (last.result === 'FAIL') {
      playNotification('vacuum_test_failed');
    }
  }, [state?.lastVacuumTests, playNotification]);
  
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
    if (doorOpen) {
      playNotification('door_open_on_start');
      setShowStartModal(false);
      setPendingProgramId(null);
      return;
    }
    if (state?.errors?.length) {
      playNotification('cycle_failed_error');
      setShowStartModal(false);
      setPendingProgramId(null);
      return;
    }
    const id = pendingProgramId || currentProgram.id;
    controls.startCycle(id);
    setShowStartModal(false);
    setPendingProgramId(null);
    setCurrentScreen('MAIN');
  };

  // --- Sub-Components ---

  const DashboardRunning = () => {
    const phaseSteps = ['PREHEAT', 'PREVACUUM', 'HEAT_UP', 'STERILIZATION', 'DRYING', 'DEPRESSURIZE', 'COOLING', 'COMPLETE'] as const;
    const stepIndex = phaseSteps.indexOf(currentPhaseName as any);
    return (
      <div className="h-full grid grid-cols-12 gap-6">
        <div className="col-span-4 flex flex-col gap-6">
           <BigMetric label="Температура" value={camTemp} unit="°C" active={true} />
           <BigMetric label="Давление" value={camPress} unit="мбар" active={true} alert={(state?.chamber.pressureMPa ?? 0) > 0.240} />
        </div>

        <div className="col-span-8 bg-slate-900 rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden shadow-inner border border-slate-700">
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>
           <div className="text-center py-4 z-10">
              {currentPhaseName === 'PREHEAT' ? (
                <div className="flex flex-col items-center gap-3 justify-center py-8">
                  <div className="text-[8rem] leading-none font-black text-amber-400 animate-pulse uppercase tracking-[0.25em]">ПРОГРЕВ</div>
                  <div className="text-slate-300 text-lg font-semibold">Ожидайте выхода на режим</div>
                </div>
              ) : (
                <>
                  <div className="text-slate-400 font-bold uppercase tracking-widest mb-2 animate-pulse">Осталось времени (фаза)</div>
                  <div className="text-[8rem] leading-none font-mono font-bold text-white tracking-tighter tabular-nums">
                    {secondsToText(timeLeft)}
                  </div>
                  <div className="mt-3 text-slate-200 text-xl font-semibold tracking-tight">
                    До окончания цикла: <span className="font-black text-white">{secondsToText(totalRemaining)}</span>
                  </div>
                </>
              )}
           </div>

           <div className="z-10">
              <div className="flex justify-between text-slate-400 text-xs font-bold uppercase mb-3 px-2">
                {phaseSteps.map((p) => (
                  <span key={p} className={`${p === currentPhaseName ? 'text-emerald-300' : ''}`}>{phaseNameMap[p] || p}</span>
                ))}
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000 ease-linear" style={{ width: `${((stepIndex + 1) / phaseSteps.length) * 100}%` }}></div>
              </div>
              <div className="mt-4 text-center">
                <span className="inline-block px-4 py-2 rounded bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 font-bold uppercase tracking-wider">
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
        <button onClick={() => setCurrentScreen('PROGRAM_SETUP')} className="flex flex-col items-start justify-between rounded-2xl bg-slate-50 border-2 border-slate-200 px-4 py-3 hover:border-cyan-500 hover:shadow">
          <span className="text-base font-semibold text-slate-800">Редактирование программ</span>
          <span className="text-xs text-slate-500 mt-1">Изменение температуры/времени с паролем.</span>
        </button>
        <button onClick={() => setCurrentScreen('CALIBRATION')} className="flex flex-col items-start justify-between rounded-2xl bg-slate-50 border-2 border-slate-200 px-4 py-3 hover:border-cyan-500 hover:shadow">
          <span className="text-base font-semibold text-slate-800">Калибровки</span>
          <span className="text-xs text-slate-500 mt-1">Сдвиги датчиков температуры/давления.</span>
        </button>
        <button onClick={() => setCurrentScreen('ERROR_LOG')} className="flex flex-col items-start justify-between rounded-2xl bg-slate-50 border-2 border-slate-200 px-4 py-3 hover:border-cyan-500 hover:shadow">
          <span className="text-base font-semibold text-slate-800">Журнал ошибок</span>
          <span className="text-xs text-slate-500 mt-1">История аварий и предупреждений.</span>
        </button>
        <button onClick={() => setCurrentScreen('SETTINGS')} className="flex flex-col items-start justify-between rounded-2xl bg-slate-50 border-2 border-slate-200 px-4 py-3 hover:border-cyan-500 hover:shadow">
          <span className="text-base font-semibold text-slate-800">Настройки</span>
          <span className="text-xs text-slate-500 mt-1">Дата/время, информация об устройстве.</span>
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
          {(state?.errorHistory?.length ?? 0) === 0 ? (
            <div className="px-4 py-4 text-slate-500 text-sm">
              Ошибок пока нет. История будет заполняться после добавления errorHistory в ядро.
            </div>
          ) : (
            (state?.errorHistory ?? []).map((err, idx) => (
              <div key={err.id} className="grid grid-cols-4 gap-0 px-4 py-2 border-b border-slate-800 text-xs">
                <div className="text-slate-300">{new Date(err.timestamp).toLocaleString('ru-RU')}</div>
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
  const VacuumTestScreen = () => {
    const vt = state?.vacuumTest;
    const lastResult = state?.lastVacuumTests?.[0];
    const running = vt?.active;
    const phaseLabel =
      vt?.phase === 'STABILIZE' ? 'Стабилизация' : vt?.phase === 'TEST' ? 'Тест' : 'Ожидание';
    const stabMin = Math.round((vt?.stabilizationTimeSec ?? 300) / 60);
    const testMin = Math.round((vt?.testTimeSec ?? 300) / 60);
    return (
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
              <span className="font-mono">{stabMin} мин</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Время теста</span>
              <span className="font-mono">{testMin} мин</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Фаза</span>
              <span className="font-mono">{phaseLabel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Прошло</span>
              <span className="font-mono">{formatNum(vt?.elapsedSec ?? 0, 0)} с</span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-slate-200">Результат теста</h2>
            <div className="flex-1 flex flex-col justify-center text-sm text-slate-200">
              {running && <span>Тест выполняется: {phaseLabel}</span>}
              {!running && lastResult && (
                <>
                  <span className="text-lg font-semibold">
                    {lastResult.result === 'PASS' ? 'Тест пройден' : 'Тест не пройден'}
                  </span>
                  <span className="text-sm text-slate-400">
                    Утечка: {(lastResult.leakRateMPaPerMin * 1000).toFixed(3)} кПа/мин
                  </span>
                </>
              )}
              {!running && !lastResult && (
                <span className="text-slate-400">Тест ещё не выполнялся.</span>
              )}
            </div>
            <button
              type="button"
              disabled={running || state?.cycle.active}
              onClick={() => controls.startVacuumTest?.({ stabilizationTimeSec: 300, testTimeSec: 300 })}
              className={`mt-2 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                running || state?.cycle.active ? 'bg-slate-700 text-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {running ? 'Тест выполняется' : 'Запустить тест'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ProgramSetupScreen = () => {
    const [unlocked, setUnlocked] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<{ setTempC: number; sterilizationTimeSec: number; preVacuumCount: number; dryingTimeSec: number } | null>(null);
    const [dial, setDial] = useState<{ open: boolean; label: string; initial: string; onConfirm: (v: number) => void }>({
      open: false,
      label: '',
      initial: '',
      onConfirm: () => {},
    });

    const data = programs.map((p) => {
      const ov = state?.programOverrides?.[p.id] || {};
      return { ...p, ...ov };
    });

    const openEditor = (pId: string) => {
      const base = data.find((p) => p.id === pId);
      if (!base) return;
      setEditingId(pId);
      setDraft({
        setTempC: base.setTempC,
        sterilizationTimeSec: base.sterilizationTimeSec,
        preVacuumCount: base.preVacuumCount,
        dryingTimeSec: base.dryingTimeSec,
      });
    };

    const applyDraft = () => {
      if (editingId && draft) {
        controls.setProgramOverride(editingId, draft);
      }
      setEditingId(null);
      setDraft(null);
    };

    return (
      <div className="flex flex-col h-full w-full bg-white text-slate-900 rounded-2xl p-6 gap-4 border border-slate-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-wide text-slate-800">Редактирование программ</h1>
          <button onClick={() => setCurrentScreen('SERVICE')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm text-slate-700 font-bold">← Назад</button>
        </div>

        {!unlocked ? (
          <PinPad onSuccess={() => setUnlocked(true)} />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 overflow-y-auto">
              {data.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openEditor(p.id)}
                  className="bg-white border-2 border-slate-200 rounded-xl p-4 text-left shadow-sm hover:border-cyan-500 transition-colors"
                >
                  <div className="text-lg font-bold text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-500 mb-2">{PROGRAM_DETAILS[p.id]?.desc}</div>
                  <div className="flex gap-2 text-xs text-slate-600">
                    <span className="px-2 py-1 bg-slate-100 rounded">{p.setTempC}°C</span>
                    <span className="px-2 py-1 bg-slate-100 rounded">{secondsToText(p.sterilizationTimeSec)}</span>
                  </div>
                </button>
              ))}
            </div>

            {editingId && draft && (
              <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xl font-bold text-slate-800">{data.find((p) => p.id === editingId)?.name}</div>
                      <div className="text-xs text-slate-500">{PROGRAM_DETAILS[editingId]?.desc}</div>
                    </div>
                    <button onClick={() => { setEditingId(null); setDraft(null); }} className="text-sm text-slate-500 hover:text-slate-700">Закрыть</button>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Температура, °C</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{draft.setTempC}</span>
                        <button onClick={() => setDial({ open: true, label: 'Температура, °C', initial: String(draft.setTempC), onConfirm: (v) => setDraft({ ...draft, setTempC: v }) })} className="text-xs text-cyan-600">Изменить</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Стерилизация, сек</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{draft.sterilizationTimeSec}</span>
                        <button onClick={() => setDial({ open: true, label: 'Стерилизация, сек', initial: String(draft.sterilizationTimeSec), onConfirm: (v) => setDraft({ ...draft, sterilizationTimeSec: v }) })} className="text-xs text-cyan-600">Изменить</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Предвакуум, шт</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{draft.preVacuumCount}</span>
                        <button onClick={() => setDial({ open: true, label: 'Предвакуум, шт', initial: String(draft.preVacuumCount), onConfirm: (v) => setDraft({ ...draft, preVacuumCount: v }) })} className="text-xs text-cyan-600">Изменить</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Сушка, сек</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{draft.dryingTimeSec}</span>
                        <button onClick={() => setDial({ open: true, label: 'Сушка, сек', initial: String(draft.dryingTimeSec), onConfirm: (v) => setDraft({ ...draft, dryingTimeSec: v }) })} className="text-xs text-cyan-600">Изменить</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => { if (editingId) controls.setProgramOverride(editingId, {}); setDraft(null); setEditingId(null); }} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">Сбросить</button>
                    <button onClick={applyDraft} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-500">Сохранить</button>
                  </div>
                </div>
              </div>
            )}

            <DialPadModal
              open={dial.open}
              label={dial.label}
              initialValue={dial.initial}
              onSubmit={dial.onConfirm}
              onClose={() => setDial({ ...dial, open: false })}
            />
          </>
        )}
      </div>
    );
  };

  const CalibrationScreen = () => {
    const c = state?.calibrationOffsets;
    const [tempCh, setTempCh] = useState(c?.chamberTempOffsetC ?? 0);
    const [pressCh, setPressCh] = useState(c?.chamberPressureOffset ?? 0);
    const [tempGen, setTempGen] = useState(c?.generatorTempOffsetC ?? 0);
    const [pressGen, setPressGen] = useState(c?.generatorPressureOffset ?? 0);
    const apply = () => controls.setCalibrationOffsets({ chamberTempOffsetC: tempCh, chamberPressureOffset: pressCh, generatorTempOffsetC: tempGen, generatorPressureOffset: pressGen });
    const reset = () => {
      setTempCh(0); setPressCh(0); setTempGen(0); setPressGen(0);
      controls.resetCalibrationOffsets();
    };
    const [dial, setDial] = useState<{ open: boolean; label: string; initial: string; onConfirm: (v: number) => void }>({
      open: false,
      label: '',
      initial: '',
      onConfirm: () => {},
    });
    return (
      <div className="flex flex-col h-full w-full bg-white text-slate-900 rounded-2xl p-6 gap-4 border border-slate-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-wide text-slate-800">Калибровки</h1>
          <button onClick={() => setCurrentScreen('SERVICE')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm text-slate-700 font-bold">← Назад</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="text-sm font-semibold text-slate-700">Камера</div>
            <div className="flex items-center justify-between text-sm">
              <div className="text-slate-600">Температура offset, °C</div>
              <button onClick={() => setDial({ open: true, label: 'Температура offset, °C', initial: String(tempCh), onConfirm: (v) => setTempCh(v) })} className="text-xs text-cyan-600">Изменить</button>
            </div>
            <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm">Текущее: {tempCh} °C</div>
            <div className="flex items-center justify-between text-sm">
              <div className="text-slate-600">Давление offset, МПа</div>
              <button onClick={() => setDial({ open: true, label: 'Давление offset, МПа', initial: String(pressCh), onConfirm: (v) => setPressCh(v) })} className="text-xs text-cyan-600">Изменить</button>
            </div>
            <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm">Текущее: {pressCh} МПа</div>
          </div>
          <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="text-sm font-semibold text-slate-700">Парогенератор</div>
            <div className="flex items-center justify-between text-sm">
              <div className="text-slate-600">Температура offset, °C</div>
              <button onClick={() => setDial({ open: true, label: 'Температура offset, °C', initial: String(tempGen), onConfirm: (v) => setTempGen(v) })} className="text-xs text-cyan-600">Изменить</button>
            </div>
            <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm">Текущее: {tempGen} °C</div>
            <div className="flex items-center justify-between text-sm">
              <div className="text-slate-600">Давление offset, МПа</div>
              <button onClick={() => setDial({ open: true, label: 'Давление offset, МПа', initial: String(pressGen), onConfirm: (v) => setPressGen(v) })} className="text-xs text-cyan-600">Изменить</button>
            </div>
            <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm">Текущее: {pressGen} МПа</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={apply} className="px-4 py-3 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-500">Применить</button>
          <button onClick={reset} className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">Сбросить</button>
        </div>
        <DialPadModal
          open={dial.open}
          label={dial.label}
          initialValue={dial.initial}
          onSubmit={dial.onConfirm}
          onClose={() => setDial({ ...dial, open: false })}
        />
      </div>
    );
  };

  const SettingsScreen = () => (
    <div className="flex flex-col h-full w-full bg-white text-slate-900 rounded-2xl p-6 gap-4 border border-slate-200">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-wide text-slate-800">Настройки</h1>
        <button onClick={() => setCurrentScreen('SERVICE')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm text-slate-700 font-bold">← Назад</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="text-sm font-semibold text-slate-700">Дата/время (только отображение)</div>
          <div className="text-lg font-mono">{new Date().toLocaleString('ru-RU')}</div>
          <div className="text-xs text-slate-500">Настройка хранения дат/опций потребует сохранения состояния, пока плейсхолдер.</div>
        </div>
        <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="text-sm font-semibold text-slate-700">Информация об устройстве</div>
          <div className="text-sm text-slate-600">Модель: Goldberg 300<br/>Версия ПО: 0.1.0 (демо)</div>
        </div>
      </div>
    </div>
  );
  // SYSTEM CHECK SCREEN (placeholder)
  const SystemCheckScreen = () => {
    const doorStatusLabel = doorLocked ? 'Заблокирована' : doorOpen ? 'Открыта' : 'Закрыта';
    return (
      <div className="flex flex-col h-full w-full bg-white text-slate-900 rounded-2xl p-6 gap-6 border border-slate-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-wide text-slate-800">Проверка системы</h1>
          <button onClick={() => setCurrentScreen('SERVICE')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm text-slate-700 font-bold">
            ← Назад
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-slate-50 border-2 border-slate-200 p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Камера</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Температура</span>
              <span className="font-mono text-lg">{(state?.chamber.temperatureC ?? 0).toFixed(1)} °C</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Давление</span>
              <span className="font-mono text-lg">{(state?.chamber.pressureMPa ?? 0).toFixed(3)} МПа</span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 border-2 border-slate-200 p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Парогенератор</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Температура</span>
              <span className="font-mono text-lg">{(state?.generator.temperatureC ?? 0).toFixed(1)} °C</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Давление</span>
              <span className="font-mono text-lg">{(state?.generator.pressureMPa ?? 0).toFixed(3)} МПа</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Уровень воды</span>
              <span className="font-mono text-lg">{(state?.generator.waterLevelPercent ?? 0).toFixed(0)}%</span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 border-2 border-slate-200 p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Служебные</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Рубашка (давление)</span>
              <span className="font-mono text-lg">{(state?.jacket.pressureMPa ?? 0).toFixed(3)} МПа</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Дверь</span>
              <span className="font-mono text-lg">{doorStatusLabel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Соединение</span>
              <span className="font-mono text-lg">{connectionStatus}</span>
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
      
      {/* Phase toast */}
      {phaseToast && (
        <div className="fixed top-4 right-4 z-[50] animate-in slide-in-from-top fade-in duration-300">
          <div className="px-4 py-2 bg-slate-900 text-white rounded-xl shadow-lg text-sm font-bold">{phaseToast}</div>
        </div>
      )}
      {/* Door toast */}
      {doorToast && (
        <div className="fixed top-16 right-4 z-[50] animate-in slide-in-from-top fade-in duration-300">
          <div className="px-4 py-2 bg-slate-800 text-white rounded-xl shadow-lg text-sm font-bold">{doorToast}</div>
        </div>
      )}

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
                     <button onClick={() => { setPendingProgramId(programs[0]?.id); setShowStartModal(true); }} className="bg-emerald-50 border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-100 rounded-xl p-5 text-left transition-colors group transform-none active:transform-none">
                       <div className="flex justify-between items-start mb-2">
                         <span className="font-bold text-emerald-800 text-lg group-hover:text-emerald-900">{programs[0]?.name}</span>
                         <Play className="text-emerald-600 bg-emerald-200 rounded-full p-1 box-content" size={16} fill="currentColor" />
                       </div>
                       <div className="text-emerald-600/70 font-medium text-sm">Основной режим</div>
                     </button>
                     <button onClick={() => { setPendingProgramId('prog_134_fast'); setShowStartModal(true); }} className="bg-slate-50 border-2 border-slate-100 hover:border-cyan-400 hover:bg-white rounded-xl p-5 text-left transition-colors group transform-none active:transform-none">
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
           /* Categorized Program Screen with sub-tabs */
           <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-700 flex items-center gap-2"><Tags /> Каталог программ</h2>
                <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold text-slate-600">
                  <button
                    onClick={() => setProgramTab('standard')}
                    className={`px-3 py-2 rounded-lg transition-all ${programTab === 'standard' ? 'bg-white shadow text-slate-800' : 'hover:text-slate-800'}`}
                  >
                    Основные
                  </button>
                  <button
                    onClick={() => setProgramTab('special')}
                    className={`px-3 py-2 rounded-lg transition-all ${programTab === 'special' ? 'bg-white shadow text-slate-800' : 'hover:text-slate-800'}`}
                  >
                    Сервисные/тест
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2">
                {programTab === 'standard' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {standardPrograms.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProgramId(p.id); startCycle(p.id); }}
                        className="bg-white border-2 border-slate-200 hover:border-cyan-500 p-4 rounded-xl text-left group transition-all h-full flex flex-col"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-lg font-bold text-slate-800 group-hover:text-cyan-700 leading-tight">{p.name}</div>
                        </div>
                        <div className="text-slate-500 text-sm mb-3 flex-1">{PROGRAM_DETAILS[p.id]?.desc}</div>
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
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {specialPrograms.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProgramId(p.id); startCycle(p.id); }}
                        className="bg-white border-2 border-slate-200 hover:border-cyan-500 p-4 rounded-xl text-left group transition-all h-full flex flex-col"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-lg font-bold text-slate-800 group-hover:text-cyan-700 leading-tight">{p.name}</div>
                          <Wrench size={16} className="text-slate-300" />
                        </div>
                        <div className="text-slate-500 text-sm mb-3 flex-1">{PROGRAM_DETAILS[p.id]?.desc}</div>
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
                )}
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
                          <th className="p-4">Начало</th>
                          <th className="p-4">Длительность</th>
                          <th className="p-4">Код ошибки</th>
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
                            <td className="p-4 text-slate-600">{c.startedAt ? new Date(c.startedAt).toLocaleString('ru-RU') : '--'}</td>
                            <td className="p-4 text-slate-600">{c.durationSec ? secondsToText(c.durationSec) : '--:--'}</td>
                            <td className="p-4 text-slate-600">{c.primaryErrorCode ?? (c.errors?.[0]?.code ?? '—')}</td>
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
        ) : currentScreen === 'PROGRAM_SETUP' ? (
            <ProgramSetupScreen />
        ) : currentScreen === 'CALIBRATION' ? (
            <CalibrationScreen />
        ) : currentScreen === 'SETTINGS' ? (
            <SettingsScreen />
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
          className={`h-16 px-8 min-w-[140px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 font-bold transition-shadow transform-none active:transform-none ${doorState.color} ${doorState.status === 'LOCKED' ? 'opacity-100 cursor-not-allowed' : 'hover:shadow-md'}`}
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
            className="h-16 w-full max-w-md bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg flex items-center justify-center gap-4 transition-colors font-black text-2xl tracking-widest uppercase"
          >
            <Square size={24} fill="currentColor" /> СТОП
          </button>
        ) : (
          <div className="flex flex-col items-center w-full max-w-md relative group">
            <button 
              onClick={() => { setPendingProgramId(currentProgram.id); setShowStartModal(true); }}
              disabled={systemState === 'ERROR' || doorOpen}
              className={`h-16 w-full rounded-xl shadow-lg flex items-center justify-center gap-4 transition-colors font-black text-2xl tracking-widest uppercase z-10 ${systemState === 'ERROR' || doorOpen ? 'bg-slate-200 cursor-not-allowed text-slate-400 shadow-none' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
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
        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border-4 border-slate-200">
            <div className={`px-6 py-4 flex items-center justify-between ${hazardInfo?.tone === 'danger' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
              <div className="flex items-center gap-3">
                {hazardInfo?.icon === 'water' && <Droplet size={32} />}
                {hazardInfo?.icon === 'temp' && <Flame size={32} />}
                {hazardInfo?.icon === 'pressure' && <Gauge size={32} />}
                {hazardInfo?.icon === 'vacuum' && <AlertTriangle size={32} />}
                {hazardInfo?.icon === 'door' && <DoorOpen size={32} />}
                {hazardInfo?.icon === 'sensor' && <ShieldAlert size={32} />}
                {hazardInfo?.icon === 'power' && <Power size={32} />}
                {!hazardInfo?.icon && <AlertOctagon size={32} />}
                <div>
                  <div className="text-xs uppercase tracking-widest font-bold opacity-80">Авария</div>
                  <div className="text-2xl font-black flex items-center gap-2">
                    {hazardInfo?.title || hazard.message}
                  </div>
                </div>
              </div>
              <button onClick={triggerResetErrors} className="px-4 py-2 rounded-xl bg-white text-red-700 font-black hover:bg-red-50">
                Сбросить
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50">
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-2">Рекомендации</div>
                <div className="text-sm text-slate-700 leading-relaxed">
                  {hazardInfo?.operatorAction ? (
                    <ul className="list-disc pl-4 space-y-1">
                      {hazardInfo.operatorAction.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    hazard.message
                  )}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-2">Параметры</div>
                <div className="text-sm text-slate-700 space-y-2">
                  <div className="flex justify-between"><span>Камера T</span><span className="font-mono">{camTemp}°C</span></div>
                  <div className="flex justify-between"><span>Камера P</span><span className="font-mono">{camPress} МПа</span></div>
                  <div className="flex justify-between"><span>Дверь</span><span className="font-mono">{doorOpen ? 'Открыта' : doorLocked ? 'Заблокирована' : 'Закрыта'}</span></div>
                </div>
              </div>
            </div>
          </div>
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

      {/* 5. POWER FAILURE MODAL */}
      {state?.powerFailure?.pending && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center border-4 border-amber-100">
             <h3 className="text-3xl font-black text-slate-800 mb-2">Сбой питания</h3>
             <p className="text-slate-500 text-lg mb-6">{state.powerFailure.message ?? 'Цикл приостановлен. Продолжить или завершить?'}</p>
             <div className="flex gap-4">
               <button onClick={() => controls.abortAfterPower()} className="flex-1 py-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg text-lg">Завершить</button>
               <button onClick={() => controls.continueAfterPower()} className="flex-1 py-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg text-lg">Продолжить</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
