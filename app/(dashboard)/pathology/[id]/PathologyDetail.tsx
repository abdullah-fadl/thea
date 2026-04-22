'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import {
  Microscope, ArrowLeft, Save, FileCheck, RefreshCw, AlertTriangle,
  CheckCircle2, Clock, Edit3, ChevronDown, ChevronRight, Plus, Trash2,
  FlaskConical, Dna, Activity, Package,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ─── Types ────────────────────────────────────────────────────────────────────

interface IhcMarker {
  id: string;
  marker: string;
  clone: string;
  result: 'POSITIVE' | 'NEGATIVE' | 'EQUIVOCAL' | '';
  intensity: '1+' | '2+' | '3+' | '';
  percentPositive: string;
  pattern: string;
  notes: string;
}

interface MolecularResult {
  id: string;
  testType: string;
  target: string;
  method: string;
  result: string;
  interpretation: string;
}

interface TumorCharacteristics {
  histologicalType: string;
  grade: string;
  pT: string;
  pN: string;
  pM: string;
  margins: string;
  marginDistance: string;
  lvi: string;
  pni: string;
  lymphNodesExamined: string;
  lymphNodesPositive: string;
  ajccStage: string;
}

interface GrossingData {
  weight: string;
  dimL: string;
  dimW: string;
  dimH: string;
  appearance: string;
  inkColors: string;
  cassettes: Array<{ label: string; description: string }>;
  frozenSection: boolean;
  frozenResult: string;
}

const STATUS_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string; bg: string; border: string }> = {
  RECEIVED:   { labelAr: 'مستلم',         labelEn: 'Received',   color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  GROSSING:   { labelAr: 'الفحص الظاهري', labelEn: 'Grossing',   color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  PROCESSING: { labelAr: 'المعالجة',      labelEn: 'Processing', color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  EMBEDDING:  { labelAr: 'التلبيس',       labelEn: 'Embedding',  color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  SECTIONING: { labelAr: 'التقطيع',       labelEn: 'Sectioning', color: 'text-fuchsia-700', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
  STAINING:   { labelAr: 'التلوين',       labelEn: 'Staining',   color: 'text-pink-700',    bg: 'bg-pink-50',    border: 'border-pink-200' },
  REPORTING:  { labelAr: 'التقرير',       labelEn: 'Reporting',  color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  FINALIZED:  { labelAr: 'منتهٍ',         labelEn: 'Finalized',  color: 'text-green-700',   bg: 'bg-green-50',   border: 'border-green-200' },
  REJECTED:   { labelAr: 'مرفوض',         labelEn: 'Rejected',   color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

const PIPELINE = ['RECEIVED','GROSSING','PROCESSING','EMBEDDING','SECTIONING','STAINING','REPORTING','FINALIZED'];

type TabKey = 'specimen' | 'histology' | 'ihc' | 'tumor' | 'molecular' | 'finalize';

function genId() { return Math.random().toString(36).slice(2, 10); }

const defaultGrossing = (): GrossingData => ({
  weight: '', dimL: '', dimW: '', dimH: '', appearance: '',
  inkColors: '', cassettes: [{ label: 'A', description: '' }],
  frozenSection: false, frozenResult: '',
});

const defaultTumor = (): TumorCharacteristics => ({
  histologicalType: '', grade: '', pT: '', pN: '', pM: '',
  margins: '', marginDistance: '', lvi: '', pni: '',
  lymphNodesExamined: '', lymphNodesPositive: '', ajccStage: '',
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value ?? '—'}</p>
    </div>
  );
}

function TA({ label, value, onChange, readonly, rows = 3, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  readonly: boolean; rows?: number; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      {readonly ? (
        <div className="text-sm text-foreground bg-muted/50 border border-border rounded-lg px-3 py-2 whitespace-pre-wrap min-h-[52px]">
          {value || <span className="text-muted-foreground italic">—</span>}
        </div>
      ) : (
        <textarea
          rows={rows}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.RECEIVED;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {lang === 'ar' ? cfg.labelAr : cfg.labelEn}
    </span>
  );
}

// ─── IHC Panel Builder ────────────────────────────────────────────────────────

function IhcPanelBuilder({ markers, onChange, readonly }: {
  markers: IhcMarker[];
  onChange: (m: IhcMarker[]) => void;
  readonly: boolean;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const addRow = () => onChange([...markers, { id: genId(), marker: '', clone: '', result: '', intensity: '', percentPositive: '', pattern: '', notes: '' }]);
  const removeRow = (id: string) => onChange(markers.filter(m => m.id !== id));
  const updateRow = (id: string, field: keyof IhcMarker, val: string) =>
    onChange(markers.map(m => m.id === id ? { ...m, [field]: val } : m));

  const RESULT_OPTIONS = [
    { value: 'POSITIVE',   ar: 'إيجابي',    en: 'Positive',   cls: 'bg-red-100 text-red-700 border-red-200' },
    { value: 'NEGATIVE',   ar: 'سلبي',      en: 'Negative',   cls: 'bg-muted text-foreground border-border' },
    { value: 'EQUIVOCAL',  ar: 'غير محدد',  en: 'Equivocal',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {tr('لوحة الكيمياء النسيجية المناعية', 'Immunohistochemistry Panel')}
        </h3>
        {!readonly && (
          <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
            <Plus className="w-3.5 h-3.5" />
            {tr('إضافة علامة', 'Add Marker')}
          </button>
        )}
      </div>

      {markers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
          <FlaskConical className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">{tr('لا توجد علامات IHC مضافة', 'No IHC markers added')}</p>
          {!readonly && (
            <button onClick={addRow} className="mt-2 text-xs text-indigo-600 underline">
              {tr('أضف العلامة الأولى', 'Add first marker')}
            </button>
          )}
        </div>
      )}

      {markers.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{tr('العلامة', 'Marker')}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{tr('النسخة', 'Clone')}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{tr('النتيجة', 'Result')}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{tr('الشدة', 'Intensity')}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{tr('% الإيجابية', '% Positive')}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{tr('النمط', 'Pattern')}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{tr('ملاحظات', 'Notes')}</th>
                {!readonly && <th className="px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {markers.map((m) => {
                const resultCfg = RESULT_OPTIONS.find(r => r.value === m.result);
                if (readonly) {
                  return (
                    <tr key={m.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2 font-medium text-foreground">{m.marker || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{m.clone || '—'}</td>
                      <td className="px-3 py-2">
                        {resultCfg ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${resultCfg.cls}`}>
                            {language === 'ar' ? resultCfg.ar : resultCfg.en}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-foreground">{m.intensity || '—'}</td>
                      <td className="px-3 py-2 text-foreground">{m.percentPositive ? `${m.percentPositive}%` : '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{m.pattern || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{m.notes || '—'}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={m.id} className="hover:bg-indigo-50/30">
                    <td className="px-2 py-1.5">
                      <input className="w-20 border border-border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" value={m.marker}
                        onChange={(e) => updateRow(m.id, 'marker', e.target.value)} placeholder="CD20" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="w-16 border border-border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" value={m.clone}
                        onChange={(e) => updateRow(m.id, 'clone', e.target.value)} placeholder="L26" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select className="border border-border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        value={m.result} onChange={(e) => updateRow(m.id, 'result', e.target.value)}>
                        <option value="">{tr('--', '--')}</option>
                        {RESULT_OPTIONS.map(r => (
                          <option key={r.value} value={r.value}>{language === 'ar' ? r.ar : r.en}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select className="border border-border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        value={m.intensity} onChange={(e) => updateRow(m.id, 'intensity', e.target.value)}
                        disabled={m.result !== 'POSITIVE'}>
                        <option value="">—</option>
                        <option value="1+">1+</option>
                        <option value="2+">2+</option>
                        <option value="3+">3+</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={0} max={100} className="w-14 border border-border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        value={m.percentPositive} onChange={(e) => updateRow(m.id, 'percentPositive', e.target.value)}
                        disabled={m.result !== 'POSITIVE'} placeholder="%" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select className="border border-border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        value={m.pattern} onChange={(e) => updateRow(m.id, 'pattern', e.target.value)}>
                        <option value="">—</option>
                        <option value="Nuclear">{tr('نووي', 'Nuclear')}</option>
                        <option value="Cytoplasmic">{tr('سيتوبلازمي', 'Cytoplasmic')}</option>
                        <option value="Membranous">{tr('غشائي', 'Membranous')}</option>
                        <option value="Mixed">{tr('مختلط', 'Mixed')}</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className="w-24 border border-border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" value={m.notes}
                        onChange={(e) => updateRow(m.id, 'notes', e.target.value)} placeholder={tr('ملاحظة', 'note')} />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeRow(m.id)} className="p-1 text-red-400 hover:text-red-600 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick templates */}
      {!readonly && (
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-xs text-muted-foreground self-center">{tr('قوالب سريعة:', 'Quick templates:')}</span>
          {[
            ['Breast Panel', ['ER','PR','HER2','Ki67','CK5/6','GCDFP-15']],
            ['Lymphoma Panel', ['CD20','CD3','CD10','BCL2','BCL6','MUM1','Ki67']],
            ['Lung Panel', ['TTF-1','Napsin A','p40','CK7','CK20','Synaptophysin','Chromogranin']],
          ].map(([name, panel]) => (
            <button key={String(name)}
              onClick={() => {
                const newMarkers = (panel as string[]).map(marker => ({
                  id: genId(), marker, clone: '', result: '' as const,
                  intensity: '' as const, percentPositive: '', pattern: '', notes: ''
                }));
                onChange([...markers, ...newMarkers]);
              }}
              className="px-2 py-1 border border-indigo-200 text-indigo-600 rounded-lg text-xs hover:bg-indigo-50">
              + {String(name)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tumor Profile ────────────────────────────────────────────────────────────

function TumorProfileForm({ tumor, onChange, readonly }: {
  tumor: TumorCharacteristics;
  onChange: (t: TumorCharacteristics) => void;
  readonly: boolean;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const set = (field: keyof TumorCharacteristics) => (val: string) =>
    onChange({ ...tumor, [field]: val });

  const sel = (label: string, field: keyof TumorCharacteristics, options: Array<{ value: string; label: string }>) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      {readonly ? (
        <div className="text-sm text-foreground bg-muted/50 border border-border rounded-lg px-3 py-1.5">
          {tumor[field] || <span className="text-muted-foreground italic">—</span>}
        </div>
      ) : (
        <select className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={tumor[field]} onChange={(e) => set(field)(e.target.value)}>
          <option value="">{tr('-- اختر --', '-- Select --')}</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </div>
  );

  const inp = (label: string, field: keyof TumorCharacteristics, placeholder?: string) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      {readonly ? (
        <div className="text-sm text-foreground bg-muted/50 border border-border rounded-lg px-3 py-1.5">
          {tumor[field] || <span className="text-muted-foreground italic">—</span>}
        </div>
      ) : (
        <input className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={tumor[field]} onChange={(e) => set(field)(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Activity className="w-4 h-4 text-indigo-600" />
        {tr('الملف الورمي', 'Tumor Profile')}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {inp(tr('النوع النسيجي', 'Histological Type'), 'histologicalType', tr('مثال: سرطانة غدية', 'e.g. Adenocarcinoma'))}
        {sel(tr('الدرجة النسيجية', 'Grade'), 'grade', [
          { value: 'G1', label: tr('G1 — متمايز جيداً', 'G1 — Well Differentiated') },
          { value: 'G2', label: tr('G2 — متمايز معتدلاً', 'G2 — Moderately Differentiated') },
          { value: 'G3', label: tr('G3 — متمايز بشكل رديء', 'G3 — Poorly Differentiated') },
          { value: 'G4', label: tr('G4 — غير متمايز', 'G4 — Undifferentiated') },
        ])}
        {sel(tr('الحواف الجراحية', 'Surgical Margins'), 'margins', [
          { value: 'CLEAR', label: tr('سالبة', 'Clear (Negative)') },
          { value: 'INVOLVED', label: tr('موجبة', 'Involved (Positive)') },
          { value: 'CLOSE', label: tr('قريبة (< 1mm)', 'Close (< 1mm)') },
        ])}
        {inp(tr('مسافة الهامش (مم)', 'Margin Distance (mm)'), 'marginDistance', 'mm')}
        {sel(tr('الغزو الوعائي اللمفي (LVI)', 'Lymphovascular Invasion (LVI)'), 'lvi', [
          { value: 'PRESENT', label: tr('موجود', 'Present') },
          { value: 'ABSENT', label: tr('غائب', 'Absent') },
          { value: 'INDETERMINATE', label: tr('غير محدد', 'Indeterminate') },
        ])}
        {sel(tr('الغزو العصبي (PNI)', 'Perineural Invasion (PNI)'), 'pni', [
          { value: 'PRESENT', label: tr('موجود', 'Present') },
          { value: 'ABSENT', label: tr('غائب', 'Absent') },
          { value: 'INDETERMINATE', label: tr('غير محدد', 'Indeterminate') },
        ])}
      </div>
      <div className="border-t pt-4">
        <p className="text-xs font-semibold text-muted-foreground mb-3">{tr('التدريج (TNM)', 'TNM Staging')}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {inp('pT', 'pT', 'pT1a, pT2...')}
          {inp('pN', 'pN', 'pN0, pN1...')}
          {inp('pM', 'pM', 'pM0, pM1')}
          {sel(tr('المرحلة الإجمالية (AJCC)', 'Overall Stage (AJCC)'), 'ajccStage', [
            { value: 'I', label: 'Stage I' }, { value: 'IA', label: 'Stage IA' }, { value: 'IB', label: 'Stage IB' },
            { value: 'II', label: 'Stage II' }, { value: 'IIA', label: 'Stage IIA' }, { value: 'IIB', label: 'Stage IIB' },
            { value: 'III', label: 'Stage III' }, { value: 'IIIA', label: 'Stage IIIA' }, { value: 'IIIB', label: 'Stage IIIB' }, { value: 'IIIC', label: 'Stage IIIC' },
            { value: 'IV', label: 'Stage IV' }, { value: 'IVA', label: 'Stage IVA' }, { value: 'IVB', label: 'Stage IVB' },
          ])}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          {inp(tr('عدد العقد اللمفية المفحوصة', 'Lymph Nodes Examined'), 'lymphNodesExamined', '0')}
          {inp(tr('عدد العقد اللمفية الموجبة', 'Lymph Nodes Positive'), 'lymphNodesPositive', '0')}
        </div>
      </div>
    </div>
  );
}

// ─── Molecular Studies ────────────────────────────────────────────────────────

function MolecularStudiesForm({ results, onChange, readonly }: {
  results: MolecularResult[];
  onChange: (r: MolecularResult[]) => void;
  readonly: boolean;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const addRow = () => onChange([...results, { id: genId(), testType: '', target: '', method: '', result: '', interpretation: '' }]);
  const removeRow = (id: string) => onChange(results.filter(r => r.id !== id));
  const updateRow = (id: string, field: keyof MolecularResult, val: string) =>
    onChange(results.map(r => r.id === id ? { ...r, [field]: val } : r));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Dna className="w-4 h-4 text-purple-600" />
          {tr('الدراسات الجزيئية', 'Molecular Studies')}
        </h3>
        {!readonly && (
          <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700">
            <Plus className="w-3.5 h-3.5" />
            {tr('إضافة فحص', 'Add Test')}
          </button>
        )}
      </div>

      {results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
          <Dna className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">{tr('لا توجد دراسات جزيئية', 'No molecular studies added')}</p>
        </div>
      )}

      {results.map((r) => (
        <div key={r.id} className="bg-purple-50/30 border border-purple-100 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr('نوع الفحص', 'Test Type')}</label>
              {readonly ? (
                <div className="text-sm text-foreground">{r.testType || '—'}</div>
              ) : (
                <select className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={r.testType} onChange={(e) => updateRow(r.id, 'testType', e.target.value)}>
                  <option value="">—</option>
                  <option value="FISH">FISH</option>
                  <option value="PCR">PCR</option>
                  <option value="NGS">NGS</option>
                  <option value="SEQUENCING">{tr('تسلسل', 'Sequencing')}</option>
                  <option value="ISH">ISH</option>
                  <option value="CISH">CISH</option>
                  <option value="CYTOGENETICS">{tr('الخلوي الوراثي', 'Cytogenetics')}</option>
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr('الجين / العلامة', 'Gene / Target')}</label>
              {readonly ? (
                <div className="text-sm text-foreground">{r.target || '—'}</div>
              ) : (
                <input className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={r.target} onChange={(e) => updateRow(r.id, 'target', e.target.value)} placeholder="HER2, EGFR, ALK..." />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr('الطريقة', 'Method')}</label>
              {readonly ? (
                <div className="text-sm text-foreground">{r.method || '—'}</div>
              ) : (
                <input className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={r.method} onChange={(e) => updateRow(r.id, 'method', e.target.value)} />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr('النتيجة', 'Result')}</label>
              {readonly ? (
                <div className="text-sm text-foreground font-medium">{r.result || '—'}</div>
              ) : (
                <input className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={r.result} onChange={(e) => updateRow(r.id, 'result', e.target.value)} placeholder={tr('موجب / سالب / رقمي', 'Positive / Negative / numeric')} />
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr('التفسير', 'Interpretation')}</label>
              {readonly ? (
                <div className="text-sm text-foreground">{r.interpretation || '—'}</div>
              ) : (
                <input className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={r.interpretation} onChange={(e) => updateRow(r.id, 'interpretation', e.target.value)} />
              )}
            </div>
          </div>
          {!readonly && (
            <div className="flex justify-end mt-2">
              <button onClick={() => removeRow(r.id)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                <Trash2 className="w-3 h-3" />
                {tr('حذف', 'Remove')}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Grossing Form ────────────────────────────────────────────────────────────

function GrossingForm({ grossing, onChange, readonly }: {
  grossing: GrossingData;
  onChange: (g: GrossingData) => void;
  readonly: boolean;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const addCassette = () => {
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const label = labels[grossing.cassettes.length] || `C${grossing.cassettes.length + 1}`;
    onChange({ ...grossing, cassettes: [...grossing.cassettes, { label, description: '' }] });
  };
  const removeCassette = (i: number) =>
    onChange({ ...grossing, cassettes: grossing.cassettes.filter((_, idx) => idx !== i) });
  const updateCassette = (i: number, field: 'label' | 'description', val: string) =>
    onChange({ ...grossing, cassettes: grossing.cassettes.map((c, idx) => idx === i ? { ...c, [field]: val } : c) });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Package className="w-4 h-4 text-teal-600" />
        {tr('توثيق الفحص الظاهري', 'Grossing Documentation')}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr('الوزن (غ)', 'Weight (g)')}</label>
          {readonly ? (
            <div className="text-sm text-foreground bg-muted/50 border border-border rounded-lg px-3 py-1.5">{grossing.weight || '—'}</div>
          ) : (
            <input type="number" className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              value={grossing.weight} onChange={(e) => onChange({ ...grossing, weight: e.target.value })} placeholder="g" />
          )}
        </div>
        {(['dimL', 'dimW', 'dimH'] as const).map((field, i) => (
          <div key={field}>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              {tr(['الطول', 'العرض', 'الارتفاع'][i] + ' (سم)', ['Length', 'Width', 'Height'][i] + ' (cm)')}
            </label>
            {readonly ? (
              <div className="text-sm text-foreground bg-muted/50 border border-border rounded-lg px-3 py-1.5">{grossing[field] || '—'}</div>
            ) : (
              <input type="number" step="0.1" className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={grossing[field]} onChange={(e) => onChange({ ...grossing, [field]: e.target.value })} placeholder="cm" />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TA label={tr('المظهر الظاهري', 'Gross Appearance')} value={grossing.appearance}
          onChange={(v) => onChange({ ...grossing, appearance: v })} readonly={readonly} rows={3}
          placeholder={tr('اللون، القوام، الحدود...', 'Color, texture, borders...')} />
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr('ألوان الحبر المستخدمة', 'Ink Colors Used')}</label>
            {readonly ? (
              <div className="text-sm text-foreground bg-muted/50 border border-border rounded-lg px-3 py-1.5">{grossing.inkColors || '—'}</div>
            ) : (
              <input className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={grossing.inkColors} onChange={(e) => onChange({ ...grossing, inkColors: e.target.value })}
                placeholder={tr('مثال: أسود للهامش الأمامي، أزرق للهامش الخلفي', 'e.g. Black anterior, Blue posterior')} />
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              {readonly ? (
                <span className={`text-xs px-2 py-0.5 rounded-full ${grossing.frozenSection ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                  {grossing.frozenSection ? tr('تجميد: نعم', 'Frozen: Yes') : tr('تجميد: لا', 'Frozen: No')}
                </span>
              ) : (
                <>
                  <input type="checkbox" checked={grossing.frozenSection} onChange={(e) => onChange({ ...grossing, frozenSection: e.target.checked })} />
                  <span className="text-xs">{tr('قسم مجمّد', 'Frozen Section')}</span>
                </>
              )}
            </label>
          </div>
          {(grossing.frozenSection || readonly) && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr('نتيجة القسم المجمّد', 'Frozen Section Result')}</label>
              {readonly ? (
                <div className="text-sm text-foreground bg-muted/50 border border-border rounded-lg px-3 py-1.5">{grossing.frozenResult || '—'}</div>
              ) : (
                <input className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  value={grossing.frozenResult} onChange={(e) => onChange({ ...grossing, frozenResult: e.target.value })} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cassette Log */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-muted-foreground">{tr('سجل الكاسيتات', 'Cassette Log')}</label>
          {!readonly && (
            <button onClick={addCassette} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800">
              <Plus className="w-3 h-3" />
              {tr('إضافة كاسيتة', 'Add Cassette')}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {grossing.cassettes.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              {readonly ? (
                <span className="w-8 h-8 flex items-center justify-center bg-teal-50 border border-teal-200 rounded-lg text-xs font-bold text-teal-700">{c.label}</span>
              ) : (
                <input className="w-10 border border-border rounded-lg px-2 py-1.5 text-xs text-center font-bold focus:outline-none focus:ring-2 focus:ring-teal-400"
                  value={c.label} onChange={(e) => updateCassette(i, 'label', e.target.value)} />
              )}
              {readonly ? (
                <div className="flex-1 text-sm text-foreground bg-muted/50 border border-border rounded-lg px-3 py-1.5">{c.description || '—'}</div>
              ) : (
                <input className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  value={c.description} onChange={(e) => updateCassette(i, 'description', e.target.value)}
                  placeholder={tr('محتوى الكاسيتة...', 'Cassette contents...')} />
              )}
              {!readonly && (
                <button onClick={() => removeCassette(i)} className="p-1 text-red-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Amendment Form ───────────────────────────────────────────────────────────

function AmendmentForm({ specimenId, onAmended, lang }: { specimenId: string; onAmended: () => void; lang: string }) {
  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAmend = async () => {
    if (!note.trim()) { setError(tr('يرجى إدخال ملاحظة التعديل', 'Please enter an amendment note')); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/pathology/specimens/${specimenId}/report`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'AMENDED', amendmentNote: note }),
      });
      if (!res.ok) throw new Error();
      setNote(''); setOpen(false); onAmended();
    } catch {
      setError(tr('فشل التعديل', 'Amendment failed'));
    } finally { setSaving(false); }
  };

  return (
    <div className="border border-amber-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 text-amber-700 text-sm font-medium">
        <span className="flex items-center gap-2"><Edit3 className="w-4 h-4" />{tr('إضافة تعديل على التقرير', 'Add Report Amendment')}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div className="p-4 space-y-3 bg-card">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <textarea rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('وصف التعديل...', 'Describe the amendment...')} />
          <button onClick={handleAmend} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50">
            {saving && <RefreshCw className="w-3 h-3 animate-spin" />}
            {tr('حفظ التعديل', 'Save Amendment')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Detail ──────────────────────────────────────────────────────────────

interface Props { specimenId: string; }

export default function PathologyDetail({ specimenId }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const router = useRouter();

  const { data, mutate, isLoading } = useSWR(`/api/pathology/specimens/${specimenId}`, fetcher);
  const specimen = data?.specimen;
  const existingReport = data?.report ?? null;

  const [activeTab, setActiveTab] = useState<TabKey>('specimen');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Grossing state
  const [grossing, setGrossing] = useState<GrossingData>(defaultGrossing());

  // Report fields
  const [grossDesc, setGrossDesc] = useState('');
  const [microDesc, setMicroDesc] = useState('');
  const [specialStains, setSpecialStains] = useState('');
  const [ihcMarkers, setIhcMarkers] = useState<IhcMarker[]>([]);
  const [tumor, setTumor] = useState<TumorCharacteristics>(defaultTumor());
  const [molecular, setMolecular] = useState<MolecularResult[]>([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [icdCode, setIcdCode] = useState('');
  const [snomed, setSnomed] = useState('');
  const [comments, setComments] = useState('');

  // Sync from server data
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (specimen && !initialized) {
      if (specimen.grossingData) {
        const gd = typeof specimen.grossingData === 'string' ? JSON.parse(specimen.grossingData) : specimen.grossingData;
        setGrossing({ ...defaultGrossing(), ...gd });
      }
    }
    if (existingReport && !initialized) {
      setGrossDesc(existingReport.grossDescription || '');
      setMicroDesc(existingReport.microscopicDescription || '');
      setSpecialStains(existingReport.specialStains || '');
      const ihc = Array.isArray(existingReport.ihcMarkers) ? existingReport.ihcMarkers : [];
      setIhcMarkers(ihc);
      const mol = Array.isArray(existingReport.molecularResults) ? existingReport.molecularResults : [];
      setMolecular(mol);
      if (existingReport.tumorCharacteristics) {
        const tc = typeof existingReport.tumorCharacteristics === 'string'
          ? JSON.parse(existingReport.tumorCharacteristics) : existingReport.tumorCharacteristics;
        setTumor({ ...defaultTumor(), ...tc });
      }
      setDiagnosis(existingReport.diagnosis || '');
      setIcdCode(existingReport.icdCode || '');
      setSnomed(existingReport.snomed || '');
      setComments(existingReport.comments || '');
      setInitialized(true);
    } else if (specimen && !existingReport && !initialized) {
      setInitialized(true);
    }
  }, [specimen, existingReport, initialized]);

  const isFinalized = existingReport?.status === 'SIGNED' || specimen?.status === 'FINALIZED';
  const isReadonly = isFinalized;

  const buildReportPayload = (status: string) => ({
    grossDescription: grossDesc, microscopicDescription: microDesc,
    specialStains, ihcMarkers, tumorCharacteristics: tumor,
    molecularResults: molecular, diagnosis, icdCode, snomed, comments, status,
  });

  const saveGrossing = async () => {
    await fetch(`/api/pathology/specimens/${specimenId}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grossingData: grossing }),
    });
  };

  const handleSave = async (status: string) => {
    if (status === 'SIGNED' && !diagnosis) {
      setSaveMsg({ ok: false, text: tr('التشخيص مطلوب لإصدار التقرير', 'Diagnosis is required to finalize') });
      setActiveTab('finalize');
      return;
    }
    setSaving(true); setSaveMsg(null);
    try {
      await saveGrossing();
      const method = existingReport ? 'PUT' : 'POST';
      const res = await fetch(`/api/pathology/specimens/${specimenId}/report`, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildReportPayload(status)),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setSaveMsg({ ok: true, text: status === 'SIGNED' ? tr('تم إصدار التقرير', 'Report finalized') : tr('تم الحفظ', 'Saved') });
      setInitialized(false);
      mutate();
    } catch (e: unknown) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : tr('فشل الحفظ', 'Save failed') });
    } finally { setSaving(false); }
  };

  const advanceStatus = async () => {
    const idx = PIPELINE.indexOf(specimen?.status || '');
    if (idx < 0 || idx >= PIPELINE.length - 1) return;
    const next = PIPELINE[idx + 1];
    await fetch(`/api/pathology/specimens/${specimenId}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    mutate();
  };

  const TABS: Array<{ key: TabKey; ar: string; en: string; icon: React.ReactNode }> = [
    { key: 'specimen',  ar: 'العينة',          en: 'Specimen',   icon: <Package className="w-3.5 h-3.5" /> },
    { key: 'histology', ar: 'التقرير النسيجي', en: 'Histology',  icon: <Microscope className="w-3.5 h-3.5" /> },
    { key: 'ihc',       ar: 'IHC',             en: 'IHC Panel',  icon: <FlaskConical className="w-3.5 h-3.5" /> },
    { key: 'tumor',     ar: 'الملف الورمي',    en: 'Tumor',      icon: <Activity className="w-3.5 h-3.5" /> },
    { key: 'molecular', ar: 'الجزيئية',        en: 'Molecular',  icon: <Dna className="w-3.5 h-3.5" /> },
    { key: 'finalize',  ar: 'التشخيص النهائي', en: 'Finalize',   icon: <FileCheck className="w-3.5 h-3.5" /> },
  ];

  if (isLoading) {
    return (
      <div dir={dir} className="min-h-screen bg-muted/50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!specimen) {
    return (
      <div dir={dir} className="min-h-screen bg-muted/50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-2" />
          <p className="text-muted-foreground">{tr('العينة غير موجودة', 'Specimen not found')}</p>
          <button onClick={() => router.push('/pathology')} className="mt-4 text-indigo-600 text-sm underline">
            {tr('العودة', 'Go back')}
          </button>
        </div>
      </div>
    );
  }

  const pipelineIdx = PIPELINE.indexOf(specimen.status);
  const canAdvance = pipelineIdx >= 0 && pipelineIdx < PIPELINE.length - 1;

  return (
    <div dir={dir} className="min-h-screen bg-muted/50">
      {/* Header */}
      <div className="bg-card border-b px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/pathology')} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Microscope className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-foreground">{specimen.accessionNumber || specimenId.slice(0, 8)}</h1>
                <StatusBadge status={specimen.status} lang={language} />
                {existingReport && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    existingReport.status === 'SIGNED' ? 'bg-green-50 border-green-200 text-green-700' :
                    existingReport.status === 'AMENDED' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                    'bg-muted/50 border-border text-muted-foreground'
                  }`}>
                    {existingReport.status === 'SIGNED' ? tr('تقرير صادر', 'Report Signed') :
                     existingReport.status === 'AMENDED' ? tr('معدّل', 'Amended') :
                     tr('مسودة', 'Draft')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{specimen.specimenType} — {specimen.site}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canAdvance && !isFinalized && (
              <button onClick={advanceStatus} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100">
                <ChevronRight className="w-3.5 h-3.5" />
                {tr('تقدم:', 'Advance:')} {language === 'ar' ? (STATUS_CONFIG[PIPELINE[pipelineIdx + 1]]?.labelAr) : (STATUS_CONFIG[PIPELINE[pipelineIdx + 1]]?.labelEn)}
              </button>
            )}
            {!isReadonly && (
              <>
                <button onClick={() => handleSave('DRAFT')} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-foreground rounded-lg text-xs font-medium hover:bg-muted/50 disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {tr('حفظ مسودة', 'Save Draft')}
                </button>
                <button onClick={() => handleSave('SIGNED')} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileCheck className="w-3 h-3" />}
                  {tr('توقيع وإصدار', 'Sign & Finalize')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Pipeline bar */}
        <div className="mt-3 flex items-center gap-0 overflow-x-auto">
          {PIPELINE.map((step, idx) => {
            const cfg = STATUS_CONFIG[step];
            const done = idx < pipelineIdx;
            const curr = idx === pipelineIdx;
            return (
              <div key={step} className="flex items-center">
                <div className={`flex flex-col items-center min-w-[64px] ${curr ? 'opacity-100' : done ? 'opacity-70' : 'opacity-35'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                    done ? 'bg-green-500 border-green-500 text-white' :
                    curr ? 'bg-indigo-600 border-indigo-600 text-white' :
                    'bg-card border-border text-muted-foreground'
                  }`}>{done ? '✓' : idx + 1}</div>
                  <span className={`text-[10px] mt-0.5 text-center leading-tight ${curr ? cfg.color + ' font-semibold' : 'text-muted-foreground'}`}>
                    {language === 'ar' ? cfg.labelAr : cfg.labelEn}
                  </span>
                </div>
                {idx < PIPELINE.length - 1 && (
                  <div className={`h-0.5 w-3 flex-shrink-0 ${idx < pipelineIdx ? 'bg-green-400' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save message */}
      {saveMsg && (
        <div className={`mx-6 mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm border ${
          saveMsg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {saveMsg.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {saveMsg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 mt-4">
        <div className="flex items-center gap-1 bg-card rounded-xl border border-border p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:bg-muted'
              }`}>
              {tab.icon}
              {tr(tab.ar, tab.en)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-5">
        {/* ─── Specimen Tab ─── */}
        {activeTab === 'specimen' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b">{tr('معلومات العينة', 'Specimen Information')}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label={tr('رقم القيد', 'Accession #')} value={specimen.accessionNumber} />
                  <InfoField label={tr('نوع العينة', 'Specimen Type')} value={specimen.specimenType} />
                  <InfoField label={tr('الموقع التشريحي', 'Anatomical Site')} value={specimen.site} />
                  <InfoField label={tr('عدد الأجزاء', 'Number of Parts')} value={specimen.numberOfParts} />
                  <InfoField label={tr('مادة الحفظ', 'Fixative')} value={specimen.fixative} />
                  <InfoField label={tr('تاريخ الاستلام', 'Received At')} value={specimen.receivedAt ? new Date(specimen.receivedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US') : null} />
                  <InfoField label={tr('تاريخ الأخذ', 'Collected At')} value={specimen.collectedAt ? new Date(specimen.collectedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US') : null} />
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b">{tr('المعلومات السريرية', 'Clinical Information')}</h2>
                <div className="space-y-3">
                  <InfoField label={tr('التاريخ السريري', 'Clinical History')} value={specimen.clinicalHistory} />
                  <InfoField label={tr('التشخيص السريري', 'Clinical Diagnosis')} value={specimen.clinicalDiagnosis} />
                </div>
              </div>
              {isFinalized && existingReport && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <h2 className="text-sm font-semibold text-green-700">{tr('التقرير صادر', 'Report Finalized')}</h2>
                  </div>
                  <InfoField label={tr('تاريخ الإصدار', 'Signed At')} value={existingReport.signedAt ? new Date(existingReport.signedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US') : null} />
                  {existingReport.amendmentNote && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                      <span className="font-semibold">{tr('ملاحظة التعديل: ', 'Amendment Note: ')}</span>{existingReport.amendmentNote}
                    </div>
                  )}
                </div>
              )}
              {isFinalized && existingReport?.status === 'SIGNED' && (
                <AmendmentForm specimenId={specimenId} onAmended={() => { setInitialized(false); mutate(); }} lang={language} />
              )}
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <GrossingForm grossing={grossing} onChange={setGrossing} readonly={isReadonly} />
              {!isReadonly && (
                <div className="mt-4 flex justify-end">
                  <button onClick={async () => { await saveGrossing(); setSaveMsg({ ok: true, text: tr('تم حفظ بيانات الفحص الظاهري', 'Grossing data saved') }); mutate(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                    <Save className="w-3.5 h-3.5" />
                    {tr('حفظ بيانات الفحص', 'Save Grossing Data')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Histology Tab ─── */}
        {activeTab === 'histology' && (
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground pb-2 border-b">{tr('الوصف النسيجي', 'Histological Description')}</h2>
            <TA label={tr('الوصف الظاهري (Gross Description)', 'Gross Description')} value={grossDesc} onChange={setGrossDesc} readonly={isReadonly} rows={4}
              placeholder={tr('حجم العينة، اللون، القوام، الحدود...', 'Specimen size, color, texture, borders...')} />
            <TA label={tr('الوصف المجهري (Microscopic Description)', 'Microscopic Description')} value={microDesc} onChange={setMicroDesc} readonly={isReadonly} rows={6}
              placeholder={tr('النمط المعماري، خصائص الخلايا، الانقسامات...', 'Architecture, cellular features, mitoses...')} />
            <TA label={tr('الأصباغ الخاصة (Special Stains)', 'Special Stains')} value={specialStains} onChange={setSpecialStains} readonly={isReadonly} rows={3}
              placeholder="PAS, Masson Trichrome, Alcian Blue, Congo Red..." />
            {!isReadonly && (
              <div className="flex justify-end pt-2 border-t">
                <button onClick={() => handleSave('DRAFT')} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {tr('حفظ', 'Save')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── IHC Tab ─── */}
        {activeTab === 'ihc' && (
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <IhcPanelBuilder markers={ihcMarkers} onChange={setIhcMarkers} readonly={isReadonly} />
            {!isReadonly && (
              <div className="flex justify-end pt-2 border-t">
                <button onClick={() => handleSave('DRAFT')} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {tr('حفظ لوحة IHC', 'Save IHC Panel')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Tumor Tab ─── */}
        {activeTab === 'tumor' && (
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <TumorProfileForm tumor={tumor} onChange={setTumor} readonly={isReadonly} />
            {!isReadonly && (
              <div className="flex justify-end pt-2 border-t">
                <button onClick={() => handleSave('DRAFT')} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {tr('حفظ الملف الورمي', 'Save Tumor Profile')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Molecular Tab ─── */}
        {activeTab === 'molecular' && (
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <MolecularStudiesForm results={molecular} onChange={setMolecular} readonly={isReadonly} />
            {!isReadonly && (
              <div className="flex justify-end pt-2 border-t">
                <button onClick={() => handleSave('DRAFT')} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {tr('حفظ الدراسات الجزيئية', 'Save Molecular Studies')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Finalize Tab ─── */}
        {activeTab === 'finalize' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground pb-2 border-b">{tr('التشخيص النهائي', 'Final Diagnosis')}</h2>
              <TA label={tr('التشخيص *', 'Diagnosis *')} value={diagnosis} onChange={setDiagnosis} readonly={isReadonly} rows={5}
                placeholder={tr('التشخيص النهائي أو التفاضلي...', 'Final or differential diagnosis...')} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr('رمز ICD-10', 'ICD-10 Code')}</label>
                  {isReadonly ? (
                    <div className="text-sm text-foreground bg-muted/50 border border-border rounded-lg px-3 py-1.5">{icdCode || '—'}</div>
                  ) : (
                    <input className="w-full border border-border rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      value={icdCode} onChange={(e) => setIcdCode(e.target.value)} placeholder="C18.0" />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr('رمز SNOMED', 'SNOMED Code')}</label>
                  {isReadonly ? (
                    <div className="text-sm text-foreground bg-muted/50 border border-border rounded-lg px-3 py-1.5">{snomed || '—'}</div>
                  ) : (
                    <input className="w-full border border-border rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      value={snomed} onChange={(e) => setSnomed(e.target.value)} placeholder="363346000" />
                  )}
                </div>
              </div>
              <TA label={tr('ملاحظات إضافية', 'Additional Comments')} value={comments} onChange={setComments} readonly={isReadonly} rows={3}
                placeholder={tr('ملاحظات إضافية للطبيب المحال...', 'Additional comments for the clinician...')} />
            </div>

            {/* Summary + actions */}
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-indigo-800 mb-3">{tr('ملخص التقرير', 'Report Summary')}</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr('الوصف الظاهري', 'Gross Description')}</span>
                    <span className={grossDesc ? 'text-green-700' : 'text-amber-600'}>{grossDesc ? tr('مكتمل', 'Done') : tr('فارغ', 'Empty')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr('الوصف المجهري', 'Microscopic Description')}</span>
                    <span className={microDesc ? 'text-green-700' : 'text-amber-600'}>{microDesc ? tr('مكتمل', 'Done') : tr('فارغ', 'Empty')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr('علامات IHC', 'IHC Markers')}</span>
                    <span className="text-foreground">{ihcMarkers.length} {tr('علامة', 'markers')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr('الدراسات الجزيئية', 'Molecular Studies')}</span>
                    <span className="text-foreground">{molecular.length} {tr('فحص', 'tests')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr('التشخيص النهائي', 'Final Diagnosis')}</span>
                    <span className={diagnosis ? 'text-green-700 font-semibold' : 'text-red-600'}>{diagnosis ? tr('مكتمل ✓', 'Complete ✓') : tr('مطلوب *', 'Required *')}</span>
                  </div>
                </div>
              </div>

              {!isReadonly && (
                <div className="bg-card rounded-xl border border-border p-5 space-y-3">
                  <button onClick={() => handleSave('DRAFT')} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted/50 disabled:opacity-50">
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {tr('حفظ مسودة', 'Save Draft')}
                  </button>
                  <button onClick={() => handleSave('PRELIMINARY')} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-amber-400 text-amber-700 bg-amber-50 rounded-lg text-sm font-medium hover:bg-amber-100 disabled:opacity-50">
                    {tr('إصدار تقرير مبدئي', 'Issue Preliminary Report')}
                  </button>
                  <button onClick={() => handleSave('SIGNED')} disabled={saving || !diagnosis}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
                    {tr('توقيع وإصدار التقرير النهائي', 'Sign & Issue Final Report')}
                  </button>
                  {!diagnosis && (
                    <p className="text-xs text-red-500 text-center">{tr('* التشخيص مطلوب للإصدار النهائي', '* Diagnosis required for final report')}</p>
                  )}
                </div>
              )}

              {isFinalized && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">{tr('التقرير النهائي صادر', 'Final Report Issued')}</p>
                    {existingReport?.signedAt && (
                      <p className="text-xs text-green-700 mt-0.5">
                        {new Date(existingReport.signedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
