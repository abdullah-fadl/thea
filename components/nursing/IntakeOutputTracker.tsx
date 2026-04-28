'use client';

import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, Droplets, ArrowDown, ArrowUp, Trash2, Clock, AlertTriangle, Clipboard } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import {
  type IOData, type IOEntry, type IODirection, type IntakeType, type OutputType,
  DEFAULT_IO_DATA, INTAKE_TYPES, OUTPUT_TYPES, calculateBalance, BALANCE_STATUS_CONFIG,
} from '@/lib/clinical/intakeOutput';

interface IntakeOutputTrackerProps {
  value: IOData | null;
  onChange: (data: IOData) => void;
  compact?: boolean;
  disabled?: boolean;
}

export function IntakeOutputTracker({ value, onChange, compact = false, disabled = false }: IntakeOutputTrackerProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const data = value || DEFAULT_IO_DATA;
  const [expanded, setExpanded] = useState(!compact);
  const [showForm, setShowForm] = useState(false);
  const [formDir, setFormDir] = useState<IODirection>('INTAKE');

  const bal = useMemo(() => calculateBalance(data.entries), [data.entries]);
  const cfg = BALANCE_STATUS_CONFIG[bal.status];

  const addEntry = useCallback((entry: IOEntry) => {
    onChange({ entries: [entry, ...data.entries] });
    setShowForm(false);
  }, [data, onChange]);

  const removeEntry = useCallback((id: string) => {
    onChange({ entries: data.entries.filter(e => e.id !== id) });
  }, [data, onChange]);

  if (compact) {
    if (!value || data.entries.length === 0) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bgClass} ${cfg.colorClass}`}>
        <Droplets className="w-3 h-3" />
        {bal.balance > 0 ? '+' : ''}{bal.balance} mL
      </span>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-3 ${cfg.bgClass} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-cyan-600" />
          <span className="font-semibold text-sm text-cyan-700">
            {tr('ميزان السوائل', 'Intake & Output')}
          </span>
          {data.entries.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cfg.bgClass} ${cfg.colorClass}`}>
              {bal.balance > 0 ? '+' : ''}{bal.balance} mL — {tr(cfg.labelAr, cfg.labelEn)}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Summary cards */}
          {data.entries.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 bg-blue-50 rounded-lg text-center">
                <ArrowDown className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                <div className="text-lg font-bold text-blue-700">{bal.totalIntake}</div>
                <div className="text-[10px] text-blue-500">{tr('داخل (مل)', 'Intake (mL)')}</div>
              </div>
              <div className="p-2.5 bg-orange-50 rounded-lg text-center">
                <ArrowUp className="w-4 h-4 text-orange-600 mx-auto mb-1" />
                <div className="text-lg font-bold text-orange-700">{bal.totalOutput}</div>
                <div className="text-[10px] text-orange-500">{tr('خارج (مل)', 'Output (mL)')}</div>
              </div>
              <div className={`p-2.5 rounded-lg text-center ${cfg.bgClass}`}>
                <Droplets className={`w-4 h-4 mx-auto mb-1 ${cfg.colorClass}`} />
                <div className={`text-lg font-bold ${cfg.colorClass}`}>{bal.balance > 0 ? '+' : ''}{bal.balance}</div>
                <div className={`text-[10px] ${cfg.colorClass}`}>{tr('الصافي (مل)', 'Balance (mL)')}</div>
              </div>
            </div>
          )}

          {/* Critical alert */}
          {(bal.status === 'CRITICAL_POSITIVE' || bal.status === 'CRITICAL_NEGATIVE') && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />{bal.status === 'CRITICAL_POSITIVE'
                ? tr('تنبيه: ميزان سوائل موجب حرج — خطر احتباس السوائل. أبلغ الطبيب.', 'Alert: Critical positive balance — fluid overload risk. Notify physician.')
                : tr('تنبيه: ميزان سوائل سالب حرج — خطر جفاف. أبلغ الطبيب.', 'Alert: Critical negative balance — dehydration risk. Notify physician.')}
            </div>
          )}

          {/* Add buttons */}
          {!disabled && (
            <div className="flex gap-2">
              <button
                onClick={() => { setFormDir('INTAKE'); setShowForm(true); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {tr('إضافة داخل', 'Add Intake')}
              </button>
              <button
                onClick={() => { setFormDir('OUTPUT'); setShowForm(true); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {tr('إضافة خارج', 'Add Output')}
              </button>
            </div>
          )}

          {/* Entry form */}
          {showForm && !disabled && (
            <IOEntryForm
              direction={formDir}
              tr={tr}
              language={language}
              onAdd={addEntry}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* Entries list */}
          {data.entries.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {tr('السجلات', 'Entries')} ({data.entries.length})
              </label>
              {data.entries.map(entry => {
                const isIntake = entry.direction === 'INTAKE';
                const typeCfg = isIntake
                  ? INTAKE_TYPES.find(t => t.value === entry.type)
                  : OUTPUT_TYPES.find(t => t.value === entry.type);
                const ts = new Date(entry.timestamp);
                const timeStr = ts.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={entry.id} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${isIntake ? 'bg-blue-50/50' : 'bg-orange-50/50'}`}>
                    <span className="text-base">{typeCfg?.icon || <Clipboard className="h-4 w-4" />}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-medium ${isIntake ? 'text-blue-700' : 'text-orange-700'}`}>
                          {tr(typeCfg?.labelAr || '', typeCfg?.labelEn || '')}
                        </span>
                        {entry.description && <span className="text-muted-foreground truncate">— {entry.description}</span>}
                      </div>
                    </div>
                    <span className={`font-bold ${isIntake ? 'text-blue-700' : 'text-orange-700'}`}>{entry.amount} mL</span>
                    <span className="text-muted-foreground flex items-center gap-0.5 shrink-0">
                      <Clock className="w-3 h-3" />{timeStr}
                    </span>
                    {!disabled && (
                      <button onClick={() => removeEntry(entry.id)} className="text-muted-foreground hover:text-red-500 shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {data.entries.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center">{tr('لا توجد سجلات سوائل', 'No I&O entries recorded')}</p>
          )}

          {/* Breakdown by type */}
          {data.entries.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div>
                <label className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1 block">{tr('تفصيل الداخل', 'Intake Breakdown')}</label>
                {Object.entries(bal.intakeByType).length > 0 ? (
                  Object.entries(bal.intakeByType).map(([type, amt]) => {
                    const cfg = INTAKE_TYPES.find(t => t.value === type);
                    return (
                      <div key={type} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-muted-foreground">{cfg?.icon} {tr(cfg?.labelAr || type, cfg?.labelEn || type)}</span>
                        <span className="font-medium text-blue-700">{amt} mL</span>
                      </div>
                    );
                  })
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <div>
                <label className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-1 block">{tr('تفصيل الخارج', 'Output Breakdown')}</label>
                {Object.entries(bal.outputByType).length > 0 ? (
                  Object.entries(bal.outputByType).map(([type, amt]) => {
                    const cfg = OUTPUT_TYPES.find(t => t.value === type);
                    return (
                      <div key={type} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-muted-foreground">{cfg?.icon} {tr(cfg?.labelAr || type, cfg?.labelEn || type)}</span>
                        <span className="font-medium text-orange-700">{amt} mL</span>
                      </div>
                    );
                  })
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IOEntryForm({ direction, tr, language, onAdd, onCancel }: {
  direction: IODirection;
  tr: (ar: string, en: string) => string;
  language: string;
  onAdd: (e: IOEntry) => void;
  onCancel: () => void;
}) {
  const isIntake = direction === 'INTAKE';
  const types = isIntake ? INTAKE_TYPES : OUTPUT_TYPES;
  const [type, setType] = useState(types[0].value);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

  const quickAmounts = isIntake ? [50, 100, 200, 250, 500, 1000] : [50, 100, 150, 200, 300, 500];

  return (
    <div className={`p-3 rounded-lg border space-y-3 ${isIntake ? 'bg-blue-50/30 border-blue-100' : 'bg-orange-50/30 border-orange-100'}`}>
      <div className="flex items-center gap-2 mb-1">
        {isIntake ? <ArrowDown className="w-4 h-4 text-blue-600" /> : <ArrowUp className="w-4 h-4 text-orange-600" />}
        <span className={`text-xs font-semibold ${isIntake ? 'text-blue-700' : 'text-orange-700'}`}>
          {isIntake ? tr('سوائل داخلة', 'Fluid Intake') : tr('سوائل خارجة', 'Fluid Output')}
        </span>
      </div>

      {/* Type selection */}
      <div className="flex flex-wrap gap-1.5">
        {types.map(t => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors
              ${type === t.value
                ? isIntake ? 'bg-blue-600 text-white border-blue-600' : 'bg-orange-600 text-white border-orange-600'
                : 'bg-card text-muted-foreground border-border hover:border-border'}`}
          >
            {t.icon} {tr(t.labelAr, t.labelEn)}
          </button>
        ))}
      </div>

      {/* Amount with quick buttons */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('الكمية (مل)', 'Amount (mL)')}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="mL"
            min={0}
            className="w-24 text-sm border rounded px-2 py-1.5 font-medium"
          />
          <div className="flex gap-1 flex-wrap flex-1">
            {quickAmounts.map(q => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className={`px-2 py-1 text-[10px] rounded border font-medium transition-colors
                  ${amount === String(q)
                    ? isIntake ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-orange-100 border-orange-400 text-orange-700'
                    : 'bg-card border-border text-muted-foreground hover:border-border'}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Description + time */}
      <div className="flex gap-2">
        <input
          type="text"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder={tr('وصف (اختياري)', 'Description (optional)')}
          className="flex-1 text-xs border rounded px-2 py-1.5"
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="text-xs border rounded px-2 py-1"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">{tr('إلغاء', 'Cancel')}</button>
        <button
          onClick={() => {
            const amt = Number(amount);
            if (!amt || amt <= 0) return;
            onAdd({
              id: `io-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              direction,
              type: type as IntakeType | OutputType,
              amount: amt,
              description: desc.trim(),
              timestamp: new Date().toISOString(),
            });
          }}
          disabled={!amount || Number(amount) <= 0}
          className={`text-xs text-white px-4 py-1.5 rounded disabled:opacity-40 ${isIntake ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
        >
          {tr('إضافة', 'Add')}
        </button>
      </div>
    </div>
  );
}
