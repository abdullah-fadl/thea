'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Pill, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function MedicationsPage() {
  const [showAll, setShowAll] = useState(false);
  const { data } = useSWR(`/api/portal/medications?status=${showAll ? 'all' : 'active'}`, fetcher);
  const router = useRouter();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const medications = data?.medications || [];

  const handleExplain = (med: any) => {
    const content = `${med.orderName || med.drugName || ''} - ${med.dose || ''} ${med.doseUnit || ''} ${med.frequency || ''} ${med.route || ''}`;
    const params = new URLSearchParams({ type: 'medication', content });
    router.push(`/p/explain?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{tr('أدويتي', 'My Medications')}</h1>
        </div>
        <button
          onClick={() => setShowAll(!showAll)}
          className={`px-3 py-1.5 rounded-lg text-xs ${showAll ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}
        >
          {showAll ? tr('الكل', 'All') : tr('النشطة فقط', 'Active Only')}
        </button>
      </div>

      <div className="space-y-3">
        {medications.map((med: any) => {
          const isActive = med.status === 'active' || med.status === 'ordered';
          return (
            <div
              key={med.id as string}
              className={`bg-card rounded-2xl border border-border p-4 ${!isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                    <Pill className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{med.orderName as string || med.drugName as string || tr('دواء', 'Medication')}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {med.dose as string} {med.doseUnit as string} &middot; {med.frequency as string} &middot; {med.route as string}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                  {isActive ? tr('نشط', 'Active') : tr('مكتمل', 'Completed')}
                </span>
              </div>

              {(med.instructions as string) && (
                <div className="flex items-start gap-2 mb-2 p-2 bg-amber-50 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5" />
                  <p className="text-xs text-amber-800">{med.instructions as string}</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(med.createdAt as string).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                </div>
                <button
                  onClick={() => handleExplain(med)}
                  className="flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 rounded-lg text-[11px] hover:bg-violet-200"
                >
                  <Sparkles className="w-3 h-3" /> {tr('اشرحلي', 'Explain')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {medications.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <Pill className="w-8 h-8 mx-auto mb-2" />
          <p>{tr('لا توجد أدوية', 'No medications found')}</p>
        </div>
      )}
    </div>
  );
}
