'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLang } from '@/hooks/use-lang';

type EpisodeRow = {
  episodeId: string;
  encounterId: string;
  patientName: string;
  location: string;
  status: string;
};

const getPatientName = (patient: any) => {
  if (!patient) return 'Unknown';
  return (
    patient.fullName ||
    [patient.firstName, patient.lastName].filter(Boolean).join(' ') ||
    patient.name ||
    'Unknown'
  );
};

const getLocationLabel = (location: any, fallbackUnit?: string | null) => {
  const unit = String(location?.unit || fallbackUnit || '').trim();
  const ward = String(location?.ward || '').trim();
  const room = String(location?.room || '').trim();
  const bed = String(location?.bed || '').trim();
  return [unit, ward, room, bed].filter(Boolean).join(' / ') || '—';
};

export default function IPDEpisodes() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [rows, setRows] = useState<EpisodeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('/api/encounters/search?encounterType=IPD', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch IPD encounters');
        const payload = await res.json();
        const items = Array.isArray(payload?.items) ? payload.items : [];

        const episodes = await Promise.all(
          items.map(async (item: any) => {
            const encounter = item?.encounter || {};
            const encounterId = String(encounter.id || '');
            if (!encounterId) return null;
            const episodeRes = await fetch(
              `/api/ipd/episodes/by-encounter?encounterCoreId=${encodeURIComponent(encounterId)}`,
              { credentials: 'include' }
            );
            const episodePayload = episodeRes.ok ? await episodeRes.json().catch(() => ({})) : {};
            const episode = episodePayload?.episode || null;
            return {
              episodeId: String(episode?.id || ''),
              encounterId,
              patientName: getPatientName(item?.patient),
              location: getLocationLabel(episode?.location, String(episode?.serviceUnit || '').trim() || null),
              status: String(episode?.status || encounter.status || '—'),
            } as EpisodeRow;
          })
        );

        if (!active) return;
        setRows(episodes.filter(Boolean) as EpisodeRow[]);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Failed to load episodes');
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const hasRows = rows.length > 0;
  const emptyState = tr('لا توجد حلقات تنويم.', 'No IPD episodes found.');

  return (
    <div className="max-w-5xl space-y-4">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{tr('حلقات التنويم', 'IPD Episodes')}</h2>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">{tr('جارٍ التحميل...', 'Loading...')}</div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : !hasRows ? (
          <div className="text-sm text-muted-foreground">{emptyState}</div>
        ) : (
          <div>
            {/* Header row */}
            <div className="grid grid-cols-5 gap-4 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحلقة', 'Episode')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الموقع', 'Location')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" />
            </div>
            {/* Body rows */}
            <div>
              {rows.map((row) => (
                <div key={row.encounterId} className="grid grid-cols-5 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                  <span className="text-sm text-foreground font-medium">{row.patientName}</span>
                  <span className="text-sm text-foreground">{row.episodeId || '—'}</span>
                  <span className="text-sm text-foreground">{row.location}</span>
                  <span className="text-sm text-foreground">{row.status}</span>
                  <span className="text-sm text-foreground text-right">
                    {row.episodeId ? (
                      <Button asChild size="sm" variant="outline" className="rounded-xl">
                        <Link href={`/ipd/episode/${row.episodeId}`}>{tr('فتح', 'Open')}</Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">{tr('غير متاح', 'Unavailable')}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
