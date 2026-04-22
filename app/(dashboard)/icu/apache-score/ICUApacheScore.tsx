'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import IcuApacheScoreForm from '@/components/icu/IcuApacheScoreForm';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

function riskBadge(risk: string, tr: (ar: string, en: string) => string) {
  const map: Record<string, { label: string; cls: string }> = {
    LOW: { label: tr('منخفض', 'Low'), cls: 'bg-green-100 text-green-800' },
    MODERATE: { label: tr('متوسط', 'Moderate'), cls: 'bg-yellow-100 text-yellow-800' },
    HIGH: { label: tr('مرتفع', 'High'), cls: 'bg-orange-100 text-orange-800' },
    VERY_HIGH: { label: tr('مرتفع جدا', 'Very High'), cls: 'bg-red-100 text-red-800' },
    CRITICAL: { label: tr('حرج', 'Critical'), cls: 'bg-red-200 text-red-900' },
  };
  const info = map[risk] || { label: risk, cls: '' };
  return <Badge className={info.cls}>{info.label}</Badge>;
}

export default function ICUApacheScore() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [selectedEpisode, setSelectedEpisode] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch active ICU episodes
  const { data: episodesData } = useSWR('/api/ipd/episodes/by-encounter?status=ACTIVE', fetcher, { refreshInterval: 15000 });
  const episodes: any[] = episodesData?.episodes || episodesData?.items || [];

  // Fetch apache scores for selected episode
  const { data: scoresData, mutate } = useSWR(
    selectedEpisode ? `/api/icu/episodes/${selectedEpisode}/apache-score` : null,
    fetcher,
    { refreshInterval: 15000 },
  );
  const scores: any[] = scoresData?.scores || [];

  const handleSubmit = async (data: Record<string, any>) => {
    if (!selectedEpisode) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/icu/episodes/${selectedEpisode}/apache-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم حفظ تقييم APACHE II', 'APACHE II assessment saved') });
      setDialogOpen(false);
      mutate();
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل حفظ التقييم', 'Failed to save assessment'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">{tr('تقييم APACHE II', 'APACHE II Score')}</h1>

      {/* ---- Episode Selector ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('اختر نوبة العناية', 'Select ICU Episode')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <Select value={selectedEpisode} onValueChange={setSelectedEpisode}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder={tr('اختر نوبة...', 'Select episode...')} />
            </SelectTrigger>
            <SelectContent>
              {episodes.map((ep: any) => (
                <SelectItem key={ep.id} value={ep.id}>
                  {ep.patientName || ep.id} - {ep.bedLabel || tr('بدون سرير', 'No bed')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setDialogOpen(true)} disabled={!selectedEpisode}>
            {tr('تقييم جديد', 'New Assessment')}
          </Button>
        </CardContent>
      </Card>

      {/* ---- Trend Chart Placeholder ---- */}
      {selectedEpisode && scores.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('مخطط الاتجاه', 'Score Trend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-end gap-1 border-b border-l px-2">
              {[...scores].reverse().map((s: any, i: number) => {
                const pct = Math.min(s.totalScore / 40 * 100, 100);
                return (
                  <div key={s.id || i} className="flex flex-col items-center flex-1 min-w-0">
                    <span className="text-[10px] mb-1">{s.totalScore}</span>
                    <div
                      className={`w-3 rounded-full ${s.totalScore >= 20 ? 'bg-red-500' : s.totalScore >= 15 ? 'bg-orange-500' : s.totalScore >= 10 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ height: `${Math.max(pct, 5)}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground mt-1 truncate w-full text-center">
                      {new Date(s.scoredAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Score History Table ---- */}
      {selectedEpisode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('سجل التقييمات', 'Assessment History')}</CardTitle>
          </CardHeader>
          <CardContent>
            {scores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {tr('لا توجد تقييمات بعد', 'No assessments yet')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 px-3 text-start">{tr('التاريخ', 'Date')}</th>
                      <th className="py-2 px-3 text-start">{tr('المقيّم', 'Scorer')}</th>
                      <th className="py-2 px-3 text-center">{tr('APS', 'APS')}</th>
                      <th className="py-2 px-3 text-center">{tr('المجموع', 'Total')}</th>
                      <th className="py-2 px-3 text-center">{tr('الوفيات المتوقعة', 'Mortality')}</th>
                      <th className="py-2 px-3 text-center">{tr('المخاطر', 'Risk')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((s: any) => (
                      <tr key={s.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3">
                          {new Date(s.scoredAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-3">{s.scoredBy || '-'}</td>
                        <td className="py-2 px-3 text-center font-mono">{s.apsTotal ?? '-'}</td>
                        <td className="py-2 px-3 text-center font-bold text-lg">{s.totalScore}</td>
                        <td className="py-2 px-3 text-center">{s.predictedMortality}%</td>
                        <td className="py-2 px-3 text-center">{riskBadge(s.riskCategory, tr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- New Assessment Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{tr('تقييم APACHE II جديد', 'New APACHE II Assessment')}</DialogTitle>
          </DialogHeader>
          <IcuApacheScoreForm onSubmit={handleSubmit} saving={saving} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
