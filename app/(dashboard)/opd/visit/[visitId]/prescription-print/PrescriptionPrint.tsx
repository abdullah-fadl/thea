'use client';

import useSWR from 'swr';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { getAge, formatGender, getPatientMrn } from '@/lib/opd/ui-helpers';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function PrescriptionPrint(props: any) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/opd/visit');
  const visitId = String(props?.params?.visitId || '').trim();
  const encounterCoreId = visitId;

  const { data: encounterData } = useSWR(
    hasPermission && encounterCoreId ? `/api/encounters/${encodeURIComponent(encounterCoreId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: ordersData } = useSWR(
    hasPermission && encounterCoreId ? `/api/orders?encounterCoreId=${encodeURIComponent(encounterCoreId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: bookingData } = useSWR(
    hasPermission && encounterCoreId
      ? `/api/opd/booking/by-encounter?encounterCoreId=${encodeURIComponent(encounterCoreId)}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const encounter = encounterData?.encounter || null;
  const patient = encounterData?.patient || null;
  const orders = Array.isArray(ordersData?.items) ? ordersData.items : [];
  const prescriptions = orders.filter((order: any) => String(order?.kind || '') === 'MEDICATION');
  const doctorName = bookingData?.provider?.displayName || tr('\u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0641', 'Unknown');
  const now = new Date();

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <button
          onClick={() => window.history.back()}
          className="px-3 py-1.5 rounded-xl bg-card text-foreground text-xs font-medium border border-border"
        >
          {tr('\u2190 \u0631\u062c\u0648\u0639', '\u2190 Back')}
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 rounded-xl bg-foreground text-card text-xs font-medium"
        >
          {tr('\ud83d\udda8\ufe0f \u0637\u0628\u0627\u0639\u0629', '\ud83d\udda8\ufe0f Print')}
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border p-8 print:border-0 print:rounded-none print:p-6 print:shadow-none">
        <div className="text-center border-b-2 border-foreground pb-4 mb-5">
          <div className="text-lg font-bold text-foreground tracking-wide">Thea HEALTH</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{tr('\u0642\u0633\u0645 \u0627\u0644\u0639\u064a\u0627\u062f\u0627\u062a \u0627\u0644\u062e\u0627\u0631\u062c\u064a\u0629', 'Outpatient Department')}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{tr('\u0646\u0638\u0627\u0645 \u0627\u0644\u0633\u062c\u0644 \u0627\u0644\u0635\u062d\u064a \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a', 'Electronic Health Record System')}</div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-5 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">{tr('\u0627\u0644\u0645\u0631\u064a\u0636', 'Patient')}:</span>{' '}
            <span className="font-medium text-foreground">{patient?.fullName || tr('\u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0641', 'Unknown')}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">{tr('\u0627\u0644\u062a\u0627\u0631\u064a\u062e', 'Date')}:</span>{' '}
            <span className="font-medium text-foreground">{now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">{tr('\u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641', 'MRN')}:</span>{' '}
            <span className="font-medium text-foreground">{getPatientMrn(patient) || patient?.id || '\u2014'}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">{tr('\u0627\u0644\u0639\u0645\u0631 / \u0627\u0644\u062c\u0646\u0633', 'Age / Sex')}:</span>{' '}
            <span className="font-medium text-foreground">
              {getAge(patient?.dob)}y / {formatGender(patient?.gender)}
            </span>
          </div>
        </div>

        <div className="text-4xl font-serif text-foreground mb-4">{'\u211e'}</div>

        <div className="space-y-4 mb-6">
          {prescriptions.length ? (
            prescriptions.map((rx: any, index: number) => (
              <div key={rx.id} className="border border-border rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="text-sm font-bold text-foreground">
                    {index + 1}. {rx.orderName || tr('\u062f\u0648\u0627\u0621', 'Medication')}
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-xl">
                    {tr('\u0627\u0644\u0643\u0645\u064a\u0629', 'Qty')}: {rx.meta?.quantity || '\u2014'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">{tr('\u0627\u0644\u062c\u0631\u0639\u0629', 'Dose')}:</span>{' '}
                    <span className="text-foreground font-medium">{rx.meta?.dose || '\u2014'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{tr('\u0627\u0644\u062a\u0643\u0631\u0627\u0631', 'Freq')}:</span>{' '}
                    <span className="text-foreground font-medium">{rx.meta?.frequency || '\u2014'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{tr('\u0627\u0644\u0637\u0631\u064a\u0642', 'Route')}:</span>{' '}
                    <span className="text-foreground font-medium">{rx.meta?.route || '\u2014'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{tr('\u0627\u0644\u0645\u062f\u0629', 'Duration')}:</span>{' '}
                    <span className="text-foreground font-medium">{rx.meta?.duration || '\u2014'}</span>
                  </div>
                </div>
                {rx.meta?.instructions && (
                  <div className="mt-2 text-xs text-foreground bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
                    {'\u26a0'} {rx.meta.instructions}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">{tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u0648\u0635\u0641\u0627\u062a \u0645\u062a\u0627\u062d\u0629.', 'No prescriptions available.')}</div>
          )}
        </div>

        <div className="border-t border-border pt-4 mt-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">{tr('\u0648\u0635\u0641 \u0628\u0648\u0627\u0633\u0637\u0629', 'Prescribed by')}</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">Dr. {doctorName}</div>
            </div>
            <div className="text-right">
              <div className="w-48 border-b border-border mb-1" />
              <div className="text-[10px] text-muted-foreground">{tr('\u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0648\u0627\u0644\u062e\u062a\u0645', 'Signature & Stamp')}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-dashed border-border flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{tr('\u062a\u0645 \u0625\u0646\u0634\u0627\u0624\u0647 \u0645\u0646 \u0639\u064a\u0627\u062f\u0627\u062a Thea Health', 'Generated from Thea Health OPD')}</span>
          <span>{tr('\u062a\u0645\u062a \u0627\u0644\u0637\u0628\u0627\u0639\u0629', 'Printed')}: {now.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
        </div>
      </div>
    </div>
  );
}
