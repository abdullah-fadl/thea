'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, ArrowRightLeft, Clock, AlertTriangle, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import {
  type ShiftHandoverData, type HandoverEntry, type HandoverTask, type HandoverUrgency, type ShiftType,
  DEFAULT_HANDOVER, SHIFT_TYPES, URGENCY_CFG, createHandoverEntry,
} from '@/lib/clinical/shiftHandover';
import { useLang } from '@/hooks/use-lang';

interface ShiftHandoverProps {
  value: ShiftHandoverData | null;
  onChange: (data: ShiftHandoverData) => void;
  compact?: boolean;
  disabled?: boolean;
}

export function ShiftHandover({ value, onChange, compact = false, disabled = false }: ShiftHandoverProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const data = value || DEFAULT_HANDOVER;
  const [expanded, setExpanded] = useState(!compact);

  const update = useCallback((patch: Partial<ShiftHandoverData>) => {
    onChange({ ...data, ...patch });
  }, [data, onChange]);

  if (compact) {
    if (!value || data.entries.length === 0) return null;
    const urgentCount = data.entries.filter(e => e.urgency === 'URGENT').length;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${urgentCount > 0 ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700'}`}>
        <ArrowRightLeft className="w-3 h-3" /> {data.entries.length}
      </span>
    );
  }

  const shiftCfg = SHIFT_TYPES.find(s => s.value === data.shiftType);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-3 bg-sky-50/50 transition-colors">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-sky-600" />
          <span className="font-semibold text-sm text-sky-700">{tr('تسليم الوردية', 'Shift Handover')}</span>
          {data.entries.length > 0 && (
            <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">
              {shiftCfg?.icon} {data.entries.length} {tr('مريض', 'patient(s)')}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('نوع الوردية', 'Shift')}</label>
              <div className="flex gap-1">
                {SHIFT_TYPES.map(s => (
                  <button key={s.value} onClick={() => !disabled && update({ shiftType: s.value })}
                    className={`flex-1 py-1.5 text-xs rounded font-medium transition-colors text-center ${data.shiftType === s.value ? 'bg-sky-600 text-white' : 'bg-card text-muted-foreground border hover:border-sky-300'}`}>
                    {s.icon} {tr(s.labelAr, s.labelEn)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('تسليم من', 'From')}</label>
              <input type="text" value={data.handoverFrom} onChange={e => !disabled && update({ handoverFrom: e.target.value })} className="w-full text-xs border rounded px-2 py-1.5" disabled={disabled} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('تسليم إلى', 'To')}</label>
              <input type="text" value={data.handoverTo} onChange={e => !disabled && update({ handoverTo: e.target.value })} className="w-full text-xs border rounded px-2 py-1.5" disabled={disabled} />
            </div>
          </div>

          {/* Add patient */}
          {!disabled && (
            <button onClick={() => update({ entries: [...data.entries, createHandoverEntry({ name: '', mrn: '', encounterCoreId: '' })] })}
              className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-medium">
              <Plus className="w-3.5 h-3.5" /> {tr('إضافة مريض للتسليم', 'Add Patient Handover')}
            </button>
          )}

          {/* Patient entries */}
          {data.entries.map((entry, idx) => (
            <HandoverCard key={entry.id} entry={entry} tr={tr} disabled={disabled}
              onChange={(patch) => { const next = [...data.entries]; next[idx] = { ...next[idx], ...patch }; update({ entries: next }); }}
              onRemove={() => update({ entries: data.entries.filter((_, i) => i !== idx) })}
            />
          ))}

          {/* General notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('ملاحظات عامة للوردية', 'General Shift Notes')}</label>
            <textarea value={data.generalNotes} onChange={e => !disabled && update({ generalNotes: e.target.value })} rows={2}
              className="w-full text-xs border rounded px-2 py-1.5 resize-none" disabled={disabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function HandoverCard({ entry, tr, disabled, onChange, onRemove }: {
  entry: HandoverEntry; tr: (a: string, e: string) => string; disabled: boolean;
  onChange: (p: Partial<HandoverEntry>) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const uCfg = URGENCY_CFG[entry.urgency];

  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${uCfg.bg} ${uCfg.text}`}>{tr(uCfg.labelAr, uCfg.labelEn)}</span>
        <span className="text-xs font-medium text-foreground flex-1 truncate">{entry.patientName || tr('مريض جديد', 'New Patient')}</span>
        {entry.pendingTasks.length > 0 && <span className="text-[10px] text-amber-600">{entry.pendingTasks.filter(t => !t.completed).length} {tr('مهام', 'tasks')}</span>}
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t pt-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={entry.patientName} onChange={e => !disabled && onChange({ patientName: e.target.value })} placeholder={tr('اسم المريض', 'Patient name')} className="text-xs border rounded px-2 py-1.5" disabled={disabled} />
            <select value={entry.urgency} onChange={e => !disabled && onChange({ urgency: e.target.value as HandoverUrgency })} className="text-xs border rounded px-2 py-1.5" disabled={disabled}>
              {(Object.keys(URGENCY_CFG) as HandoverUrgency[]).map(u => <option key={u} value={u}>{tr(URGENCY_CFG[u].labelAr, URGENCY_CFG[u].labelEn)}</option>)}
            </select>
          </div>

          {/* ISBAR fields */}
          {[
            { key: 'situation' as const, lAr: 'الوضع الحالي (S)', lEn: 'Situation' },
            { key: 'background' as const, lAr: 'الخلفية (B)', lEn: 'Background' },
            { key: 'assessment' as const, lAr: 'التقييم (A)', lEn: 'Assessment' },
            { key: 'recommendation' as const, lAr: 'التوصيات (R)', lEn: 'Recommendation' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground mb-0.5 block">{tr(f.lAr, f.lEn)}</label>
              <textarea value={entry[f.key]} onChange={e => !disabled && onChange({ [f.key]: e.target.value })} rows={1} className="w-full text-xs border rounded px-2 py-1.5 resize-none" disabled={disabled} />
            </div>
          ))}

          {/* Quick fields */}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-muted-foreground">{tr('وصول وريدي', 'IV Access')}</label>
              <input type="text" value={entry.ivAccess} onChange={e => !disabled && onChange({ ivAccess: e.target.value })} className="w-full text-xs border rounded px-2 py-1" disabled={disabled} /></div>
            <div><label className="text-[10px] text-muted-foreground">{tr('احتياطات عزل', 'Isolation')}</label>
              <input type="text" value={entry.isolationPrecautions} onChange={e => !disabled && onChange({ isolationPrecautions: e.target.value })} className="w-full text-xs border rounded px-2 py-1" disabled={disabled} /></div>
            <div><label className="text-[10px] text-muted-foreground">{tr('حمية', 'Diet')}</label>
              <input type="text" value={entry.dietRestrictions} onChange={e => !disabled && onChange({ dietRestrictions: e.target.value })} className="w-full text-xs border rounded px-2 py-1" disabled={disabled} /></div>
            <div><label className="text-[10px] text-muted-foreground">{tr('حالة الإنعاش', 'Code Status')}</label>
              <input type="text" value={entry.codeStatus} onChange={e => !disabled && onChange({ codeStatus: e.target.value })} className="w-full text-xs border rounded px-2 py-1" disabled={disabled} /></div>
          </div>

          {/* Pending tasks */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground">{tr('مهام معلقة', 'Pending Tasks')}</label>
              {!disabled && <button onClick={() => onChange({ pendingTasks: [...entry.pendingTasks, { id: `t-${Date.now()}`, description: '', priority: 'MEDIUM', completed: false }] })}
                className="text-xs text-sky-600"><Plus className="w-3 h-3 inline" /></button>}
            </div>
            {entry.pendingTasks.map((t, ti) => (
              <div key={t.id} className="flex items-center gap-1.5 mb-1">
                <button disabled={disabled} onClick={() => { const tasks = [...entry.pendingTasks]; tasks[ti] = { ...t, completed: !t.completed }; onChange({ pendingTasks: tasks }); }}>
                  {t.completed ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                <input type="text" value={t.description} onChange={e => { const tasks = [...entry.pendingTasks]; tasks[ti] = { ...t, description: e.target.value }; onChange({ pendingTasks: tasks }); }}
                  className={`flex-1 text-xs border rounded px-2 py-0.5 ${t.completed ? 'line-through text-muted-foreground' : ''}`} disabled={disabled} placeholder={tr('وصف المهمة', 'Task description')} />
                {!disabled && <button onClick={() => onChange({ pendingTasks: entry.pendingTasks.filter((_, i) => i !== ti) })} className="text-muted-foreground hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
              </div>
            ))}
          </div>

          {!disabled && <div className="flex justify-end"><button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">{tr('حذف', 'Remove')}</button></div>}
        </div>
      )}
    </div>
  );
}
