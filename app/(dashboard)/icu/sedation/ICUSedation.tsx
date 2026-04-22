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
import IcuSedationForm from '@/components/icu/IcuSedationForm';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ICUSedation() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [selectedEpisode, setSelectedEpisode] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch active ICU episodes
  const { data: episodesData } = useSWR('/api/ipd/episodes/by-encounter?status=ACTIVE', fetcher, { refreshInterval: 15000 });
  const episodes: any[] = episodesData?.episodes || episodesData?.items || [];

  // Fetch sedation assessments
  const { data: assessmentsData, mutate } = useSWR(
    selectedEpisode ? `/api/icu/episodes/${selectedEpisode}/sedation` : null,
    fetcher,
    { refreshInterval: 15000 },
  );
  const assessments: any[] = assessmentsData?.assessments || [];
  const latest = assessments[0] || null;

  const handleSubmit = async (data: Record<string, any>) => {
    if (!selectedEpisode) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/icu/episodes/${selectedEpisode}/sedation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم حفظ تقييم التخدير', 'Sedation assessment saved') });
      setDialogOpen(false);
      mutate();
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل حفظ التقييم', 'Failed to save assessment'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const scoreLabel = (scaleType: string, score: number) => {
    if (scaleType === 'RASS') {
      const labels: Record<number, { ar: string; en: string }> = {
        4: { ar: 'هيجان شديد', en: 'Combative' },
        3: { ar: 'هياج شديد', en: 'Very Agitated' },
        2: { ar: 'هياج', en: 'Agitated' },
        1: { ar: 'حركة زائدة', en: 'Restless' },
        0: { ar: 'متيقظ وهادئ', en: 'Alert & Calm' },
        [-1]: { ar: 'نعسان', en: 'Drowsy' },
        [-2]: { ar: 'تخدير خفيف', en: 'Light Sedation' },
        [-3]: { ar: 'تخدير متوسط', en: 'Moderate Sedation' },
        [-4]: { ar: 'تخدير عميق', en: 'Deep Sedation' },
        [-5]: { ar: 'غير قابل للإيقاظ', en: 'Unarousable' },
      };
      const l = labels[score];
      return l ? tr(l.ar, l.en) : String(score);
    }
    return String(score);
  };

  const onTargetBadge = (onTarget: boolean | null) => {
    if (onTarget == null) return null;
    return (
      <Badge className={onTarget ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
        {onTarget ? tr('في المستهدف', 'On Target') : tr('خارج المستهدف', 'Off Target')}
      </Badge>
    );
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">{tr('مقياس التخدير (RASS/SAS)', 'Sedation Scale (RASS/SAS)')}</h1>

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

      {/* ---- Current Status Card ---- */}
      {selectedEpisode && latest && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('الحالة الحالية', 'Current Status')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{tr('المقياس', 'Scale')}</p>
                <Badge variant="outline" className="text-base mt-1">{latest.scaleType}</Badge>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{tr('الدرجة الحالية', 'Current Score')}</p>
                <p className="text-3xl font-extrabold mt-1">
                  {latest.scaleType === 'RASS' && latest.score > 0 ? '+' : ''}{latest.score}
                </p>
                <p className="text-xs text-muted-foreground">{scoreLabel(latest.scaleType, latest.score)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{tr('المستهدف', 'Target')}</p>
                <p className="text-2xl font-bold mt-1">{latest.targetScore != null ? latest.targetScore : '-'}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{tr('الحالة', 'Status')}</p>
                <div className="mt-2">{onTargetBadge(latest.onTarget)}</div>
              </div>
            </div>
            {latest.painScore != null && (
              <div className="mt-3 text-center">
                <p className="text-xs text-muted-foreground">{tr('درجة الألم', 'Pain Score')}</p>
                <p className="text-xl font-bold">{latest.painScore}/10</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- History Table ---- */}
      {selectedEpisode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('سجل التقييمات', 'Assessment History')}</CardTitle>
          </CardHeader>
          <CardContent>
            {assessments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {tr('لا توجد تقييمات بعد', 'No assessments yet')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 px-3 text-start">{tr('الوقت', 'Time')}</th>
                      <th className="py-2 px-3 text-center">{tr('المقياس', 'Scale')}</th>
                      <th className="py-2 px-3 text-center">{tr('الدرجة', 'Score')}</th>
                      <th className="py-2 px-3 text-center">{tr('المستهدف', 'Target')}</th>
                      <th className="py-2 px-3 text-center">{tr('الحالة', 'Status')}</th>
                      <th className="py-2 px-3 text-center">{tr('الألم', 'Pain')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map((a: any) => (
                      <tr key={a.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3">
                          {new Date(a.assessedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant="outline">{a.scaleType}</Badge>
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          {a.scaleType === 'RASS' && a.score > 0 ? '+' : ''}{a.score}
                        </td>
                        <td className="py-2 px-3 text-center">{a.targetScore != null ? a.targetScore : '-'}</td>
                        <td className="py-2 px-3 text-center">{onTargetBadge(a.onTarget)}</td>
                        <td className="py-2 px-3 text-center">{a.painScore != null ? `${a.painScore}/10` : '-'}</td>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{tr('تقييم تخدير جديد', 'New Sedation Assessment')}</DialogTitle>
          </DialogHeader>
          <IcuSedationForm onSubmit={handleSubmit} saving={saving} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
