'use client';

import { useLang } from '@/hooks/use-lang';
import { Brain, ChevronRight } from 'lucide-react';

interface Decision {
  id?: string;
  code?: string;
  title: string;
  titleAr?: string;
  type: string;
  status: string;
  riskScore?: number;
  confidenceScore?: number;
  hospitalName?: string;
  hospitalNameAr?: string;
  domain?: string;
  createdAt?: string;
  financialImpact?: {
    estimatedCost?: number;
    avoidedLoss?: number;
    netImpact?: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  AUTO_APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  COMPLETED: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
  EXECUTING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export function LiveDecisionStream({ decisions }: { decisions: Decision[] }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const sorted = [...decisions].reverse().slice(0, 12);

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 h-full flex flex-col"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-400" />
          {tr('تيار القرارات المباشر', 'Live Decision Stream')}
        </h3>
        <span className="text-[10px] text-white/30 font-mono">
          {decisions.length} {tr('قرار', 'decisions')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto command-scroll space-y-2 max-h-[360px]">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-white/20 text-xs">
            {tr('بانتظار القرارات...', 'Awaiting decisions...')}
          </div>
        ) : (
          sorted.map((d, i) => {
            const statusCls = STATUS_COLORS[d.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            return (
              <div
                key={d.id || d.code || i}
                className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 hover:bg-white/[0.05] transition-colors cursor-pointer group"
                style={{ animation: `slideInUp 0.3s ease-out ${i * 0.05}s both` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {d.code && (
                        <span className="font-mono text-[10px] text-cyan-400/80">{d.code}</span>
                      )}
                      <span className="text-[10px] text-white/30 bg-white/[0.04] rounded px-1.5 py-0.5">
                        {d.type?.replace(/_/g, ' ') || 'DECISION'}
                      </span>
                    </div>
                    <p className="text-xs text-white/80 truncate">
                      {language === 'ar' && d.titleAr ? d.titleAr : d.title}
                    </p>
                    {d.hospitalName && (
                      <p className="text-[10px] text-white/30 mt-0.5">
                        {language === 'ar' && d.hospitalNameAr ? d.hospitalNameAr : d.hospitalName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusCls}`}>
                      {d.status?.replace(/_/g, ' ')}
                    </span>
                    {d.financialImpact?.estimatedCost != null && (
                      <span className="text-[10px] font-mono text-white/30">
                        {(d.financialImpact.estimatedCost / 1000).toFixed(0)}K SAR
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  {d.confidenceScore != null && (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-white/20">{tr('ثقة', 'Conf.')}</span>
                      <span className="text-[10px] font-mono text-cyan-400/60">{d.confidenceScore}%</span>
                    </div>
                  )}
                  <ChevronRight className="h-3 w-3 text-white/10 group-hover:text-white/30 transition-colors" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
