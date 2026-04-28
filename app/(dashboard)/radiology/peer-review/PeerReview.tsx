'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

const SCORE_TYPES = ['AGREE', 'MINOR_DISCREPANCY', 'MAJOR_DISCREPANCY', 'MISS'] as const;

function scoreColor(s: string) {
  switch (s) {
    case 'AGREE': return 'bg-green-100 text-green-800';
    case 'MINOR_DISCREPANCY': return 'bg-yellow-100 text-yellow-800';
    case 'MAJOR_DISCREPANCY': return 'bg-orange-100 text-orange-800';
    case 'MISS': return 'bg-red-100 text-red-800';
    default: return 'bg-muted text-foreground';
  }
}

export default function PeerReview() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('reviews');

  const { data, mutate } = useSWR('/api/radiology/peer-review?limit=50', fetcher, { refreshInterval: 15000 });
  const reviews = data?.reviews || [];

  const { data: statsData } = useSWR('/api/radiology/peer-review/stats', fetcher);
  const stats = statsData || {};

  const [newReview, setNewReview] = useState({ studyId: '', originalReportId: '', score: 'AGREE', findings: '', recommendation: '' });

  const submitReview = useCallback(async () => {
    try {
      const res = await fetch('/api/radiology/peer-review', { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newReview) });
      if (res.ok) { toast({ title: tr('تم حفظ المراجعة', 'Review saved') }); mutate(); setNewReview(p => ({ ...p, findings: '', recommendation: '' })); }
    } catch { toast({ title: tr('فشل', 'Failed'), variant: 'destructive' }); }
  }, [newReview, mutate, toast, tr]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{tr('مراجعة الأقران — الأشعة', 'Radiology Peer Review')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{stats.totalReviews || 0}</p><p className="text-sm">{tr('إجمالي المراجعات', 'Total Reviews')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-green-600">{stats.agreeRate ? (stats.agreeRate * 100).toFixed(0) + '%' : '—'}</p><p className="text-sm">{tr('نسبة التوافق', 'Agreement Rate')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-orange-600">{stats.discrepancyRate ? (stats.discrepancyRate * 100).toFixed(1) + '%' : '—'}</p><p className="text-sm">{tr('نسبة التناقض', 'Discrepancy Rate')}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-red-600">{stats.missCount || 0}</p><p className="text-sm">{tr('حالات فائتة', 'Misses')}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="reviews">{tr('المراجعات', 'Reviews')}</TabsTrigger>
          <TabsTrigger value="new">{tr('مراجعة جديدة', 'New Review')}</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews">
          <div className="space-y-3">
            {reviews.map((r: any) => (
              <Card key={r.id}>
                <CardContent className="pt-4 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{r.studyId?.slice(0, 8) || '—'}</span>
                    <span className="text-sm text-muted-foreground ml-3">{r.findings?.slice(0, 80) || ''}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={scoreColor(r.score)}>{r.score?.replace(/_/g, ' ')}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {reviews.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground">{tr('لا توجد مراجعات', 'No reviews yet')}</CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="new">
          <Card>
            <CardHeader><CardTitle>{tr('مراجعة أقران جديدة', 'New Peer Review')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder={tr('معرف الدراسة', 'Study ID')} value={newReview.studyId} onChange={e => setNewReview(p => ({ ...p, studyId: e.target.value }))} />
              <Input placeholder={tr('معرف التقرير الأصلي', 'Original Report ID')} value={newReview.originalReportId} onChange={e => setNewReview(p => ({ ...p, originalReportId: e.target.value }))} />
              <Select value={newReview.score} onValueChange={v => setNewReview(p => ({ ...p, score: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGREE">{tr('متوافق', 'Agree')}</SelectItem>
                  <SelectItem value="MINOR_DISCREPANCY">{tr('تناقض بسيط', 'Minor Discrepancy')}</SelectItem>
                  <SelectItem value="MAJOR_DISCREPANCY">{tr('تناقض كبير', 'Major Discrepancy')}</SelectItem>
                  <SelectItem value="MISS">{tr('حالة فائتة', 'Miss')}</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder={tr('النتائج', 'Findings')} value={newReview.findings} onChange={e => setNewReview(p => ({ ...p, findings: e.target.value }))} />
              <Input placeholder={tr('التوصية', 'Recommendation')} value={newReview.recommendation} onChange={e => setNewReview(p => ({ ...p, recommendation: e.target.value }))} />
              <Button onClick={submitReview}>{tr('إرسال المراجعة', 'Submit Review')}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
