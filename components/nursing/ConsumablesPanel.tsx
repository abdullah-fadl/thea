'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Package, Plus, Trash2, AlertTriangle, Eye } from 'lucide-react';
import dynamic from 'next/dynamic';

const NursingConsumableEntry = dynamic(() => import('./NursingConsumableEntry'), { ssr: false });

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface Props {
  encounterCoreId: string;
  patientMasterId?: string;
  department: 'OPD' | 'ER' | 'IPD' | 'OR' | 'ICU';
}

export default function ConsumablesPanel({ encounterCoreId, patientMasterId, department }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [showEntry, setShowEntry] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const { data, mutate } = useSWR(
    `/api/consumables/usage?encounterCoreId=${encounterCoreId}&summary=true`,
    fetcher
  );

  const summary = data || { eventCount: 0, totalItems: 0, totalWaste: 0, totalCost: 0, chargeableCount: 0, events: [] };

  const handleVoid = async (eventId: string) => {
    const reason = prompt(tr('سبب الإلغاء', 'Void reason'));
    if (!reason) return;
    await fetch('/api/consumables/usage/void', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usageEventId: eventId, reason }),
    });
    mutate();
  };

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-purple-600" />
          <span className="font-bold text-sm">{tr('المستهلكات', 'Consumables')}</span>
          {summary.eventCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
              {summary.totalItems} {tr('عنصر', 'items')}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowEntry(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-medium hover:bg-purple-700"
        >
          <Plus className="w-3.5 h-3.5" />
          {tr('تسجيل', 'Record')}
        </button>
      </div>

      {/* Quick stats */}
      {summary.eventCount > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-purple-50 rounded-xl p-2 text-center">
            <div className="text-lg font-bold text-purple-700">{summary.totalItems}</div>
            <div className="text-[10px] text-muted-foreground">{tr('مستخدم', 'Used')}</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-2 text-center">
            <div className="text-lg font-bold text-amber-700">{summary.totalWaste}</div>
            <div className="text-[10px] text-muted-foreground">{tr('هدر', 'Waste')}</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-2 text-center">
            <div className="text-lg font-bold text-blue-700">{summary.totalCost.toFixed(0)}</div>
            <div className="text-[10px] text-muted-foreground">SAR</div>
          </div>
        </div>
      )}

      {/* Events list */}
      {summary.events?.length > 0 && (
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <Eye className="w-3 h-3" />
            {showDetails ? tr('إخفاء التفاصيل', 'Hide Details') : tr('عرض التفاصيل', 'Show Details')}
          </button>
          {showDetails && (
            <div className="space-y-1.5">
              {summary.events.map((event: any) => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm ${event.status === 'VOIDED' ? 'bg-red-50 line-through opacity-50' : 'bg-muted/30'}`}
                >
                  <div>
                    <span className="font-medium">{event.supplyName}</span>
                    <span className="text-muted-foreground ms-2">×{event.quantity}</span>
                    {event.wasteQty > 0 && (
                      <span className="ms-2 text-amber-600 text-xs flex items-center gap-0.5 inline-flex">
                        <AlertTriangle className="w-3 h-3" /> {event.wasteQty}
                      </span>
                    )}
                  </div>
                  {event.status === 'RECORDED' && (
                    <button onClick={() => handleVoid(event.id)} className="p-1 text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {summary.eventCount === 0 && (
        <div className="text-center text-muted-foreground py-4 text-xs">
          {tr('لا توجد مستهلكات مسجلة', 'No consumables recorded')}
        </div>
      )}

      {/* Entry Modal */}
      {showEntry && (
        <NursingConsumableEntry
          encounterCoreId={encounterCoreId}
          patientMasterId={patientMasterId}
          department={department}
          onClose={() => setShowEntry(false)}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  );
}
