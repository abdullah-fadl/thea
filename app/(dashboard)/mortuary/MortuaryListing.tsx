'use client';

// =============================================================================
// MortuaryListing — Main mortuary case list page
// =============================================================================

import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import {
  Heart, Clock, CheckCircle, ArrowRight, RefreshCw,
  Package, MapPin, User,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { labelEn: string; labelAr: string; color: string }> = {
  RECEIVED: { labelEn: 'Received', labelAr: 'مستلم', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  AWAITING_RELEASE: { labelEn: 'Awaiting Release', labelAr: 'بانتظار التسليم', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  RELEASED_TO_FAMILY: { labelEn: 'Released', labelAr: 'سُلِّم للعائلة', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  TRANSFERRED_OUT: { labelEn: 'Transferred Out', labelAr: 'محوَّل للخارج', color: 'bg-muted text-muted-foreground' },
  UNKNOWN: { labelEn: 'Unknown', labelAr: 'غير محدد', color: 'bg-muted text-muted-foreground' },
};

type FilterTab = 'active' | 'all';

interface MortuaryCase {
  id: string;
  bodyTagNumber: string | null;
  status: string;
  location: { morgueRoom?: string; shelf?: string } | null;
  createdAt: string;
  updatedAt: string | null;
  patient: { fullName: string; mrn: string | null; gender: string | null; dob: string | null } | null;
}

function formatAge(dob: string | null): string {
  if (!dob) return '—';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years}y`;
}

function timeAgo(iso: string, lang: string = 'en'): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (lang === 'ar') {
    if (mins < 60) return `منذ ${mins} د`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} س`;
    return `منذ ${Math.floor(hrs / 24)} ي`;
  }
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MortuaryListing() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);
  const router = useRouter();
  const [tab, setTab] = useState<FilterTab>('active');

  const url = tab === 'active' ? '/api/mortuary?status=active' : '/api/mortuary';
  const { data, isLoading, mutate } = useSWR(url, fetcher, { refreshInterval: 60000 });

  const cases: MortuaryCase[] = data?.cases ?? [];
  const summary = data?.summary ?? { total: 0, active: 0, released: 0, transferred: 0 };

  return (
    <div className="space-y-6 p-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Heart className="h-6 w-6 text-muted-foreground" />
            {tr('وحدة الحفظ الطبي', 'Mortuary Unit')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('إدارة الحالات والتسليم', 'Case management and release tracking')}
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
        <div className="bg-muted/50 rounded-xl p-4 border border-border">
          <p className="text-xs text-muted-foreground mb-1">{tr('الإجمالي', 'Total Cases')}</p>
          <p className="text-2xl font-bold text-foreground">{summary.total}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
          <p className="text-xs text-blue-500 mb-1">{tr('حالات نشطة', 'Active')}</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summary.active}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800">
          <p className="text-xs text-green-500 mb-1">{tr('سُلِّم للعائلة', 'Released')}</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{summary.released}</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 border border-border">
          <p className="text-xs text-muted-foreground mb-1">{tr('محوَّل للخارج', 'Transferred')}</p>
          <p className="text-2xl font-bold text-foreground">{summary.transferred}</p>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex rounded-lg border border-border overflow-hidden text-xs w-fit">
        {(['active', 'all'] as FilterTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 font-medium transition ${
              tab === t ? 'bg-gray-700 text-white' : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {t === 'active' ? tr('الحالات النشطة', 'Active Cases') : tr('جميع الحالات', 'All Cases')}
          </button>
        ))}
      </div>

      {/* ── Cases Grid / Table ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : cases.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
          <CheckCircle className="h-10 w-10 text-green-400" />
          <p className="text-sm font-medium">{tr('لا توجد حالات نشطة', 'No active cases')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map(c => {
            const statusCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG['UNKNOWN'];
            const isTerminal = ['RELEASED_TO_FAMILY', 'TRANSFERRED_OUT'].includes(c.status);

            return (
              <div
                key={c.id}
                className={`bg-card rounded-xl border ${
                  isTerminal ? 'border-border opacity-70' : 'border-border'
                } p-4 hover:shadow-md transition cursor-pointer`}
                onClick={() => router.push(`/mortuary/${c.id}`)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono">
                        {c.bodyTagNumber ? `Tag: ${c.bodyTagNumber}` : tr('بدون بطاقة', 'No Tag')}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                    {isAr ? statusCfg.labelAr : statusCfg.labelEn}
                  </span>
                </div>

                {/* Patient info */}
                {c.patient ? (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="font-semibold text-sm text-foreground">{c.patient.fullName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground ml-5">
                      MRN: {c.patient.mrn ?? '—'} ·{' '}
                      {c.patient.gender ?? '—'} ·{' '}
                      {formatAge(c.patient.dob)}
                    </p>
                  </div>
                ) : (
                  <div className="mb-3">
                    <p className="text-sm text-muted-foreground italic">{tr('معلومات المريض غير متاحة', 'Patient info unavailable')}</p>
                  </div>
                )}

                {/* Location */}
                {c.location && (c.location.morgueRoom || c.location.shelf) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>
                      {c.location.morgueRoom && `${tr('غرفة', 'Room')} ${c.location.morgueRoom}`}
                      {c.location.morgueRoom && c.location.shelf && ' · '}
                      {c.location.shelf && `${tr('رف', 'Shelf')} ${c.location.shelf}`}
                    </span>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {timeAgo(c.createdAt, language)}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/mortuary/${c.id}`); }}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {tr('عرض', 'View')}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
