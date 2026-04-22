'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, Pill, Clock, Check, X, Trash2, PauseCircle } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import {
  type MARData, type MARMedication, type MARAdminEntry, type MARStatus, type MARRoute, type MARFrequency,
  DEFAULT_MAR, MAR_ROUTES, MAR_FREQUENCIES, MAR_STATUS_CFG, createMedication, createAdminEntry,
} from '@/lib/clinical/medicationAdminRecord';

interface MedicationAdminRecordProps {
  value: MARData | null;
  onChange: (data: MARData) => void;
  compact?: boolean;
  disabled?: boolean;
}

export function MedicationAdminRecord({ value, onChange, compact = false, disabled = false }: MedicationAdminRecordProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const data = value || DEFAULT_MAR;
  const [expanded, setExpanded] = useState(!compact);
  const [showAddMed, setShowAddMed] = useState(false);

  const update = useCallback((patch: Partial<MARData>) => { onChange({ ...data, ...patch }); }, [data, onChange]);

  const pendingCount = data.adminEntries.filter(e => e.status === 'SCHEDULED').length;
  const givenCount = data.adminEntries.filter(e => e.status === 'GIVEN').length;

  if (compact) {
    if (!value || data.medications.length === 0) return null;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-50 text-pink-700">
        <Pill className="w-3 h-3" /> {data.medications.length}
      </span>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-3 bg-pink-50/50 transition-colors">
        <div className="flex items-center gap-2">
          <Pill className="w-4 h-4 text-pink-600" />
          <span className="font-semibold text-sm text-pink-700">{tr('سجل إعطاء الأدوية', 'Medication Administration Record')}</span>
          {data.medications.length > 0 && (
            <>
              <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-medium">{data.medications.length} {tr('دواء', 'med(s)')}</span>
              {pendingCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{pendingCount} {tr('مجدول', 'pending')}</span>}
            </>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {!disabled && (
            <button onClick={() => setShowAddMed(true)} className="flex items-center gap-1.5 text-xs text-pink-600 hover:text-pink-700 font-medium">
              <Plus className="w-3.5 h-3.5" /> {tr('إضافة دواء', 'Add Medication')}
            </button>
          )}

          {showAddMed && !disabled && (
            <MedForm tr={tr} language={language}
              onAdd={(med) => { update({ medications: [...data.medications, med] }); setShowAddMed(false); }}
              onCancel={() => setShowAddMed(false)} />
          )}

          {data.medications.length > 0 ? (
            data.medications.map((med, idx) => {
              const entries = data.adminEntries.filter(e => e.medicationId === med.id);
              return (
                <MedCard key={med.id} med={med} entries={entries} tr={tr} language={language} disabled={disabled}
                  onAdminister={() => {
                    const entry = createAdminEntry(med.id);
                    entry.status = 'GIVEN';
                    entry.administeredAt = new Date().toISOString();
                    update({ adminEntries: [...data.adminEntries, entry] });
                  }}
                  onStatusChange={(entryId, status, reason) => {
                    const adminEntries = data.adminEntries.map(e => e.id === entryId ? { ...e, status, ...(status === 'HELD' ? { holdReason: reason } : {}), ...(status === 'REFUSED' ? { refusedReason: reason } : {}), ...(status === 'GIVEN' ? { administeredAt: new Date().toISOString() } : {}) } : e);
                    update({ adminEntries });
                  }}
                  onRemoveMed={() => {
                    update({ medications: data.medications.filter((_, i) => i !== idx), adminEntries: data.adminEntries.filter(e => e.medicationId !== med.id) });
                  }}
                />
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground italic">{tr('لا توجد أدوية مسجلة', 'No medications recorded')}</p>
          )}
        </div>
      )}
    </div>
  );
}

function MedForm({ tr, language, onAdd, onCancel }: { tr: (a: string, e: string) => string; language: string; onAdd: (m: MARMedication) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState<MARRoute>('PO');
  const [freq, setFreq] = useState<MARFrequency>('DAILY');
  const [isPRN, setIsPRN] = useState(false);

  return (
    <div className="p-3 bg-pink-50/30 rounded-lg border border-pink-100 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={tr('اسم الدواء', 'Medication name')} className="text-xs border rounded px-2 py-1.5" />
        <input type="text" value={dose} onChange={e => setDose(e.target.value)} placeholder={tr('الجرعة (مثال: 500mg)', 'Dose (e.g. 500mg)')} className="text-xs border rounded px-2 py-1.5" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select value={route} onChange={e => setRoute(e.target.value as MARRoute)} className="text-xs border rounded px-2 py-1.5">
          {MAR_ROUTES.map(r => <option key={r.value} value={r.value}>{tr(r.labelAr, r.labelEn)}</option>)}
        </select>
        <select value={freq} onChange={e => setFreq(e.target.value as MARFrequency)} className="text-xs border rounded px-2 py-1.5">
          {MAR_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{tr(f.labelAr, f.labelEn)}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={isPRN} onChange={e => setIsPRN(e.target.checked)} className="rounded border-border text-pink-600" />
          PRN
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-muted-foreground px-2 py-1">{tr('إلغاء', 'Cancel')}</button>
        <button onClick={() => { const m = createMedication(); m.name = name.trim(); m.dose = dose.trim(); m.route = route; m.frequency = freq; m.isPRN = isPRN; if (m.name) onAdd(m); }}
          disabled={!name.trim()} className="text-xs bg-pink-600 text-white px-3 py-1 rounded disabled:opacity-40">{tr('إضافة', 'Add')}</button>
      </div>
    </div>
  );
}

function MedCard({ med, entries, tr, language, disabled, onAdminister, onStatusChange, onRemoveMed }: {
  med: MARMedication; entries: MARAdminEntry[]; tr: (a: string, e: string) => string; language: string; disabled: boolean;
  onAdminister: () => void; onStatusChange: (entryId: string, status: MARStatus, reason?: string) => void; onRemoveMed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const routeCfg = MAR_ROUTES.find(r => r.value === med.route);
  const freqCfg = MAR_FREQUENCIES.find(f => f.value === med.frequency);
  const lastGiven = entries.filter(e => e.status === 'GIVEN').sort((a, b) => (b.administeredAt || '').localeCompare(a.administeredAt || ''))[0];

  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors">
        <Pill className="w-4 h-4 text-pink-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground">{med.name}</span>
            <span className="text-[10px] text-muted-foreground">{med.dose}</span>
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{tr(routeCfg?.labelAr || '', routeCfg?.labelEn || '')}</span>
            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{tr(freqCfg?.labelAr || '', freqCfg?.labelEn || '')}</span>
            {med.isPRN && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">PRN</span>}
          </div>
          {lastGiven?.administeredAt && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
              <Clock className="w-3 h-3" /> {tr('آخر إعطاء:', 'Last given:')} {new Date(lastGiven.administeredAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {!disabled && (
          <button onClick={(e) => { e.stopPropagation(); onAdminister(); }} className="text-xs bg-green-600 text-white px-2.5 py-1 rounded hover:bg-green-700 shrink-0">
            {tr('إعطاء', 'Give')}
          </button>
        )}
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 border-t pt-2 space-y-2">
          {entries.length > 0 ? (
            entries.sort((a, b) => (b.scheduledTime).localeCompare(a.scheduledTime)).map(entry => {
              const sCfg = MAR_STATUS_CFG[entry.status];
              const timeStr = entry.administeredAt
                ? new Date(entry.administeredAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                : new Date(entry.scheduledTime).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={entry.id} className="flex items-center gap-2 text-xs">
                  <span>{sCfg.icon}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sCfg.bg} ${sCfg.text}`}>{tr(sCfg.labelAr, sCfg.labelEn)}</span>
                  <span className="text-muted-foreground">{timeStr}</span>
                  {entry.holdReason && <span className="text-amber-600 text-[10px]">({entry.holdReason})</span>}
                  {entry.refusedReason && <span className="text-red-500 text-[10px]">({entry.refusedReason})</span>}
                  <div className="flex-1" />
                  {!disabled && entry.status === 'SCHEDULED' && (
                    <div className="flex gap-1">
                      <button onClick={() => onStatusChange(entry.id, 'GIVEN')} className="text-green-600 hover:text-green-700" title="Given"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onStatusChange(entry.id, 'HELD', tr('سبب التعليق', 'Hold reason'))} className="text-amber-600 hover:text-amber-700" title="Hold"><PauseCircle className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onStatusChange(entry.id, 'REFUSED', tr('سبب الرفض', 'Refusal reason'))} className="text-red-500 hover:text-red-600" title="Refused"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground italic">{tr('لم يُعطَ بعد', 'Not yet administered')}</p>
          )}
          {!disabled && <div className="flex justify-end"><button onClick={onRemoveMed} className="text-xs text-red-500 hover:text-red-700">{tr('حذف الدواء', 'Remove Medication')}</button></div>}
        </div>
      )}
    </div>
  );
}
