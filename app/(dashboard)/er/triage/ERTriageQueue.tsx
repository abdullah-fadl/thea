'use client';

// =============================================================================
// ER Triage Queue — Main listing page
// =============================================================================

import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import {
  AlertTriangle, Clock, Users, CheckCircle, UserX,
  RefreshCw, ChevronRight, Activity,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── ESI Level config ────────────────────────────────────────────────────────
const ESI_CONFIG: Record<number, { labelEn: string; labelAr: string; color: string; bg: string; border: string }> = {
  1: { labelEn: 'Resuscitation', labelAr: 'إنعاش', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-400' },
  2: { labelEn: 'Emergent', labelAr: 'طارئ', color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-400' },
  3: { labelEn: 'Urgent', labelAr: 'عاجل', color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-400' },
  4: { labelEn: 'Less Urgent', labelAr: 'أقل إلحاحاً', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-400' },
  5: { labelEn: 'Non-Urgent', labelAr: 'غير عاجل', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-400' },
};

// ── Stage label translation ─────────────────────────────────────────────────
const STAGE_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  WAITING: { ar: 'انتظار فرز', en: 'Awaiting Triage', color: 'bg-muted text-foreground' },
  WAITING_BED: { ar: 'انتظار سرير', en: 'Waiting Bed', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  IN_BED: { ar: 'في السرير', en: 'In Bed', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  SEEN: { ar: 'رآه الطبيب', en: 'Seen by Doctor', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  PENDING_RESULTS: { ar: 'انتظار نتائج', en: 'Pending Results', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  DISPO: { ar: 'قرار', en: 'Disposition', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
};

// ── Elapsed time helper ─────────────────────────────────────────────────────
function elapsedMin(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

// ── Types ───────────────────────────────────────────────────────────────────
interface EncounterItem {
  id: string;
  visitNumber: string | null;
  patientName: string;
  mrn: string;
  status: string;
  stageLabel: string;
  stageStartedAt: string | null;
  triageLevel: number | null;
  triageComplete: boolean;
  triageMissing: string[];
  critical: boolean;
  bedLabel: string | null;
  bedZone: string | null;
  chiefComplaint?: string | null;
  arrivalMethod?: string | null;
  startedAt: string | null;
}

// ── Filter tabs ─────────────────────────────────────────────────────────────
type FilterTab = 'pending' | 'all';

export default function ERTriageQueue() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const router = useRouter();

  const [tab, setTab] = useState<FilterTab>('pending');
  const [levelFilter, setLevelFilter] = useState<number | null>(null);

  const { data, isLoading, mutate } = useSWR('/api/er/board', fetcher, { refreshInterval: 30000 });

  const allItems: EncounterItem[] = data?.items ?? [];

  // Pending triage = triageComplete is false or stage is WAITING
  const pendingItems = allItems.filter(e => !e.triageComplete || e.stageLabel === 'WAITING');
  const displayItems = tab === 'pending' ? pendingItems : allItems;
  const filteredItems = levelFilter
    ? displayItems.filter(e => e.triageLevel === levelFilter)
    : displayItems;

  // KPI counts
  const level1 = allItems.filter(e => e.triageLevel === 1).length;
  const level2 = allItems.filter(e => e.triageLevel === 2).length;
  const critical = allItems.filter(e => e.critical).length;

  return (
    <div className="space-y-6 p-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-red-500" />
            {tr('قائمة انتظار الفرز', 'Triage Queue')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('فرز المرضى القادمين حسب درجة الخطورة', 'Triage incoming patients by acuity level')}
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {tr('تحديث', 'Refresh')}
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={<Users className="h-5 w-5 text-muted-foreground" />}
          label={tr('إجمالي النشطين', 'Total Active')}
          value={allItems.length}
          color="bg-muted/50"
        />
        <KpiCard
          icon={<UserX className="h-5 w-5 text-orange-500" />}
          label={tr('بانتظار الفرز', 'Awaiting Triage')}
          value={pendingItems.length}
          color="bg-orange-50 dark:bg-orange-900/20"
          highlight={pendingItems.length > 0}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          label={tr('مستوى 1–2 (خطر)', 'Level 1–2 (Critical)')}
          value={level1 + level2}
          color="bg-red-50 dark:bg-red-900/20"
          highlight={level1 > 0}
        />
        <KpiCard
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          label={tr('حالة حرجة', 'Critical Flag')}
          value={critical}
          color="bg-yellow-50 dark:bg-yellow-900/20"
          highlight={critical > 0}
        />
      </div>

      {/* ── Filter Row ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(['pending', 'all'] as FilterTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 font-medium transition ${
                tab === t
                  ? 'bg-blue-600 text-white'
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {t === 'pending'
                ? `${tr('انتظار الفرز', 'Pending Triage')} (${pendingItems.length})`
                : `${tr('الكل', 'All')} (${allItems.length})`}
            </button>
          ))}
        </div>

        {/* ESI Level filter pills */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setLevelFilter(null)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              !levelFilter ? 'bg-gray-700 text-white border-gray-700' : 'border-border hover:bg-muted'
            }`}
          >
            {tr('الكل', 'All Levels')}
          </button>
          {[1, 2, 3, 4, 5].map(level => {
            const cfg = ESI_CONFIG[level];
            const count = displayItems.filter(e => e.triageLevel === level).length;
            return (
              <button
                key={level}
                onClick={() => setLevelFilter(levelFilter === level ? null : level)}
                className={`text-xs px-2.5 py-1 rounded-full border transition font-medium ${
                  levelFilter === level
                    ? `${cfg.bg} ${cfg.color} ${cfg.border} border`
                    : `border-border hover:bg-muted`
                }`}
              >
                {tr(`م${level}`, `L${level}`)} {count > 0 && <span className="ml-0.5">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Queue Table ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
          <CheckCircle className="h-10 w-10 text-green-400" />
          <p className="text-sm font-medium">{tr('لا يوجد مرضى بانتظار الفرز', 'No patients awaiting triage')}</p>
          <p className="text-xs">{tr('جميع المرضى تم فرزهم', 'All patients have been triaged')}</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50/50 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3 text-start">{tr('المريض', 'Patient')}</th>
                <th className="px-4 py-3 text-start">{tr('مستوى ESI', 'ESI Level')}</th>
                <th className="px-4 py-3 text-start hidden sm:table-cell">{tr('الحالة', 'Stage')}</th>
                <th className="px-4 py-3 text-start hidden md:table-cell">{tr('الشكوى الرئيسية', 'Chief Complaint')}</th>
                <th className="px-4 py-3 text-start"><Clock className="h-3.5 w-3.5 inline" /></th>
                <th className="px-4 py-3 text-start">{tr('إجراء', 'Action')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((enc, idx) => {
                const esiCfg = enc.triageLevel ? ESI_CONFIG[enc.triageLevel] : null;
                const stageCfg = STAGE_LABELS[enc.stageLabel] || STAGE_LABELS['WAITING'];
                const waitMin = elapsedMin(enc.stageStartedAt || enc.startedAt);
                const isLong = waitMin >= 30;

                return (
                  <tr
                    key={enc.id}
                    className={`border-b border-border hover:bg-muted/50 cursor-pointer transition ${
                      idx % 2 === 0 ? '' : 'bg-muted/50/30'
                    } ${enc.critical ? 'border-l-4 border-l-red-500' : ''}`}
                    onClick={() => router.push(`/er/triage/${enc.id}`)}
                  >
                    {/* Patient */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {enc.critical && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="h-3 w-3" />
                            {tr('حرج', 'CRIT')}
                          </span>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{enc.patientName}</p>
                          <p className="text-xs text-muted-foreground">{enc.mrn} {enc.visitNumber ? `· ${enc.visitNumber}` : ''}</p>
                        </div>
                      </div>
                    </td>

                    {/* ESI Level */}
                    <td className="px-4 py-3">
                      {esiCfg ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border ${esiCfg.bg} ${esiCfg.color} ${esiCfg.border}`}>
                          {enc.triageLevel}
                          <span className="font-normal hidden sm:inline">— {isAr ? esiCfg.labelAr : esiCfg.labelEn}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground border border-dashed border-border">
                          {tr('لم يُحدَّد', 'Not Set')}
                        </span>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageCfg.color}`}>
                        {isAr ? stageCfg.ar : stageCfg.en}
                      </span>
                    </td>

                    {/* Chief Complaint */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {enc.chiefComplaint || <span className="text-muted-foreground italic">{tr('—', '—')}</span>}
                      </p>
                    </td>

                    {/* Wait Time */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono font-medium ${isLong ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {formatElapsed(waitMin)}
                        {isLong && <AlertTriangle className="ml-1 h-3 w-3 inline text-red-500" />}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/er/triage/${enc.id}`); }}
                        className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                          !enc.triageComplete
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-muted hover:bg-muted text-foreground'
                        }`}
                      >
                        {!enc.triageComplete ? tr('بدء الفرز', 'Start Triage') : tr('مراجعة', 'Review')}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ESI Legend ── */}
      <div className="flex flex-wrap gap-3 pt-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider self-center">
          {tr('مستويات ESI:', 'ESI Levels:')}
        </span>
        {Object.entries(ESI_CONFIG).map(([lvl, cfg]) => (
          <span key={lvl} className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
            {lvl} — {isAr ? cfg.labelAr : cfg.labelEn}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── KpiCard helper ──────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 ${color} border ${highlight ? 'border-orange-300 dark:border-orange-700' : 'border-border'}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}
