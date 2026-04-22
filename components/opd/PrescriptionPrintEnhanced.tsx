'use client';

import { useRef } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Printer, Download } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

interface Props {
  encounterCoreId: string;
  facilityName?: string;
  facilityNameAr?: string;
  facilityLogo?: string;
}

interface MedOrder {
  id: string;
  orderName: string;
  orderCode: string;
  priority: string;
  status: string;
  kind?: string;
  createdAt: string;
  meta: {
    dose?: string;
    frequency?: string;
    route?: string;
    duration?: string;
    quantity?: number;
    refills?: number;
    form?: string;
    strength?: string;
    instructions?: string;
    genericName?: string;
    prn?: boolean;
    indication?: string;
    prescribedAt?: string;
  };
}

interface PatientInfo {
  fullName?: string;
  mrn?: string;
  dob?: string;
  mobile?: string;
}

interface EncounterInfo {
  doctorName?: string;
  department?: string;
}

export default function PrescriptionPrintEnhanced({
  encounterCoreId,
  facilityName = 'Thea Medical Center',
  facilityNameAr = 'مركز ثيا الطبي',
  facilityLogo,
}: Props) {
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: ordersData } = useSWR(
    encounterCoreId ? `/api/orders?encounterCoreId=${encodeURIComponent(encounterCoreId)}` : null,
    fetcher,
  );

  const { data: encounterData } = useSWR(
    encounterCoreId ? `/api/encounters/${encodeURIComponent(encounterCoreId)}` : null,
    fetcher,
  );

  const allOrders: MedOrder[] = ordersData?.items ?? [];
  const meds = allOrders.filter(o => o.status !== 'CANCELLED' &&
    o.kind === 'MEDICATION');
  const encounter: EncounterInfo | undefined = encounterData?.encounter;
  const patient: PatientInfo | undefined = encounterData?.patient;

  const now = new Date();
  const rxNum = `RX-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${encounterCoreId.slice(-4).toUpperCase()}`;

  const handlePrint = () => window.print();

  if (meds.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>{tr('لا توجد أدوية لطباعتها', 'No medications to print')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Controls (hidden on print) */}
      <div className="flex items-center gap-3 mb-4 print:hidden">
        <button
          onClick={() => window.history.back()}
          className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition"
        >
          {tr('→ رجوع', '← Back')}
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 transition"
        >
          <Printer className="w-4 h-4" />
          {tr('طباعة', 'Print')}
        </button>
      </div>

      {/* Printable prescription */}
      <div
        ref={printRef}
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          maxWidth: '794px',
          margin: '0 auto',
          background: 'white',
          padding: '32px',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #1e40af' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {facilityLogo ? (
              <img src={facilityLogo} alt="logo" style={{ height: '48px', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px' }}>T</div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#1e40af' }}>{isRTL ? facilityNameAr : facilityName}</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>{isRTL ? facilityName : facilityNameAr}</div>
            </div>
          </div>
          <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>{tr('وصفة طبية', 'Medical Prescription')}</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{rxNum}</div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>{now.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</div>
          </div>
        </div>

        {/* Patient & Doctor Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tr('معلومات المريض', 'Patient Information')}</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{patient?.fullName ?? '—'}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{tr('رقم الملف', 'MRN')}: {patient?.mrn ?? '—'}</div>
            {patient?.dob && (
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{tr('تاريخ الميلاد', 'DOB')}: {new Date(patient.dob).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</div>
            )}
            {patient?.mobile && (
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{tr('الجوال', 'Mobile')}: {patient.mobile}</div>
            )}
          </div>
          <div style={{ borderInlineStart: '1px solid #e5e7eb', paddingInlineStart: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tr('الطبيب المعالج', 'Prescribing Doctor')}</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{encounter?.doctorName ?? '—'}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{encounter?.department ?? ''}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{tr('التاريخ', 'Date')}: {now.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</div>
          </div>
        </div>

        {/* Medications */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ℞ {tr('الأدوية الموصوفة', 'Prescribed Medications')}
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {meds.map((med, index) => (
              <div
                key={med.id}
                style={{
                  padding: '14px 16px',
                  borderBottom: index < meds.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: index % 2 === 0 ? 'white' : '#fafafa',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{index + 1}. {med.orderName}</span>
                    {med.meta.strength && (
                      <span style={{ marginInlineStart: '8px', fontSize: '12px', color: '#6b7280' }}>({med.meta.strength})</span>
                    )}
                    {med.meta.genericName && (
                      <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>{med.meta.genericName}</div>
                    )}
                  </div>
                  {med.meta.prn && (
                    <span style={{ fontSize: '10px', fontWeight: 600, background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '12px' }}>PRN</span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '12px' }}>
                  {med.meta.dose && (
                    <div><span style={{ color: '#6b7280' }}>{tr('الجرعة', 'Dose')}: </span><strong>{med.meta.dose}</strong></div>
                  )}
                  {med.meta.frequency && (
                    <div><span style={{ color: '#6b7280' }}>{tr('التكرار', 'Freq')}: </span><strong>{med.meta.frequency}</strong></div>
                  )}
                  {med.meta.route && (
                    <div><span style={{ color: '#6b7280' }}>{tr('الطريقة', 'Route')}: </span><strong>{med.meta.route}</strong></div>
                  )}
                  {med.meta.duration && (
                    <div><span style={{ color: '#6b7280' }}>{tr('المدة', 'Duration')}: </span><strong>{med.meta.duration}</strong></div>
                  )}
                  {med.meta.quantity != null && (
                    <div><span style={{ color: '#6b7280' }}>{tr('الكمية', 'Qty')}: </span><strong>{med.meta.quantity}</strong></div>
                  )}
                  {(med.meta.refills ?? 0) > 0 && (
                    <div><span style={{ color: '#6b7280' }}>{tr('التجديد', 'Refills')}: </span><strong>{med.meta.refills}</strong></div>
                  )}
                </div>
                {med.meta.instructions && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#374151', background: '#f9fafb', padding: '6px 8px', borderRadius: '4px', borderInlineStart: '3px solid #1e40af' }}>
                    {med.meta.instructions}
                  </div>
                )}
                {med.meta.indication && (
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
                    {tr('للعلاج من', 'Indication')}: {med.meta.indication}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Signature area */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <div>
            <div style={{ height: '48px', borderBottom: '1px solid #9ca3af', marginBottom: '4px' }} />
            <div style={{ fontSize: '11px', color: '#6b7280' }}>{tr('توقيع الطبيب', 'Doctor Signature')}</div>
          </div>
          <div>
            <div style={{ height: '48px', borderBottom: '1px solid #9ca3af', marginBottom: '4px' }} />
            <div style={{ fontSize: '11px', color: '#6b7280' }}>{tr('الختم', 'Stamp')}</div>
          </div>
        </div>

        {/* QR code placeholder + footer */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>
            <div>{tr('هذه الوصفة صادرة إلكترونياً من نظام ثيا الصحي', 'This prescription was electronically issued via Thea EHR')}</div>
            <div>ID: {rxNum} — {now.toISOString()}</div>
          </div>
          <div style={{ width: '56px', height: '56px', border: '1px solid #e5e7eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#9ca3af', textAlign: 'center' }}>
            QR<br />Code
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #__next * { visibility: hidden; }
          [data-prescription-print], [data-prescription-print] * { visibility: visible; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
    </div>
  );
}
