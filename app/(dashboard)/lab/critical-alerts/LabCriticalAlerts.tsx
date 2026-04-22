'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FlaskConical,
  Bell,
  BellOff,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type AlertFilter = 'unacknowledged' | 'all' | 'today';

export default function LabCriticalAlerts() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [filter, setFilter] = useState<AlertFilter>('unacknowledged');
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const prevUnackCountRef = useRef<number>(0);

  const queryParams = filter === 'unacknowledged' ? '?unacknowledged=true' : '';
  const { data, mutate } = useSWR(`/api/lab/critical-alerts${queryParams}`, fetcher, {
    refreshInterval: 5000,
  });

  const allAlerts = data?.alerts ?? [];

  // Filter for "today" option client-side
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const alerts = filter === 'today'
    ? allAlerts.filter((a: any) => new Date(a.createdAt) >= todayStart)
    : allAlerts;

  // Compute KPIs
  const unacknowledgedCount = allAlerts.filter((a: any) => !a.acknowledgedAt).length;
  const acknowledgedToday = allAlerts.filter(
    (a: any) => a.acknowledgedAt && new Date(a.acknowledgedAt) >= todayStart,
  ).length;

  // Avg response time (for acknowledged alerts)
  const ackedAlerts = allAlerts.filter((a: any) => a.acknowledgedAt);
  const avgResponseMs = ackedAlerts.length > 0
    ? ackedAlerts.reduce((sum: number, a: any) => {
        return sum + (new Date(a.acknowledgedAt).getTime() - new Date(a.createdAt).getTime());
      }, 0) / ackedAlerts.length
    : 0;
  const avgResponseMin = Math.round(avgResponseMs / 60000);

  const criticalTestCount = new Set(allAlerts.map((a: any) => a.testName ?? a.testCode)).size;

  // Audio notification when new unacknowledged alerts arrive
  useEffect(() => {
    if (audioEnabled && unacknowledgedCount > prevUnackCountRef.current && prevUnackCountRef.current > 0) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 200);
      } catch {
        // Audio not available
      }
    }
    prevUnackCountRef.current = unacknowledgedCount;
  }, [unacknowledgedCount, audioEnabled]);

  const handleAcknowledge = async (alertId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAcknowledging(alertId);
    try {
      const res = await fetch('/api/lab/critical-alerts', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });
      if (res.ok) {
        toast({ title: tr('تم التأكيد', 'Acknowledged') });
        mutate();
        if (selectedAlert?.id === alertId) {
          setSelectedAlert({ ...selectedAlert, acknowledgedAt: new Date().toISOString() });
        }
      } else {
        toast({ title: tr('خطأ', 'Error'), variant: 'destructive' });
      }
    } finally {
      setAcknowledging(null);
    }
  };

  const timeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} ${tr('د', 'min')}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${tr('س', 'hr')}`;
    const days = Math.floor(hours / 24);
    return `${days} ${tr('ي', 'd')}`;
  };

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              {tr('تنبيهات القيم الحرجة', 'Critical Value Alerts')}
              {unacknowledgedCount > 0 && (
                <Badge variant="destructive" className="animate-pulse ms-2">
                  {unacknowledgedCount}
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tr('إدارة ومتابعة القيم الحرجة', 'Manage and track critical values')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="gap-1.5"
          >
            {audioEnabled ? (
              <>
                <Bell className="w-4 h-4" />
                {tr('صوت مفعل', 'Sound On')}
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4" />
                {tr('صوت معطل', 'Sound Off')}
              </>
            )}
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className={unacknowledgedCount > 0 ? 'border-red-300 bg-red-50/30' : ''}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-50">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('غير مؤكدة', 'Unacknowledged')}</p>
                  <p className="text-2xl font-bold text-foreground">{unacknowledgedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-50">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('مؤكدة اليوم', 'Acknowledged Today')}</p>
                  <p className="text-2xl font-bold text-foreground">{acknowledgedToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('متوسط وقت الاستجابة', 'Avg Response Time')}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {avgResponseMin > 0 ? `${avgResponseMin} ${tr('د', 'min')}` : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-50">
                  <FlaskConical className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tr('فحوصات حرجة', 'Critical Tests')}</p>
                  <p className="text-2xl font-bold text-foreground">{criticalTestCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as AlertFilter)} className="mb-4">
          <TabsList>
            <TabsTrigger value="unacknowledged">
              {tr('غير مؤكدة', 'Unacknowledged')}
              {unacknowledgedCount > 0 && (
                <Badge variant="destructive" className="ms-1.5 text-[10px] px-1.5">{unacknowledgedCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">{tr('الكل', 'All')}</TabsTrigger>
            <TabsTrigger value="today">{tr('اليوم', 'Today')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Alert List */}
        <div className="space-y-2">
          {alerts.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400" />
                <p className="font-medium">{tr('لا توجد تنبيهات حرجة', 'No critical alerts')}</p>
              </CardContent>
            </Card>
          )}

          {alerts.map((alert: any) => {
            const isUnack = !alert.acknowledgedAt;
            const isRecent = alert.acknowledgedAt &&
              (Date.now() - new Date(alert.acknowledgedAt).getTime()) < 30 * 60 * 1000;

            return (
              <Card
                key={alert.id}
                className={`cursor-pointer transition-colors hover:shadow-md ${
                  isUnack
                    ? 'border-red-300 bg-red-50/50'
                    : isRecent
                    ? 'border-yellow-200 bg-yellow-50/30'
                    : ''
                }`}
                onClick={() => setSelectedAlert(alert)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-4">
                    {/* Priority indicator */}
                    <div className={`w-2 h-10 rounded-full shrink-0 ${isUnack ? 'bg-red-500 animate-pulse' : 'bg-muted'}`} />

                    {/* Test & Value info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground">{alert.testName ?? alert.testCode ?? '—'}</span>
                        <Badge variant={isUnack ? 'destructive' : 'secondary'}>
                          {isUnack ? tr('غير مؤكد', 'Unacknowledged') : tr('مؤكد', 'Acknowledged')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm">
                        <span className="text-muted-foreground">
                          {alert.patientName ?? '—'} {alert.mrn ? `(${alert.mrn})` : ''}
                        </span>
                        <span className="font-bold text-red-600 text-base">
                          {alert.value} {alert.unit ?? ''}
                        </span>
                        {alert.threshold && (
                          <span className="text-xs text-muted-foreground">
                            {tr('الحد:', 'Threshold:')} {alert.threshold}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Time & Action */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-end">
                        <span className={`text-sm font-medium ${isUnack ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {timeSince(alert.createdAt)} {tr('مضت', 'ago')}
                        </span>
                      </div>
                      {isUnack && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => handleAcknowledge(alert.id, e)}
                          disabled={acknowledging === alert.id}
                          className="shrink-0"
                        >
                          {acknowledging === alert.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            tr('تأكيد', 'Acknowledge')
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Alert Detail Dialog */}
        <Dialog open={!!selectedAlert} onOpenChange={(open) => { if (!open) setSelectedAlert(null); }}>
          <DialogContent className="max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {tr('تفاصيل التنبيه الحرج', 'Critical Alert Details')}
              </DialogTitle>
            </DialogHeader>

            {selectedAlert && (
              <div className="space-y-4">
                {/* Test Info */}
                <div className="bg-red-50/50 rounded-xl p-4 border border-red-200">
                  <div className="text-center mb-3">
                    <p className="text-sm text-muted-foreground">{selectedAlert.testName ?? selectedAlert.testCode}</p>
                    <p className="text-4xl font-bold text-red-600 mt-1">
                      {selectedAlert.value} <span className="text-lg">{selectedAlert.unit ?? ''}</span>
                    </p>
                    {selectedAlert.normalRange && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {tr('النطاق الطبيعي:', 'Normal Range:')} {selectedAlert.normalRange}
                      </p>
                    )}
                    {selectedAlert.threshold && (
                      <p className="text-xs text-muted-foreground">
                        {tr('حد التنبيه:', 'Alert Threshold:')} {selectedAlert.threshold}
                      </p>
                    )}
                  </div>
                </div>

                {/* Patient Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{tr('المريض', 'Patient')}</span>
                    <p className="font-medium">{selectedAlert.patientName ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{tr('رقم الملف', 'MRN')}</span>
                    <p className="font-medium">{selectedAlert.mrn ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{tr('وقت التنبيه', 'Alert Time')}</span>
                    <p className="font-medium">
                      {new Date(selectedAlert.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{tr('الحالة', 'Status')}</span>
                    <p className="font-medium">
                      {selectedAlert.acknowledgedAt
                        ? tr('مؤكد', 'Acknowledged')
                        : tr('غير مؤكد', 'Unacknowledged')}
                    </p>
                  </div>
                </div>

                {/* Acknowledged info */}
                {selectedAlert.acknowledgedAt && (
                  <div className="bg-green-50 rounded-xl p-3 border border-green-200 text-sm">
                    <p>
                      <span className="text-muted-foreground">{tr('تم التأكيد في:', 'Acknowledged at:')}</span>{' '}
                      <span className="font-medium">
                        {new Date(selectedAlert.acknowledgedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </span>
                    </p>
                    {selectedAlert.acknowledgedBy && (
                      <p className="mt-1">
                        <span className="text-muted-foreground">{tr('بواسطة:', 'By:')}</span>{' '}
                        <span className="font-medium">{selectedAlert.acknowledgedBy}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Clinical Context */}
                {selectedAlert.clinicalContext && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">{tr('السياق السريري', 'Clinical Context')}</h4>
                    <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                      {selectedAlert.clinicalContext}
                    </p>
                  </div>
                )}

                {/* Test History */}
                {selectedAlert.history && Array.isArray(selectedAlert.history) && selectedAlert.history.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">{tr('سجل الفحص', 'Test History')}</h4>
                    <div className="space-y-1">
                      {selectedAlert.history.map((h: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                          <span className="text-muted-foreground">
                            {new Date(h.date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                          </span>
                          <span className={`font-medium ${h.critical ? 'text-red-600' : 'text-foreground'}`}>
                            {h.value} {h.unit ?? ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Acknowledge button in dialog */}
                {!selectedAlert.acknowledgedAt && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleAcknowledge(selectedAlert.id)}
                    disabled={acknowledging === selectedAlert.id}
                  >
                    {acknowledging === selectedAlert.id ? (
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 me-2" />
                    )}
                    {tr('تأكيد التنبيه الحرج', 'Acknowledge Critical Alert')}
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
