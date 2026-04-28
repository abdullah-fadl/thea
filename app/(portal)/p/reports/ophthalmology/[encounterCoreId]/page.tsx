'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/time/format';
import { useLang } from '@/hooks/use-lang';

function getPatientMrn(patient: any) {
  const links = Array.isArray(patient?.links) ? patient.links : [];
  const opdLink = links.find((link: any) => link?.system === 'OPD' && (link?.mrn || link?.tempMrn));
  const anyLink = links.find((link: any) => link?.mrn || link?.tempMrn);
  return opdLink?.mrn || opdLink?.tempMrn || anyLink?.mrn || anyLink?.tempMrn || '';
}

function getAge(dob?: string | Date | null) {
  if (!dob) return '—';
  const date = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function formatGender(value?: string | null) {
  if (!value) return '—';
  const normalized = String(value).toUpperCase();
  if (normalized === 'MALE') return 'M';
  if (normalized === 'FEMALE') return 'F';
  return normalized.slice(0, 1);
}

export default function PortalOphthalmologyReportPage({ params }: { params: { encounterCoreId: string } }) {
  const router = useRouter();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const encounterCoreId = String(params?.encounterCoreId || '').trim();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/portal/reports/ophthalmology/${encodeURIComponent(encounterCoreId)}`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          router.replace('/p/login');
          return null;
        }
        if (res.status === 403) {
          router.replace('/p/reports');
          return null;
        }
        return res.json();
      })
      .then((payload) => {
        if (payload) setData(payload);
      })
      .catch(() => router.replace('/p/reports'));
  }, [encounterCoreId, router]);

  const ophthalmology = data?.opd?.opdClinicExtensions?.ophthalmology || null;
  const isOphthalmology = useMemo(() => {
    const clinicName = String(data?.clinic?.name || '').toLowerCase();
    return clinicName.includes('ophthalmology') || clinicName.includes('ophthalmic') || Boolean(ophthalmology);
  }, [data?.clinic?.name, ophthalmology]);

  if (!data) {
    return <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>;
  }

  const encounter = data.encounter || null;
  const patient = data.patient || null;
  const opd = data.opd || null;
  const booking = data.booking || null;
  const clinic = data.clinic || null;
  const provider = data.provider || null;
  const doctorName = provider?.displayName || provider?.resourceRef?.displayName || '—';
  const visitTime = booking?.startAt || encounter?.createdAt || null;

  const doctorExam = ophthalmology?.doctorExam || {};
  const glassesRx = ophthalmology?.glassesRx || {};

  if (!isOphthalmology) {
    return <div className="text-sm text-muted-foreground">{tr('تقرير العيون غير متاح لهذه الزيارة.', 'Ophthalmology report not available for this visit.')}</div>;
  }

  return (
    <div className="p-6 print:p-0 print:bg-card">
      <div className="max-w-3xl mx-auto space-y-6 print:space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xl font-semibold">Thea Health</div>
            <div className="text-xs text-muted-foreground">تقرير العيون / Ophthalmology Report</div>
          </div>
          <div className="border border-dashed rounded-md w-28 h-16 flex items-center justify-center text-xs text-muted-foreground">
            {tr('ختم', 'Stamp')}
          </div>
        </div>

        <div className="grid gap-2 text-sm">
          <div>الطبيب / Doctor: {doctorName}</div>
          <div>
            المريض / Patient: {patient?.fullName || 'Unknown'} • {formatGender(patient?.gender)} • {getAge(patient?.dob)} • رقم الملف / MRN{' '}
            {getPatientMrn(patient) || '—'}
          </div>
          <div>وقت الزيارة / Visit Time: {formatDateTime(visitTime, { timeZone: 'UTC' }) || '—'}</div>
        </div>

        <div className="border rounded-md p-4 space-y-3 text-sm">
          <div className="font-medium">فحص الطبيب / Doctor Exam</div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>{tr('حدة البصر OD', 'Visual Acuity OD')}: {doctorExam.visualAcuityOD || '—'}</div>
            <div>{tr('حدة البصر OS', 'Visual Acuity OS')}: {doctorExam.visualAcuityOS || '—'}</div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div>
              {tr('انكسار OD', 'Refraction OD')}: {doctorExam.refractionOD?.sphere || '—'} / {doctorExam.refractionOD?.cyl || '—'} /{' '}
              {doctorExam.refractionOD?.axis || '—'}
            </div>
            <div>
              {tr('انكسار OS', 'Refraction OS')}: {doctorExam.refractionOS?.sphere || '—'} / {doctorExam.refractionOS?.cyl || '—'} /{' '}
              {doctorExam.refractionOS?.axis || '—'}
            </div>
            <div>
              {tr('ضغط العين OD/OS', 'IOP OD/OS')}: {doctorExam.iopOD || '—'} / {doctorExam.iopOS || '—'}
            </div>
          </div>
          <div>الانطباع / Impression: {doctorExam.impression || '—'}</div>
        </div>

        <div className="border rounded-md p-4 space-y-3 text-sm">
          <div className="font-medium">وصفة النظارات / Glasses Prescription</div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">{tr('العين', 'Eye')}</th>
                <th className="text-left py-1">{tr('كروي', 'Sphere')}</th>
                <th className="text-left py-1">{tr('اسطواني', 'Cyl')}</th>
                <th className="text-left py-1">{tr('محور', 'Axis')}</th>
                <th className="text-left py-1">{tr('إضافة', 'Add')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-1">OD</td>
                <td>{glassesRx.od?.sphere || '—'}</td>
                <td>{glassesRx.od?.cyl || '—'}</td>
                <td>{glassesRx.od?.axis || '—'}</td>
                <td>{glassesRx.od?.add || '—'}</td>
              </tr>
              <tr>
                <td className="py-1">OS</td>
                <td>{glassesRx.os?.sphere || '—'}</td>
                <td>{glassesRx.os?.cyl || '—'}</td>
                <td>{glassesRx.os?.axis || '—'}</td>
                <td>{glassesRx.os?.add || '—'}</td>
              </tr>
            </tbody>
          </table>
          <div>PD: {glassesRx.pd || '—'}</div>
          <div>ملاحظات / Notes: {glassesRx.notes || '—'}</div>
        </div>

        <div className="flex justify-between items-center print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            {tr('طباعة', 'Print')}
          </Button>
          <div className="text-xs text-muted-foreground">Generated from Thea Health OPD</div>
        </div>
        <div className="hidden print:block text-xs text-muted-foreground">Generated from Thea Health OPD</div>
      </div>
    </div>
  );
}
