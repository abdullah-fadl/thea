'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'CONCERN'] as const;

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  NEUTRAL: 'bg-slate-100 text-slate-700 border-slate-300',
  NEGATIVE: 'bg-amber-50 text-amber-700 border-amber-200',
  CONCERN: 'bg-rose-50 text-rose-700 border-rose-200',
};

interface VisitRow {
  id: string;
  patientName: string | null;
  patientMrn: string | null;
  departmentKey: string | null;
  visitDate: string | null;
  satisfactionScore: number | null;
  sentiment: string | null;
  hasComplaint: boolean;
  feedbackText: string | null;
  visitId: string | null;
  patientId: string | null;
}

interface PxCaseLink {
  id: string;
  caseNumber: number;
  status: string;
  severity: string | null;
  categoryKey: string | null;
  createdAt: string;
}

function formatDate(iso: string | null, language: 'ar' | 'en'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function PxVisits() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { isLoading: permLoading, hasPermission } = useRoutePermission('/patient-experience/visits');

  const [departmentKey, setDepartmentKey] = useState('');
  const [sentiment, setSentiment] = useState('ALL');
  const [hasComplaint, setHasComplaint] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const limit = 25;

  const params = useMemo(() => {
    const usp = new URLSearchParams();
    if (departmentKey.trim()) usp.set('departmentKey', departmentKey.trim());
    if (sentiment !== 'ALL') usp.set('sentiment', sentiment);
    if (hasComplaint !== 'ALL') usp.set('hasComplaint', hasComplaint);
    if (dateFrom) usp.set('dateFrom', dateFrom);
    if (dateTo) usp.set('dateTo', dateTo);
    usp.set('page', String(page));
    usp.set('limit', String(limit));
    return usp.toString();
  }, [departmentKey, sentiment, hasComplaint, dateFrom, dateTo, page]);

  const { data, error, isLoading, mutate } = useSWR<{
    visits: VisitRow[];
    total: number;
  }>(`/api/patient-experience/visits?${params}`, fetcher, {
    revalidateOnFocus: false,
  });

  const visits = useMemo(() => data?.visits ?? [], [data?.visits]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!hasPermission) return null;

  return (
    <div
      className="container mx-auto p-6 space-y-4"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold">
            {tr('زيارات تجربة المريض', 'Patient Experience Visits')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'مؤشرات الرضا والمشاعر وعلامات الشكاوى لكل زيارة',
              'Per-visit satisfaction, sentiment and complaint flags',
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {tr('تحديث', 'Refresh')}
        </Button>
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <div>
            <Label className="text-xs">{tr('القسم', 'Department')}</Label>
            <Input
              value={departmentKey}
              onChange={(e) => {
                setDepartmentKey(e.target.value);
                setPage(1);
              }}
              placeholder={tr('OPD، ER، ...', 'OPD, ER, ...')}
            />
          </div>
          <div>
            <Label className="text-xs">{tr('المشاعر', 'Sentiment')}</Label>
            <Select
              value={sentiment}
              onValueChange={(v) => {
                setSentiment(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                {SENTIMENTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('الشكوى', 'Complaint')}</Label>
            <Select
              value={hasComplaint}
              onValueChange={(v) => {
                setHasComplaint(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                <SelectItem value="true">{tr('نعم', 'Yes')}</SelectItem>
                <SelectItem value="false">{tr('لا', 'No')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('من', 'From')}</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <Label className="text-xs">{tr('إلى', 'To')}</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-4 border-rose-200 bg-rose-50 text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              {tr('فشل تحميل الزيارات', 'Failed to load visits')}
            </span>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start px-3 py-2 font-medium">{tr('المريض', 'Patient')}</th>
              <th className="text-start px-3 py-2 font-medium">{tr('القسم', 'Department')}</th>
              <th className="text-start px-3 py-2 font-medium">{tr('الزيارة', 'Visit')}</th>
              <th className="text-start px-3 py-2 font-medium">{tr('الرضا', 'Score')}</th>
              <th className="text-start px-3 py-2 font-medium">{tr('المشاعر', 'Sentiment')}</th>
              <th className="text-start px-3 py-2 font-medium">{tr('شكوى', 'Complaint')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center">
                  <Loader2 className="h-5 w-5 animate-spin inline-block text-muted-foreground" />
                </td>
              </tr>
            )}
            {!isLoading && visits.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {tr('لا توجد زيارات', 'No visits')}
                </td>
              </tr>
            )}
            {!isLoading &&
              visits.map((v) => (
                <tr
                  key={v.id}
                  className="border-t border-border cursor-pointer hover:bg-muted/40"
                  onClick={() => setSelectedId(v.id)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {v.patientName ?? tr('مجهول', 'Anonymous')}
                    </div>
                    {v.patientMrn && (
                      <div className="text-xs text-muted-foreground">{v.patientMrn}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{v.departmentKey ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{formatDate(v.visitDate, language)}</td>
                  <td className="px-3 py-2 text-xs">
                    {v.satisfactionScore != null ? `${v.satisfactionScore}/5` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {v.sentiment && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${SENTIMENT_COLORS[v.sentiment] ?? ''}`}
                      >
                        {v.sentiment}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {v.hasComplaint ? (
                      <span className="text-rose-700">{tr('نعم', 'Yes')}</span>
                    ) : (
                      <span className="text-muted-foreground">{tr('لا', 'No')}</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {tr('الإجمالي', 'Total')}: {total}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <VisitDetailDialog
        visitId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function VisitDetailDialog({
  visitId,
  onClose,
}: {
  visitId: string | null;
  onClose: () => void;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const open = visitId !== null;

  const { data, isLoading } = useSWR<{
    visit: VisitRow;
    linkedCases: PxCaseLink[];
  }>(open ? `/api/patient-experience/visits/${visitId}/feedback` : null, fetcher);

  if (!open) return null;
  const v = data?.visit;
  const linked = data?.linkedCases ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        <DialogHeader>
          <DialogTitle>
            {v?.patientName ?? tr('تفاصيل الزيارة', 'Visit details')}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !v ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr('رقم الملف', 'MRN')} value={v.patientMrn ?? '—'} />
              <Field label={tr('القسم', 'Department')} value={v.departmentKey ?? '—'} />
              <Field
                label={tr('تاريخ الزيارة', 'Visit date')}
                value={formatDate(v.visitDate, language)}
              />
              <Field
                label={tr('درجة الرضا', 'Satisfaction')}
                value={v.satisfactionScore != null ? `${v.satisfactionScore}/5` : '—'}
              />
              <Field
                label={tr('المشاعر', 'Sentiment')}
                value={v.sentiment ?? '—'}
              />
              <Field
                label={tr('شكوى', 'Complaint')}
                value={v.hasComplaint ? tr('نعم', 'Yes') : tr('لا', 'No')}
              />
            </div>
            {v.feedbackText && (
              <Card className="p-3 bg-muted/40">
                <Label className="text-xs">{tr('ملاحظات المريض', 'Feedback')}</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{v.feedbackText}</p>
              </Card>
            )}
            <div>
              <h3 className="text-sm font-bold mb-2">
                {tr('الحالات المرتبطة', 'Linked PX Cases')}
              </h3>
              {linked.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {tr('لا توجد', 'None')}
                </p>
              ) : (
                <ul className="space-y-1">
                  {linked.map((c) => (
                    <li key={c.id} className="text-xs">
                      <a
                        href={`/patient-experience/cases?case=${c.id}`}
                        className="hover:underline"
                      >
                        #{c.caseNumber} · {c.status} · {c.categoryKey ?? '—'}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="gap-1">
            <X className="h-4 w-4" />
            {tr('إغلاق', 'Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="text-sm mt-0.5">{value}</div>
    </div>
  );
}
