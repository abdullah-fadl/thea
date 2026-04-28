'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, CheckCircle2, Circle, Clock, AlertTriangle, ClipboardList, X } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import {
  type ProceduresData, type ProcedureRecord, type ProcedureStatus,
  DEFAULT_PROCEDURES_DATA, PROCEDURE_TEMPLATES, createProcedureFromTemplate,
} from '@/lib/clinical/bedsideProcedures';

interface BedsideProcedureChecklistProps {
  value: ProceduresData | null;
  onChange: (data: ProceduresData) => void;
  compact?: boolean;
  disabled?: boolean;
}

const STATUS_COLORS: Record<ProcedureStatus, { bg: string; text: string; labelAr: string; labelEn: string }> = {
  NOT_STARTED: { bg: 'bg-muted', text: 'text-muted-foreground', labelAr: 'لم يبدأ', labelEn: 'Not Started' },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700', labelAr: 'قيد التنفيذ', labelEn: 'In Progress' },
  COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700', labelAr: 'مكتمل', labelEn: 'Completed' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-600', labelAr: 'ملغي', labelEn: 'Cancelled' },
};

export function BedsideProcedureChecklist({ value, onChange, compact = false, disabled = false }: BedsideProcedureChecklistProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const data = value || DEFAULT_PROCEDURES_DATA;
  const [expanded, setExpanded] = useState(!compact);
  const [showPicker, setShowPicker] = useState(false);

  const update = useCallback((procedures: ProcedureRecord[]) => {
    onChange({ ...data, procedures });
  }, [data, onChange]);

  const addProcedure = (templateId: string) => {
    const tpl = PROCEDURE_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    const proc = createProcedureFromTemplate(tpl);
    proc.status = 'IN_PROGRESS';
    proc.startedAt = new Date().toISOString();
    update([proc, ...data.procedures]);
    setShowPicker(false);
  };

  const removeProcedure = (idx: number) => {
    update(data.procedures.filter((_, i) => i !== idx));
  };

  const updateProcedure = (idx: number, patch: Partial<ProcedureRecord>) => {
    const next = [...data.procedures];
    next[idx] = { ...next[idx], ...patch };
    update(next);
  };

  const completedCount = data.procedures.filter(p => p.status === 'COMPLETED').length;
  const inProgressCount = data.procedures.filter(p => p.status === 'IN_PROGRESS').length;

  if (compact) {
    if (!value || data.procedures.length === 0) return null;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
        <ClipboardList className="w-3 h-3" />
        {completedCount}/{data.procedures.length}
      </span>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-teal-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-teal-600" />
          <span className="font-semibold text-sm text-teal-700">
            {tr('قوائم فحص الإجراءات', 'Procedure Checklists')}
          </span>
          {data.procedures.length > 0 && (
            <>
              <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                {data.procedures.length} {tr('إجراء', 'procedure(s)')}
              </span>
              {inProgressCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {inProgressCount} {tr('قيد التنفيذ', 'in progress')}
                </span>
              )}
            </>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Add procedure button */}
          {!disabled && (
            <div>
              {!showPicker ? (
                <button
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {tr('إضافة إجراء', 'Add Procedure')}
                </button>
              ) : (
                <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">{tr('اختر الإجراء', 'Select Procedure')}</span>
                    <button onClick={() => setShowPicker(false)} className="text-muted-foreground hover:text-muted-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PROCEDURE_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => addProcedure(tpl.id)}
                        className="flex items-center gap-2 p-2 text-left bg-card border rounded-lg hover:border-teal-400 hover:bg-teal-50 transition-colors"
                      >
                        <span className="text-lg">{tpl.icon}</span>
                        <div>
                          <span className="text-xs font-medium text-foreground block">{tr(tpl.labelAr, tpl.labelEn)}</span>
                          <span className="text-[10px] text-muted-foreground">{tpl.items.length} {tr('خطوة', 'steps')}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Procedure cards */}
          {data.procedures.length > 0 ? (
            <div className="space-y-3">
              {data.procedures.map((proc, idx) => (
                <ProcedureCard
                  key={proc.id}
                  proc={proc}
                  tr={tr}
                  language={language}
                  disabled={disabled}
                  onChange={(patch) => updateProcedure(idx, patch)}
                  onRemove={() => removeProcedure(idx)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">{tr('لا توجد إجراءات مسجلة', 'No procedures recorded')}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ProcedureCard({ proc, tr, language, disabled, onChange, onRemove }: {
  proc: ProcedureRecord;
  tr: (ar: string, en: string) => string;
  language: string;
  disabled: boolean;
  onChange: (patch: Partial<ProcedureRecord>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(proc.status === 'IN_PROGRESS');
  const tpl = PROCEDURE_TEMPLATES.find(t => t.id === proc.templateId);
  const statusCfg = STATUS_COLORS[proc.status];
  const checkedCount = proc.items.filter(i => i.checked).length;
  const totalCount = proc.items.length;
  const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const toggleItem = (itemId: string) => {
    if (disabled || proc.status === 'COMPLETED' || proc.status === 'CANCELLED') return;
    const items = proc.items.map(it =>
      it.id === itemId ? { ...it, checked: !it.checked, timestamp: !it.checked ? new Date().toISOString() : undefined } : it
    );
    const allChecked = items.every(i => i.checked);
    onChange({
      items,
      ...(allChecked ? { status: 'COMPLETED', completedAt: new Date().toISOString() } : {}),
    });
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${proc.status === 'COMPLETED' ? 'border-emerald-200' : ''}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="text-lg">{tpl?.icon || <ClipboardList className="h-4 w-4" />}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{tr(tpl?.labelAr || '', tpl?.labelEn || '')}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusCfg.bg} ${statusCfg.text}`}>
              {tr(statusCfg.labelAr, statusCfg.labelEn)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{checkedCount}/{totalCount}</span>
            {proc.startedAt && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {new Date(proc.startedAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t pt-2">
          {/* Checklist items */}
          <div className="space-y-1">
            {proc.items.map((item) => {
              const canToggle = !disabled && proc.status !== 'COMPLETED' && proc.status !== 'CANCELLED';
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  disabled={!canToggle}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors
                    ${item.checked
                      ? 'bg-emerald-50'
                      : canToggle ? 'hover:bg-muted/50' : ''}`}
                >
                  {item.checked
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <span className={`text-xs flex-1 ${item.checked ? 'text-emerald-700 line-through' : 'text-foreground'}`}>
                    {tr(item.labelAr, item.labelEn)}
                  </span>
                  {item.checked && item.timestamp && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(item.timestamp).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Complications & response */}
          {!disabled && proc.status !== 'CANCELLED' && (
            <div className="space-y-2 pt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" />
                  {tr('مضاعفات', 'Complications')}
                </label>
                <input
                  type="text"
                  value={proc.complications}
                  onChange={e => onChange({ complications: e.target.value })}
                  placeholder={tr('لا يوجد', 'None')}
                  className="w-full text-xs border rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('استجابة المريض', 'Patient Response')}</label>
                <input
                  type="text"
                  value={proc.patientResponse}
                  onChange={e => onChange({ patientResponse: e.target.value })}
                  placeholder={tr('تحمّل الإجراء بشكل جيد', 'Tolerated procedure well')}
                  className="w-full text-xs border rounded px-2 py-1.5"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          {!disabled && (
            <div className="flex justify-between items-center pt-1">
              {proc.status === 'IN_PROGRESS' && (
                <button
                  onClick={() => onChange({ status: 'CANCELLED' })}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  {tr('إلغاء الإجراء', 'Cancel Procedure')}
                </button>
              )}
              {proc.status === 'CANCELLED' && (
                <button
                  onClick={() => onChange({ status: 'IN_PROGRESS' })}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {tr('إعادة تفعيل', 'Reactivate')}
                </button>
              )}
              <div className="flex-1" />
              <button onClick={onRemove} className="text-xs text-muted-foreground hover:text-red-500">{tr('حذف', 'Remove')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
