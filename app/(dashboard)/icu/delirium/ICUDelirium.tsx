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
import IcuDeliriumForm from '@/components/icu/IcuDeliriumForm';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ICUDelirium() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [selectedEpisode, setSelectedEpisode] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch active ICU episodes
  const { data: episodesData } = useSWR('/api/ipd/episodes/by-encounter?status=ACTIVE', fetcher, { refreshInterval: 15000 });
  const episodes: any[] = episodesData?.episodes || episodesData?.items || [];

  // Fetch delirium screens
  const { data: screensData, mutate } = useSWR(
    selectedEpisode ? `/api/icu/episodes/${selectedEpisode}/delirium` : null,
    fetcher,
    { refreshInterval: 15000 },
  );
  const screens: any[] = screensData?.screens || [];
  const latest = screens[0] || null;

  const handleSubmit = async (data: Record<string, any>) => {
    if (!selectedEpisode) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/icu/episodes/${selectedEpisode}/delirium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم حفظ فحص الهذيان', 'Delirium screening saved') });
      setDialogOpen(false);
      mutate();
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل حفظ الفحص', 'Failed to save screening'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resultBadge = (screen: any) => {
    if (screen.tooSedated) {
      return <Badge className="bg-yellow-100 text-yellow-800">{tr('مخدر بعمق', 'Too Sedated')}</Badge>;
    }
    if (screen.camIcuPositive === true) {
      return <Badge className="bg-red-100 text-red-800">{tr('إيجابي - هذيان', 'Positive - Delirium')}</Badge>;
    }
    if (screen.camIcuPositive === false) {
      return <Badge className="bg-green-100 text-green-800">{tr('سلبي', 'Negative')}</Badge>;
    }
    return <Badge variant="outline">{tr('غير محدد', 'Undetermined')}</Badge>;
  };

  const deliriumTypeBadge = (type: string | null) => {
    if (!type) return null;
    const labels: Record<string, { ar: string; en: string; cls: string }> = {
      HYPERACTIVE: { ar: 'مفرط النشاط', en: 'Hyperactive', cls: 'bg-red-50 text-red-700' },
      HYPOACTIVE: { ar: 'ناقص النشاط', en: 'Hypoactive', cls: 'bg-blue-50 text-blue-700' },
      MIXED: { ar: 'مختلط', en: 'Mixed', cls: 'bg-purple-50 text-purple-700' },
    };
    const info = labels[type] || { ar: type, en: type, cls: '' };
    return <Badge className={info.cls}>{tr(info.ar, info.en)}</Badge>;
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">{tr('فحص الهذيان (CAM-ICU)', 'Delirium Screening (CAM-ICU)')}</h1>

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
            {tr('فحص جديد', 'New Screening')}
          </Button>
        </CardContent>
      </Card>

      {/* ---- Current Status Card ---- */}
      {selectedEpisode && latest && (
        <Card className={`border-2 ${latest.camIcuPositive ? 'border-red-400' : latest.tooSedated ? 'border-yellow-400' : 'border-green-400'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('الحالة الحالية', 'Current Status')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">{tr('آخر فحص', 'Last Screen')}</p>
                <p className="text-sm font-medium mt-1">
                  {new Date(latest.screenedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">RASS</p>
                <p className="text-2xl font-bold mt-1">{latest.rassScore ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tr('النتيجة', 'Result')}</p>
                <div className="mt-2">{resultBadge(latest)}</div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tr('النوع', 'Type')}</p>
                <div className="mt-2">{deliriumTypeBadge(latest.deliriumType) || <span className="text-muted-foreground">-</span>}</div>
              </div>
            </div>
            {/* Features summary */}
            {!latest.tooSedated && (
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                <Badge variant="outline" className={latest.feature1AcuteOnset ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}>
                  {tr('سمة 1', 'F1')}: {latest.feature1AcuteOnset ? '+' : '-'}
                </Badge>
                <Badge variant="outline" className={latest.feature2Inattention ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}>
                  {tr('سمة 2', 'F2')}: {latest.feature2Inattention ? '+' : '-'}
                </Badge>
                <Badge variant="outline" className={latest.feature3AlteredLOC ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}>
                  {tr('سمة 3', 'F3')}: {latest.feature3AlteredLOC ? '+' : '-'}
                </Badge>
                <Badge variant="outline" className={latest.feature4DisorganizedThinking ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}>
                  {tr('سمة 4', 'F4')}: {latest.feature4DisorganizedThinking ? '+' : '-'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- Screening History Table ---- */}
      {selectedEpisode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('سجل الفحوصات', 'Screening History')}</CardTitle>
          </CardHeader>
          <CardContent>
            {screens.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {tr('لا توجد فحوصات بعد', 'No screenings yet')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 px-3 text-start">{tr('الوقت', 'Time')}</th>
                      <th className="py-2 px-3 text-center">RASS</th>
                      <th className="py-2 px-3 text-center">{tr('سمة 1', 'F1')}</th>
                      <th className="py-2 px-3 text-center">{tr('سمة 2', 'F2')}</th>
                      <th className="py-2 px-3 text-center">{tr('سمة 3', 'F3')}</th>
                      <th className="py-2 px-3 text-center">{tr('سمة 4', 'F4')}</th>
                      <th className="py-2 px-3 text-center">{tr('النتيجة', 'Result')}</th>
                      <th className="py-2 px-3 text-center">{tr('النوع', 'Type')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screens.map((s: any) => (
                      <tr key={s.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3">
                          {new Date(s.screenedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">{s.rassScore ?? '-'}</td>
                        <td className="py-2 px-3 text-center">
                          {s.tooSedated ? '-' : s.feature1AcuteOnset ? <span className="text-red-600 font-bold">+</span> : <span className="text-green-600">-</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {s.tooSedated ? '-' : s.feature2Inattention ? <span className="text-red-600 font-bold">+</span> : <span className="text-green-600">-</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {s.tooSedated ? '-' : s.feature3AlteredLOC ? <span className="text-red-600 font-bold">+</span> : <span className="text-green-600">-</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {s.tooSedated ? '-' : s.feature4DisorganizedThinking ? <span className="text-red-600 font-bold">+</span> : <span className="text-green-600">-</span>}
                        </td>
                        <td className="py-2 px-3 text-center">{resultBadge(s)}</td>
                        <td className="py-2 px-3 text-center">{deliriumTypeBadge(s.deliriumType) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- New Screening Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{tr('فحص هذيان جديد (CAM-ICU)', 'New Delirium Screening (CAM-ICU)')}</DialogTitle>
          </DialogHeader>
          <IcuDeliriumForm onSubmit={handleSubmit} saving={saving} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
