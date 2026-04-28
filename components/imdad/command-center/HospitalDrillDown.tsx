'use client';

import { useLang } from '@/hooks/use-lang';
import { ArrowLeft, ArrowRight, Building2, Activity, Brain, Zap } from 'lucide-react';

interface HospitalDrillDownProps {
  hospitalId: string;
  hospitalName: string;
  hospital: {
    id: string;
    name: string;
    nameAr: string;
    pressure: number;
    status: string;
    healthScore?: number;
    city?: string;
    cityAr?: string;
    beds?: number;
    [key: string]: any;
  };
  decisions: any[];
  actions: any[];
  pressure: any;
  onBack: () => void;
}

export function HospitalDrillDown({
  hospitalId,
  hospitalName,
  hospital,
  decisions,
  actions,
  pressure,
  onBack,
}: HospitalDrillDownProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isRtl = language === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const pressureColor = hospital.pressure >= 70 ? '#ef4444' : hospital.pressure >= 40 ? '#f59e0b' : '#22c55e';
  const statusLabel = hospital.pressure >= 70
    ? tr('حرج', 'Critical')
    : hospital.pressure >= 40
      ? tr('تحذير', 'Warning')
      : tr('طبيعي', 'Normal');

  return (
    <div className="min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-black/40 backdrop-blur-xl px-4 py-4 md:px-6">
        <div className="mx-auto max-w-[1800px]">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
            >
              <BackIcon className="h-4 w-4" />
              {tr('العودة للشبكة', 'Back to Network')}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white/90">{hospitalName}</h1>
                <p className="text-[10px] text-white/40">
                  {hospital.city || ''} | ID: {hospitalId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold font-mono" style={{ color: pressureColor }}>
                  {hospital.pressure}%
                </p>
                <p className="text-[10px] text-white/40">{tr('الضغط', 'Pressure')}</p>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium border"
                style={{
                  color: pressureColor,
                  borderColor: `${pressureColor}40`,
                  backgroundColor: `${pressureColor}15`,
                }}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-[1800px] px-4 py-6 md:px-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Activity, labelAr: 'صحة النظام', labelEn: 'Health Score', value: `${hospital.healthScore ?? '--'}%`, color: '#22c55e' },
            { icon: Brain, labelAr: 'القرارات', labelEn: 'Decisions', value: String(decisions.length), color: '#8b5cf6' },
            { icon: Zap, labelAr: 'الإجراءات', labelEn: 'Actions', value: String(actions.length), color: '#06b6d4' },
            { icon: Building2, labelAr: 'الأسرّة', labelEn: 'Beds', value: String(hospital.beds ?? '--'), color: '#3b82f6' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.labelEn} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4" style={{ color: stat.color }} />
                  <span className="text-[10px] text-white/40">{tr(stat.labelAr, stat.labelEn)}</span>
                </div>
                <p className="text-xl font-bold font-mono" style={{ color: stat.color }}>
                  {stat.value}
                </p>
              </div>
            );
          })}
        </div>

        {/* Decisions list */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-400" />
            {tr('القرارات', 'Decisions')}
          </h3>
          {decisions.length === 0 ? (
            <p className="text-xs text-white/20 py-6 text-center">
              {tr('لا توجد قرارات لهذا المستشفى', 'No decisions for this hospital')}
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto command-scroll">
              {decisions.map((d: any, i: number) => (
                <div key={d.id || i} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      {d.code && <span className="font-mono text-[10px] text-cyan-400/80 me-2">{d.code}</span>}
                      <span className="text-xs text-white/80">
                        {isRtl && d.titleAr ? d.titleAr : d.title || '---'}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/30 bg-white/[0.04] rounded px-1.5 py-0.5 shrink-0 ms-2">
                      {d.status?.replace(/_/g, ' ') || 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions list */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-400" />
            {tr('الإجراءات التلقائية', 'Autonomous Actions')}
          </h3>
          {actions.length === 0 ? (
            <p className="text-xs text-white/20 py-6 text-center">
              {tr('لا توجد إجراءات', 'No actions')}
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto command-scroll">
              {actions.map((a: any, i: number) => (
                <div key={a.id || i} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                  <p className="text-xs text-white/80">
                    {isRtl && a.titleAr ? a.titleAr : a.title || tr('إجراء', 'Action')}
                  </p>
                  <p className="text-[10px] text-white/30 mt-1">{a.type?.replace(/_/g, ' ') || ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
