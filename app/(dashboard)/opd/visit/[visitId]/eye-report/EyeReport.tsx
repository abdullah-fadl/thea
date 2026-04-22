'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { Printer, FileText } from 'lucide-react';
import { getAge, formatGender, getPatientMrn } from '@/lib/opd/ui-helpers';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function EyeReport(props: any) {
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
  const { data: opdData } = useSWR(
    hasPermission && encounterCoreId ? `/api/opd/encounters/${encodeURIComponent(encounterCoreId)}` : null,
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

  const ophthalmology = ((opdData as { opd?: { opdClinicExtensions?: { ophthalmology?: Record<string, unknown> } } } | undefined)?.opd?.opdClinicExtensions?.ophthalmology || null) as Record<string, unknown> | null;
  const isOphthalmology = useMemo(() => {
    const clinicName = String(bookingData?.clinic?.name || '').toLowerCase();
    return clinicName.includes('ophthalmology') || clinicName.includes('ophthalmic') || Boolean(ophthalmology);
  }, [bookingData?.clinic?.name, ophthalmology]);

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const encounter = encounterData?.encounter || null;
  const patient = encounterData?.patient || null;
  const opd = opdData?.opd || null;
  const booking = bookingData?.booking || null;
  const doctorName = bookingData?.provider?.displayName || tr('—', '—');
  const visitTime = booking?.startAt || encounter?.createdAt || null;

  const doctorExam = (ophthalmology?.doctorExam || {}) as Record<string, any>;
  const glassesRx = (ophthalmology?.glassesRx || {}) as Record<string, any>;

  if (!isOphthalmology) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">{tr('تقرير العيون غير متاح لهذه الزيارة.', 'Ophthalmology report not available for this visit.')}</div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <button
          onClick={() => window.history.back()}
          className="px-3 py-1.5 rounded-xl bg-card text-foreground text-xs font-medium border border-border"
        >
          {tr('← رجوع', '← Back')}
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium"
        >
          <Printer className="h-3 w-3 inline mr-1" />{tr('طباعة', 'Print')}
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border p-8 print:border-0 print:rounded-none print:p-6 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-foreground pb-4 mb-5">
          <div>
            <div className="text-lg font-bold text-foreground tracking-wide">Thea HEALTH</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{tr('قسم العيون', 'Ophthalmology Department')}</div>
          </div>
          <div className="w-24 h-14 border-2 border-dashed border-border rounded-xl flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">{tr('ختم', 'Stamp')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-5 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">{tr('الطبيب', 'Doctor')}:</span>{' '}
            <span className="font-medium text-foreground">{doctorName}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">{tr('تاريخ الزيارة', 'Visit Date')}:</span>{' '}
            <span className="font-medium text-foreground">
              {visitTime ? new Date(visitTime).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US') : '—'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">{tr('المريض', 'Patient')}:</span>{' '}
            <span className="font-medium text-foreground">{patient?.fullName || tr('غير معروف', 'Unknown')}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">{tr('رقم الملف', 'MRN')}:</span>{' '}
            <span className="font-medium text-foreground">{getPatientMrn(patient) || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">{tr('العمر / الجنس', 'Age / Sex')}:</span>{' '}
            <span className="font-medium text-foreground">
              {getAge(patient?.dob)}y / {formatGender(patient?.gender)}
            </span>
          </div>
        </div>

        <div className="border border-border rounded-xl p-4 mb-4">
          <div className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">{tr('فحص الطبيب', 'Doctor Examination')}</div>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="bg-muted rounded-xl p-3">
              <div className="text-[10px] font-medium text-muted-foreground uppercase">{tr('حدة الإبصار OD (يمين)', 'Visual Acuity OD (Right)')}</div>
              <div className="text-lg font-bold text-foreground mt-0.5">{doctorExam.visualAcuityOD || '—'}</div>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <div className="text-[10px] font-medium text-muted-foreground uppercase">{tr('حدة الإبصار OS (يسار)', 'Visual Acuity OS (Left)')}</div>
              <div className="text-lg font-bold text-foreground mt-0.5">{doctorExam.visualAcuityOS || '—'}</div>
            </div>
          </div>

          <div className="mb-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">{tr('الانكسار', 'Refraction')}</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 text-[10px] font-semibold text-muted-foreground uppercase w-12">{tr('العين', 'Eye')}</th>
                  <th className="text-center py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">{tr('كروي', 'Sphere')}</th>
                  <th className="text-center py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">{tr('أسطواني', 'Cyl')}</th>
                  <th className="text-center py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">{tr('المحور', 'Axis')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 font-medium text-xs text-foreground">OD</td>
                  <td className="py-2 text-center text-xs">{doctorExam.refractionOD?.sphere || '—'}</td>
                  <td className="py-2 text-center text-xs">{doctorExam.refractionOD?.cyl || '—'}</td>
                  <td className="py-2 text-center text-xs">{doctorExam.refractionOD?.axis || '—'}°</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-xs text-foreground">OS</td>
                  <td className="py-2 text-center text-xs">{doctorExam.refractionOS?.sphere || '—'}</td>
                  <td className="py-2 text-center text-xs">{doctorExam.refractionOS?.cyl || '—'}</td>
                  <td className="py-2 text-center text-xs">{doctorExam.refractionOS?.axis || '—'}°</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="text-xs">
              <span className="text-muted-foreground">{tr('ضغط العين OD', 'IOP OD')}:</span>{' '}
              <span className="font-medium">{doctorExam.iopOD || '—'} mmHg</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">{tr('ضغط العين OS', 'IOP OS')}:</span>{' '}
              <span className="font-medium">{doctorExam.iopOS || '—'} mmHg</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="text-[10px] font-semibold text-amber-600 uppercase mb-1">{tr('الانطباع السريري', 'Clinical Impression')}</div>
            <div className="text-xs text-foreground">{doctorExam.impression || '—'}</div>
          </div>
        </div>

        <div className="border border-border rounded-xl p-4 mb-4">
          <div className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">{tr('وصفة النظارات', 'Glasses Prescription')}</div>
          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 text-[10px] font-semibold text-muted-foreground uppercase w-12">{tr('العين', 'Eye')}</th>
                <th className="text-center py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">{tr('كروي', 'Sphere')}</th>
                <th className="text-center py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">{tr('أسطواني', 'Cyl')}</th>
                <th className="text-center py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">{tr('المحور', 'Axis')}</th>
                <th className="text-center py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">{tr('إضافة', 'Add')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-2 font-medium text-xs text-foreground">OD</td>
                <td className="py-2 text-center text-xs">{glassesRx.od?.sphere || '—'}</td>
                <td className="py-2 text-center text-xs">{glassesRx.od?.cyl || '—'}</td>
                <td className="py-2 text-center text-xs">{glassesRx.od?.axis || '—'}°</td>
                <td className="py-2 text-center text-xs">{glassesRx.od?.add || '—'}</td>
              </tr>
              <tr>
                <td className="py-2 font-medium text-xs text-foreground">OS</td>
                <td className="py-2 text-center text-xs">{glassesRx.os?.sphere || '—'}</td>
                <td className="py-2 text-center text-xs">{glassesRx.os?.cyl || '—'}</td>
                <td className="py-2 text-center text-xs">{glassesRx.os?.axis || '—'}°</td>
                <td className="py-2 text-center text-xs">{glassesRx.os?.add || '—'}</td>
              </tr>
            </tbody>
          </table>
          <div className="flex gap-8 text-xs mb-2">
            <div>
              <span className="text-muted-foreground">{tr('المسافة الحدقية', 'PD')}:</span> <span className="font-medium">{glassesRx.pd || '—'}mm</span>
            </div>
          </div>
          {glassesRx.notes && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs text-foreground">
              <FileText className="h-3 w-3 inline mr-1" /> {glassesRx.notes}
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4 mt-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">{tr('الطبيب الفاحص', 'Examining Physician')}</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">{doctorName}</div>
            </div>
            <div className="text-right">
              <div className="w-48 border-b border-border mb-1" />
              <div className="text-[10px] text-muted-foreground">{tr('التوقيع والختم', 'Signature & Stamp')}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-dashed border-border flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{tr('تم إنشاؤه من عيادات Thea Health', 'Generated from Thea Health OPD')}</span>
          <span>{tr('تمت الطباعة', 'Printed')}: {new Date().toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
        </div>
      </div>
    </div>
  );
}
