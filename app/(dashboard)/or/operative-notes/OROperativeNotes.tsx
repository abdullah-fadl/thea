'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Scissors,
  Search,
  RefreshCw,
  FileText,
  CheckCircle2,
  Clock,
  PenLine,
  User,
  Calendar,
} from 'lucide-react';
import OrOperativeNoteForm from '@/components/or/OrOperativeNoteForm';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type NoteFilter = 'ALL' | 'DRAFT' | 'SIGNED' | 'PENDING';

export default function OROperativeNotes() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/or/cases');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<NoteFilter>('ALL');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Fetch today's cases
  const { data, isLoading, mutate } = useSWR(
    '/api/or/cases?limit=200',
    fetcher,
    { refreshInterval: 15000 },
  );

  const allCases: any[] = data?.items || [];

  // Derive note status per case
  const casesWithNoteStatus = useMemo(() => {
    return allCases.map((c: any) => {
      const noteStatus = c.operativeNoteStatus || c._noteStatus || null;
      let derivedNoteStatus: string;
      if (noteStatus === 'SIGNED' || noteStatus === 'AMENDED') {
        derivedNoteStatus = 'SIGNED';
      } else if (noteStatus === 'DRAFT') {
        derivedNoteStatus = 'DRAFT';
      } else {
        derivedNoteStatus = 'PENDING';
      }
      return { ...c, derivedNoteStatus };
    });
  }, [allCases]);

  // KPI counts
  const kpis = useMemo(() => {
    const total = casesWithNoteStatus.length;
    const drafted = casesWithNoteStatus.filter((c) => c.derivedNoteStatus === 'DRAFT').length;
    const signed = casesWithNoteStatus.filter((c) => c.derivedNoteStatus === 'SIGNED').length;
    const pending = casesWithNoteStatus.filter((c) => c.derivedNoteStatus === 'PENDING').length;
    return { total, drafted, signed, pending };
  }, [casesWithNoteStatus]);

  // Filter + search
  const displayed = useMemo(() => {
    let items = casesWithNoteStatus;

    if (filter !== 'ALL') {
      items = items.filter((c) => c.derivedNoteStatus === filter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (c) =>
          (c.patientName || '').toLowerCase().includes(q) ||
          (c.procedureName || '').toLowerCase().includes(q) ||
          (c.mrn || '').toLowerCase().includes(q),
      );
    }

    return items;
  }, [casesWithNoteStatus, filter, search]);

  const handleDialogClose = () => {
    setSelectedCaseId(null);
    mutate();
  };

  if (permLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div className="space-y-6 p-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-500" />
            {tr('التقارير الجراحية', 'Operative Notes')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('إنشاء وتوقيع التقارير الجراحية لجميع العمليات', 'Create and sign operative notes for all surgical cases')}
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted/50 text-muted-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> {tr('تحديث', 'Refresh')}
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: tr('إجمالي العمليات', 'Total Cases'), value: kpis.total, color: 'text-foreground', icon: Scissors },
          { label: tr('مسودات', 'Drafted'), value: kpis.drafted, color: 'text-amber-600', icon: PenLine },
          { label: tr('موقّعة', 'Signed'), value: kpis.signed, color: 'text-green-600', icon: CheckCircle2 },
          { label: tr('معلّقة', 'Pending'), value: kpis.pending, color: 'text-red-600', icon: Clock },
        ].map((kpi, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filter tabs + Search ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {([
            { key: 'ALL' as NoteFilter, ar: 'الكل', en: 'All' },
            { key: 'DRAFT' as NoteFilter, ar: 'مسودة', en: 'Draft' },
            { key: 'SIGNED' as NoteFilter, ar: 'موقّع', en: 'Signed' },
            { key: 'PENDING' as NoteFilter, ar: 'معلّق', en: 'Pending' },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${
                filter === t.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tr(t.ar, t.en)}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder={tr('بحث بالمريض أو العملية...', 'Search by patient or procedure...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && displayed.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {tr('لا توجد عمليات', 'No surgical cases found')}
        </div>
      )}

      {/* ── Cases Grid ── */}
      {!isLoading && displayed.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map((c: any) => {
            const noteStatusConfig: Record<string, { labelAr: string; labelEn: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; color: string }> = {
              SIGNED: { labelAr: 'موقّع', labelEn: 'Signed', variant: 'default', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
              DRAFT: { labelAr: 'مسودة', labelEn: 'Draft', variant: 'secondary', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
              PENDING: { labelAr: 'معلّق', labelEn: 'Pending', variant: 'outline', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
            };
            const nsc = noteStatusConfig[c.derivedNoteStatus] || noteStatusConfig.PENDING;

            return (
              <div
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className="bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 cursor-pointer transition-all"
              >
                {/* Patient + Status row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">
                        {c.patientName || tr('غير معروف', 'Unknown')}
                      </p>
                      {c.mrn && <p className="text-[10px] text-muted-foreground font-mono">{c.mrn}</p>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${nsc.color}`}>
                    {isAr ? nsc.labelAr : nsc.labelEn}
                  </span>
                </div>

                {/* Procedure */}
                <p className="text-sm text-foreground truncate mb-2">
                  {c.procedureName || '---'}
                </p>

                {/* Footer: date + case status */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '---'}
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {c.status || 'OPEN'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Operative Note Dialog ── */}
      <Dialog open={!!selectedCaseId} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('التقرير الجراحي', 'Operative Note')}</DialogTitle>
            <DialogDescription>
              {tr('تعبئة وتوقيع التقرير الجراحي لهذه العملية', 'Complete and sign the operative note for this case')}
            </DialogDescription>
          </DialogHeader>
          {selectedCaseId && (
            <OrOperativeNoteForm
              caseId={selectedCaseId}
              onSaved={() => mutate()}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
