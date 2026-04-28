'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Phone,
  MessageSquare,
  Users,
  Bell,
  Timer,
  ShieldAlert,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ─── Types ──────────────────────────────────────────────────────────── */
interface CriticalFinding {
  id: string;
  orderId: string;
  testCode: string; // modality
  testName: string; // study type
  patientName: string;
  mrn: string;
  value: string; // finding text
  criticalType: string; // severity: CRITICAL | URGENT
  source: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  threshold: string | null; // JSON with communication details
  createdAt: string;
}

interface Stats {
  unacknowledged: number;
  acknowledgedToday: number;
  avgCommTimeMinutes: number;
  totalThisWeek: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function timeSince(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return lang === 'ar' ? `${mins} دقيقة` : `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'ar' ? `${hrs} ساعة` : `${hrs} hr`;
  const days = Math.floor(hrs / 24);
  return lang === 'ar' ? `${days} يوم` : `${days} day`;
}

function parseCommunicationDetails(threshold: string | null) {
  if (!threshold) return null;
  try {
    return JSON.parse(threshold);
  } catch {
    return null;
  }
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function RadiologyCriticalFindings() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState('unacknowledged');
  const [acknowledgeDialog, setAcknowledgeDialog] = useState<CriticalFinding | null>(null);
  const [communicationMethod, setCommunicationMethod] = useState('phone');
  const [referringPhysicianName, setReferringPhysicianName] = useState('');
  const [communicationNotes, setCommunicationNotes] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);

  const apiUrl = `/api/radiology/critical-findings${statusFilter ? `?status=${statusFilter}` : ''}`;
  const { data, isLoading, mutate } = useSWR(apiUrl, fetcher, { refreshInterval: 5000 });

  const findings: CriticalFinding[] = Array.isArray(data?.findings) ? data.findings : [];
  const stats: Stats = data?.stats || { unacknowledged: 0, acknowledgedToday: 0, avgCommTimeMinutes: 0, totalThisWeek: 0 };

  // Check ACR 60-min window compliance
  const isWithin60Min = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    return diff <= 60 * 60 * 1000;
  };

  const handleAcknowledge = async () => {
    if (!acknowledgeDialog) return;
    if (!referringPhysicianName.trim()) {
      toast({ title: tr('اسم الطبيب المحول مطلوب', 'Referring physician name is required'), variant: 'destructive' });
      return;
    }
    setAcknowledging(true);
    try {
      const res = await fetch('/api/radiology/critical-findings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findingId: acknowledgeDialog.id,
          communicationMethod,
          referringPhysicianName,
          communicationNotes,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم توثيق التبليغ بنجاح', 'Communication documented successfully') });
      setAcknowledgeDialog(null);
      setCommunicationMethod('phone');
      setReferringPhysicianName('');
      setCommunicationNotes('');
      await mutate();
    } catch {
      toast({ title: tr('فشل توثيق التبليغ', 'Failed to document communication'), variant: 'destructive' });
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-red-600" />
              {tr('تنبيهات النتائج الحرجة', 'Critical Finding Alerts')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tr('إدارة تبليغ النتائج الحرجة - معايير ACR', 'Critical results communication management - ACR Guidelines')}
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-950/40 rounded-xl">
                <Bell className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.unacknowledged}</p>
                <p className="text-xs text-muted-foreground">{tr('غير مبلغة', 'Unacknowledged')}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-950/40 rounded-xl">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.acknowledgedToday}</p>
                <p className="text-xs text-muted-foreground">{tr('تم التبليغ اليوم', 'Acknowledged Today')}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-950/40 rounded-xl">
                <Timer className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.avgCommTimeMinutes} {tr('د', 'min')}
                </p>
                <p className="text-xs text-muted-foreground">{tr('متوسط وقت التبليغ', 'Avg Communication Time')}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-950/40 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalThisWeek}</p>
                <p className="text-xs text-muted-foreground">{tr('هذا الأسبوع', 'Total This Week')}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filter */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-4">
            <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder={tr('الحالة', 'Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unacknowledged">{tr('غير مبلغة', 'Unacknowledged')}</SelectItem>
                <SelectItem value="acknowledged">{tr('تم التبليغ', 'Acknowledged')}</SelectItem>
                <SelectItem value="__all__">{tr('الكل', 'All')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {isLoading ? (
            <Card className="p-12 text-center text-muted-foreground">
              {tr('جاري التحميل...', 'Loading...')}
            </Card>
          ) : findings.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium">{tr('لا توجد تنبيهات', 'No alerts found')}</p>
            </Card>
          ) : (
            findings.map((finding) => {
              const isAck = !!finding.acknowledgedAt;
              const withinWindow = isWithin60Min(finding.createdAt);
              const commDetails = parseCommunicationDetails(finding.threshold);
              const timeSinceReport = timeSince(finding.createdAt, language);

              return (
                <Card
                  key={finding.id}
                  className={`p-4 transition-colors ${
                    !isAck
                      ? withinWindow
                        ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/10'
                        : 'border-red-500 dark:border-red-600 bg-red-100/50 dark:bg-red-950/20'
                      : 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {!isAck && (
                          <Badge className="bg-red-600 text-white text-xs animate-pulse">
                            {tr('غير مبلغة', 'UNACKNOWLEDGED')}
                          </Badge>
                        )}
                        {isAck && (
                          <Badge className="bg-green-100 text-green-700 text-xs">
                            {tr('تم التبليغ', 'ACKNOWLEDGED')}
                          </Badge>
                        )}
                        <Badge className={`text-xs ${
                          finding.criticalType === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {finding.criticalType === 'CRITICAL' ? tr('حرج', 'CRITICAL') : tr('عاجل', 'URGENT')}
                        </Badge>
                        {finding.testCode && (
                          <Badge variant="outline" className="text-xs">{finding.testCode}</Badge>
                        )}
                        {!isAck && !withinWindow && (
                          <Badge className="bg-red-700 text-white text-xs">
                            {tr('تجاوز 60 دقيقة', 'Exceeded 60 min')}
                          </Badge>
                        )}
                      </div>

                      {/* Finding details */}
                      <p className="font-semibold text-foreground mb-1">
                        {finding.value}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <span className="text-muted-foreground">{tr('المريض:', 'Patient:')}</span>{' '}
                          <span className="font-medium text-foreground">{finding.patientName || '---'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{tr('رقم الملف:', 'MRN:')}</span>{' '}
                          <span className="font-medium text-foreground">{finding.mrn || '---'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{tr('نوع الدراسة:', 'Study Type:')}</span>{' '}
                          <span className="font-medium text-foreground">{finding.testName || '---'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{tr('منذ:', 'Since:')}</span>{' '}
                          <span className={`font-medium ${!isAck && !withinWindow ? 'text-red-600' : 'text-foreground'}`}>
                            {timeSinceReport}
                          </span>
                        </div>
                      </div>

                      {/* Communication details if acknowledged */}
                      {isAck && commDetails && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-lg text-sm">
                          <div className="flex items-center gap-3 flex-wrap text-green-700 dark:text-green-400">
                            {commDetails.communicationMethod === 'phone' && <Phone className="h-3.5 w-3.5" />}
                            {commDetails.communicationMethod === 'in_person' && <Users className="h-3.5 w-3.5" />}
                            {commDetails.communicationMethod === 'secure_message' && <MessageSquare className="h-3.5 w-3.5" />}
                            <span>
                              {commDetails.communicationMethod === 'phone'
                                ? tr('هاتفيا', 'By Phone')
                                : commDetails.communicationMethod === 'in_person'
                                ? tr('شخصيا', 'In Person')
                                : tr('رسالة آمنة', 'Secure Message')}
                            </span>
                            {commDetails.referringPhysicianName && (
                              <>
                                <span className="text-muted-foreground">|</span>
                                <span>
                                  {tr('الطبيب:', 'Physician:')} {commDetails.referringPhysicianName}
                                </span>
                              </>
                            )}
                            {finding.acknowledgedAt && (
                              <>
                                <span className="text-muted-foreground">|</span>
                                <span>
                                  {new Date(finding.acknowledgedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                          {commDetails.communicationNotes && (
                            <p className="mt-1 text-xs text-muted-foreground">{commDetails.communicationNotes}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    {!isAck && (
                      <Button
                        onClick={() => setAcknowledgeDialog(finding)}
                        className="bg-red-600 hover:bg-red-700 text-white gap-1.5 shrink-0"
                        size="sm"
                      >
                        <Phone className="h-4 w-4" />
                        {tr('توثيق التبليغ', 'Communicate Finding')}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* ACR Guidelines note */}
        <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                {tr('إرشادات ACR للنتائج الحرجة', 'ACR Practice Guideline for Critical Results')}
              </p>
              <p className="text-amber-700 dark:text-amber-400 mt-1">
                {tr(
                  'يجب تبليغ النتائج الحرجة للطبيب المحول خلال 60 دقيقة من اكتشافها. يجب توثيق طريقة التبليغ ووقته واسم المستلم.',
                  'Critical results must be communicated to the referring physician within 60 minutes of detection. Communication method, time, and recipient name must be documented.'
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Acknowledge Dialog ──────────────────────────────────────── */}
      <Dialog open={!!acknowledgeDialog} onOpenChange={(open) => !open && setAcknowledgeDialog(null)}>
        <DialogContent className="sm:max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('توثيق تبليغ النتيجة الحرجة', 'Communicate Critical Finding')}</DialogTitle>
          </DialogHeader>

          {acknowledgeDialog && (
            <div className="space-y-4">
              {/* Finding summary */}
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm">
                <p className="font-semibold text-red-800 dark:text-red-300">{acknowledgeDialog.value}</p>
                <p className="text-red-700 dark:text-red-400 mt-1">
                  {acknowledgeDialog.patientName} - MRN: {acknowledgeDialog.mrn || '---'}
                </p>
              </div>

              {/* Communication method */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {tr('طريقة التبليغ', 'Communication Method')} *
                </label>
                <Select value={communicationMethod} onValueChange={setCommunicationMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" />
                        {tr('هاتفيا', 'By Phone')}
                      </div>
                    </SelectItem>
                    <SelectItem value="in_person">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" />
                        {tr('شخصيا', 'In Person')}
                      </div>
                    </SelectItem>
                    <SelectItem value="secure_message">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {tr('رسالة آمنة', 'Secure Message')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Referring physician */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {tr('الطبيب المحول / المستلم', 'Referring Physician / Recipient')} *
                </label>
                <Input
                  value={referringPhysicianName}
                  onChange={(e) => setReferringPhysicianName(e.target.value)}
                  placeholder={tr('اسم الطبيب المحول...', 'Referring physician name...')}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {tr('ملاحظات إضافية', 'Additional Notes')}
                </label>
                <Textarea
                  value={communicationNotes}
                  onChange={(e) => setCommunicationNotes(e.target.value)}
                  rows={2}
                  placeholder={tr('ملاحظات...', 'Notes...')}
                  className="text-sm"
                />
              </div>

              {/* 60-min compliance indicator */}
              {acknowledgeDialog && (
                <div
                  className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
                    isWithin60Min(acknowledgeDialog.createdAt)
                      ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                      : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
                  }`}
                >
                  <Timer className="h-3.5 w-3.5" />
                  {isWithin60Min(acknowledgeDialog.createdAt)
                    ? tr('ضمن نافذة الـ 60 دقيقة (ACR)', 'Within 60-minute window (ACR)')
                    : tr('تجاوز نافذة الـ 60 دقيقة (ACR)', 'Exceeded 60-minute window (ACR)')}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAcknowledgeDialog(null)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={handleAcknowledge}
              disabled={acknowledging || !referringPhysicianName.trim()}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {acknowledging
                ? tr('جاري التوثيق...', 'Documenting...')
                : tr('توثيق التبليغ', 'Document Communication')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
