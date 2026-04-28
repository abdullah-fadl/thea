'use client';

import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((res) => res.json());

type BedItem = {
  id: string;
  zone: string;
  bedLabel: string;
  state: string;
  encounterId?: string | null;
  visitNumber?: string | null;
  patientName?: string | null;
  patientGender?: string | null;
  mrn?: string | null;
  tempMrn?: string | null;
  triageLevel?: number | null;
  roomName?: string | null;
  roomCode?: string | null;
};

export default function ERBeds() {
  const router = useRouter();
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/er/beds');
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { data, mutate } = useSWR<{ beds: BedItem[] }>('/api/er/beds', fetcher, {
    refreshInterval: 1000,
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
  const { data: boardData } = useSWR('/api/er/board', fetcher, {
    refreshInterval: 1000,
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
  const { data: roomsData } = useSWR('/api/clinical-infra/rooms', fetcher, {
    refreshInterval: 3000,
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const [selectedEncounter, setSelectedEncounter] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectionFilter, setSelectionFilter] = useState<'waiting_bed' | 'in_bed' | 'resus' | 'isolation'>(
    'waiting_bed'
  );
  useEffect(() => {
    const encounterId = searchParams?.get('encounterId');
    if (encounterId) {
      setSelectedEncounter(encounterId);
    }
  }, [searchParams]);

  const beds = data?.beds || [];
  const encounters = boardData?.items || [];
  const encounterBedZoneMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const bed of beds) {
      if (!bed.encounterId) continue;
      const zone = String(bed.roomName || bed.zone || '').trim();
      if (zone) map.set(bed.encounterId, zone);
    }
    return map;
  }, [beds]);
  const bedEncounterItems = useMemo(() => {
    return beds
      .filter((bed) => bed.encounterId)
      .map((bed) => ({
        id: String(bed.encounterId),
        visitNumber: bed.visitNumber || null,
        patientName: bed.patientName || 'Unknown',
        patientGender: bed.patientGender || null,
        mrn: bed.mrn || null,
        tempMrn: bed.tempMrn || null,
        status: 'IN_BED',
        bedZone: bed.roomName || bed.zone || null,
        bedLabel: bed.bedLabel || null,
        triageLevel: bed.triageLevel ?? null,
      }));
  }, [beds]);
  const mergedEncounters = useMemo(() => {
    const map = new Map<string, any>();
    for (const item of bedEncounterItems) {
      map.set(String(item.id), item);
    }
    for (const item of encounters) {
      const existing = map.get(String(item.id));
      map.set(String(item.id), { ...existing, ...item });
    }
    return Array.from(map.values());
  }, [bedEncounterItems, encounters]);
  const activeEncounters = useMemo(() => {
    const finalStatuses = new Set(['DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'DEATH']);
    return mergedEncounters.filter((encounter: any) => {
      const status = String(encounter?.status || '').trim().toUpperCase();
      const hasBed = encounterBedZoneMap.has(encounter?.id);
      if (finalStatuses.has(status)) return false;
      if (hasBed) return true;
      if (status === 'WAITING_BED' || status === 'IN_BED') return true;
      return status.startsWith('TRIAGE_');
    });
  }, [mergedEncounters, encounterBedZoneMap]);
  const rooms = useMemo(() => {
    const map = new Map<string, { name: string; vacant: number; occupied: number }>();
    const infraRooms = Array.isArray(roomsData?.items) ? roomsData.items : [];
    for (const room of infraRooms) {
      const name = String(room?.name || room?.shortCode || room?.id || 'Unknown').trim() || 'Unknown';
      if (!map.has(name)) map.set(name, { name, vacant: 0, occupied: 0 });
    }
    for (const bed of beds) {
      const name = String(bed.roomName || bed.zone || 'Unknown').trim() || 'Unknown';
      const entry = map.get(name) || { name, vacant: 0, occupied: 0 };
      const isOccupied = bed.state !== 'VACANT' || !!bed.encounterId;
      if (isOccupied) entry.occupied += 1;
      else entry.vacant += 1;
      map.set(name, entry);
    }
    const extractNumber = (value: string) => {
      const match = /(\d+)/.exec(value);
      return match ? Number(match[1]) : Number.NaN;
    };
    const rankName = (value: string) => {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'resus') return 10;
      if (normalized === 'er general') return 20;
      if (normalized === 'peds') return 30;
      if (normalized === 'isolation') return 40;
      if (normalized === 'fast track') return 50;
      if (normalized === 'procedure') return 60;
      return 1000;
    };
    return Array.from(map.values()).sort((a, b) => {
      const aRank = rankName(a.name);
      const bRank = rankName(b.name);
      if (aRank !== bRank) return aRank - bRank;
      const aNum = extractNumber(a.name);
      const bNum = extractNumber(b.name);
      if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
        return aNum - bNum;
      }
      return a.name.localeCompare(b.name);
    });
  }, [beds, roomsData]);
  const roomGroupNames = useMemo(() => {
    const toGroup = (keyword: string) =>
      rooms
        .map((room) => String(room.name || '').trim())
        .filter((name) => name.toLowerCase().includes(keyword));
    return {
      resus: toGroup('resus').map((name) => name.toLowerCase()),
      isolation: toGroup('isolation').map((name) => name.toLowerCase()),
    };
  }, [rooms]);
  const selectedEncounterItem = useMemo(
    () => activeEncounters.find((item: any) => item.id === selectedEncounter) || null,
    [activeEncounters, selectedEncounter]
  );
  const getEncounterLabel = (encounter: any) => {
    const mrnValue = String(encounter?.mrn || '').trim();
    const tempMrnValue = String(encounter?.tempMrn || '').trim();
    const primaryIdLabel = mrnValue ? 'MRN' : 'TEMP';
    const primaryIdValue = mrnValue || tempMrnValue || '\u2014';
    const gender = String(encounter?.patientGender || encounter?.sex || '').trim() || 'Unknown';
    const nameRaw = String(encounter?.patientName || '').trim();
    const displayName = nameRaw && nameRaw !== 'Unknown' ? nameRaw : `Unknown ${gender}`.trim();
    const triageLevel = encounter?.triageLevel ?? null;
    const bedLabel = encounter?.bedLabel ? `${encounter?.bedZone || 'Bed'}-${encounter?.bedLabel}` : null;
    const visitNumber = String(encounter?.visitNumber || '').trim() || null;
    return { primaryIdLabel, primaryIdValue, displayName, triageLevel, bedLabel, visitNumber };
  };
  const filteredEncounterOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const matchesFilter = (encounter: any) => {
      if (term) return true;
      const status = String(encounter?.status || '').trim().toUpperCase();
      const bedZone = String(encounterBedZoneMap.get(encounter?.id) || encounter?.bedZone || '')
        .trim()
        .toLowerCase();
      const hasBed = encounterBedZoneMap.has(encounter?.id);
      if (selectionFilter === 'waiting_bed') return status === 'WAITING_BED';
      if (selectionFilter === 'in_bed') return status === 'IN_BED' || hasBed;
      if (selectionFilter === 'resus') {
        if (!roomGroupNames.resus.length) return bedZone.includes('resus');
        return roomGroupNames.resus.some((name) => bedZone === name || bedZone.includes(name));
      }
      if (selectionFilter === 'isolation') {
        if (!roomGroupNames.isolation.length) return bedZone.includes('isolation');
        return roomGroupNames.isolation.some((name) => bedZone === name || bedZone.includes(name));
      }
      return true;
    };
    const matchesSearch = (encounter: any) => {
      if (!term) return true;
      const label = getEncounterLabel(encounter);
      const bed = label.bedLabel ? label.bedLabel.toLowerCase() : '';
      const mrn = String(encounter?.mrn || '').toLowerCase();
      const tempMrn = String(encounter?.tempMrn || '').toLowerCase();
      const name = String(label.displayName || '').toLowerCase();
      const visit = String(label.visitNumber || '').toLowerCase();
      return [mrn, tempMrn, name, bed, visit].some((value) => value.includes(term));
    };
    return activeEncounters.filter((encounter: any) => matchesFilter(encounter) && matchesSearch(encounter)).slice(0, 8);
  }, [activeEncounters, searchTerm, selectionFilter, encounterBedZoneMap, roomGroupNames]);
  const filteredBeds = useMemo(() => {
    if (selectedEncounterItem?.id) {
      const assigned = beds.filter((bed) => bed.encounterId === selectedEncounterItem.id);
      if (assigned.length) return assigned;
    }
    if (selectedRoom === 'all') return beds;
    return beds.filter((bed) => String(bed.roomName || bed.zone || 'Unknown') === selectedRoom);
  }, [beds, selectedRoom, selectedEncounterItem]);
  const sortedBeds = useMemo(() => {
    const extractNumber = (value: string) => {
      const match = /(\d+)/.exec(value);
      return match ? Number(match[1]) : Number.NaN;
    };
    return [...filteredBeds].sort((a, b) => {
      const aNum = extractNumber(String(a.bedLabel || ''));
      const bNum = extractNumber(String(b.bedLabel || ''));
      if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
        return aNum - bNum;
      }
      return String(a.bedLabel || '').localeCompare(String(b.bedLabel || ''));
    });
  }, [filteredBeds]);

  const getBedStateClasses = (bed: BedItem) => {
    const isOccupied = bed.state !== 'VACANT' || !!bed.encounterId;
    if (bed.state === 'CLEANING') return 'border-s-purple-300 dark:border-s-purple-700 bg-purple-50/30 dark:bg-purple-950/10';
    if (bed.state === 'RESERVED') return 'border-s-amber-300 dark:border-s-amber-700 bg-amber-50/30 dark:bg-amber-950/10';
    if (isOccupied) return 'border-s-blue-300 dark:border-s-blue-700 bg-blue-50/30 dark:bg-blue-950/10';
    return 'border-s-emerald-300 dark:border-s-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/10';
  };

  if (isLoading || hasPermission === null) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">{tr('خريطة أسرّة الطوارئ', 'ER Bed Map')}</h1>
            <p className="text-sm text-muted-foreground">{tr('إسناد أو تحرير الأسرّة.', 'Assign or release beds.')}</p>
          </div>
          <button
            className="px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast disabled:opacity-50"
            onClick={() => router.push('/er/board')}
          >
            {tr('العودة للوحة', 'Back to Board')}
          </button>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-extrabold text-base">{tr('إسناد زيارة', 'Assign Visit')}</h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold thea-transition-fast ${
                  selectedRoom === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setSelectedRoom('all')}
              >
                {tr('جميع الغرف', 'All Rooms')}
              </button>
              {rooms.map((room) => (
                <button
                  key={room.name}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold thea-transition-fast ${
                    selectedRoom === room.name ? 'bg-primary text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setSelectedRoom(room.name)}
                >
                  {room.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {room.vacant}/{room.occupied}
                  </span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">{tr('المريض المختار', 'Selected Patient')}</label>
              <div className="flex flex-wrap items-center gap-2">
                {selectedEncounterItem ? (
                  (() => {
                    const label = getEncounterLabel(selectedEncounterItem);
                    return (
                      <>
                        <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-bold">{label.displayName}</span>
                        <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-bold">ER Visit: {label.visitNumber || 'ER-\u2014'}</span>
                        <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">
                          {label.primaryIdLabel}: {label.primaryIdValue}
                        </span>
                        {label.bedLabel ? <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-bold">Bed: {label.bedLabel}</span> : null}
                        {label.triageLevel != null ? <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-bold">Triage: {label.triageLevel}</span> : null}
                      </>
                    );
                  })()
                ) : (
                  <span className="text-sm text-muted-foreground">{tr('اختر مريضاً', 'Select a patient')}</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">{tr('البحث عن مريض', 'Find patient')}</label>
              <input
                className="w-full rounded-xl border-[1.5px] border-border bg-muted/30 px-3 py-2 text-sm thea-input-focus thea-transition-fast placeholder:text-muted-foreground"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={tr('بحث بالرقم الطبي أو الاسم أو السرير', 'Search MRN, TEMP, name, or bed')}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold thea-transition-fast ${
                    selectionFilter === 'waiting_bed' ? 'bg-primary text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setSelectionFilter('waiting_bed')}
                >
                  {tr('بانتظار سرير', 'Waiting Bed')}
                </button>
                <button
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold thea-transition-fast ${
                    selectionFilter === 'in_bed' ? 'bg-primary text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setSelectionFilter('in_bed')}
                >
                  {tr('في السرير', 'In Bed')}
                </button>
                <button
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold thea-transition-fast ${
                    selectionFilter === 'resus' ? 'bg-primary text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setSelectionFilter('resus')}
                >
                  {tr('إنعاش', 'Resus')}
                </button>
                <button
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold thea-transition-fast ${
                    selectionFilter === 'isolation' ? 'bg-primary text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setSelectionFilter('isolation')}
                >
                  {tr('عزل', 'Isolation')}
                </button>
              </div>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {filteredEncounterOptions.length ? (
                  filteredEncounterOptions.map((item: any) => {
                    const label = getEncounterLabel(item);
                    const isSelected = selectedEncounter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm thea-transition-fast thea-hover-lift rounded-xl',
                          isSelected && 'bg-muted'
                        )}
                        onClick={() => setSelectedEncounter((current) => (current === item.id ? '' : item.id))}
                      >
                        <div className="font-medium">{label.displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          ER Visit: {label.visitNumber || 'ER-\u2014'} {'\u2022'} {label.primaryIdLabel}: {label.primaryIdValue}
                          {label.bedLabel ? ` \u2022 Bed: ${label.bedLabel}` : ''}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">{tr('لا يوجد مرضى مطابقون.', 'No matching patients.')}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sortedBeds.map((bed) => {
            const isOccupied = bed.state !== 'VACANT' || !!bed.encounterId;
            return (
              <div
                key={bed.id}
                className={cn(
                  'rounded-2xl border-s-4 bg-card border border-border overflow-hidden thea-transition-fast',
                  getBedStateClasses(bed)
                )}
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{bed.roomName || bed.zone}</p>
                      <p className="text-lg font-extrabold">{bed.bedLabel}</p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                        bed.state === 'VACANT'
                          ? 'bg-muted text-muted-foreground'
                          : 'border border-border'
                      )}
                    >
                      {bed.state}
                    </span>
                  </div>
                  <div className="text-sm">
                    {bed.encounterId ? (
                      <>
                        <p>
                          {tr('مشغول بواسطة', 'Occupied by')}{' '}
                          {(() => {
                            const gender = String(bed.patientGender || '').trim() || 'Unknown';
                            const nameRaw = String(bed.patientName || '').trim();
                            const displayName = nameRaw && nameRaw !== 'Unknown' ? nameRaw : `Unknown ${gender}`.trim();
                            return displayName;
                          })()}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-bold">ER Visit: {bed.visitNumber || 'ER-\u2014'}</span>
                          {bed.mrn ? (
                            <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">MRN: {bed.mrn}</span>
                          ) : bed.tempMrn ? (
                            <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">TEMP: {bed.tempMrn}</span>
                          ) : null}
                          {bed.triageLevel != null ? (
                            <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-bold">Triage: {bed.triageLevel}</span>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-4 py-2 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90 disabled:opacity-50"
                      disabled={!selectedEncounter || busy || Boolean(bed.encounterId)}
                      onClick={async () => {
                        setBusy(true);
                        const res = await fetch('/api/er/beds/assign', {
                          credentials: 'include',
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ encounterId: selectedEncounter, bedId: bed.id }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          toast({
                            title: tr('\u0641\u0634\u0644 \u0627\u0644\u0625\u0633\u0646\u0627\u062F', 'Assign failed'),
                            description: data?.error || tr('\u062A\u0639\u0630\u0631 \u0625\u0633\u0646\u0627\u062F \u0627\u0644\u0633\u0631\u064A\u0631', 'Unable to assign bed'),
                            variant: 'destructive',
                          });
                        } else if (data?.noOp) {
                          toast({
                            title: tr('\u0645\u064F\u0633\u0646\u064E\u062F \u0645\u0633\u0628\u0642\u0627\u064B', 'Already assigned'),
                            description: tr('\u0647\u0630\u0647 \u0627\u0644\u0632\u064A\u0627\u0631\u0629 \u0645\u0633\u0646\u062F\u0629 \u0645\u0633\u0628\u0642\u0627\u064B \u0644\u0647\u0630\u0627 \u0627\u0644\u0633\u0631\u064A\u0631.', 'This visit is already assigned to this bed.'),
                          });
                        } else {
                          toast({ title: tr('\u062A\u0645 \u0627\u0644\u0625\u0633\u0646\u0627\u062F', 'Assigned'), description: tr('\u062A\u0645 \u0625\u0633\u0646\u0627\u062F \u0627\u0644\u0633\u0631\u064A\u0631 \u0628\u0646\u062C\u0627\u062D.', 'Bed assigned successfully.') });
                        }
                        await mutate();
                        setBusy(false);
                      }}
                    >
                      {tr('إسناد', 'Assign')}
                    </button>
                    <button
                      className="px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast disabled:opacity-50"
                      disabled={busy || !bed.encounterId}
                      onClick={async () => {
                        setBusy(true);
                        const res = await fetch('/api/er/beds/assign', {
                          credentials: 'include',
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ encounterId: bed.encounterId, bedId: bed.id, action: 'UNASSIGN' }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          toast({
                            title: tr('\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0631\u064A\u0631', 'Release failed'),
                            description: data?.error || tr('\u062A\u0639\u0630\u0631 \u062A\u062D\u0631\u064A\u0631 \u0627\u0644\u0633\u0631\u064A\u0631', 'Unable to release bed'),
                            variant: 'destructive',
                          });
                        } else {
                          toast({ title: tr('\u062A\u0645 \u0627\u0644\u062A\u062D\u0631\u064A\u0631', 'Released'), description: tr('\u062A\u0645 \u062A\u062D\u0631\u064A\u0631 \u0627\u0644\u0633\u0631\u064A\u0631 \u0628\u0646\u062C\u0627\u062D.', 'Bed released successfully.') });
                        }
                        await mutate();
                        setBusy(false);
                      }}
                    >
                      {tr('تحرير', 'Release')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
