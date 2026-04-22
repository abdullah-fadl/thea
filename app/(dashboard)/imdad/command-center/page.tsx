'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';
import {
  ArrowDown,
  ArrowUp,
  Brain,
  Gauge,
  Heart,
  Minus,
  Radio,
} from 'lucide-react';

// Components
import { GlobalNetworkView } from '@/components/imdad/command-center/GlobalNetworkView';
import { LiveDecisionStream } from '@/components/imdad/command-center/LiveDecisionStream';
import { RiskRadar } from '@/components/imdad/command-center/RiskRadar';
import { SystemPulse } from '@/components/imdad/command-center/SystemPulse';
import { AutonomousActionFeed } from '@/components/imdad/command-center/AutonomousActionFeed';
import { HospitalDrillDown } from '@/components/imdad/command-center/HospitalDrillDown';
import { CEOImpactStrip } from '@/components/imdad/command-center/CEOImpactStrip';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// IMDAD CINEMATIC COMMAND CENTER — VISUAL DOMINANCE MODE
// Focus Master + Pressure Wave + Background Intelligence + Particle System
// ---------------------------------------------------------------------------

const KEYFRAMES = `
@keyframes scanLine { 0% { top: -2px; } 100% { top: 100vh; } }
@keyframes sweep { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 4px 2px rgba(34,197,94,0.4); } 50% { box-shadow: 0 0 12px 6px rgba(34,197,94,0.7); } }
@keyframes pulse-glow-red { 0%, 100% { box-shadow: 0 0 4px 2px rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 14px 8px rgba(239,68,68,0.7); } }
@keyframes slideInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes gradientDrift {
  0% { background-position: 0% 50%; }
  25% { background-position: 100% 25%; }
  50% { background-position: 50% 100%; }
  75% { background-position: 0% 75%; }
  100% { background-position: 0% 50%; }
}
@keyframes pressureWave {
  0% { transform: translateX(-100%) scaleY(1); opacity: 0; }
  20% { opacity: 0.15; }
  80% { opacity: 0.15; }
  100% { transform: translateX(200%) scaleY(1.5); opacity: 0; }
}
@keyframes particleFloat {
  0% { transform: translateY(100vh) translateX(0) scale(0); opacity: 0; }
  10% { opacity: 1; scale: 1; }
  90% { opacity: 0.6; }
  100% { transform: translateY(-20px) translateX(var(--drift)) scale(0.3); opacity: 0; }
}
@keyframes focusPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(6,182,212,0.15); }
  50% { box-shadow: 0 0 40px rgba(6,182,212,0.3), 0 0 60px rgba(6,182,212,0.1); }
}
`;

function healthColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

function healthBg(score: number): string {
  if (score >= 80) return 'from-emerald-500/10 to-emerald-500/5';
  if (score >= 60) return 'from-amber-500/10 to-amber-500/5';
  return 'from-red-500/10 to-red-500/5';
}

function TrendArrow({ dir }: { dir: string }) {
  if (dir === 'up' || dir === 'improving' || dir === 'rising') return <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />;
  if (dir === 'down' || dir === 'degrading' || dir === 'falling') return <ArrowDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}

function ArcGauge({ value, size = 160, strokeWidth = 12 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = healthColor(value);

  return (
    <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`} className="drop-shadow-lg">
      <path d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`} fill="none" stroke="#1f2937" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" style={{ filter: `drop-shadow(0 0 6px ${color}60)` }} />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="fill-white" style={{ fontSize: '2rem', fontWeight: 800 }}>{value}</text>
      <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="fill-gray-400" style={{ fontSize: '0.65rem' }}>/ 100</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Particle System — floating particles that react to pressure
// ---------------------------------------------------------------------------
function ParticleField({ pressure }: { pressure: number }) {
  const particleCount = pressure >= 70 ? 12 : pressure >= 40 ? 8 : 5;
  const particles = useMemo(() =>
    Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      left: `${5 + (i * 97) / particleCount}%`,
      delay: `${(i * 4.2) % 12}s`,
      duration: `${8 + (i % 5) * 3}s`,
      size: pressure >= 60 ? 2 + (i % 3) : 1.5,
      drift: `${-30 + (i * 17) % 60}px`,
      color: pressure >= 70 ? 'rgba(239,68,68,0.4)' : pressure >= 40 ? 'rgba(245,158,11,0.3)' : 'rgba(6,182,212,0.25)',
    })),
  [particleCount, pressure]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animation: `particleFloat ${p.duration} ease-in-out ${p.delay} infinite`,
            ['--drift' as string]: p.drift,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Focus Alert Bar — shows the most critical item
// ---------------------------------------------------------------------------
function FocusAlertBar({
  hospital,
  decision,
  tr,
  language,
}: {
  hospital: { name: string; nameAr: string; pressure: number; status: string } | null;
  decision: { title: string; titleAr: string; riskScore: number; decisionType: string; code: string } | null;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  if (!hospital && !decision) return null;

  return (
    <div
      className="relative z-10 border-b border-red-500/20 bg-gradient-to-r from-red-500/[0.06] via-transparent to-red-500/[0.06] overflow-hidden"
      style={{ animation: 'focusPulse 3s ease-in-out infinite' }}
    >
      <div className="mx-auto max-w-[1800px] px-4 py-2 md:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Pulsing attention dot */}
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-red-400/80 font-mono font-bold">
            {tr('تركيز النظام', 'SYSTEM FOCUS')}
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs">
          {hospital && (
            <div className="flex items-center gap-2">
              <span className="text-red-400/60">{tr('أعلى ضغط', 'Highest Pressure')}:</span>
              <span className="text-white/90 font-medium">
                {language === 'ar' ? hospital.nameAr : hospital.name}
              </span>
              <span className="text-red-400 font-mono font-bold">{hospital.pressure}%</span>
            </div>
          )}
          {decision && (
            <div className="flex items-center gap-2">
              <span className="text-orange-400/60">{tr('أخطر قرار', 'Critical Decision')}:</span>
              <span className="text-cyan-400 font-mono text-[10px]">{decision.code}</span>
              <span className="text-white/80 truncate max-w-[200px]">
                {language === 'ar' ? decision.titleAr : decision.title}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal sweep */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.06), transparent)',
          backgroundSize: '200% 100%',
          animation: 'sweep 4s linear infinite',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ImdadCinematicCommandCenter() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const stylesInjected = useRef(false);

  const sim = useImdadBrain();
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);

  // Inject keyframes
  useEffect(() => {
    if (stylesInjected.current) return;
    stylesInjected.current = true;
    const style = document.createElement('style');
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // --- Focus Master: detect most critical hospital + decision ---
  const focusHospital = useMemo(() => {
    if (sim.hospitals.length === 0) return null;
    return sim.hospitals.reduce((max, h) => h.pressure > max.pressure ? h : max, sim.hospitals[0]);
  }, [sim.hospitals]);

  const focusDecision = useMemo(() => {
    if (sim.decisions.length === 0) return null;
    return sim.decisions.reduce((max, d) => (d.riskScore ?? 0) > (max.riskScore ?? 0) ? d : max, sim.decisions[0]);
  }, [sim.decisions]);

  const hasCriticalFocus = (focusHospital?.pressure ?? 0) >= 70 || (focusDecision?.riskScore ?? 0) >= 70;

  // Drill-down — passes live simulation data, never fetches from API
  if (selectedHospital) {
    const hospital = sim.hospitals.find((h) => h.id === selectedHospital);
    if (hospital) {
      // Filter decisions/actions for this hospital
      const hospitalDecisions = sim.decisions.filter(
        (d) => d.hospitalName === hospital.name || d.hospitalNameAr === hospital.nameAr
      );
      const hospitalActions = sim.actions.filter(
        (a) => a.hospitalName === hospital.name || a.hospitalNameAr === hospital.nameAr
      );
      return (
        <div className="min-h-screen bg-[#050a18] text-white">
          <HospitalDrillDown
            hospitalId={selectedHospital}
            hospitalName={language === 'ar' ? hospital.nameAr : hospital.name}
            hospital={hospital}
            decisions={hospitalDecisions}
            actions={hospitalActions}
            pressure={sim.pressure}
            onBack={() => setSelectedHospital(null)}
          />
        </div>
      );
    }
  }

  const isUnderPressure = sim.pulse.healthScore < 60 || sim.pulse.operationalPressure > 75;
  const pressureLevel = sim.pulse.operationalPressure;

  // Ambient glow color shifts with pressure
  const ambientColor = pressureLevel >= 75 ? 'rgba(239,68,68,0.12)'
    : pressureLevel >= 55 ? 'rgba(249,115,22,0.08)'
    : pressureLevel >= 35 ? 'rgba(245,158,11,0.05)'
    : 'rgba(6,182,212,0.03)';

  const scanSpeed = pressureLevel >= 75 ? '3s' : pressureLevel >= 55 ? '5s' : '8s';
  const gridOpacity = pressureLevel >= 75 ? '0.06' : pressureLevel >= 55 ? '0.04' : '0.03';

  // Gradient drift speed scales with pressure
  const gradientSpeed = pressureLevel >= 70 ? '8s' : pressureLevel >= 40 ? '15s' : '25s';

  const healthIndicators = [
    { labelAr: 'صحة النظام', labelEn: 'System Health', value: sim.pulse.healthScore, trend: sim.pulse.trend, icon: Heart },
    { labelAr: 'الضغط التشغيلي', labelEn: 'Op. Pressure', value: sim.pulse.operationalPressure, trend: 'stable', icon: Gauge, inverted: true },
    { labelAr: 'الإشارات النشطة', labelEn: 'Active Signals', value: sim.pulse.activeSignals, trend: 'stable', icon: Radio, isCount: true },
    { labelAr: 'الاستقلالية', labelEn: 'Autonomy', value: sim.pulse.autonomyScore, trend: 'stable', icon: Brain },
  ];

  return (
    <div className="min-h-screen bg-[#050a18] text-white overflow-hidden relative" dir={language === 'ar' ? 'rtl' : 'ltr'}>

      {/* ============================================================== */}
      {/* BACKGROUND INTELLIGENCE LAYER                                  */}
      {/* ============================================================== */}

      {/* Living gradient background — drifts slowly, color reacts to pressure */}
      <div
        className="fixed inset-0 pointer-events-none transition-all duration-2000"
        style={{
          background: pressureLevel >= 70
            ? 'radial-gradient(ellipse at 30% 20%, rgba(239,68,68,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(249,115,22,0.05) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(6,182,212,0.02) 0%, transparent 70%)'
            : pressureLevel >= 40
              ? 'radial-gradient(ellipse at 30% 20%, rgba(245,158,11,0.04) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(6,182,212,0.03) 0%, transparent 50%)'
              : 'radial-gradient(ellipse at 30% 20%, rgba(6,182,212,0.03) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.02) 0%, transparent 50%)',
          backgroundSize: '200% 200%',
          animation: `gradientDrift ${gradientSpeed} ease-in-out infinite`,
        }}
      />

      {/* Ambient Pressure Overlay */}
      <div
        className="fixed inset-0 pointer-events-none transition-all duration-2000"
        style={{ boxShadow: `inset 0 0 150px 40px ${ambientColor}` }}
      />

      {/* Particle Field */}
      <ParticleField pressure={pressureLevel} />

      {/* Background Grid */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          opacity: gridOpacity,
          backgroundImage: 'linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Scan Line */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute left-0 right-0 h-[2px] opacity-10"
          style={{
            background: `linear-gradient(90deg, transparent, ${isUnderPressure ? '#ef4444' : '#00ffff'}, transparent)`,
            animation: `scanLine ${scanSpeed} linear infinite`,
          }}
        />
      </div>

      {/* Pressure Wave — horizontal wave that sweeps across screen */}
      {pressureLevel >= 30 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
          <div
            className="absolute inset-y-0 w-[300px]"
            style={{
              background: `linear-gradient(90deg, transparent, ${
                pressureLevel >= 70 ? 'rgba(239,68,68,0.08)' : pressureLevel >= 50 ? 'rgba(245,158,11,0.05)' : 'rgba(6,182,212,0.04)'
              }, transparent)`,
              animation: `pressureWave ${pressureLevel >= 70 ? '4s' : pressureLevel >= 50 ? '7s' : '12s'} ease-in-out infinite`,
            }}
          />
        </div>
      )}

      {/* Pressure vignette */}
      {pressureLevel >= 70 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(239,68,68,0.08) 100%)',
            animation: 'pulse-glow-red 4s ease-in-out infinite',
          }}
        />
      )}

      {/* ============================================================== */}
      {/* SCENARIO PHASE INDICATOR                                       */}
      {/* ============================================================== */}
      <div className="relative z-20 border-b border-white/[0.04] bg-black/40 backdrop-blur-sm">
        <div className="mx-auto max-w-[1800px] px-6 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(['GLOBAL_STATE', 'CRITICAL_ESCALATION', 'SIGNAL_DETECTION', 'AUTONOMOUS_ACTION', 'SYSTEM_RESPONSE', 'IMPACT_DISPLAY'] as const).map((p, i) => {
              const isActive = sim.phase === p;
              const isPast = (['GLOBAL_STATE', 'CRITICAL_ESCALATION', 'SIGNAL_DETECTION', 'AUTONOMOUS_ACTION', 'SYSTEM_RESPONSE', 'IMPACT_DISPLAY'] as const).indexOf(sim.phase) > i;
              const colors: Record<string, string> = {
                GLOBAL_STATE: '#10b981',
                CRITICAL_ESCALATION: '#ef4444',
                SIGNAL_DETECTION: '#f59e0b',
                AUTONOMOUS_ACTION: '#06b6d4',
                SYSTEM_RESPONSE: '#22c55e',
                IMPACT_DISPLAY: '#8b5cf6',
              };
              const labels: Record<string, [string, string]> = {
                GLOBAL_STATE: ['مراقبة', 'Monitor'],
                CRITICAL_ESCALATION: ['تصعيد', 'Escalate'],
                SIGNAL_DETECTION: ['كشف', 'Detect'],
                AUTONOMOUS_ACTION: ['تنفيذ', 'Execute'],
                SYSTEM_RESPONSE: ['استجابة', 'Respond'],
                IMPACT_DISPLAY: ['تأثير', 'Impact'],
              };
              return (
                <div key={p} className="flex items-center gap-1.5">
                  <div
                    className="h-1.5 w-1.5 rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: isActive || isPast ? colors[p] : '#374151',
                      boxShadow: isActive ? `0 0 8px ${colors[p]}` : 'none',
                      transform: isActive ? 'scale(1.5)' : 'scale(1)',
                    }}
                  />
                  <span
                    className="text-[9px] font-mono uppercase tracking-wider transition-colors duration-300"
                    style={{ color: isActive ? colors[p] : isPast ? `${colors[p]}80` : '#4b5563' }}
                  >
                    {tr(labels[p][0], labels[p][1])}
                  </span>
                  {i < 5 && <span className="text-gray-700 text-[8px] mx-1">→</span>}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1 w-24 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${(sim.scenarioTime / 30) * 100}%`,
                  background: sim.phase === 'CRITICAL_ESCALATION' || sim.phase === 'SIGNAL_DETECTION'
                    ? 'linear-gradient(90deg, #ef4444, #f59e0b)'
                    : sim.phase === 'SYSTEM_RESPONSE' || sim.phase === 'IMPACT_DISPLAY'
                      ? 'linear-gradient(90deg, #22c55e, #10b981)'
                      : 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                }}
              />
            </div>
            <span className="text-[9px] font-mono text-gray-600">{sim.scenarioTime}s / 30s</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* FOCUS ALERT BAR — shows highest priority items                  */}
      {/* ============================================================== */}
      {hasCriticalFocus && (
        <FocusAlertBar
          hospital={focusHospital}
          decision={focusDecision}
          tr={tr}
          language={language}
        />
      )}

      {/* ============================================================== */}
      {/* IMPACT OVERLAY — Phase 6 results                               */}
      {/* ============================================================== */}
      {sim.impact.visible && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="pointer-events-auto bg-black/80 backdrop-blur-2xl rounded-3xl border border-emerald-500/20 p-10 shadow-2xl shadow-emerald-500/10 max-w-lg w-full mx-4 text-center"
            style={{ animation: 'slideInUp 0.6s ease-out' }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              {tr('النظام استجاب بنجاح', 'System Responded Successfully')}
            </h2>
            <p className="text-sm text-emerald-400/70 mb-6">
              {tr('إجراءات تلقائية بدون تدخل بشري', 'Autonomous actions — zero human intervention')}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                <p className="text-2xl font-bold text-emerald-400 font-mono">
                  {(sim.impact.costSavings / 1_000_000).toFixed(1)}M
                </p>
                <p className="text-[10px] text-emerald-400/60 mt-1">{tr('ر.س توفير', 'SAR Saved')}</p>
              </div>
              <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/20">
                <p className="text-2xl font-bold text-cyan-400 font-mono">
                  {sim.impact.riskReduction}%
                </p>
                <p className="text-[10px] text-cyan-400/60 mt-1">{tr('تخفيض المخاطر', 'Risk Reduced')}</p>
              </div>
              <div className="bg-violet-500/10 rounded-xl p-4 border border-violet-500/20">
                <p className="text-2xl font-bold text-violet-400 font-mono">
                  {sim.impact.timeSavedHours}h
                </p>
                <p className="text-[10px] text-violet-400/60 mt-1">{tr('وقت محفوظ', 'Time Saved')}</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-600 mt-4 font-mono">
              {tr('يعاد التشغيل تلقائياً...', 'Auto-restarting scenario...')}
            </p>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TOP BAR                                                        */}
      {/* ============================================================== */}
      <header className="relative z-10 border-b border-cyan-500/20 bg-black/60 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,255,0.4), transparent)', backgroundSize: '200% 100%', animation: 'sweep 8s linear infinite' }} />

        <div className="relative mx-auto max-w-[1800px] px-4 py-4 md:px-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <span className="text-lg font-bold">إ</span>
                </div>
                <div
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#050a18]"
                  style={{
                    backgroundColor: isUnderPressure ? '#EF4444' : '#22c55e',
                    animation: isUnderPressure ? 'pulse-glow-red 2s ease-in-out infinite' : 'pulse-glow 2s ease-in-out infinite',
                  }}
                />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {tr('مركز القيادة — إمداد', 'IMDAD — Command Center')}
                </h1>
                <p className="text-[10px] text-cyan-500/60 tracking-[0.3em] uppercase">
                  {isUnderPressure
                    ? tr('النظام تحت ضغط — وضع التحكم النشط', 'System Under Pressure — Active Control Mode')
                    : tr('نظام التحكم التشغيلي المستقل', 'Autonomous Operational Control System')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => sim.setIsLive(!sim.isLive)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  sim.isLive
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-gray-800 text-gray-500 border border-gray-700',
                )}
              >
                <span className={cn('w-2 h-2 rounded-full', sim.isLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600')} />
                {sim.isLive ? tr('بث مباشر', 'LIVE') : tr('متوقف', 'PAUSED')}
              </button>

              <div className="text-xs text-gray-500 font-mono">
                {tr('دورة', 'CYCLE')} <span className="text-cyan-400">#{sim.cycleCount}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <Brain className="h-3.5 w-3.5 text-cyan-500/60" />
                <span className="text-cyan-400 font-mono font-bold">{sim.decisions.length}</span>
                <span className="text-gray-600">{tr('قرار', 'decisions')}</span>
              </div>

              <span className="text-[10px] text-gray-600 font-mono">
                {sim.lastRefresh.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Health indicators */}
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-end md:gap-8">
            <div className="flex flex-col items-center">
              <ArcGauge value={sim.pulse.healthScore} />
              <span className="mt-1 text-[10px] font-medium uppercase tracking-widest text-cyan-500/40">
                {tr('صحة النظام الكلية', 'Overall System Health')}
              </span>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
              {healthIndicators.map((ind) => {
                const Icon = ind.icon;
                const color = ind.isCount ? '#06b6d4' : ind.inverted ? healthColor(100 - ind.value) : healthColor(ind.value);
                return (
                  <div
                    key={ind.labelEn}
                    className={cn(
                      'rounded-lg border border-white/5 bg-gradient-to-b p-3 transition-all hover:border-cyan-500/20',
                      ind.isCount ? 'from-cyan-500/10 to-cyan-500/5' : ind.inverted ? healthBg(100 - ind.value) : healthBg(ind.value),
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="h-4 w-4 text-white/40" />
                      <TrendArrow dir={ind.trend} />
                    </div>
                    <p className="mt-2 text-2xl font-bold transition-all duration-500" style={{ color }}>
                      {ind.isCount ? ind.value : `${ind.value}%`}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/40">{tr(ind.labelAr, ind.labelEn)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* CEO IMPACT HERO — DOMINANT TOP LAYER                           */}
      {/* ============================================================== */}
      <div className="relative z-10">
        <CEOImpactStrip
          data={{
            totalLost: sim.decisions.filter((d: any) => d.type === 'EMERGENCY_PROCUREMENT').reduce((s: number, d: any) => s + ((d.financialImpact?.estimatedCost ?? 0) * 0.2), 0),
            totalSaved: sim.decisions.filter((d: any) => d.status === 'COMPLETED').reduce((s: number, d: any) => s + (d.financialImpact?.avoidedLoss ?? 0), 0),
            netImpact: sim.decisions.filter((d: any) => d.status === 'COMPLETED').reduce((s: number, d: any) => s + (d.financialImpact?.netImpact ?? 0), 0),
            trend: sim.pulse.trend,
            topLosses: sim.decisions
              .filter((d: any) => d.type === 'EMERGENCY_PROCUREMENT' && d.financialImpact)
              .slice(-3).reverse()
              .map((d: any) => ({ hospitalName: d.hospitalName ?? '', hospitalNameAr: d.hospitalNameAr ?? '', domain: d.domain ?? '', value: (d.financialImpact?.estimatedCost ?? 0) * 0.2, cause: 'EMERGENCY_PRICING', description: d.title ?? '', descriptionAr: d.titleAr ?? '' })),
            topSavings: sim.decisions
              .filter((d: any) => d.status === 'COMPLETED' && (d.financialImpact?.avoidedLoss ?? 0) > 0)
              .slice(-3).reverse()
              .map((d: any) => ({ hospitalName: d.hospitalName ?? '', hospitalNameAr: d.hospitalNameAr ?? '', domain: d.domain ?? '', value: d.financialImpact?.avoidedLoss ?? 0, description: d.title ?? '', descriptionAr: d.titleAr ?? '' })),
            totalDailyRevenue: 0,
            missedRevenue: 0,
            downtimeLoss: 0,
            avgUtilization: 0,
            topOpportunities: [],
            worstHospital: focusHospital ? { name: focusHospital.name, nameAr: focusHospital.nameAr, pressure: focusHospital.pressure } : null,
            responsibleRole: focusHospital && focusHospital.pressure >= 70 ? 'GENERAL_DIRECTOR' : 'COO_GROUP',
          }}
        />
      </div>

      {/* ============================================================== */}
      {/* MAIN GRID                                                      */}
      {/* ============================================================== */}
      <main className="relative z-10 mx-auto max-w-[1800px] px-4 py-5 md:px-6 space-y-5">
        {/* Row 1: Pulse + Radar + Decisions */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3">
            <SystemPulse pulse={sim.pulse} />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <RiskRadar pressureData={sim.pressure} />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <LiveDecisionStream decisions={sim.decisions} />
          </div>
        </div>

        {/* Row 2: Network + Action Feed */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <GlobalNetworkView
              hospitals={sim.hospitals}
              onSelectHospital={(id) => setSelectedHospital(id)}
            />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <AutonomousActionFeed actions={sim.actions} />
          </div>
        </div>
      </main>

      {/* Scrollbar styles */}
      <style jsx global>{`
        .command-scroll::-webkit-scrollbar { width: 4px; }
        .command-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
        .command-scroll::-webkit-scrollbar-thumb { background: rgba(0,255,255,0.3); border-radius: 2px; }
        .command-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,255,255,0.5); }
      `}</style>
    </div>
  );
}
