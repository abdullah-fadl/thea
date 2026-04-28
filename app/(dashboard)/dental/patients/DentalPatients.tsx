'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function DentalPatients() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [search, setSearch] = useState('');
  const { data } = useSWR(
    search.length >= 2 ? `/api/patients/search?q=${encodeURIComponent(search)}` : null,
    fetcher
  );

  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{tr('مرضى الأسنان', 'Dental Patients')}</h1>
          <p className="text-muted-foreground">
            {tr('ابحث عن مريض لفتح المخطط أو خطة العلاج', 'Search for a patient to open the chart or treatment plan')}
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('ابحث بالاسم أو رقم الملف...', 'Search by name or file number...')}
            className="w-full px-4 py-2 border border-border rounded-xl thea-input-focus bg-background text-foreground"
          />
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr className="text-sm text-muted-foreground">
                <th className="px-4 py-3 font-medium text-start">{tr('المريض', 'Patient')}</th>
                <th className="px-4 py-3 font-medium text-start">{tr('رقم الملف', 'File No.')}</th>
                <th className="px-4 py-3 font-medium text-start">{tr('الجنس', 'Gender')}</th>
                <th className="px-4 py-3 font-medium text-start">{tr('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {search.length < 2 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    {tr('اكتب حرفين على الأقل للبحث', 'Type at least 2 characters to search')}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    {tr('لا توجد نتائج', 'No results found')}
                  </td>
                </tr>
              ) : (
                items.map((patient: any) => (
                  <tr key={patient.id} className="thea-hover-lift">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {patient.fullName || patient.displayName || patient.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">
                      {patient.links?.mrn || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {patient.gender
                        ? tr(
                            patient.gender === 'MALE' ? 'ذكر' : patient.gender === 'FEMALE' ? 'أنثى' : patient.gender,
                            patient.gender === 'MALE' ? 'Male' : patient.gender === 'FEMALE' ? 'Female' : patient.gender
                          )
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/dental/chart/${patient.id}`}
                          className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-xl text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          {tr('المخطط', 'Chart')}
                        </Link>
                        <Link
                          href={`/dental/treatment/${patient.id}`}
                          className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-xl text-sm font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                        >
                          {tr('خطة العلاج', 'Treatment Plan')}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
