'use client';

import { useRef } from 'react';
import { Printer, AlertTriangle } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

interface WristbandPrintProps {
  patient: {
    mrn: string;
    fullName: string;
    fullNameAr?: string;
    dateOfBirth?: string;
    gender?: string;
    bloodType?: string;
    allergies?: string[];
  };
  encounter: {
    id: string;
    triageLevel?: number;
    arrivalTime: string;
  };
  onClose: () => void;
}

export function WristbandPrint({ patient, encounter, onClose }: WristbandPrintProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const triageColors: Record<number, string> = {
    1: 'bg-red-600 text-white',
    2: 'bg-orange-500 text-white',
    3: 'bg-yellow-400 text-black',
    4: 'bg-green-500 text-white',
    5: 'bg-blue-500 text-white',
  };

  const triageColor = triageColors[encounter.triageLevel || 5] || 'bg-gray-500 text-white';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:bg-white print:static">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 print:rounded-none print:p-0 print:max-w-none">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <h2 className="text-xl font-bold">{tr('طباعة سوار المريض', 'Print Patient Wristband')}</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer className="h-4 w-4 inline mr-1" /> {tr('طباعة', 'Print')}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {tr('إغلاق', 'Close')}
            </button>
          </div>
        </div>

        <div ref={printRef} className="print:block">
          {[1, 2].map((copy) => (
            <div
              key={copy}
              className="border-2 border-dashed border-gray-400 p-4 mb-4 print:border-solid print:break-after-avoid"
              style={{ width: '280mm', height: '25mm' }}
            >
              <div className="flex items-center justify-between h-full">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{patient.fullName}</span>
                    {patient.fullNameAr && (
                      <span className="text-gray-600">({patient.fullNameAr})</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 flex gap-4 mt-1">
                    <span>
                      {tr('رقم الملف', 'MRN')}: <strong>{patient.mrn}</strong>
                    </span>
                    <span>{tr('تاريخ الميلاد', 'DOB')}: {patient.dateOfBirth || tr('غ/م', 'N/A')}</span>
                    <span>{patient.gender || tr('غ/م', 'N/A')}</span>
                    {patient.bloodType && (
                      <span>
                        {tr('الدم', 'Blood')}: <strong>{patient.bloodType}</strong>
                      </span>
                    )}
                  </div>
                  {patient.allergies && patient.allergies.length > 0 && (
                    <div className="text-sm text-red-600 font-bold mt-1">
                      <AlertTriangle className="h-3 w-3 inline mr-1" /> {tr('الحساسية', 'ALLERGIES')}: {patient.allergies.join(', ')}
                    </div>
                  )}
                </div>

                <div className={`px-4 py-2 rounded-lg ${triageColor} text-center min-w-[80px]`}>
                  <div className="text-2xl font-bold">ESI {encounter.triageLevel || '?'}</div>
                </div>

                <div className="ml-4 text-center">
                  <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                    {encounter.id.substring(0, 12)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(encounter.arrivalTime).toLocaleString('en-SA')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 print:hidden">
          <strong>{tr('تعليمات:', 'Instructions:')}</strong> {tr('استخدم ورق طابعة الأساور (1 × 11 بوصة أو مشابه). يتم إنشاء نسختين للاحتياط.', 'Use wristband printer paper (1" x 11" or similar). Two copies are generated for redundancy.')}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block,
          .print\\:block * {
            visibility: visible;
          }
          @page {
            size: landscape;
            margin: 5mm;
          }
        }
      `}</style>
    </div>
  );
}
