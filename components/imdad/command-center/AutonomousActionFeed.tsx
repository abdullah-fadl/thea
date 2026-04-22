'use client';

import { useLang } from '@/hooks/use-lang';
import { Zap, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

interface Action {
  id?: string;
  code?: string;
  title?: string;
  titleAr?: string;
  type?: string;
  status?: string;
  hospitalName?: string;
  hospitalNameAr?: string;
  executedAt?: string;
  result?: string;
  resultAr?: string;
  confidence?: number;
}

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  COMPLETED: CheckCircle2,
  SUCCESS: CheckCircle2,
  FAILED: AlertTriangle,
  PENDING: Clock,
  EXECUTING: Zap,
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'text-emerald-400',
  SUCCESS: 'text-emerald-400',
  FAILED: 'text-red-400',
  PENDING: 'text-amber-400',
  EXECUTING: 'text-cyan-400',
};

export function AutonomousActionFeed({ actions }: { actions: Action[] }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const sorted = [...actions].reverse().slice(0, 15);

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 h-full flex flex-col"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Zap className="h-4 w-4 text-cyan-400" />
          {tr('الإجراءات التلقائية', 'Autonomous Actions')}
        </h3>
        <span className="text-[10px] text-white/30 font-mono">
          {actions.length} {tr('إجراء', 'actions')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto command-scroll space-y-2 max-h-[400px]">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-white/20 text-xs">
            {tr('لا توجد إجراءات بعد', 'No actions yet')}
          </div>
        ) : (
          sorted.map((action, i) => {
            const IconComp = STATUS_ICON[action.status || ''] || Clock;
            const colorCls = STATUS_COLOR[action.status || ''] || 'text-gray-400';

            return (
              <div
                key={action.id || action.code || i}
                className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <IconComp className={`h-4 w-4 mt-0.5 shrink-0 ${colorCls}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/80 truncate">
                      {language === 'ar' && action.titleAr ? action.titleAr : action.title || tr('إجراء تلقائي', 'Autonomous Action')}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {action.type && (
                        <span className="text-[10px] text-white/30 bg-white/[0.04] rounded px-1.5 py-0.5">
                          {action.type.replace(/_/g, ' ')}
                        </span>
                      )}
                      {action.hospitalName && (
                        <span className="text-[10px] text-white/25">
                          {language === 'ar' && action.hospitalNameAr ? action.hospitalNameAr : action.hospitalName}
                        </span>
                      )}
                    </div>
                    {(action.result || action.resultAr) && (
                      <p className="text-[10px] text-white/30 mt-1 truncate">
                        {language === 'ar' && action.resultAr ? action.resultAr : action.result}
                      </p>
                    )}
                  </div>
                  {action.confidence != null && (
                    <span className="text-[10px] font-mono text-cyan-400/50 shrink-0">
                      {action.confidence}%
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
