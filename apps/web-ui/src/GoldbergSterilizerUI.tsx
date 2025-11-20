import React, { useState, useEffect, useMemo } from 'react';
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
  Globe, 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Info,
  ChevronRight,
  Power,
  Droplets,
  Wind
} from 'lucide-react';
import { useEngineSimulation, PROGRAM_DETAILS, type EngineMode } from './engineClient';

// --- Types & Mock Data ---

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


// --- Reusable Components ---

const MetricCard = ({ title, value, unit, icon: Icon, colorClass = "text-slate-700" }: any) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden">
    <div className="flex justify-between items-start z-10">
      <span className="text-slate-500 font-medium text-sm uppercase tracking-wide">{title}</span>
      {Icon && <Icon size={20} className="text-slate-400" />}
    </div>
    <div className="flex items-baseline gap-2 z-10">
      <span className={`text-4xl font-bold tracking-tight font-mono ${colorClass}`}>{value}</span>
      <span className="text-slate-400 font-medium">{unit}</span>
    </div>
    {/* Decorative background element */}
    <div className="absolute -bottom-4 -right-4 opacity-5">
      {Icon && <Icon size={80} />}
    </div>
  </div>
);

const MenuButton = ({ label, onClick, icon: Icon, active = false }: any) => (
  <button 
    onClick={onClick}
    className={`
      w-full p-6 rounded-xl border flex items-center gap-4 transition-all duration-200 group
      ${active 
        ? 'bg-cyan-50 border-cyan-500 shadow-md ring-1 ring-cyan-500' 
        : 'bg-white border-slate-200 hover:border-cyan-400 hover:shadow-md hover:bg-slate-50'}
    `}
  >
    <div className={`
      p-3 rounded-lg transition-colors
      ${active ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:text-cyan-600 group-hover:bg-white'}
    `}>
      <Icon size={28} />
    </div>
    <span className={`text-lg font-semibold ${active ? 'text-cyan-900' : 'text-slate-700'}`}>
      {label}
    </span>
    <ChevronRight className={`ml-auto ${active ? 'text-cyan-600' : 'text-slate-300'}`} />
  </button>
);

const StatusBadge = ({ status }: { status: string }) => {
  let bg = 'bg-slate-100';
  let text = 'text-slate-600';
  
  if (status === 'Идёт стерилизация') { bg = 'bg-amber-100'; text = 'text-amber-700 animate-pulse'; }
  if (status === 'Готов') { bg = 'bg-emerald-100'; text = 'text-emerald-700'; }
  if (status === 'Ошибка') { bg = 'bg-red-100'; text = 'text-red-700'; }

  return (
    <div className={`px-4 py-2 rounded-full font-bold uppercase tracking-wider text-sm flex items-center gap-2 ${bg} ${text}`}>
      <div className={`w-2 h-2 rounded-full ${status === 'Идёт стерилизация' ? 'bg-amber-600' : status === 'Готов' ? 'bg-emerald-600' : 'bg-red-600'}`} />
      {status}
    </div>
  );
};

// --- Main Application Component ---

export default function GoldbergSterilizerUI() {
  const [engineMode, setEngineMode] = useState<EngineMode>('local');
  const { state, programs, controls, ready, connectionStatus } = useEngineSimulation(engineMode);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('MAIN');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'fail'>('all');
  
  // Modals State
  const [showStopModal, setShowStopModal] = useState(false);
  const [showDoorModal, setShowDoorModal] = useState(false);
  const [showErrorOverlay, setShowErrorOverlay] = useState(false);

  useEffect(() => {
    if (state?.errors?.length) {
      setShowErrorOverlay(true);
    }
  }, [state?.errors]);

  useEffect(() => {
    if (!selectedProgramId && programs.length) {
      setSelectedProgramId(programs[0].id);
    }
  }, [programs, selectedProgramId]);

  const currentProgram = useMemo(() => {
    const id = state?.cycle.currentProgram?.id || selectedProgramId || programs[0]?.id;
    return programs.find((p) => p.id === id) || programs[0];
  }, [programs, selectedProgramId, state?.cycle.currentProgram]);

  const currentProgramMeta = PROGRAM_DETAILS[currentProgram?.id ?? ''] ?? { desc: '', phases: [] };

  const derivedStatus = useMemo(() => {
    if (!ready) return 'Инициализация...';
    if (statusOverride) return statusOverride;
    if (state?.errors?.length) return 'Ошибка';
    if (state?.cycle.active) return 'Идёт стерилизация';
    return 'Готов';
  }, [ready, state?.cycle.active, state?.errors, statusOverride]);

  const metrics = {
    generatorP: state?.generator.pressureMPa,
    generatorT: state?.generator.temperatureC,
    jacketP: state?.jacket.pressureMPa,
    chamberP: state?.chamber.pressureMPa,
    chamberT: state?.chamber.temperatureC,
    waterLevel: state?.generator.waterLevelPercent,
  };

  const cyclesSorted = useMemo(() => {
    const arr = [...(state?.lastCompletedCycles ?? [])];
    return arr.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  }, [state?.lastCompletedCycles]);

  const cyclesFiltered = useMemo(() => {
    if (logFilter === 'all') return cyclesSorted;
    const success = logFilter === 'success';
    return cyclesSorted.filter((c) => Boolean(c.success) === success);
  }, [cyclesSorted, logFilter]);

  const formatPressure = (v?: number) => (v !== undefined ? v.toFixed(3) : '--');
  const formatTemp = (v?: number) => (v !== undefined ? v.toFixed(1) : '--');
  const formatMinutes = (seconds: number) => `${(seconds / 60).toFixed(1)} мин`;
  const formatDuration = (start?: number, end?: number) => {
    if (!start || !end) return '—';
    const diff = Math.max(0, end - start) / 1000;
    return formatMinutes(diff);
  };

  // --- Handlers ---
  const handleStart = () => {
    if (!currentProgram || !ready) return;
    setStatusOverride(null);
    controls.startCycle(currentProgram.id);
  };
  const handleStop = () => setShowStopModal(true);
  const confirmStop = async () => { 
    await controls.stopCycle(); 
    setStatusOverride('Остановлено пользователем'); 
    setShowStopModal(false); 
  };
  const toggleError = () => setShowErrorOverlay(!showErrorOverlay);

  // --- Header ---
  const Header = React.memo(({ screen, status }: { screen: ScreenType; status: string }) => {
    const [dateTime, setDateTime] = useState(new Date());
    useEffect(() => {
      const timer = setInterval(() => setDateTime(new Date()), 1000);
      return () => clearInterval(timer);
    }, []);

    return (
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <div className="bg-cyan-600 text-white font-black px-3 py-1 rounded text-lg tracking-tighter">GOLDBERG</div>
          <span className="text-slate-400 font-light text-xl">|</span>
          <h1 className="text-slate-800 font-semibold text-lg">
            {screen === 'MAIN' && 'Мониторинг'}
            {screen === 'PROGRAMS' && 'Выбор программы'}
            {screen === 'VACUUM_TEST' && 'Вакуум-тест'}
            {screen === 'SYSTEM_CHECK' && 'Проверка системы'}
            {screen === 'PROGRAM_SETUP' && 'Настройка программы'}
            {screen === 'SPECIAL_PROGRAMS' && 'Специальные программы'}
            {screen === 'REPORTS' && 'Журнал циклов'}
            {screen === 'ERROR_LOG' && 'Журнал ошибок'}
            {screen === 'SERVICE' && 'Сервис'}
          </h1>
        </div>
        
        <div className="flex items-center gap-6">
          <StatusBadge status={status} />
          <div className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background:
                  connectionStatus === 'connected'
                    ? '#22c55e'
                    : connectionStatus === 'connecting'
                    ? '#eab308'
                    : connectionStatus === 'fallback'
                    ? '#3b82f6'
                    : '#ef4444',
              }}
            />
            {engineMode === 'local'
              ? 'Local simulation'
              : `Remote: ${connectionStatus}`}
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-700 leading-none font-mono">
              {dateTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs text-slate-400 font-medium uppercase">
              {dateTime.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>
    );
  });

  // --- Bottom Bar ---
  const Footer = () => (
    <footer className="h-24 bg-slate-800 flex items-center justify-between px-6 shadow-lg z-30 text-white">
      <div className="flex items-center gap-4 h-full py-3">
        {/* Main Actions */}
        <button 
          onClick={handleStart}
          disabled={!ready || state?.cycle.active}
          className="h-full px-8 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex flex-col items-center justify-center gap-1 shadow-lg transition-all min-w-[140px]"
        >
          <Play size={24} fill="currentColor" />
          <span className="font-bold uppercase text-sm tracking-wide">Старт</span>
        </button>

        <button 
          onClick={handleStop}
          disabled={!ready}
          className="h-full px-8 bg-slate-700 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex flex-col items-center justify-center gap-1 shadow-md transition-all min-w-[140px]"
        >
          <Square size={24} fill="currentColor" />
          <span className="font-bold uppercase text-sm tracking-wide">Стоп</span>
        </button>

        <div className="w-px h-10 bg-slate-600 mx-2"></div>

        <button 
          onClick={() => setShowDoorModal(true)}
          disabled={!ready}
          className="h-full px-6 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex flex-col items-center justify-center gap-1 min-w-[100px]"
        >
          <DoorOpen size={24} />
          <span className="font-medium text-xs">Дверь</span>
        </button>

        <button className="h-full px-6 bg-slate-700 hover:bg-slate-600 rounded-lg flex flex-col items-center justify-center gap-1 min-w-[100px]">
          <Globe size={24} />
          <span className="font-medium text-xs">Русский</span>
        </button>
      </div>

      {/* Current Program Display */}
      <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-600/50 flex items-center gap-4 px-6">
        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Текущая программа</span>
          <span className="text-lg font-bold text-cyan-400">{currentProgram?.name || '—'}</span>
        </div>
        <div className="h-10 w-10 bg-cyan-900/50 rounded-full flex items-center justify-center border border-cyan-700">
          <Settings size={20} className="text-cyan-400" />
        </div>
      </div>
    </footer>
  );

  // --- Screens ---

  const ScreenMain = () => (
    <div className="grid grid-cols-12 gap-6 h-full">
      {/* Left Column: Metrics */}
      <div className="col-span-4 flex flex-col gap-4 overflow-y-auto pr-2">
        <MetricCard title="Парогенератор P" value={formatPressure(metrics.generatorP)} unit="МПа" icon={Gauge} />
        <MetricCard title="Парогенератор T" value={formatTemp(metrics.generatorT)} unit="°C" icon={Thermometer} colorClass="text-amber-600" />
        <MetricCard title="Рубашка P" value={formatPressure(metrics.jacketP)} unit="МПа" icon={Gauge} />
        <MetricCard title="Камера P" value={formatPressure(metrics.chamberP)} unit="МПа" icon={Gauge} colorClass="text-cyan-600" />
        <MetricCard title="Камера T" value={formatTemp(metrics.chamberT)} unit="°C" icon={Thermometer} />
      </div>

      {/* Right Column: Menu */}
      <div className="col-span-8 grid grid-cols-2 gap-4 content-start">
        <MenuButton label="Программы" icon={FileText} onClick={() => setCurrentScreen('PROGRAMS')} />
        <MenuButton label="Вакуум-тест" icon={Wind} onClick={() => setCurrentScreen('VACUUM_TEST')} />
        <MenuButton label="Проверка системы" icon={Activity} onClick={() => setCurrentScreen('SYSTEM_CHECK')} />
        <MenuButton label="Настройка программы" icon={Settings} onClick={() => setCurrentScreen('PROGRAM_SETUP')} />
        <MenuButton label="Спец. программы" icon={Wrench} onClick={() => setCurrentScreen('SPECIAL_PROGRAMS')} />
        <MenuButton label="Отчёты" icon={FileText} onClick={() => setCurrentScreen('REPORTS')} />
        <MenuButton label="Журнал ошибок" icon={AlertTriangle} onClick={() => setCurrentScreen('ERROR_LOG')} />
        <MenuButton label="Сервис" icon={Wrench} onClick={() => setCurrentScreen('SERVICE')} />
      </div>
    </div>
  );

  const ScreenPrograms = () => (
    <div className="h-full flex gap-6">
      <div className="w-1/3 flex flex-col gap-3 overflow-y-auto pr-2">
        <button className="text-left font-bold text-slate-400 uppercase text-sm mb-2" onClick={() => setCurrentScreen('MAIN')}>
          &larr; Назад в меню
        </button>
        {programs.map((prog) => (
          <div 
            key={prog.id}
            onClick={() => setSelectedProgramId(prog.id)}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${currentProgram?.id === prog.id ? 'bg-cyan-50 border-cyan-500 ring-1 ring-cyan-500' : 'bg-white border-slate-200 hover:border-cyan-300'}`}
          >
            <div className="font-bold text-lg text-slate-800">{prog.name}</div>
            <div className="flex gap-4 text-sm mt-1">
              <span className="font-mono text-slate-600 font-semibold">{`${prog.setTempC}°C`}</span>
              <span className="text-slate-400">|</span>
              <span className="font-mono text-slate-600 font-semibold">{formatMinutes(prog.sterilizationTimeSec)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="w-2/3 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">{currentProgram?.name}</h2>
            <p className="text-slate-500 mt-2 text-lg">{currentProgramMeta.desc}</p>
          </div>
          <div className="bg-slate-100 p-4 rounded-lg text-right">
            <div className="text-sm text-slate-500">Время цикла (ориент.)</div>
            <div className="text-2xl font-mono font-bold text-slate-700">~45 мин</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="text-slate-400 text-sm uppercase font-bold mb-1">Температура</div>
            <div className="text-3xl font-mono font-bold text-amber-600">{currentProgram ? `${currentProgram.setTempC}°C` : '--'}</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="text-slate-400 text-sm uppercase font-bold mb-1">Выдержка</div>
            <div className="text-3xl font-mono font-bold text-cyan-600">
              {currentProgram ? formatMinutes(currentProgram.sterilizationTimeSec) : '--'}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <h3 className="font-bold text-slate-700 mb-4">Схема фаз</h3>
          <div className="flex items-center justify-between relative">
            {/* Phase connector line */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 rounded-full"></div>
            
            {currentProgramMeta.phases.map((phase, idx) => (
              <div key={idx} className="flex flex-col items-center bg-white p-2">
                <div className="w-4 h-4 rounded-full bg-cyan-500 border-4 border-white shadow-sm mb-2"></div>
                <span className="text-sm font-medium text-slate-600">{phase}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const ScreenVacuumTest = () => (
    <div className="h-full flex gap-6">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-lg border border-slate-200 p-10 text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-8">Параметры теста на герметичность</h2>
          
          <div className="grid grid-cols-3 gap-8 mb-12">
            <div>
              <div className="text-slate-400 font-medium text-sm uppercase mb-2">Стабилизация</div>
              <div className="text-4xl font-mono font-bold text-slate-700">5.00 <span className="text-lg text-slate-400">мин</span></div>
            </div>
            <div>
              <div className="text-slate-400 font-medium text-sm uppercase mb-2">Время теста</div>
              <div className="text-4xl font-mono font-bold text-slate-700">10.00 <span className="text-lg text-slate-400">мин</span></div>
            </div>
            <div>
              <div className="text-slate-400 font-medium text-sm uppercase mb-2">Утечка (Max)</div>
              <div className="text-4xl font-mono font-bold text-slate-700">1.3 <span className="text-lg text-slate-400">мбар/мин</span></div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 mb-8">
             <div className="text-slate-500 uppercase text-sm font-bold mb-2">Текущая скорость утечки</div>
             <div className="text-6xl font-mono font-bold text-cyan-600">0.0</div>
             <div className="text-slate-400 mt-1">мбар/мин</div>
          </div>

          <div className="flex justify-center gap-4">
            <button onClick={() => setCurrentScreen('MAIN')} className="px-8 py-4 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50">
              Назад
            </button>
            <button onClick={handleStart} className="px-12 py-4 rounded-xl bg-cyan-600 text-white font-bold shadow-lg hover:bg-cyan-500 hover:shadow-cyan-500/30 transition-all">
              СТАРТ ТЕСТА
            </button>
          </div>
        </div>
      </div>

      <div className="w-80 flex flex-col gap-4">
        <MetricCard title="Парогенератор P" value={formatPressure(metrics.generatorP)} unit="МПа" icon={Gauge} />
        <MetricCard title="Камера P" value={formatPressure(metrics.chamberP)} unit="МПа" icon={Gauge} colorClass="text-cyan-600" />
        <MetricCard title="Камера T" value={formatTemp(metrics.chamberT)} unit="°C" icon={Thermometer} />
      </div>
    </div>
  );

  const ScreenSystemCheck = () => {
    const StatusRow = ({ label, status, active = false }: any) => (
      <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
        <span className="font-medium text-slate-700">{label}</span>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${active ? 'text-emerald-600' : 'text-slate-400'}`}>{status}</span>
          <div className={`w-4 h-4 rounded-full ${active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-300'}`}></div>
        </div>
      </div>
    );

    return (
      <div className="h-full grid grid-cols-12 gap-6">
        <div className="col-span-8 flex flex-col gap-4">
           <div className="flex items-center gap-2 mb-2">
             <button onClick={() => setCurrentScreen('MAIN')} className="p-2 hover:bg-slate-200 rounded-full"><ArrowLeft /></button>
             <h2 className="text-xl font-bold text-slate-700">Состояние узлов</h2>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <StatusRow label="Вакуумный насос" status="ВЫКЛ" />
              <StatusRow label="Клапан подачи пара (V1)" status="ЗАКРЫТ" />
              <StatusRow label="Клапан сброса (V2)" status="ОТКРЫТ" active={true} />
              <StatusRow label="Подача воды" status="НОРМА" active={true} />
              <StatusRow label="Датчик двери" status="ЗАКРЫТА" active={true} />
              <StatusRow label="ТЭНы Парогенератора" status="ВКЛ" active={true} />
              <StatusRow label="Вентилятор охлаждения" status="ВЫКЛ" />
              <StatusRow label="Компрессор прокладки" status="ВКЛ" active={true} />
           </div>
        </div>
        <div className="col-span-4 flex flex-col gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex-1">
            <h3 className="font-bold text-slate-500 uppercase text-xs mb-4">График давления (Live)</h3>
            <div className="h-32 bg-slate-50 rounded border border-slate-100 flex items-end justify-around p-2 gap-1">
              {[20, 30, 45, 60, 55, 40, 35, 50, 70, 65].map((h, i) => (
                <div key={i} className="w-full bg-cyan-200 rounded-t" style={{ height: `${h}%` }}></div>
              ))}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex-1">
            <h3 className="font-bold text-slate-500 uppercase text-xs mb-4">График температуры (Live)</h3>
            <div className="h-32 bg-slate-50 rounded border border-slate-100 flex items-end justify-around p-2 gap-1">
               {[20, 22, 25, 28, 30, 35, 40, 42, 43, 45].map((h, i) => (
                <div key={i} className="w-full bg-amber-200 rounded-t" style={{ height: `${h}%` }}></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ScreenProgramSetup = () => (
    <div className="h-full max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
         <button onClick={() => setCurrentScreen('MAIN')} className="p-2 hover:bg-slate-200 rounded-full"><ArrowLeft /></button>
         <h2 className="text-2xl font-bold text-slate-800">Редактирование параметров</h2>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="mb-8">
          <label className="block text-slate-500 text-sm font-bold mb-2">Выберите программу</label>
          <select
            className="w-full p-4 bg-slate-50 border border-slate-300 rounded-lg text-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            value={currentProgram?.id}
            onChange={(e) => setSelectedProgramId(e.target.value)}
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <label className="block text-slate-500 text-sm font-bold mb-2">Температура стерилизации, °C</label>
            <input type="text" value={currentProgram?.setTempC ?? ''} readOnly className="w-full p-4 bg-white border border-slate-300 rounded-lg text-xl font-mono font-bold text-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" />
          </div>
          <div>
            <label className="block text-slate-500 text-sm font-bold mb-2">Время стерилизации, мин</label>
            <input type="text" value={(currentProgram?.sterilizationTimeSec ?? 0) / 60} readOnly className="w-full p-4 bg-white border border-slate-300 rounded-lg text-xl font-mono font-bold text-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" />
          </div>
          <div>
            <label className="block text-slate-500 text-sm font-bold mb-2">Количество предвакуумов</label>
            <input type="number" value={currentProgram?.preVacuumCount ?? ''} readOnly className="w-full p-4 bg-white border border-slate-300 rounded-lg text-xl font-mono font-bold text-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" />
          </div>
          <div>
            <label className="block text-slate-500 text-sm font-bold mb-2">Время сушки, мин</label>
            <input type="text" value={(currentProgram?.dryingTimeSec ?? 0) / 60} readOnly className="w-full p-4 bg-white border border-slate-300 rounded-lg text-xl font-mono font-bold text-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
          <h3 className="text-amber-800 font-bold flex items-center gap-2 mb-2">
             <AlertTriangle size={18} /> Ограничения безопасности
          </h3>
          <div className="flex gap-8 text-sm text-amber-900">
            <span>Макс. давление: 0.240 МПа</span>
            <span>Макс. температура: 138.0 °C</span>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button className="px-6 py-3 rounded-lg text-slate-600 font-bold hover:bg-slate-100">Сбросить</button>
          <button onClick={() => setCurrentScreen('MAIN')} className="px-8 py-3 rounded-lg bg-cyan-600 text-white font-bold hover:bg-cyan-500 shadow-lg">Сохранить изменения</button>
        </div>
      </div>
    </div>
  );

  const ScreenTables = ({ type }: { type: 'LOGS' | 'ERRORS' }) => (
    <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
             <button onClick={() => setCurrentScreen('MAIN')} className="p-2 hover:bg-slate-200 rounded-full"><ArrowLeft /></button>
             <h2 className="text-2xl font-bold text-slate-800">{type === 'LOGS' ? 'Журнал циклов' : 'Журнал ошибок'}</h2>
          </div>
          <div className="flex gap-2">
             {type === 'LOGS' && (
               <>
                 <button onClick={() => setLogFilter('all')} className={`px-4 py-2 rounded font-medium border ${logFilter === 'all' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-600 border-slate-300'}`}>Все</button>
                 <button onClick={() => setLogFilter('success')} className={`px-4 py-2 rounded font-medium border ${logFilter === 'success' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300'}`}>Успех</button>
                 <button onClick={() => setLogFilter('fail')} className={`px-4 py-2 rounded font-medium border ${logFilter === 'fail' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300'}`}>Ошибки</button>
               </>
             )}
             <button
             onClick={() => {
               const payload = {
                 cycles: state?.lastCompletedCycles ?? [],
                 errors: state?.errors ?? [],
               };
               const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
               const url = URL.createObjectURL(blob);
               const link = document.createElement('a');
               link.href = url;
               link.download = 'goldberg-logs.json';
               document.body.appendChild(link);
               link.click();
               link.remove();
               URL.revokeObjectURL(url);
             }}
             className="px-4 py-2 bg-cyan-600 text-white rounded font-medium flex items-center gap-2"
           >
             <FileText size={16} /> Экспорт JSON
           </button>
           <button
             onClick={() => {
               const rows = (state?.lastCompletedCycles ?? []).map((row) => [
                 row.id,
                 new Date(row.startedAt).toISOString(),
                 row.programName,
                 row.success ? 'OK' : 'FAIL',
                 (row.maxTemperatureC ?? '').toString(),
                 (row.maxPressureMPa ?? '').toString(),
               ]);
               const header = ['id', 'startedAt', 'program', 'status', 'maxTemp', 'maxPressure'];
               const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
               const blob = new Blob([csv], { type: 'text/csv' });
               const url = URL.createObjectURL(blob);
               const a = document.createElement('a');
               a.href = url;
               a.download = 'cycles.csv';
               a.click();
               URL.revokeObjectURL(url);
             }}
             className="px-4 py-2 bg-emerald-600 text-white rounded font-medium flex items-center gap-2"
           >
             <FileText size={16} /> Экспорт CSV
           </button>
         </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold sticky top-0">
              {type === 'LOGS' ? (
                <tr>
                  <th className="p-4">№ Цикла</th>
                  <th className="p-4">Дата</th>
                  <th className="p-4">Время</th>
                  <th className="p-4">Программа</th>
                  <th className="p-4">Длительность</th>
                  <th className="p-4">T макс</th>
                  <th className="p-4">P макс</th>
                  <th className="p-4">Статус</th>
                </tr>
              ) : (
                <tr>
                  <th className="p-4">Время</th>
                  <th className="p-4">Код</th>
                  <th className="p-4">Описание</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {type === 'LOGS' && cyclesFiltered.length ? (
                cyclesFiltered.map((row) => {
                  const started = new Date(row.startedAt);
                  const date = started.toLocaleDateString('ru-RU');
                  const time = started.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 cursor-pointer group">
                      <td className="p-4 font-mono text-slate-600">{row.id}</td>
                      <td className="p-4 text-slate-700">{date}</td>
                      <td className="p-4 text-slate-700">{time}</td>
                      <td className="p-4 font-medium text-slate-800">{row.programName}</td>
                      <td className="p-4 text-slate-600">{formatDuration(row.startedAt, row.endedAt)}</td>
                      <td className="p-4 text-slate-600">{row.maxTemperatureC?.toFixed?.(1) ?? '—'} °C</td>
                      <td className="p-4 text-slate-600">{row.maxPressureMPa?.toFixed?.(3) ?? '—'} МПа</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${row.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {row.success ? 'Успешно' : 'Ошибка'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : null}
              {type === 'ERRORS' && state?.errors?.length ? (
                state.errors.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 cursor-pointer">
                    <td className="p-4 font-mono text-slate-600">
                      {new Date(row.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="p-4 font-mono font-bold text-red-600">{row.code}</td>
                    <td className="p-4 text-slate-800 font-medium">{row.message}</td>
                  </tr>
                ))
              ) : (
                type === 'ERRORS' && (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={3}>Ошибок нет</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
        
        {/* Right Details Panel */}
        <div className="w-80 border-l border-slate-200 p-6 bg-slate-50">
          {type === 'LOGS' ? (
            <>
               <h3 className="font-bold text-slate-700 mb-4">Детали цикла</h3>
               <div className="h-40 bg-white border border-slate-200 rounded mb-4 flex items-center justify-center text-slate-400 text-sm">
                 [График T/P]
               </div>
               <div className="space-y-2 text-sm">
                 <div className="flex justify-between"><span className="text-slate-500">Последний:</span> <span>{state?.lastCompletedCycles?.[0]?.programName ?? '—'}</span></div>
                 <div className="flex justify-between"><span className="text-slate-500">Макс. темп:</span> <span>{state?.lastCompletedCycles?.[0]?.maxTemperatureC?.toFixed?.(1) ?? '—'} °C</span></div>
                 <div className="flex justify-between"><span className="text-slate-500">Макс. давл.:</span> <span>{state?.lastCompletedCycles?.[0]?.maxPressureMPa?.toFixed?.(3) ?? '—'} МПа</span></div>
               </div>
            </>
          ) : (
            <>
              <h3 className="font-bold text-slate-700 mb-4">Информация об ошибке</h3>
              <div className="p-4 bg-red-50 rounded border border-red-100 mb-4">
                <div className="text-red-800 font-bold text-lg mb-1">E004</div>
                <div className="text-red-700">Ошибка нагрева</div>
              </div>
              <p className="text-sm text-slate-600">
                Температура не достигла заданного значения за установленное время. Проверьте подачу пара и состояние клапана V1.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const ScreenService = () => (
     <div className="h-full max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
         <button onClick={() => setCurrentScreen('MAIN')} className="p-2 hover:bg-slate-200 rounded-full"><ArrowLeft /></button>
         <h2 className="text-2xl font-bold text-slate-800">Сервисное обслуживание</h2>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2">Информация о системе</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Модель</span> <span className="font-bold">GOLDBERG 300</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Серийный номер</span> <span className="font-mono">SN-2025-8841</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Версия ПО</span> <span className="font-mono">v2.4.1 (Build 804)</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">IP Адрес</span> <span className="font-mono">192.168.1.45</span></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2">Счётчики</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">Ресурс уплотнителя двери</span> <span>850 / 1000 цикли</span></div>
              <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full" style={{width: '85%'}}></div></div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">До следующего ТО</span> <span>120 ч.</span></div>
              <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-amber-500 h-2 rounded-full" style={{width: '20%'}}></div></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-2">
          <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2">Калибровка датчиков</h3>
          <div className="grid grid-cols-2 gap-8">
             <div>
                <label className="block text-sm text-slate-500 mb-1">Смещение T Камеры</label>
                <div className="flex items-center gap-2">
                   <input type="text" defaultValue="+0.1" className="p-2 border border-slate-300 rounded w-24 text-center font-mono" />
                   <span className="text-slate-400">°C</span>
                </div>
             </div>
             <div>
                <label className="block text-sm text-slate-500 mb-1">Смещение P Камеры</label>
                <div className="flex items-center gap-2">
                   <input type="text" defaultValue="-0.002" className="p-2 border border-slate-300 rounded w-24 text-center font-mono" />
                   <span className="text-slate-400">МПа</span>
                </div>
             </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex justify-center">
        <button className="text-slate-400 hover:text-red-500 text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-colors">
           <Wrench size={16} /> Вход в инженерное меню
        </button>
      </div>
     </div>
  );

  // --- Overlay Modals ---

  const StopModal = () => (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center transform scale-100">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Square size={32} className="text-red-600" fill="currentColor" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Остановить цикл?</h3>
        <p className="text-slate-500 mb-8">Процесс стерилизации будет прерван. Давление в камере будет сброшено.</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setShowStopModal(false)} className="py-3 px-6 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">Нет, продолжить</button>
          <button onClick={confirmStop} className="py-3 px-6 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg">ДА, ОСТАНОВИТЬ</button>
        </div>
      </div>
    </div>
  );

  const DoorModal = () => (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <DoorOpen size={32} className="text-blue-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Открыть дверь?</h3>
        <p className="text-slate-500 mb-8">Убедитесь, что давление в камере выровнено с атмосферным.</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setShowDoorModal(false)} className="py-3 px-6 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">Отмена</button>
          <button
            onClick={() => {
              setShowDoorModal(false);
              if (ready) controls.openDoor();
            }}
            className="py-3 px-6 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg"
          >
            Открыть
          </button>
        </div>
      </div>
    </div>
  );

  const ErrorOverlay = () => (
    <div className="fixed top-0 left-0 w-full h-20 bg-red-600 z-[100] flex items-center justify-between px-8 shadow-xl animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-4 text-white">
        <AlertTriangle size={32} className="animate-pulse" fill="white" textAnchor='middle' stroke='red' />
        <div>
          <div className="font-black uppercase text-lg tracking-wider">Внимание: Аварийное сообщение</div>
          <div className="text-red-100 text-sm font-medium">ИЗБЫТОЧНОЕ ДАВЛЕНИЕ ИЛИ ВЫСОКАЯ ТЕМПЕРАТУРА</div>
        </div>
      </div>
      <button onClick={() => setShowErrorOverlay(false)} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded font-bold transition-colors">
        Закрыть
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden select-none">
      <Header screen={currentScreen} status={derivedStatus} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-6 relative">
        {engineMode === 'remote' && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
            Remote режим в разработке. Сейчас работает локальная симуляция.
          </div>
        )}
        {currentScreen === 'MAIN' && <ScreenMain />}
        {currentScreen === 'PROGRAMS' && <ScreenPrograms />}
        {currentScreen === 'VACUUM_TEST' && <ScreenVacuumTest />}
        {currentScreen === 'SYSTEM_CHECK' && <ScreenSystemCheck />}
        {currentScreen === 'PROGRAM_SETUP' && <ScreenProgramSetup />}
        {currentScreen === 'REPORTS' && <ScreenTables type='LOGS' />}
        {currentScreen === 'ERROR_LOG' && <ScreenTables type='ERRORS' />}
        {currentScreen === 'SERVICE' && <ScreenService />}
        
        {/* Special Programs Placeholder screen reused */}
        {currentScreen === 'SPECIAL_PROGRAMS' && (
          <div className="h-full flex flex-col">
             <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setCurrentScreen('MAIN')} className="p-2 hover:bg-slate-200 rounded-full"><ArrowLeft /></button>
                <h2 className="text-2xl font-bold text-slate-800">Специальные программы</h2>
             </div>
             <div className="grid grid-cols-3 gap-6">
               {['Тест Вакуума', 'Тест Bowie-Dick', 'Тест проникновения пара', 'Прогрев камеры'].map(name => (
                 <div key={name} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-cyan-400 transition-colors cursor-pointer group">
                    <div className="w-12 h-12 bg-cyan-50 rounded-lg flex items-center justify-center text-cyan-600 mb-4 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                      <Play size={24} fill="currentColor" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{name}</h3>
                    <p className="text-sm text-slate-500">Служебный цикл для проверки работоспособности системы.</p>
                 </div>
               ))}
             </div>
          </div>
        )}
      </main>

      <Footer />

      {/* Overlays */}
      {showStopModal && <StopModal />}
      {showDoorModal && <DoorModal />}
      {showErrorOverlay && <ErrorOverlay />}
      
      {/* Debug trigger for error overlay (invisible to user normally, click Goldberg logo to toggle) */}
      <div className="fixed bottom-0 right-0 w-2 h-2 cursor-pointer" onClick={toggleError}></div>
    </div>
  );
}
