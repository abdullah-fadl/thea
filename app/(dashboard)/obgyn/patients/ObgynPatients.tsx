'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ObgynPatients() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [search, setSearch] = useState('');
  const { data } = useSWR(search ? `/api/patients/search?q=${encodeURIComponent(search)}` : null, fetcher);
  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{tr('\u0645\u0631\u064A\u0636\u0627\u062A \u0627\u0644\u0646\u0633\u0627\u0621 \u0648\u0627\u0644\u0648\u0644\u0627\u062F\u0629', 'OB/GYN Patients')}</h1>
          <p className="text-muted-foreground">{tr('\u0627\u0628\u062D\u062B\u064A \u0639\u0646 \u0627\u0644\u0645\u0631\u064A\u0636\u0629 \u0644\u0641\u062A\u062D \u0627\u0644\u0646\u0645\u0648\u0630\u062C', 'Search for a patient to open the form')}</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('\u0627\u0628\u062D\u062B\u064A \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641...', 'Search by name or MRN...')}
            className="w-full px-4 py-2 border border-border rounded-xl thea-input-focus"
          />
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-background">
              <tr className="text-right text-sm text-muted-foreground">
                <th className="px-4 py-3 font-medium">{tr('\u0627\u0644\u0645\u0631\u064A\u0636\u0629', 'Patient')}</th>
                <th className="px-4 py-3 font-medium">{tr('\u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641', 'MRN')}</th>
                <th className="px-4 py-3 font-medium">{tr('\u0627\u0644\u0646\u0645\u0627\u0630\u062C', 'Forms')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    {search ? tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u062A\u0627\u0626\u062C', 'No results found') : tr('\u0627\u0628\u062F\u0623\u064A \u0628\u0627\u0644\u0628\u062D\u062B', 'Start searching')}
                  </td>
                </tr>
              ) : (
                items.map((patient: any) => (
                  <tr key={patient.id} className="hover:bg-background">
                    <td className="px-4 py-3">
                      <div className="font-medium">{patient.fullName || patient.displayName || patient.name}</div>
                      <div className="text-sm text-muted-foreground">{patient.gender || '\u2014'}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{patient.links?.mrn || '\u2014'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <Link href={`/obgyn/antenatal/${patient.id}`} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-xl text-sm">
                          {tr('\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062D\u0645\u0644', 'Antenatal Care')}
                        </Link>
                        <Link href={`/obgyn/labor/${patient.id}`} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-xl text-sm">
                          {tr('\u0627\u0644\u0648\u0644\u0627\u062F\u0629', 'Labor & Delivery')}
                        </Link>
                        <Link href={`/obgyn/postpartum/${patient.id}`} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-sm">
                          {tr('\u0645\u0627 \u0628\u0639\u062F \u0627\u0644\u0648\u0644\u0627\u062F\u0629', 'Postpartum')}
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
