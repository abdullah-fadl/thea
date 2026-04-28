'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { toast } from '@/hooks/use-toast';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED'] as const;
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const CATEGORIES = [
  'billing',
  'clinical',
  'communication',
  'facility',
  'food',
  'medication',
  'staff',
  'wait_time',
  'other',
] as const;

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-300',
  ESCALATED: 'bg-rose-50 text-rose-700 border-rose-200',
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-amber-50 text-amber-700',
  CRITICAL: 'bg-rose-50 text-rose-700',
};

interface PxCase {
  id: string;
  caseNumber: number;
  status: string;
  severity: string | null;
  categoryKey: string | null;
  subjectName: string | null;
  subjectMrn: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  assignedDeptKey: string | null;
  assigneeUserId: string | null;
  satisfactionScore: number | null;
  resolutionNotes: string | null;
  detailsEn: string | null;
  detailsAr: string | null;
  dueAt: string | null;
  escalationLevel: number;
  resolvedAt: string | null;
  createdAt: string;
}

interface TimelineEntry {
  id: string;
  kind: string;
  body: string;
  authorName: string | null;
  createdAt: string;
}

function formatDateTime(iso: string | null, language: 'ar' | 'en'): string {
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

function timeUntil(iso: string | null, language: 'ar' | 'en'): string {
  if (!iso) return '—';
  const due = new Date(iso).getTime();
  if (Number.isNaN(due)) return '—';
  const diff = due - Date.now();
  const past = diff < 0;
  const mins = Math.abs(Math.round(diff / 60000));
  const formatted =
    mins < 60
      ? `${mins}m`
      : mins < 60 * 24
        ? `${Math.floor(mins / 60)}h ${mins % 60}m`
        : `${Math.floor(mins / (60 * 24))}d`;
  if (past) return language === 'ar' ? `متأخر ${formatted}` : `${formatted} overdue`;
  return language === 'ar' ? `بعد ${formatted}` : `in ${formatted}`;
}

export default function PxCases() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { isLoading: permLoading, hasPermission } = useRoutePermission('/patient-experience/cases');

  const [status, setStatus] = useState<string>('ALL');
  const [severity, setSeverity] = useState<string>('ALL');
  const [category, setCategory] = useState<string>('ALL');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sync ?case=<id> from URL on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get('case');
    if (id) setSelectedId(id);
  }, []);

  const params = useMemo(() => {
    const usp = new URLSearchParams();
    if (status !== 'ALL') usp.set('status', status);
    if (severity !== 'ALL') usp.set('severity', severity);
    if (category !== 'ALL') usp.set('categoryKey', category);
    if (q.trim()) usp.set('q', q.trim());
    if (dateFrom) usp.set('dateFrom', dateFrom);
    if (dateTo) usp.set('dateTo', dateTo);
    usp.set('page', String(page));
    usp.set('limit', String(limit));
    return usp.toString();
  }, [status, severity, category, q, dateFrom, dateTo, page]);

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    cases: PxCase[];
    total: number;
    page: number;
    limit: number;
  }>(`/api/patient-experience/cases?${params}`, fetcher, { revalidateOnFocus: false });

  const cases = useMemo(() => data?.cases ?? [], [data?.cases]);
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
            {tr('حالات تجربة المريض', 'Patient Experience Cases')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'تتبع الشكاوى والملاحظات والتصعيدات وحلّها وفقًا لاتفاقية الخدمة',
              'Track complaints, feedback and escalations against the SLA',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {tr('تحديث', 'Refresh')}
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {tr('حالة جديدة', 'New case')}
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <div className="md:col-span-2">
            <Label className="text-xs">{tr('بحث', 'Search')}</Label>
            <div className="relative">
              <Search className="absolute top-2.5 start-2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder={tr('اسم المريض أو رقم الملف', 'Patient name or MRN')}
                className="ps-8"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">{tr('الحالة', 'Status')}</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('الخطورة', 'Severity')}</Label>
            <Select
              value={severity}
              onValueChange={(v) => {
                setSeverity(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{tr('الفئة', 'Category')}</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mt-2">
          <div className="md:col-start-6">
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
            <span className="text-sm">{tr('فشل تحميل الحالات', 'Failed to load cases')}</span>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-start">
              <th className="text-start px-3 py-2 font-medium">#</th>
              <th className="text-start px-3 py-2 font-medium">
                {tr('الموضوع', 'Subject')}
              </th>
              <th className="text-start px-3 py-2 font-medium">
                {tr('الحالة', 'Status')}
              </th>
              <th className="text-start px-3 py-2 font-medium">
                {tr('الخطورة', 'Severity')}
              </th>
              <th className="text-start px-3 py-2 font-medium">
                {tr('الفئة', 'Category')}
              </th>
              <th className="text-start px-3 py-2 font-medium">
                {tr('الاستحقاق', 'Due')}
              </th>
              <th className="text-start px-3 py-2 font-medium">
                {tr('أُنشئت', 'Created')}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline-block" />
                </td>
              </tr>
            )}
            {!isLoading && cases.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {tr('لا توجد حالات', 'No cases')}
                </td>
              </tr>
            )}
            {!isLoading &&
              cases.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-border cursor-pointer hover:bg-muted/40"
                  onClick={() => setSelectedId(c.id)}
                >
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    #{c.caseNumber}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {c.subjectName ?? tr('مجهول', 'Anonymous')}
                    </div>
                    {c.subjectMrn && (
                      <div className="text-xs text-muted-foreground">{c.subjectMrn}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[c.status] ?? ''}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {c.severity && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${SEVERITY_COLORS[c.severity] ?? ''}`}
                      >
                        {c.severity}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{c.categoryKey ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{timeUntil(c.dueAt, language)}</td>
                  <td className="px-3 py-2 text-xs">
                    {formatDateTime(c.createdAt, language)}
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

      <CreateCaseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          mutate();
        }}
      />

      <CaseDetailDialog
        caseId={selectedId}
        onClose={() => setSelectedId(null)}
        onMutated={() => mutate()}
      />
    </div>
  );
}

function CreateCaseDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    subjectName: '',
    subjectMrn: '',
    contactPhone: '',
    contactEmail: '',
    severity: 'MEDIUM',
    categoryKey: 'other',
    detailsEn: '',
    detailsAr: '',
  });

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/patient-experience/cases', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          contactEmail: form.contactEmail || undefined,
          subjectName: form.subjectName || undefined,
          subjectMrn: form.subjectMrn || undefined,
          contactPhone: form.contactPhone || undefined,
          detailsEn: form.detailsEn || undefined,
          detailsAr: form.detailsAr || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: tr('فشل الإنشاء', 'Create failed'),
          description: data?.error ?? `${res.status}`,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: tr('تم إنشاء الحالة', 'Case created') });
      setForm({
        subjectName: '',
        subjectMrn: '',
        contactPhone: '',
        contactEmail: '',
        severity: 'MEDIUM',
        categoryKey: 'other',
        detailsEn: '',
        detailsAr: '',
      });
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{tr('حالة جديدة', 'New case')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{tr('اسم المريض', 'Patient name')}</Label>
              <Input
                value={form.subjectName}
                onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">{tr('رقم الملف', 'MRN')}</Label>
              <Input
                value={form.subjectMrn}
                onChange={(e) => setForm({ ...form, subjectMrn: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">{tr('الجوال', 'Phone')}</Label>
              <Input
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">{tr('البريد', 'Email')}</Label>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">{tr('الفئة', 'Category')}</Label>
              <Select
                value={form.categoryKey}
                onValueChange={(v) => setForm({ ...form, categoryKey: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{tr('الخطورة', 'Severity')}</Label>
              <Select
                value={form.severity}
                onValueChange={(v) => setForm({ ...form, severity: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">{tr('الوصف بالعربية', 'Details (Arabic)')}</Label>
            <textarea
              value={form.detailsAr}
              onChange={(e) => setForm({ ...form, detailsAr: e.target.value })}
              className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">{tr('الوصف بالإنجليزية', 'Details (English)')}</Label>
            <textarea
              value={form.detailsEn}
              onChange={(e) => setForm({ ...form, detailsEn: e.target.value })}
              className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {tr('إلغاء', 'Cancel')}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {tr('إنشاء', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CaseDetailDialog({
  caseId,
  onClose,
  onMutated,
}: {
  caseId: string | null;
  onClose: () => void;
  onMutated: () => void;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const open = caseId !== null;

  const { data, mutate, isLoading } = useSWR<{
    success: boolean;
    case: PxCase;
    timeline: TimelineEntry[];
  }>(open ? `/api/patient-experience/cases/${caseId}` : null, fetcher);

  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function patch(payload: Record<string, unknown>) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/patient-experience/cases/${caseId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: tr('فشل التحديث', 'Update failed'),
          description: json?.error ?? `${res.status}`,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: tr('تم التحديث', 'Updated') });
      mutate();
      onMutated();
    } finally {
      setSubmitting(false);
    }
  }

  async function addComment() {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/patient-experience/cases/${caseId}/comments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: comment.trim() }),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast({
          title: tr('فشل إضافة التعليق', 'Comment failed'),
          description: json?.error ?? `${res.status}`,
          variant: 'destructive',
        });
        return;
      }
      setComment('');
      mutate();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;
  const c = data?.case;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] overflow-y-auto"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {c ? (
              <>
                <span className="font-mono text-xs text-muted-foreground">
                  #{c.caseNumber}
                </span>
                {c.subjectName ?? tr('حالة', 'Case')}
              </>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !c ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Field label={tr('الحالة', 'Status')}>
                <Select
                  value={c.status}
                  onValueChange={(v) => patch({ status: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tr('الخطورة', 'Severity')}>
                <Select
                  value={c.severity ?? 'MEDIUM'}
                  onValueChange={(v) => patch({ severity: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tr('الاستحقاق', 'SLA Due')}>
                <span className="text-xs">{timeUntil(c.dueAt, language)}</span>
              </Field>
              <Field label={tr('التصعيد', 'Escalation')}>
                <span className="text-xs">L{c.escalationLevel}</span>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <Field label={tr('الفئة', 'Category')}>
                <Select
                  value={c.categoryKey ?? 'other'}
                  onValueChange={(v) => patch({ categoryKey: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tr('القسم', 'Department')}>
                <Input
                  defaultValue={c.assignedDeptKey ?? ''}
                  onBlur={(e) => {
                    const next = e.target.value.trim() || null;
                    if (next !== c.assignedDeptKey)
                      patch({ assignedDeptKey: next });
                  }}
                  className="h-8"
                />
              </Field>
            </div>

            {(c.detailsAr || c.detailsEn) && (
              <Card className="p-3 bg-muted/40">
                {c.detailsAr && <p className="text-sm" dir="rtl">{c.detailsAr}</p>}
                {c.detailsEn && (
                  <p className="text-sm mt-1" dir="ltr">
                    {c.detailsEn}
                  </p>
                )}
              </Card>
            )}

            <div>
              <Label className="text-xs">{tr('ملاحظات الحل', 'Resolution notes')}</Label>
              <textarea
                defaultValue={c.resolutionNotes ?? ''}
                onBlur={(e) => {
                  const next = e.target.value.trim() || null;
                  if (next !== c.resolutionNotes)
                    patch({ resolutionNotes: next });
                }}
                className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>

            {c.resolvedAt && (
              <div className="text-xs text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {tr('حُلّت', 'Resolved')} {formatDateTime(c.resolvedAt, language)}
              </div>
            )}

            <div>
              <h3 className="text-sm font-bold mb-2">
                {tr('السجل الزمني', 'Timeline')}
              </h3>
              <div className="space-y-2">
                {(data?.timeline ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="border-s-2 border-muted ps-3 py-1"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{t.kind}</span>
                      <span>·</span>
                      <span>{formatDateTime(t.createdAt, language)}</span>
                      {t.authorName && (
                        <>
                          <span>·</span>
                          <span>{t.authorName}</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm">{t.body}</p>
                  </div>
                ))}
                {(!data?.timeline || data.timeline.length === 0) && (
                  <p className="text-xs text-muted-foreground">
                    {tr('لا توجد إدخالات', 'No entries')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={tr('أضف تعليقًا…', 'Add a comment…')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    addComment();
                  }
                }}
              />
              <Button onClick={addComment} disabled={submitting || !comment.trim()} size="sm" className="gap-1">
                <MessageSquare className="h-4 w-4" />
                {tr('تعليق', 'Post')}
              </Button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
