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

const fetcher = async (url: string) => {
  const r = await fetch(url, { credentials: 'include' });
  const json = await r.json().catch(() => ({}));
  return { ...json, _status: r.status };
};

export default function BedsAdmin() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { mutate } = useSWRConfig();
  const { data: fac } = useSWR('/api/clinical-infra/facilities', fetcher);
  const { data: units } = useSWR('/api/clinical-infra/units', fetcher);
  const { data: floors } = useSWR('/api/clinical-infra/floors', fetcher);
  const { data: rooms } = useSWR('/api/clinical-infra/rooms', fetcher);
  const facilities = Array.isArray(fac?.items) ? fac.items : [];
  const unitItems = Array.isArray(units?.items) ? units.items : [];
  const floorItems = Array.isArray(floors?.items) ? floors.items : [];
  const roomItems = Array.isArray(rooms?.items) ? rooms.items : [];
  const facStatus = Number(fac?._status || 0);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'range' | 'list'>('range');
  const [facilityId, setFacilityId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [bedType, setBedType] = useState<'ER' | 'IPD' | 'ICU'>('ER');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [prefix, setPrefix] = useState('Bed');
  const [startNumber, setStartNumber] = useState('1');
  const [endNumber, setEndNumber] = useState('20');
  const [namesText, setNamesText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const previewCount = useMemo(() => {
    if (!facilityId || !unitId || !floorId || !roomId || !bedType || !status) return 0;
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
  }, [bulkMode, startNumber, endNumber, namesText, facilityId, unitId, floorId, roomId, bedType, status]);

  const onBulkSubmit = async () => {
    if (!facilityId || !unitId || !floorId || !roomId || !bedType || !status) {
      alert(tr('المرفق/الوحدة/الطابق/الغرفة/نوع السرير/الحالة مطلوبة', 'Facility/Unit/Floor/Room/Bed Type/Status are required'));
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { facilityId, unitId, floorId, roomId, bedType, status };
      if (bulkMode === 'range') {
        payload.prefix = prefix;
        payload.startNumber = Number(startNumber);
        payload.endNumber = Number(endNumber);
      } else {
        payload.labels = namesText
          .split(/\r?\n/g)
          .map((x) => x.trim())
          .filter(Boolean);
      }
      const res = await fetch('/api/clinical-infra/beds/bulk', {
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
      await mutate('/api/clinical-infra/beds');
    } finally {
      setSubmitting(false);
    }
  };

  const fields: CrudField[] = useMemo(() => {
    const facilityOptions = facilities.map((f: any) => ({ value: String(f.id), label: String(f.name || f.id) }));
    const unitOptions = unitItems.map((u: any) => ({ value: String(u.id), label: String(u.name || u.id) }));
    const floorOptions = floorItems.map((fl: any) => ({ value: String(fl.id), label: String(fl.name || fl.id) }));
    const roomOptions = (form: Record<string, any>) => {
      const selectedUnitId = String(form.unitId || '').trim();
      const filtered = selectedUnitId ? roomItems.filter((r: any) => String(r.unitId || '') === selectedUnitId) : roomItems;
      return filtered.map((r: any) => ({ value: String(r.id), label: String(r.name || r.id) }));
    };
    return [
      { key: 'label', label: tr('التسمية', 'Label'), type: 'text', placeholder: tr('سرير 01', 'Bed 01') },
      { key: 'facilityId', label: tr('المرفق', 'Facility'), type: 'select', options: facilityOptions },
      { key: 'unitId', label: tr('الوحدة', 'Unit'), type: 'select', options: unitOptions, clearOnChange: ['roomId'] },
      { key: 'floorId', label: tr('الطابق', 'Floor'), type: 'select', options: floorOptions },
      { key: 'roomId', label: tr('الغرفة', 'Room'), type: 'select', options: roomOptions },
      { key: 'bedType', label: tr('نوع السرير', 'Bed Type'), type: 'select', options: ['ER', 'IPD', 'ICU'].map((v) => ({ value: v, label: v })) },
      { key: 'status', label: tr('الحالة', 'Status'), type: 'select', options: ['active', 'inactive'].map((v) => ({ value: v, label: tr(v === 'active' ? 'نشط' : 'غير نشط', v) })) },
    ];
  }, [facilities, unitItems, floorItems, roomItems, language]);

  const facilityOptions = facilities.map((f: any) => ({ value: String(f.id), label: String(f.name || f.id) }));
  const unitOptions = unitItems.map((u: any) => ({ value: String(u.id), label: String(u.name || u.id) }));
  const floorOptions = floorItems.map((fl: any) => ({ value: String(fl.id), label: String(fl.name || fl.id) }));
  const roomOptions = roomItems
    .filter((r: any) => !unitId || String(r.unitId || '') === unitId)
    .map((r: any) => ({ value: String(r.id), label: String(r.name || r.id) }));

  return (
    <>
      <div className="container mx-auto p-4 md:p-6 max-w-5xl">
        <div className="flex justify-end">
          <Button className="rounded-xl" variant="outline" onClick={() => setBulkOpen(true)}>
            {tr('إنشاء أسرّة جماعي', 'Bulk Create Beds')}
          </Button>
        </div>
      </div>

      <ClinicalInfraCrudPage title={tr('الأسرّة', 'Beds')} endpoint="/api/clinical-infra/beds" fields={fields} />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('إنشاء أسرّة جماعي', 'Bulk Create Beds')}</DialogTitle>
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
              {facStatus && facStatus !== 200 ? (
                <div className="text-xs text-destructive">{tr(`فشل تحميل المرافق (الحالة ${facStatus}).`, `Failed to load facilities (status ${facStatus}).`)}</div>
              ) : null}
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوحدة', 'Unit')}</span>
              <Select
                value={unitId}
                onValueChange={(value) => {
                  setUnitId(value);
                  setRoomId('');
                }}
              >
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
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الغرفة', 'Room')}</span>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر الغرفة', 'Select room')} />
                </SelectTrigger>
                <SelectContent>
                  {roomOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع السرير', 'Bed Type')}</span>
              <Select value={bedType} onValueChange={(v) => setBedType(v as 'ER' | 'IPD' | 'ICU')}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر نوع السرير', 'Select bed type')} />
                </SelectTrigger>
                <SelectContent>
                  {['ER', 'IPD', 'ICU'].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر الحالة', 'Select status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{tr('نشط', 'active')}</SelectItem>
                  <SelectItem value="inactive">{tr('غير نشط', 'inactive')}</SelectItem>
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
                {previewCount ? tr(`${previewCount} سرير`, `${previewCount} bed(s)`) : '—'}
              </div>
            </div>
          </div>

          {bulkMode === 'range' ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البادئة', 'Prefix')}</span>
                <Input className="rounded-xl thea-input-focus" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder={tr('سرير', 'Bed')} />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم البداية', 'Start Number')}</span>
                <Input className="rounded-xl thea-input-focus" value={startNumber} onChange={(e) => setStartNumber(e.target.value)} placeholder="1" />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم النهاية', 'End Number')}</span>
                <Input className="rounded-xl thea-input-focus" value={endNumber} onChange={(e) => setEndNumber(e.target.value)} placeholder="20" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تسميات الأسرّة (واحدة لكل سطر)', 'Bed labels (one per line)')}</span>
              <Textarea
                value={namesText}
                onChange={(e) => setNamesText(e.target.value)}
                placeholder={tr('سرير 1\nسرير 2\nسرير 3', 'Bed 1\nBed 2\nBed 3')}
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
