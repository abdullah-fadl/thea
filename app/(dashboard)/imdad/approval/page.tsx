'use client';

import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

export default function ApprovalPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const brain = useImdadBrain();

  const pendingDecisions = brain.decisions.filter((d: any) => d.status === 'PENDING_REVIEW');
  const approvedDecisions = brain.decisions.filter((d: any) => d.status === 'APPROVED' || d.status === 'AUTO_APPROVED');
  const rejectedDecisions = brain.decisions.filter((d: any) => d.status === 'REJECTED');

  const fmt = (n: number | null | undefined) =>
    n != null ? new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(Number(n)) : '-';

  return (
    <div className="min-h-screen bg-[#050a18] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {tr('الموافقات', 'Approvals')}
            </h1>
            <p className="text-xs text-gray-500 mt-1">{tr('القرارات المعلقة وسلاسل الموافقة', 'Pending decisions and approval chains')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500 font-mono">{tr('دورة', 'CYCLE')} #{brain.cycleCount}</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-amber-500/20 p-4 text-center">
            <p className="text-2xl font-bold font-mono text-amber-400">{pendingDecisions.length}</p>
            <p className="text-[10px] text-gray-500 mt-1">{tr('قيد المراجعة', 'Pending Review')}</p>
          </div>
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-emerald-500/20 p-4 text-center">
            <p className="text-2xl font-bold font-mono text-emerald-400">{approvedDecisions.length}</p>
            <p className="text-[10px] text-gray-500 mt-1">{tr('معتمد', 'Approved')}</p>
          </div>
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-red-500/20 p-4 text-center">
            <p className="text-2xl font-bold font-mono text-red-400">{rejectedDecisions.length}</p>
            <p className="text-[10px] text-gray-500 mt-1">{tr('مرفوض', 'Rejected')}</p>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-amber-400 mb-4">{tr('بانتظار الموافقة', 'Awaiting Approval')}</h2>
          {pendingDecisions.length > 0 ? (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {pendingDecisions.map((d: any, i: number) => (
                <div key={d.id || i} className="py-3 px-4 rounded-lg bg-white/[0.02] border border-amber-500/10 hover:border-amber-500/30 transition">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-gray-200">{language === 'ar' ? (d.titleAr || d.title) : d.title}</p>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {tr('قيد المراجعة', 'PENDING')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span>{d.decisionCode}</span>
                    <span>{d.decisionType}</span>
                    {d.costImpact && <span>{fmt(d.costImpact)}</span>}
                    {d.confidenceScore && <span>{tr('ثقة', 'Confidence')}: {d.confidenceScore}%</span>}
                  </div>
                  {d.escalationLevel && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-gray-600">{tr('مستوى التصعيد', 'Escalation')}:</span>
                      <span className="text-[10px] text-cyan-400 font-mono">{d.escalationLevel}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {tr('النظام يراقب — لا تنبيهات نشطة', 'System monitoring — no active alerts')}
            </div>
          )}
        </div>

        {/* Recent Approved */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-emerald-400 mb-4">{tr('الموافقات الأخيرة', 'Recent Approvals')}</h2>
          {approvedDecisions.length > 0 ? (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {approvedDecisions.slice(0, 8).map((d: any, i: number) => (
                <div key={d.id || i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div>
                    <p className="text-xs text-gray-300">{language === 'ar' ? (d.titleAr || d.title) : d.title}</p>
                    <p className="text-[10px] text-gray-500">{d.decisionCode}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] ${d.autoApproved ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {d.autoApproved ? tr('تلقائي', 'AUTO') : tr('معتمد', 'APPROVED')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {tr('النظام يراقب — لا تنبيهات نشطة', 'System monitoring — no active alerts')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
