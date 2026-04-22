'use client';

import { useLang } from '@/hooks/use-lang';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface DecisionDetailDrawerProps {
  decision: any;
  onClose: () => void;
}

export function DecisionDetailDrawer({ decision, onClose }: DecisionDetailDrawerProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isRtl = language === 'ar';

  if (!decision) return null;

  const isPending = decision.status === 'PENDING_REVIEW' || decision.status === 'PENDING';
  const isApproved = decision.status === 'APPROVED' || decision.status === 'COMPLETED' || decision.status === 'AUTO_APPROVED';
  const isRejected = decision.status === 'REJECTED';

  const statusCls = isApproved
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : isRejected
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

  const fmtDate = (d: any) => {
    if (!d) return '---';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const fmtSAR = (v: number | undefined) => {
    if (v == null) return '---';
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M SAR`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K SAR`;
    return `${v.toFixed(0)} SAR`;
  };

  const chain: any[] = decision.approvalChain || [];

  const fields = [
    { labelAr: 'الرمز', labelEn: 'Code', value: decision.code || '---' },
    { labelAr: 'النوع', labelEn: 'Type', value: decision.type?.replace(/_/g, ' ') || '---' },
    { labelAr: 'المستشفى', labelEn: 'Hospital', value: isRtl && decision.hospitalNameAr ? decision.hospitalNameAr : decision.hospitalName || '---' },
    { labelAr: 'تاريخ التقديم', labelEn: 'Submitted', value: fmtDate(decision.createdAt) },
    { labelAr: 'الثقة', labelEn: 'Confidence', value: decision.confidenceScore ? `${decision.confidenceScore}%` : '---' },
    { labelAr: 'المخاطر', labelEn: 'Risk Score', value: decision.riskScore ? `${decision.riskScore}%` : '---' },
  ];

  const fi = decision.financialImpact;

  return (
    <Sheet open={!!decision} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side={isRtl ? 'left' : 'right'}
        className="w-full sm:max-w-md bg-[#0a1628] border-white/10 text-white"
      >
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-3 flex-wrap">
            <span className="truncate">
              {isRtl && decision.titleAr ? decision.titleAr : decision.title || 'Decision'}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold shrink-0 ${statusCls}`}>
              {decision.status?.replace(/_/g, ' ') || 'N/A'}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
          {fields.map((f) => (
            <div key={f.labelEn} className="flex justify-between border-b border-white/[0.06] pb-2">
              <span className="text-sm text-white/40">{tr(f.labelAr, f.labelEn)}</span>
              <span className="text-sm font-medium text-white/80">{f.value}</span>
            </div>
          ))}

          {/* Financial Impact */}
          {fi && (
            <div className="pt-3">
              <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">
                {tr('التأثير المالي', 'Financial Impact')}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-center">
                  <p className="text-xs text-white/30">{tr('التكلفة المقدرة', 'Est. Cost')}</p>
                  <p className="text-sm font-mono text-amber-400">{fmtSAR(fi.estimatedCost)}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-center">
                  <p className="text-xs text-white/30">{tr('خسائر محتملة', 'Avoided Loss')}</p>
                  <p className="text-sm font-mono text-emerald-400">{fmtSAR(fi.avoidedLoss)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Approval Chain */}
          {chain.length > 0 && (
            <div className="pt-3">
              <h4 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                {tr('سلسلة الموافقات', 'Approval Chain')}
              </h4>
              <div className="space-y-0">
                {chain.map((step: any, si: number) => {
                  const isLast = si === chain.length - 1;
                  const isDone = step.status === 'APPROVED' || step.status === 'COMPLETED';
                  const isRej = step.status === 'REJECTED';
                  const dotCls = isDone
                    ? 'bg-emerald-400'
                    : isRej
                      ? 'bg-red-500'
                      : 'bg-amber-400 animate-pulse';
                  const labelCls = isDone
                    ? 'text-emerald-400'
                    : isRej
                      ? 'text-red-400'
                      : 'text-amber-400';

                  return (
                    <div key={si} className="relative flex items-start gap-3 pb-3">
                      {!isLast && (
                        <div className="absolute top-4 h-full w-px bg-white/10" style={isRtl ? { right: 5 } : { left: 5 }} />
                      )}
                      <div className={`relative mt-1.5 h-3 w-3 shrink-0 rounded-full ${dotCls}`} />
                      <div className="flex flex-1 items-center justify-between min-w-0">
                        <span className="text-sm text-white/70 truncate">
                          {step.role || step.approverRole || `${tr('الخطوة', 'Step')} ${si + 1}`}
                        </span>
                        <span className={`text-xs font-medium ${labelCls}`}>
                          {isDone ? tr('تمت', 'Done')
                            : isRej ? tr('مرفوض', 'Rejected')
                            : tr('قيد الانتظار', 'Pending')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {decision.reasoning && (
            <div className="pt-2">
              <span className="text-sm text-white/40">{tr('السبب', 'Reasoning')}</span>
              <p className="text-sm text-white/60 mt-1">{decision.reasoning}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
