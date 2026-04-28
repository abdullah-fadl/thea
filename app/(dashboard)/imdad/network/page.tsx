'use client';

import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';
import { useMemo } from 'react';
import {
  Activity,
  Building2,
  Radio,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------

const KEYFRAMES = `
@keyframes networkPulse {
  0%, 100% { box-shadow: 0 0 8px 2px rgba(6,182,212,0.2); }
  50% { box-shadow: 0 0 20px 8px rgba(6,182,212,0.4); }
}
@keyframes criticalBorder {
  0%, 100% { border-color: rgba(239,68,68,0.4); box-shadow: 0 0 8px rgba(239,68,68,0.2); }
  50% { border-color: rgba(239,68,68,0.9); box-shadow: 0 0 20px rgba(239,68,68,0.5); }
}
@keyframes initDot {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
@keyframes liveBadge {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
@keyframes sweepLine {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  OPERATIONAL: '#10b981',
  ELEVATED: '#f59e0b',
  HIGH_PRESSURE: '#f97316',
  CRITICAL: '#ef4444',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] || '#6b7280';
}

function pressureColor(pressure: number): string {
  if (pressure < 30) return '#10b981';
  if (pressure < 50) return '#f59e0b';
  if (pressure < 75) return '#f97316';
  return '#ef4444';
}

function pressureBarGradient(pressure: number): string {
  if (pressure < 30) return 'from-emerald-500 to-emerald-400';
  if (pressure < 50) return 'from-amber-500 to-amber-400';
  if (pressure < 75) return 'from-orange-500 to-orange-400';
  return 'from-red-500 to-red-400';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising' || trend === 'up' || trend === 'improving')
    return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (trend === 'falling' || trend === 'down' || trend === 'degrading')
    return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-slate-500" />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ImdadNetworkPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const brain = useImdadBrain();
  const { hospitals, pulse, pressure, cycleCount } = brain;

  // Compute summary counts
  const summary = useMemo(() => {
    const total = hospitals.length;
    let operational = 0;
    let elevated = 0;
    let critical = 0;

    hospitals.forEach((h: any) => {
      const s = h.status || 'OPERATIONAL';
      if (s === 'OPERATIONAL') operational++;
      else if (s === 'ELEVATED') elevated++;
      else if (s === 'HIGH_PRESSURE' || s === 'CRITICAL') critical++;
    });

    // Group elevated + high_pressure together for the amber count
    const amber = hospitals.filter(
      (h: any) => h.status === 'ELEVATED' || h.status === 'HIGH_PRESSURE',
    ).length;
    const red = hospitals.filter((h: any) => h.status === 'CRITICAL').length;

    return { total, operational, amber, red };
  }, [hospitals]);

  const isInitializing = hospitals.length === 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      <div
        className="min-h-screen bg-[#050a18] text-white overflow-auto"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* ---- Background ambient ---- */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, rgba(6,182,212,0.25), transparent 60%), radial-gradient(circle at 80% 70%, rgba(99,102,241,0.15), transparent 50%)',
            }}
          />
        </div>

        <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* ================================================================
              HEADER
          ================================================================ */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <Activity className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  {tr('الشبكة الحية', 'Live Network')}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tr(
                    'عرض مباشر لجميع المستشفيات في الشبكة',
                    'Real-time view of all hospitals in the network',
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* LIVE badge */}
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase border"
                style={{
                  borderColor: 'rgba(239,68,68,0.5)',
                  background: 'rgba(239,68,68,0.1)',
                  color: '#f87171',
                  animation: 'liveBadge 2s ease-in-out infinite',
                }}
              >
                <Radio className="h-3 w-3" />
                {tr('مباشر', 'LIVE')}
              </span>

              {/* Cycle counter */}
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                {tr('الدورة', 'Cycle')} #{cycleCount}
              </span>
            </div>
          </div>

          {/* ================================================================
              NETWORK SUMMARY STRIP
          ================================================================ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Total Hospitals */}
            <SummaryCard
              icon={<Building2 className="h-4 w-4 text-cyan-400" />}
              label={tr('إجمالي المستشفيات', 'Total Hospitals')}
              value={summary.total || 14}
              accent="#06b6d4"
            />
            {/* Operational */}
            <SummaryCard
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              label={tr('تشغيلي', 'Operational')}
              value={summary.operational}
              accent="#10b981"
            />
            {/* Elevated */}
            <SummaryCard
              icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
              label={tr('مرتفع', 'Elevated')}
              value={summary.amber}
              accent="#f59e0b"
            />
            {/* Critical */}
            <SummaryCard
              icon={<ShieldAlert className="h-4 w-4 text-red-400" />}
              label={tr('حرج', 'Critical')}
              value={summary.red}
              accent="#ef4444"
            />
          </div>

          {/* ================================================================
              HOSPITAL GRID or INITIALIZING STATE
          ================================================================ */}
          {isInitializing ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div
                className="h-3 w-3 rounded-full bg-cyan-400"
                style={{ animation: 'initDot 1.5s ease-in-out infinite' }}
              />
              <p className="text-sm text-slate-400">
                {tr(
                  'جاري تهيئة النظام — الاتصال بالشبكة...',
                  'System initializing — connecting to network...',
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {hospitals.map((hospital: any, idx: number) => (
                <HospitalCard
                  key={hospital.id || idx}
                  hospital={hospital}
                  language={language}
                  tr={tr}
                />
              ))}
            </div>
          )}

          {/* ================================================================
              CROSS-HOSPITAL PRESSURE DIMENSIONS
          ================================================================ */}
          {!isInitializing && pressure.dimensions.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">
                  {tr('الأبعاد التشغيلية عبر الشبكة', 'Cross-Network Pressure Dimensions')}
                </h2>
                <span
                  className="ml-auto text-[11px] font-mono px-2 py-0.5 rounded-full border"
                  style={{
                    borderColor: `${pressureColor(pressure.composite)}33`,
                    color: pressureColor(pressure.composite),
                    background: `${pressureColor(pressure.composite)}10`,
                  }}
                >
                  {tr('الضغط المركب', 'Composite')} {pressure.composite}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {pressure.dimensions.map((dim) => (
                  <div
                    key={dim.key}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-300">
                        {language === 'ar' ? dim.labelAr : dim.label}
                      </span>
                      <div className="flex items-center gap-1">
                        <TrendIcon trend={(dim as any).trend} />
                        <span
                          className="text-xs font-mono font-bold"
                          style={{ color: pressureColor(dim.pressure) }}
                        >
                          {dim.pressure}%
                        </span>
                      </div>
                    </div>
                    {/* Pressure bar */}
                    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${pressureBarGradient(dim.pressure)} transition-all duration-700`}
                        style={{ width: `${Math.min(dim.pressure, 100)}%` }}
                      />
                    </div>
                    {/* Drivers */}
                    <div className="flex flex-wrap gap-1">
                      {(dim as any).drivers.slice(0, 2).map((d, i) => (
                        <span
                          key={i}
                          className="text-[10px] text-slate-500 bg-white/[0.03] border border-white/[0.05] rounded px-1.5 py-0.5"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 flex items-center gap-3"
      style={{ animation: 'networkPulse 4s ease-in-out infinite' }}
    >
      <div
        className="p-2 rounded-lg"
        style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold tabular-nums" style={{ color: accent }}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hospital Card
// ---------------------------------------------------------------------------

function HospitalCard({
  hospital,
  language,
  tr,
}: {
  hospital: any;
  language: string;
  tr: (ar: string, en: string) => string;
}) {
  const status = hospital.status || 'OPERATIONAL';
  const isCritical = status === 'CRITICAL';
  const color = statusColor(status);
  const pressureVal = hospital.pressure ?? hospital.operationalPressure ?? 0;
  const activeSignals = hospital.activeSignals ?? hospital.signals?.length ?? 0;
  const decisionsToday = hospital.decisionsToday ?? hospital.decisions?.length ?? 0;
  const nameEn = hospital.name || hospital.nameEn || `Hospital`;
  const nameAr = hospital.nameAr || hospital.name || nameEn;
  const cityEn = hospital.city || hospital.cityEn || '';
  const cityAr = hospital.cityAr || hospital.city || cityEn;

  return (
    <div
      className="group rounded-xl border bg-white/[0.02] backdrop-blur-sm p-4 space-y-3 transition-all duration-300 hover:bg-white/[0.04] cursor-pointer"
      style={{
        borderColor: isCritical ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.06)',
        animation: isCritical ? 'criticalBorder 2s ease-in-out infinite' : undefined,
      }}
    >
      {/* Top row: name + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">
            {language === 'ar' ? nameAr : nameEn}
          </h3>
          {(cityEn || cityAr) && (
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {language === 'ar' ? cityAr : cityEn}
            </p>
          )}
        </div>
        {/* Status badge */}
        <span
          className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border"
          style={{
            color,
            borderColor: `${color}40`,
            background: `${color}15`,
          }}
        >
          {status === 'OPERATIONAL'
            ? tr('تشغيلي', 'OK')
            : status === 'ELEVATED'
              ? tr('مرتفع', 'ELEVATED')
              : status === 'HIGH_PRESSURE'
                ? tr('ضغط عالي', 'HIGH')
                : tr('حرج', 'CRITICAL')}
        </span>
      </div>

      {/* Pressure bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
            {tr('الضغط', 'Pressure')}
          </span>
          <span
            className="text-[11px] font-mono font-bold"
            style={{ color: pressureColor(pressureVal) }}
          >
            {pressureVal}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${pressureBarGradient(pressureVal)} transition-all duration-700`}
            style={{ width: `${Math.min(pressureVal, 100)}%` }}
          />
        </div>
      </div>

      {/* Bottom stats */}
      <div className="flex items-center gap-4 pt-1 border-t border-white/[0.04]">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-cyan-500/70" />
          <span className="text-[11px] text-slate-400 tabular-nums">
            {activeSignals} {tr('إشارات', 'signals')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-amber-500/70" />
          <span className="text-[11px] text-slate-400 tabular-nums">
            {decisionsToday} {tr('قرارات', 'decisions')}
          </span>
        </div>
      </div>
    </div>
  );
}
