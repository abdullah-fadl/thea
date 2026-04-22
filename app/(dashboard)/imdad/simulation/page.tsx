'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '@/hooks/use-lang';
import {
  Play, Pause, Square, RotateCcw, Zap, Activity, AlertTriangle, Server,
  Clock, TrendingUp, Gauge, ShieldAlert, Flame, Wind, Bug, Users,
  Truck, Wrench, BarChart3, FileText, Heart, Stethoscope, Baby, Syringe,
  Bed, ThermometerSun, Moon, Calendar,
} from 'lucide-react';

type SimStatus = 'running' | 'paused' | 'stopped';
type Speed = 1 | 5 | 10 | 20 | 60;

interface SimConfig {
  status: SimStatus;
  speedMultiplier: Speed;
  tickIntervalSeconds: number;
  simulationTime: string;
  totalTicks: number;
  lastTickAt: string | null;
  activeScenarios: Array<{
    type: string;
    intensity: number;
    startedAtTick: number;
    durationTicks: number;
    hospitalIds: string[];
  }>;
}

interface SimEvent {
  tickNumber: number;
  simulationTime: string;
  eventType: string;
  hospitalId: string | null;
  description: string;
  createdAt: string;
}

interface TickResult {
  tickNumber: number;
  duration_ms: number;
  hospitalsProcessed: number;
  newPurchaseRequisitions: number;
  newPurchaseOrders: number;
  newGoodsReceived: number;
  newInvoices: number;
  alertsGenerated: number;
  statusTransitions: number;
}

interface ScenarioDef {
  type: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  defaultIntensity: number;
  defaultDurationTicks: number;
}

const SCENARIO_ICONS: Record<string, React.ReactNode> = {
  emergency_surge: <Zap className="w-4 h-4 text-red-500" />,
  icu_overload: <Activity className="w-4 h-4 text-orange-500" />,
  flu_season: <Bug className="w-4 h-4 text-yellow-500" />,
  staffing_shortage: <Users className="w-4 h-4 text-purple-500" />,
  vendor_delay: <Truck className="w-4 h-4 text-blue-500" />,
  equipment_failure: <Wrench className="w-4 h-4 text-gray-500" />,
  mass_casualty: <ShieldAlert className="w-4 h-4 text-red-700" />,
  supply_shortage: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  pandemic_wave: <Flame className="w-4 h-4 text-red-600" />,
  heat_wave: <Wind className="w-4 h-4 text-orange-400" />,
};

export default function SimulationPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [config, setConfig] = useState<SimConfig | null>(null);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [scenarios, setScenarios] = useState<ScenarioDef[]>([]);
  const [lastTick, setLastTick] = useState<TickResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticking, setTicking] = useState(false);
  const [authError, setAuthError] = useState(false);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/imdad/simulation/status?events=30');
      if (res.status === 401) { setAuthError(true); return; }
      if (!res.ok) return;
      const json = await res.json();
      if (json.data && mountedRef.current) {
        setConfig(json.data.config);
        setEvents(json.data.events ?? []);
        setLiveCounts(json.data.liveCounts ?? {});
        setAuthError(false);
      }
    } catch (e) {
      console.error('Failed to fetch sim status', e);
    }
  }, []);

  // Fetch scenarios
  const fetchScenarios = useCallback(async () => {
    try {
      const res = await fetch('/api/imdad/simulation/scenarios');
      if (!res.ok) return;
      const json = await res.json();
      if (json.data?.available && mountedRef.current) setScenarios(json.data.available);
    } catch (e) {
      console.error('Failed to fetch scenarios', e);
    }
  }, []);

  // Control action
  const sendControl = async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch('/api/imdad/simulation/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json();
    if (json.data) setConfig(json.data);
    return json.data;
  };

  // Execute a single tick
  const doTick = async () => {
    setTicking(true);
    try {
      const res = await fetch('/api/imdad/simulation/tick', { method: 'POST' });
      const json = await res.json();
      if (json.data) setLastTick(json.data);
      await fetchStatus();
    } catch (e) {
      console.error('Tick failed', e);
    }
    setTicking(false);
  };

  // Inject scenario
  const injectScenario = async (type: string) => {
    await fetch('/api/imdad/simulation/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'inject', scenarioType: type }),
    });
    await fetchStatus();
    await fetchScenarios();
  };

  // Remove scenario
  const removeScenario = async (type: string) => {
    await fetch('/api/imdad/simulation/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', scenarioType: type }),
    });
    await fetchStatus();
  };

  // Auto-tick interval
  useEffect(() => {
    if (config?.status === 'running') {
      const ms = (config.tickIntervalSeconds ?? 60) * 1000;
      tickIntervalRef.current = setInterval(doTick, ms);
    } else {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    }
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.status, config?.tickIntervalSeconds]);

  // Initial load + cleanup
  useEffect(() => {
    mountedRef.current = true;
    Promise.all([fetchStatus(), fetchScenarios()]).then(() => {
      if (mountedRef.current) setLoading(false);
    });
    const poll = setInterval(fetchStatus, 15000); // Poll every 15s
    return () => {
      mountedRef.current = false;
      clearInterval(poll);
    };
  }, [fetchStatus, fetchScenarios]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isRunning = config?.status === 'running';
  const isPaused = config?.status === 'paused';
  const isStopped = config?.status === 'stopped' || !config;

  if (authError && !config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <AlertTriangle className="w-12 h-12 text-yellow-500" />
        <h2 className="text-xl font-bold text-gray-800">
          {tr('يرجى تسجيل الدخول أولاً', 'Please log in first')}
        </h2>
        <p className="text-gray-500 text-sm">
          {tr('محرك المحاكاة يتطلب صلاحيات مسؤول', 'The simulation engine requires admin privileges')}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-6 h-6 text-blue-600" />
            {tr('محرك محاكاة المستشفيات', 'Hospital Reality Engine')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tr('محاكاة حية لعمليات 50 مستشفى مع 31,000 موظف', 'Live simulation of 50 hospitals with 31,000 employees')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            isRunning ? 'bg-green-100 text-green-800 animate-pulse' :
            isPaused ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-600'
          }`}>
            {isRunning ? tr('يعمل', 'RUNNING') : isPaused ? tr('متوقف مؤقتاً', 'PAUSED') : tr('متوقف', 'STOPPED')}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Gauge className="w-5 h-5" />
          {tr('لوحة التحكم', 'Control Panel')}
        </h2>
        <div className="flex flex-wrap gap-3 items-center">
          {/* Play / Pause / Stop / Reset */}
          <button
            onClick={() => sendControl(isRunning ? 'pause' : 'start')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition ${
              isRunning
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning ? tr('إيقاف مؤقت', 'Pause') : tr('تشغيل', 'Start')}
          </button>

          {!isStopped && (
            <button
              onClick={() => sendControl('stop')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm bg-red-600 text-white hover:bg-red-700"
            >
              <Square className="w-4 h-4" />
              {tr('إيقاف', 'Stop')}
            </button>
          )}

          <button
            onClick={() => sendControl('reset')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
          >
            <RotateCcw className="w-4 h-4" />
            {tr('إعادة تعيين', 'Reset')}
          </button>

          <div className="w-px h-8 bg-gray-200 mx-1" />

          {/* Manual tick */}
          <button
            onClick={doTick}
            disabled={ticking || isStopped}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            {ticking ? tr('يعالج...', 'Processing...') : tr('تقدم يدوي', 'Manual Tick')}
          </button>

          <div className="w-px h-8 bg-gray-200 mx-1" />

          {/* Speed control */}
          <span className="text-xs text-gray-500 font-medium">{tr('السرعة:', 'Speed:')}</span>
          {([1, 5, 10, 20, 60] as Speed[]).map(s => (
            <button
              key={s}
              onClick={() => sendControl('start', { speed: s })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                config?.speedMultiplier === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}x
            </button>
          ))}

          <div className="w-px h-8 bg-gray-200 mx-1" />

          {/* Tick interval */}
          <span className="text-xs text-gray-500 font-medium">{tr('الفاصل:', 'Interval:')}</span>
          {[60, 300, 900, 3600].map(sec => (
            <button
              key={sec}
              onClick={() => sendControl('start', { tickInterval: sec })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                config?.tickIntervalSeconds === sec
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {sec < 60 ? `${sec}s` : `${sec / 60}m`}
            </button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard icon={<Clock className="w-4 h-4" />} label={tr('الوقت المحاكى', 'Sim Time')}
          value={config?.simulationTime ? new Date(config.simulationTime).toLocaleString('en-SA', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '—'} />
        <StatCard icon={<BarChart3 className="w-4 h-4" />} label={tr('عدد الدورات', 'Total Ticks')}
          value={config?.totalTicks?.toLocaleString() ?? '0'} />
        <StatCard icon={<FileText className="w-4 h-4" />} label={tr('أوامر الشراء', 'Purchase Orders')}
          value={(liveCounts.purchase_orders ?? 0).toLocaleString()} color="blue" />
        <StatCard icon={<FileText className="w-4 h-4" />} label={tr('طلبات الشراء', 'PRs')}
          value={(liveCounts.purchase_requisitions ?? 0).toLocaleString()} color="indigo" />
        <StatCard icon={<FileText className="w-4 h-4" />} label={tr('الفواتير', 'Invoices')}
          value={(liveCounts.invoices ?? 0).toLocaleString()} color="green" />
        <StatCard icon={<AlertTriangle className="w-4 h-4" />} label={tr('التنبيهات', 'Alerts')}
          value={(liveCounts.alert_instances ?? 0).toLocaleString()} color="red" />
        <StatCard icon={<Server className="w-4 h-4" />} label={tr('المستشفيات', 'Organizations')}
          value={(liveCounts.organizations ?? 0).toLocaleString()} color="purple" />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label={tr('مؤشرات KPI', 'KPI Snapshots')}
          value={(liveCounts.kpi_snapshots ?? 0).toLocaleString()} color="teal" />
        <StatCard icon={<Truck className="w-4 h-4" />} label={tr('الموردون', 'Vendors')}
          value={(liveCounts.vendors ?? 0).toLocaleString()} />
        <StatCard icon={<Activity className="w-4 h-4" />} label={tr('الأصول', 'Assets')}
          value={(liveCounts.assets ?? 0).toLocaleString()} color="amber" />
        <StatCard icon={<FileText className="w-4 h-4" />} label={tr('الأصناف', 'Items')}
          value={(liveCounts.item_masters ?? 0).toLocaleString()} />
        <StatCard icon={<Users className="w-4 h-4" />} label={tr('الأقسام', 'Departments')}
          value={(liveCounts.departments ?? 0).toLocaleString()} />
      </div>

      {/* Last tick result */}
      {lastTick && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-medium text-blue-800 text-sm mb-2">
            {tr(`آخر دورة — #${lastTick.tickNumber}`, `Last Tick — #${lastTick.tickNumber}`)} ({lastTick.duration_ms}ms)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-blue-700">
            <span>{tr('مستشفيات:', 'Hospitals:')} {lastTick.hospitalsProcessed}</span>
            <span>{tr('طلبات شراء جديدة:', 'New PRs:')} {lastTick.newPurchaseRequisitions}</span>
            <span>{tr('أوامر شراء:', 'New POs:')} {lastTick.newPurchaseOrders}</span>
            <span>{tr('فواتير:', 'Invoices:')} {lastTick.newInvoices}</span>
            <span>{tr('استلام بضائع:', 'GRNs:')} {lastTick.newGoodsReceived}</span>
            <span>{tr('تنبيهات:', 'Alerts:')} {lastTick.alertsGenerated}</span>
            <span>{tr('تغيير حالات:', 'Transitions:')} {lastTick.statusTransitions}</span>
            {(lastTick as any).chaosEventsCount > 0 && (
              <span className="text-red-600 font-bold">{tr('أحداث فوضى:', 'Chaos:')} {(lastTick as any).chaosEventsCount}</span>
            )}
          </div>
          {/* Patient Flow from last tick */}
          {(lastTick as any).totalOpdVisits != null && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-blue-700 mt-2 pt-2 border-t border-blue-200">
              <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {tr('عيادات:', 'OPD:')} {(lastTick as any).totalOpdVisits}</span>
              <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-500" /> {tr('طوارئ:', 'ER:')} {(lastTick as any).totalErArrivals}</span>
              <span className="flex items-center gap-1"><Syringe className="w-3 h-3" /> {tr('عمليات:', 'Surgery:')} {(lastTick as any).totalSurgeries}</span>
              <span className="flex items-center gap-1"><Baby className="w-3 h-3" /> {tr('ولادة:', 'Delivery:')} {(lastTick as any).totalDeliveries}</span>
              <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {tr('إشغال ICU:', 'ICU Occ:')} {(lastTick as any).avgIcuOccupancy}%</span>
            </div>
          )}
          {/* Seasonal Effects */}
          {(lastTick as any).seasonalEffects?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-blue-200">
              {(lastTick as any).seasonalEffects.map((s: string) => (
                <span key={s} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-medium flex items-center gap-1">
                  {s === 'FLU_SEASON' && <ThermometerSun className="w-3 h-3" />}
                  {s === 'RAMADAN' && <Moon className="w-3 h-3" />}
                  {s === 'WEEKEND' && <Calendar className="w-3 h-3" />}
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scenario injection + Event log side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenarios */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            {tr('محرك السيناريوهات', 'Scenario Engine')}
          </h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {scenarios.map(s => {
              const isActive = config?.activeScenarios?.some(a => a.type === s.type);
              return (
                <div key={s.type}
                  className={`flex items-center justify-between p-3 rounded-lg border transition ${
                    isActive ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}>
                  <div className="flex items-center gap-2">
                    {SCENARIO_ICONS[s.type] ?? <AlertTriangle className="w-4 h-4" />}
                    <div>
                      <div className="text-sm font-medium text-gray-800">
                        {language === 'ar' ? s.nameAr : s.nameEn}
                      </div>
                      <div className="text-xs text-gray-500 line-clamp-1">
                        {language === 'ar' ? s.descriptionAr : s.descriptionEn}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => isActive ? removeScenario(s.type) : injectScenario(s.type)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                      isActive
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isActive ? tr('إيقاف', 'Remove') : tr('تفعيل', 'Inject')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event log */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-500" />
            {tr('سجل الأحداث', 'Event Log')}
          </h2>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto font-mono text-xs">
            {events.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                {tr('لا توجد أحداث بعد — ابدأ المحاكاة', 'No events yet — start the simulation')}
              </div>
            ) : events.map((ev, i) => (
              <div key={i} className="flex gap-2 py-1 border-b border-gray-50">
                <span className="text-gray-400 shrink-0">#{ev.tickNumber}</span>
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  ev.eventType === 'SCENARIO_ACTIVE' ? 'bg-red-100 text-red-700' :
                  ev.eventType === 'SCENARIO_INJECTED' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {ev.eventType}
                </span>
                <span className="text-gray-700 truncate">{ev.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card component
// ---------------------------------------------------------------------------

function StatCard({ icon, label, value, color = 'gray' }: {
  icon: React.ReactNode; label: string; value: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    purple: 'bg-purple-50 border-purple-200',
    amber: 'bg-amber-50 border-amber-200',
    teal: 'bg-teal-50 border-teal-200',
  };
  return (
    <div className={`${colorMap[color] ?? colorMap.gray} border rounded-xl p-3`}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        {icon} {label}
      </div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
    </div>
  );
}
