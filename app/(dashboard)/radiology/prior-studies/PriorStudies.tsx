'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

export default function PriorStudies() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [patientSearch, setPatientSearch] = useState('');

  const { data } = useSWR(patientSearch ? `/api/radiology/prior-studies?patientId=${patientSearch}` : null, fetcher);
  const studies = data?.studies || [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('الدراسات السابقة', 'Prior Studies Comparison')}</h1>
      <Input placeholder={tr('معرف المريض', 'Patient ID')} value={patientSearch} onChange={e => setPatientSearch(e.target.value)} className="max-w-md" />

      {studies.length > 0 ? (
        <div className="space-y-3">
          {studies.map((s: any) => (
            <Card key={s.id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{s.modality} — {s.bodyPart || '—'}</span>
                    <span className="text-sm text-muted-foreground ml-3">{new Date(s.studyDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{s.matchType || 'AUTO'}</Badge>
                    <Badge className={s.comparisonNotes ? 'bg-blue-100 text-blue-800' : 'bg-muted'}>{s.comparisonNotes ? tr('مقارنة', 'Compared') : tr('بدون مقارنة', 'No Comparison')}</Badge>
                  </div>
                </div>
                {s.findings && <p className="text-sm mt-2 text-muted-foreground">{s.findings.slice(0, 150)}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : patientSearch ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('لا توجد دراسات سابقة', 'No prior studies found')}</CardContent></Card>
      ) : null}
    </div>
  );
}
