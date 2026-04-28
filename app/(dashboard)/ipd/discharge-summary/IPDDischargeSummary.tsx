'use client';

// =============================================================================
// IPDDischargeSummary — Episode listing + discharge summary management
// =============================================================================

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Search,
  RefreshCw,
  ClipboardCheck,
  FileSignature,
  Clock,
  AlertCircle,
  User,
  Calendar,
} from 'lucide-react';
import EnhancedDischargeSummaryForm from '@/components/ipd/EnhancedDischargeSummaryForm';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null): string {
  if (!iso) return '---';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Episode status display ───────────────────────────────────────────────────
const EPISODE_STATUS: Record<string, { labelAr: string; labelEn: string; variant: string }> = {
  ACTIVE: {
    labelAr: 'نشط',
    labelEn: 'Active',
    variant: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  DISCHARGE_READY: {
    labelAr: 'جاهز للخروج',
    labelEn: 'Discharge Ready',
    variant: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  DISCHARGED: {
    labelAr: 'خرج',
    labelEn: 'Discharged',
    variant: 'bg-muted text-foreground',
  },
};

const SUMMARY_STATUS: Record<string, { labelAr: string; labelEn: string; variant: string }> = {
  DRAFT: {
    labelAr: 'مسودة',
    labelEn: 'Draft',
    variant: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  SIGNED: {
    labelAr: 'موقّع',
    labelEn: 'Signed',
    variant: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  NONE: {
    labelAr: 'غير موجود',
    labelEn: 'Not Created',
    variant: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
};

// =============================================================================
// Component
// =============================================================================
export default function IPDDischargeSummary() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('__all__');
  const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Data: live beds (contains episodes) ────────────────────────────────────
  const { data: bedsData, isLoading: bedsLoading, mutate: mutateBeds } = useSWR(
    '/api/ipd/live-beds',
    fetcher,
    { refreshInterval: 15000 }
  );

  // ── Data: discharge summary for selected episode ───────────────────────────
  const { data: summaryData, mutate: mutateSummary } = useSWR(
    selectedEpisode ? `/api/ipd/episodes/${selectedEpisode.episodeId}/discharge-summary` : null,
    fetcher
  );

  // ── Build episode list from beds data ──────────────────────────────────────
  const episodes = useMemo(() => {
    const allBeds: any[] = bedsData?.beds || [];
    // Only beds with admissions (active patients)
    return allBeds
      .filter((bed: any) => bed.admission)
      .map((bed: any) => {
        const adm = bed.admission;
        const epStatus = String(adm.episodeStatus || adm.status || 'ACTIVE').toUpperCase();
        return {
          episodeId: adm.episodeId || adm.id || bed.id,
          patientName: adm.patientName || '---',
          mrn: adm.mrn || '',
          doctorName: adm.doctorName || '',
          admissionDate: adm.admissionDate || null,
          bedLabel: bed.bedLabel || bed.id,
          departmentName: bed.departmentName || '',
          episodeStatus: epStatus,
          // Summary status will be approximated; real check needs per-episode API call
          summaryStatus: adm.dischargeSummaryStatus || 'NONE',
        };
      });
  }, [bedsData]);

  // ── KPI stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const dischargeReady = episodes.filter(e => e.episodeStatus === 'DISCHARGE_READY').length;
    const draft = episodes.filter(e => e.summaryStatus === 'DRAFT').length;
    const signed = episodes.filter(e => e.summaryStatus === 'SIGNED').length;
    const pending = episodes.filter(e => e.summaryStatus === 'NONE').length;
    return { dischargeReady, draft, signed, pending };
  }, [episodes]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filteredEpisodes = useMemo(() => {
    let list = episodes;
    if (statusFilter === 'DISCHARGE_READY') {
      list = list.filter(e => e.episodeStatus === 'DISCHARGE_READY');
    } else if (statusFilter === 'ACTIVE') {
      list = list.filter(e => e.episodeStatus === 'ACTIVE');
    }
    if (q) {
      list = list.filter(
        e =>
          e.patientName.toLowerCase().includes(q) ||
          e.mrn.toLowerCase().includes(q) ||
          e.bedLabel.toLowerCase().includes(q) ||
          e.doctorName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [episodes, statusFilter, q]);

  // ── Open dialog ────────────────────────────────────────────────────────────
  function openSummary(episode: any) {
    setSelectedEpisode(episode);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setSelectedEpisode(null);
    mutateBeds();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-500" />
            {tr('ملخص الخروج', 'Discharge Summary')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr(
              'إدارة ملخصات الخروج للمرضى المنومين — تحديث كل ١٥ ثانية',
              'Manage discharge summaries for inpatient episodes — auto-refresh every 15s'
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutateBeds()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          {tr('تحديث', 'Refresh')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: tr('جاهز للخروج', 'Discharge Ready'),
            value: stats.dischargeReady,
            color: 'text-yellow-600',
            icon: AlertCircle,
            iconColor: 'text-yellow-500',
          },
          {
            label: tr('مسودات', 'Drafts'),
            value: stats.draft,
            color: 'text-amber-600',
            icon: Clock,
            iconColor: 'text-amber-500',
          },
          {
            label: tr('موقّعة', 'Signed'),
            value: stats.signed,
            color: 'text-green-600',
            icon: FileSignature,
            iconColor: 'text-green-500',
          },
          {
            label: tr('معلقة', 'Pending'),
            value: stats.pending,
            color: 'text-red-600',
            icon: ClipboardCheck,
            iconColor: 'text-red-500',
          },
        ].map((kpi, i) => (
          <Card key={i} className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={tr('بحث بالمريض أو رقم السجل أو السرير...', 'Search by patient, MRN, or bed...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={tr('تصفية بالحالة', 'Filter by status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('جميع الحالات', 'All Statuses')}</SelectItem>
            <SelectItem value="DISCHARGE_READY">{tr('جاهز للخروج', 'Discharge Ready')}</SelectItem>
            <SelectItem value="ACTIVE">{tr('نشط', 'Active')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {bedsLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty */}
      {!bedsLoading && filteredEpisodes.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {tr('لا توجد حلقات مطابقة', 'No matching episodes found')}
        </div>
      )}

      {/* Episode List */}
      {!bedsLoading && filteredEpisodes.length > 0 && (
        <div className="space-y-2">
          {filteredEpisodes.map(ep => {
            const epCfg = EPISODE_STATUS[ep.episodeStatus] || EPISODE_STATUS.ACTIVE;
            const sumCfg = SUMMARY_STATUS[ep.summaryStatus] || SUMMARY_STATUS.NONE;

            return (
              <Card
                key={ep.episodeId}
                className="border border-border hover:shadow-md transition cursor-pointer"
                onClick={() => openSummary(ep)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Left: Patient info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-foreground truncate">
                          {ep.patientName}
                        </span>
                        {ep.mrn && (
                          <span className="text-xs text-muted-foreground">MRN: {ep.mrn}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {fmtDate(ep.admissionDate)}
                        </span>
                        {ep.doctorName && (
                          <span>{tr('الطبيب:', 'Dr:')} {ep.doctorName}</span>
                        )}
                        <span>{tr('سرير:', 'Bed:')} {ep.bedLabel}</span>
                        {ep.departmentName && <span>{ep.departmentName}</span>}
                      </div>
                    </div>

                    {/* Right: Status badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${epCfg.variant}`}>
                        {isAr ? epCfg.labelAr : epCfg.labelEn}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sumCfg.variant}`}>
                        {isAr ? sumCfg.labelAr : sumCfg.labelEn}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Discharge Summary Dialog ──────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={open => !open && handleDialogClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-500" />
              {tr('ملخص الخروج', 'Discharge Summary')}
              {selectedEpisode && (
                <span className="text-sm font-normal text-muted-foreground">
                  &mdash; {selectedEpisode.patientName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedEpisode && (
            <EnhancedDischargeSummaryForm
              episodeId={selectedEpisode.episodeId}
              existingSummary={summaryData?.summary}
              onSaved={() => {
                mutateSummary();
                mutateBeds();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
