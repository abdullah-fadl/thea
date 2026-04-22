'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ClinicalInfraCrudPage, type CrudField } from '@/components/admin/clinicalInfra/CrudPage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSWRConfig } from 'swr';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function RoomsAdmin() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { mutate } = useSWRConfig();
  const { data: fac } = useSWR('/api/clinical-infra/facilities', fetcher);
  const { data: units } = useSWR('/api/clinical-infra/units', fetcher);
  const { data: floors } = useSWR('/api/clinical-infra/floors', fetcher);
  const facilities = Array.isArray(fac?.items) ? fac.items : [];
  const unitItems = Array.isArray(units?.items) ? units.items : [];
  const floorItems = Array.isArray(floors?.items) ? floors.items : [];

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'range' | 'list'>('range');
  const [facilityId, setFacilityId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [roomType, setRoomType] = useState<'clinicRoom' | 'erRoom' | 'ipdRoom' | 'procedureRoom'>('clinicRoom');
  const [prefix, setPrefix] = useState('Room');
  const [startNumber, setStartNumber] = useState('101');
  const [endNumber, setEndNumber] = useState('120');
  const [namesText, setNamesText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const previewCount = useMemo(() => {
    if (!facilityId || !unitId || !floorId || !roomType) return 0;
    if (bulkMode === 'range') {
      const s = Number(startNumber);
      const e = Number(endNumber);
      if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
      const start = Math.floor(s);
      const end = Math.floor(e);
      if (start <= 0 || end <= 0 || end < start) return 0;
      return end - start + 1;
    }
    const lines = namesText
      .split(/\r?\n/g)
      .map((x) => x.trim())
      .filter(Boolean);
    return lines.length;
  }, [bulkMode, startNumber, endNumber, namesText, facilityId, unitId, floorId, roomType]);

  const onBulkSubmit = async () => {
    if (!facilityId || !unitId || !floorId || !roomType) {
      alert(tr('المرفق/الوحدة/الطابق/نوع الغرفة مطلوبة', 'Facility/Unit/Floor/Room Type are required'));
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { facilityId, unitId, floorId, roomType };
      if (bulkMode === 'range') {
        payload.prefix = prefix;
        payload.startNumber = Number(startNumber);
        payload.endNumber = Number(endNumber);
      } else {
        payload.names = namesText
          .split(/\r?\n/g)
          .map((x) => x.trim())
          .filter(Boolean);
      }
      const res = await fetch('/api/clinical-infra/rooms/bulk', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || tr('فشل الإنشاء الجماعي', 'Bulk create failed'));
        return;
      }
      setBulkOpen(false);
      await mutate('/api/clinical-infra/rooms');
    } finally {
      setSubmitting(false);
    }
  };

  const roomTypeLabels: Record<string, string> = {
    clinicRoom: tr('غرفة عيادة', 'clinicRoom'),
    erRoom: tr('غرفة طوارئ', 'erRoom'),
    ipdRoom: tr('غرفة تنويم', 'ipdRoom'),
    procedureRoom: tr('غرفة إجراءات', 'procedureRoom'),
  };

  const fields: CrudField[] = useMemo(() => {
    const facilityOptions = facilities.map((f: any) => ({ value: String(f.id), label: String(f.name || f.id) }));
    const unitOptions = unitItems.map((u: any) => ({ value: String(u.id), label: String(u.name || u.id) }));
    const floorOptions = floorItems.map((fl: any) => ({ value: String(fl.id), label: String(fl.name || fl.id) }));
    return [
      { key: 'name', label: tr('الاسم', 'Name'), type: 'text', placeholder: tr('غرفة 12', 'Room 12') },
      { key: 'facilityId', label: tr('المرفق', 'Facility'), type: 'select', options: facilityOptions },
      { key: 'unitId', label: tr('الوحدة', 'Unit'), type: 'select', options: unitOptions },
      { key: 'floorId', label: tr('الطابق', 'Floor'), type: 'select', options: floorOptions },
      {
        key: 'roomType',
        label: tr('نوع الغرفة', 'Room Type'),
        type: 'select',
        options: ['clinicRoom', 'erRoom', 'ipdRoom', 'procedureRoom'].map((v) => ({ value: v, label: roomTypeLabels[v] || v })),
      },
    ];
  }, [facilities, unitItems, floorItems, language]);

  const facilityOptions = facilities.map((f: any) => ({ value: String(f.id), label: String(f.name || f.id) }));
  const unitOptions = unitItems.map((u: any) => ({ value: String(u.id), label: String(u.name || u.id) }));
  const floorOptions = floorItems.map((fl: any) => ({ value: String(fl.id), label: String(fl.name || fl.id) }));

  return (
    <>
      <div className="container mx-auto p-4 md:p-6 max-w-5xl">
        <div className="flex justify-end">
          <Button className="rounded-xl" variant="outline" onClick={() => setBulkOpen(true)}>
            {tr('إنشاء غرف جماعي', 'Bulk Create Rooms')}
          </Button>
        </div>
      </div>

      <ClinicalInfraCrudPage title={tr('الغرف', 'Rooms')} endpoint="/api/clinical-infra/rooms" fields={fields} />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إنشاء غرف جماعي', 'Bulk Create Rooms')}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المرفق', 'Facility')}</span>
              <Select value={facilityId} onValueChange={setFacilityId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر المرفق', 'Select facility')} />
                </SelectTrigger>
                <SelectContent>
                  {facilityOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوحدة', 'Unit')}</span>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر الوحدة', 'Select unit')} />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الطابق', 'Floor')}</span>
              <Select value={floorId} onValueChange={setFloorId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر الطابق', 'Select floor')} />
                </SelectTrigger>
                <SelectContent>
                  {floorOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع الغرفة', 'Room Type')}</span>
              <Select value={roomType} onValueChange={(v) => setRoomType(v as typeof roomType)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر نوع الغرفة', 'Select room type')} />
                </SelectTrigger>
                <SelectContent>
                  {['clinicRoom', 'erRoom', 'ipdRoom', 'procedureRoom'].map((v) => (
                    <SelectItem key={v} value={v}>
                      {roomTypeLabels[v] || v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوضع', 'Mode')}</span>
              <Select value={bulkMode} onValueChange={(v) => setBulkMode(v as 'range' | 'list')}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر الوضع', 'Select mode')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="range">{tr('نطاق', 'Range')}</SelectItem>
                  <SelectItem value="list">{tr('قائمة', 'List')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('معاينة', 'Preview')}</span>
              <div className="text-sm text-muted-foreground">
                {previewCount ? tr(`${previewCount} غرفة`, `${previewCount} room(s)`) : '—'}
              </div>
            </div>
          </div>

          {bulkMode === 'range' ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البادئة', 'Prefix')}</span>
                <Input className="rounded-xl thea-input-focus" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder={tr('غرفة', 'Room')} />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم البداية', 'Start Number')}</span>
                <Input className="rounded-xl thea-input-focus" value={startNumber} onChange={(e) => setStartNumber(e.target.value)} placeholder="101" />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم النهاية', 'End Number')}</span>
                <Input className="rounded-xl thea-input-focus" value={endNumber} onChange={(e) => setEndNumber(e.target.value)} placeholder="120" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('أسماء الغرف (واحدة لكل سطر)', 'Room names (one per line)')}</span>
              <Textarea
                value={namesText}
                onChange={(e) => setNamesText(e.target.value)}
                placeholder={tr('غرفة 1\nغرفة 2\nغرفة 3', 'Room 1\nRoom 2\nRoom 3')}
                className="min-h-[140px] rounded-xl thea-input-focus"
              />
            </div>
          )}

          <DialogFooter>
            <Button className="rounded-xl" onClick={onBulkSubmit} disabled={submitting || previewCount === 0}>
              {submitting ? tr('جاري الإنشاء...', 'Creating...') : tr('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
