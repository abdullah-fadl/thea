'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { IcuCodeBlueForm } from '@/components/icu/IcuCodeBlueForm';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ICUCodeBlue() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [showNewCode, setShowNewCode] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Fetch code blue events (all recent)
  const { data, isLoading, mutate } = useSWR('/api/icu/code-blue', fetcher, {
    refreshInterval: 5000,
  });

  const events: any[] = data?.events ?? [];

  // KPI calculations
  const activeCodes = useMemo(() => events.filter((e) => e.status === 'ACTIVE').length, [events]);

  const codesToday = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return events.filter((e) => new Date(e.codeCalledAt) >= todayStart).length;
  }, [events]);

  const roscRate = useMemo(() => {
    const completed = events.filter((e) => e.outcome === 'ROSC' || e.outcome === 'DEATH');
    if (completed.length === 0) return 0;
    const roscCount = completed.filter((e) => e.outcome === 'ROSC').length;
    return Math.round((roscCount / completed.length) * 100);
  }, [events]);

  const avgResponseTime = useMemo(() => {
    // Approximate: difference between code called and first timeline event
    const times: number[] = [];
    for (const ev of events) {
      let timeline: any[] = [];
      try {
        timeline = ev.timelineEvents ? (typeof ev.timelineEvents === 'string' ? JSON.parse(ev.timelineEvents) : ev.timelineEvents) : [];
      } catch { continue; }
      if (timeline.length > 0 && ev.codeCalledAt) {
        const codeTime = new Date(ev.codeCalledAt).getTime();
        const sorted = [...timeline].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const firstEvent = new Date(sorted[0].timestamp).getTime();
        const diffMin = (firstEvent - codeTime) / 60000;
        if (diffMin >= 0 && diffMin < 60) times.push(diffMin);
      }
    }
    if (times.length === 0) return 0;
    return Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
  }, [events]);

  const formatDateTime = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusBadge = (status: string) => {
    if (status === 'ACTIVE') return <Badge variant="destructive">{tr('نشط', 'Active')}</Badge>;
    if (status === 'COMPLETED') return <Badge variant="default">{tr('مكتمل', 'Completed')}</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const outcomeBadge = (outcome: string | null) => {
    if (!outcome) return <Badge variant="outline">{tr('قيد التنفيذ', 'In Progress')}</Badge>;
    if (outcome === 'ROSC') return <Badge className="bg-green-600 text-white">{tr('ROSC — عودة الدورة', 'ROSC')}</Badge>;
    if (outcome === 'DEATH') return <Badge variant="destructive">{tr('وفاة', 'Death')}</Badge>;
    if (outcome === 'ONGOING') return <Badge variant="secondary">{tr('مستمر', 'Ongoing')}</Badge>;
    return <Badge variant="outline">{outcome}</Badge>;
  };

  const rhythmLabel = (rhythm: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      VF: { ar: 'رجفان بطيني', en: 'VF' },
      VT: { ar: 'تسرع بطيني', en: 'VT' },
      PEA: { ar: 'PEA', en: 'PEA' },
      ASYSTOLE: { ar: 'توقف القلب', en: 'Asystole' },
      BRADYCARDIA: { ar: 'بطء القلب', en: 'Bradycardia' },
      TACHYCARDIA: { ar: 'تسرع القلب', en: 'Tachycardia' },
    };
    return map[rhythm] ? tr(map[rhythm].ar, map[rhythm].en) : rhythm || '—';
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {tr('توثيق الإنعاش القلبي الرئوي', 'Code Blue Documentation')}
            </h1>
            <p className="text-muted-foreground">
              {tr('توثيق ACLS وإدارة أحداث الإنعاش', 'ACLS flowsheet and code blue event management')}
            </p>
          </div>
          <Button onClick={() => { setSelectedEvent(null); setShowNewCode(true); }} variant="destructive" size="lg">
            {tr('بدء إنعاش جديد', 'Initiate Code Blue')}
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className={activeCodes > 0 ? 'border-red-300 bg-red-50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {tr('إنعاشات نشطة', 'Active Codes')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${activeCodes > 0 ? 'text-red-600 animate-pulse' : 'text-foreground'}`}>
                {activeCodes}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {tr('إنعاشات اليوم', 'Codes Today')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{codesToday}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {tr('معدل ROSC', 'ROSC Rate')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${roscRate >= 50 ? 'text-green-600' : roscRate > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                {roscRate}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {tr('متوسط وقت الاستجابة', 'Avg Response Time')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {avgResponseTime > 0 ? `${avgResponseTime} ${tr('د', 'min')}` : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Event list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            {tr('جاري التحميل...', 'Loading...')}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {tr('لا توجد أحداث إنعاش مسجلة', 'No code blue events recorded')}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-start p-3 font-medium">{tr('التاريخ/الوقت', 'Date/Time')}</th>
                  <th className="text-start p-3 font-medium">{tr('الحالة', 'Status')}</th>
                  <th className="text-start p-3 font-medium">{tr('الموقع', 'Location')}</th>
                  <th className="text-start p-3 font-medium">{tr('الإيقاع الأولي', 'Initial Rhythm')}</th>
                  <th className="text-start p-3 font-medium">{tr('النتيجة', 'Outcome')}</th>
                  <th className="text-start p-3 font-medium">{tr('إجراء', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev: any) => (
                  <tr
                    key={ev.id}
                    className={`border-t hover:bg-muted/30 transition-colors cursor-pointer ${ev.status === 'ACTIVE' ? 'bg-red-50/50' : ''}`}
                    onClick={() => { setSelectedEvent(ev); setShowNewCode(true); }}
                  >
                    <td className="p-3">{formatDateTime(ev.codeCalledAt)}</td>
                    <td className="p-3">{statusBadge(ev.status)}</td>
                    <td className="p-3">{ev.location || '—'}</td>
                    <td className="p-3">
                      <Badge variant="outline">{rhythmLabel(ev.initialRhythm)}</Badge>
                    </td>
                    <td className="p-3">{outcomeBadge(ev.outcome)}</td>
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                          setShowNewCode(true);
                        }}
                      >
                        {ev.status === 'ACTIVE' ? tr('متابعة', 'Continue') : tr('عرض', 'View')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Full-screen dialog for Code Blue form */}
        <Dialog open={showNewCode} onOpenChange={setShowNewCode}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedEvent
                  ? tr('توثيق الإنعاش', 'Code Blue Documentation')
                  : tr('بدء إنعاش جديد', 'Initiate New Code Blue')}
              </DialogTitle>
            </DialogHeader>
            <IcuCodeBlueForm
              codeBlueId={selectedEvent?.id}
              initialData={selectedEvent}
              onSuccess={() => {
                setShowNewCode(false);
                setSelectedEvent(null);
                mutate();
              }}
              onCancel={() => {
                setShowNewCode(false);
                setSelectedEvent(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
