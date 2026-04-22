'use client';

import { useLang } from '@/hooks/use-lang';
import { Truck, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ProcurementOrder {
  id: string;
  code: string;
  title: string;
  titleAr: string;
  vendor: string;
  vendorAr: string;
  domain: string;
  totalSAR: number;
  stage: 'REQUISITION' | 'APPROVAL' | 'ORDER' | 'SHIPMENT' | 'DELIVERY' | 'INSPECTION' | 'COMPLETED';
  delayRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  slaCompliance: boolean;
  daysInCurrentStage: number;
  hospital: string;
  hospitalAr: string;
  expectedDelivery: string;
}

const STAGES = ['REQUISITION', 'APPROVAL', 'ORDER', 'SHIPMENT', 'DELIVERY', 'INSPECTION', 'COMPLETED'] as const;
const STAGE_LABELS: Record<string, [string, string]> = {
  REQUISITION: ['طلب', 'Requisition'],
  APPROVAL: ['موافقة', 'Approval'],
  ORDER: ['أمر', 'Order'],
  SHIPMENT: ['شحن', 'Shipment'],
  DELIVERY: ['تسليم', 'Delivery'],
  INSPECTION: ['فحص', 'Inspection'],
  COMPLETED: ['مكتمل', 'Completed'],
};

const RISK_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  LOW: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  MEDIUM: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  HIGH: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500 animate-pulse' },
};

export function ProcurementTimeline({ orders }: { orders: ProcurementOrder[] }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const fmtSAR = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toFixed(0);
  };

  const stageIndex = (stage: string) => STAGES.indexOf(stage as any);

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 h-full"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Truck className="h-4 w-4 text-blue-400" />
          {tr('مسار المشتريات', 'Procurement Timeline')}
        </h3>
        <span className="text-[10px] text-white/30 font-mono">
          {orders.length} {tr('أمر', 'orders')}
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-white/20 text-xs">
          {tr('لا توجد أوامر نشطة', 'No active orders')}
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto war-scroll">
          {orders.map((order) => {
            const risk = RISK_COLORS[order.delayRisk] || RISK_COLORS.LOW;
            const currentIdx = stageIndex(order.stage);
            const progress = currentIdx >= 0 ? ((currentIdx + 1) / STAGES.length) * 100 : 0;

            return (
              <div
                key={order.id}
                className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-[10px] text-cyan-400/80">{order.code}</span>
                      <span className={`${risk.dot} h-2 w-2 rounded-full`} />
                    </div>
                    <p className="text-xs text-white/80 truncate">
                      {language === 'ar' ? order.titleAr : order.title}
                    </p>
                    <p className="text-[10px] text-white/30">
                      {language === 'ar' ? order.vendorAr : order.vendor}
                      {' | '}
                      {language === 'ar' ? order.hospitalAr : order.hospital}
                    </p>
                  </div>
                  <div className="text-end shrink-0 ms-2">
                    <p className="text-xs font-mono text-white/60">{fmtSAR(order.totalSAR)} {tr('ر.س', 'SAR')}</p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      {order.slaCompliance ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-red-400" />
                      )}
                      <span className={`text-[10px] ${order.slaCompliance ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                        {order.slaCompliance ? 'SLA OK' : 'SLA Risk'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: order.delayRisk === 'HIGH' ? '#ef4444' : order.delayRisk === 'MEDIUM' ? '#f59e0b' : '#10b981',
                      }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${risk.text}`}>
                    {tr(STAGE_LABELS[order.stage]?.[0] || order.stage, STAGE_LABELS[order.stage]?.[1] || order.stage)}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-white/20" />
                    <span className="text-[10px] text-white/30">
                      {order.daysInCurrentStage}d {tr('في المرحلة', 'in stage')}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/20">
                    {tr('التسليم المتوقع', 'ETA')}: {order.expectedDelivery}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
