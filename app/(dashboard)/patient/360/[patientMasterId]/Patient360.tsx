'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function Patient360({ params }: { params: { patientMasterId: string } }) {
  const { isRTL } = useLang();
  const { hasPermission, isLoading } = useRoutePermission('/patient/360');
  const patientMasterId = String(params.patientMasterId || '');

  const { data } = useSWR(
    hasPermission && patientMasterId ? `/api/patient-360/${encodeURIComponent(patientMasterId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const banner = data?.banner || {};
  const snapshot = data?.snapshot || {};
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const links = data?.links || {};

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Patient 360</h2>
          <p className="text-sm text-muted-foreground">Unified read-only view</p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="text-lg font-semibold">{banner.name || 'Unknown'}</div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">MRN {banner.mrn || '—'}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{banner.gender || '—'}</span>
            {banner.age ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Age {banner.age}</span> : <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Age —</span>}
            {banner.activeEncounterType ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">Active {banner.activeEncounterType}</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">No active encounter</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Location: {banner.location?.unit || banner.location?.ward || '—'} {banner.location?.bed ? `• Bed ${banner.location.bed}` : ''}
          </div>
          <div className="flex flex-wrap gap-2">
            {banner.flags?.isolation ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">Isolation</span> : <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">No isolation</span>}
            {Array.isArray(banner.flags?.allergies) && banner.flags.allergies.length ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Allergies: {banner.flags.allergies.join(', ')}</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Allergies —</span>
            )}
            {banner.flags?.deceased ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">Deceased</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {links.activeEncounter ? (
              <Button size="sm" variant="outline" className="rounded-xl" asChild>
                <Link href={links.activeEncounter}>Open Active Encounter</Link>
              </Button>
            ) : null}
            {links.ipdEpisode ? (
              <Button size="sm" variant="outline" className="rounded-xl" asChild>
                <Link href={links.ipdEpisode}>Go to IPD Episode</Link>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" className="rounded-xl" asChild>
              <Link href={links.journey || `/patient/${encodeURIComponent(patientMasterId)}/journey`}>View Journey</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Active Care Snapshot</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Current Episode</div>
            <div className="font-medium">{snapshot.currentEpisodeType || '—'}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Current Bed</div>
            <div className="font-medium">{snapshot.currentBed || '—'}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Attending Doctor</div>
            <div className="font-medium">{snapshot.attendingDoctor || '—'}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Open Tasks</div>
            <div className="font-medium">{snapshot.openTasksCount ?? 0}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Unack Results</div>
            <div className="font-medium">{snapshot.unackResultsCount ?? 0}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Last Vitals</div>
            <div className="font-medium">
              {snapshot.lastVitalsAt ? new Date(snapshot.lastVitalsAt).toLocaleString() : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Timeline</h2>
          <p className="text-sm text-muted-foreground">Chronological, read-only</p>
        </div>
        <div className="space-y-2 text-sm">
          {timeline.length ? (
            timeline.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border border-border p-2">
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'} • {item.type}
                  </div>
                </div>
                {item.deepLink ? (
                  <Button size="sm" variant="outline" className="rounded-xl" asChild>
                    <Link href={item.deepLink}>Open</Link>
                  </Button>
                ) : null}
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No timeline entries.</div>
          )}
        </div>
      </div>
    </div>
  );
}
