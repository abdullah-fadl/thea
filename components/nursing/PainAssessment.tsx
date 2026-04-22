'use client';

import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, MapPin, Clock, Check, X, Zap } from 'lucide-react';
import {
  type PainEntry, type PainScale, type PainCharacter, type PainIntervention,
  DEFAULT_PAIN_ENTRY, getScoreFromSeverity, SEVERITY_CONFIG, NRS_FACES,
  BODY_REGIONS, PAIN_CHARACTERS, NON_PHARM_INTERVENTIONS, getRecommendedScale,
} from '@/lib/clinical/painAssessment';
import { useLang } from '@/hooks/use-lang';

interface PainAssessmentProps {
  value: PainEntry | null;
  onChange: (data: PainEntry) => void;
  ageYears?: number | null;
  isIntubated?: boolean;
  compact?: boolean;
}

export function PainAssessment({ value, onChange, ageYears, isIntubated, compact = false }: PainAssessmentProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const data = value || DEFAULT_PAIN_ENTRY;
  const severity = getScoreFromSeverity(data.score);
  const cfg = SEVERITY_CONFIG[severity];
  const recommended = getRecommendedScale(ageYears ?? null, isIntubated);
  const [expanded, setExpanded] = useState(!compact);
  const [showInterventionForm, setShowInterventionForm] = useState(false);

  const update = useCallback((patch: Partial<PainEntry>) => {
    const next = { ...data, ...patch };
    if ('score' in patch) next.severity = getScoreFromSeverity(patch.score!);
    onChange(next);
  }, [data, onChange]);

  if (compact) {
    if (!value || data.score === 0) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bgClass} ${cfg.colorClass}`}>
        {NRS_FACES[data.score]?.emoji} {data.score}/10
      </span>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-3 ${cfg.bgClass} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{NRS_FACES[data.score]?.emoji || ''}</span>
          <span className={`font-semibold text-sm ${cfg.colorClass}`}>
            {tr('تقييم الألم', 'Pain Assessment')}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.colorClass} bg-white/60`}>
            {data.score}/10 — {tr(cfg.labelAr, cfg.labelEn)}
          </span>
          {data.regions.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {data.regions.length} {tr('منطقة', 'region(s)')}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-5">
          {/* Scale selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">{tr('نوع المقياس', 'Pain Scale')}</label>
              {data.scale !== recommended && (
                <button
                  onClick={() => update({ scale: recommended })}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {tr(`المقياس المقترح: ${recommended}`, `Suggested: ${recommended}`)}
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {(['NRS', 'WONG_BAKER', 'FLACC', 'CPOT'] as PainScale[]).map(s => (
                <button
                  key={s}
                  onClick={() => update({ scale: s })}
                  className={`flex-1 py-1.5 text-xs rounded font-medium transition-colors
                    ${data.scale === s ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
                >
                  {s.replace('_', '-')}
                </button>
              ))}
            </div>
          </div>

          {/* NRS Slider with faces */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              {tr('شدة الألم', 'Pain Intensity')}: <span className={`font-bold ${cfg.colorClass}`}>{data.score}/10</span>
            </label>
            <div className="flex items-center gap-1 mb-2">
              {NRS_FACES.map(f => (
                <button
                  key={f.score}
                  onClick={() => update({ score: f.score })}
                  className={`flex-1 flex flex-col items-center py-1.5 rounded transition-all text-center
                    ${data.score === f.score
                      ? `ring-2 ring-offset-1 ${SEVERITY_CONFIG[getScoreFromSeverity(f.score)].bgClass} ring-blue-400`
                      : 'hover:bg-muted/50'
                    }`}
                >
                  <span className="text-lg leading-none">{f.emoji}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{f.score}</span>
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={data.score}
              onChange={e => update({ score: Number(e.target.value) })}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Action recommendation */}
          {severity !== 'NONE' && (
            <div className={`p-2.5 rounded-lg ${cfg.bgClass} border border-current/10`}>
              <p className={`text-xs font-medium ${cfg.colorClass}`}>
                <Zap className="h-3.5 w-3.5 inline mr-1" />{tr(cfg.actionAr, cfg.actionEn)}
              </p>
            </div>
          )}

          {/* Body regions */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              <MapPin className="w-3 h-3 inline mr-1" />
              {tr('موقع الألم', 'Pain Location')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {BODY_REGIONS.map(r => {
                const sel = data.regions.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      const next = sel ? data.regions.filter(x => x !== r.id) : [...data.regions, r.id];
                      update({ regions: next });
                    }}
                    className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors
                      ${sel ? 'bg-blue-600 text-white border-blue-600' : 'bg-card text-muted-foreground border-border hover:border-blue-300'}`}
                  >
                    {tr(r.labelAr, r.labelEn)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pain characteristics */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              {tr('طبيعة الألم', 'Pain Character')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PAIN_CHARACTERS.map(c => {
                const sel = data.character.includes(c.value);
                return (
                  <button
                    key={c.value}
                    onClick={() => {
                      const next = sel ? data.character.filter(x => x !== c.value) : [...data.character, c.value] as PainCharacter[];
                      update({ character: next });
                    }}
                    className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors
                      ${sel ? 'bg-purple-600 text-white border-purple-600' : 'bg-card text-muted-foreground border-border hover:border-purple-300'}`}
                  >
                    {tr(c.labelAr, c.labelEn)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Radiating */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.radiating}
                onChange={e => update({ radiating: e.target.checked, radiatingTo: e.target.checked ? data.radiatingTo : '' })}
                className="rounded border-border text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-foreground">
                {tr('ألم ممتد / منتشر', 'Radiating pain')}
              </span>
            </label>
            {data.radiating && (
              <input
                type="text"
                value={data.radiatingTo}
                onChange={e => update({ radiatingTo: e.target.value })}
                placeholder={tr('يمتد إلى...', 'Radiates to...')}
                className="flex-1 text-xs border rounded px-2 py-1"
              />
            )}
          </div>

          {/* Onset & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('بداية الألم', 'Onset')}</label>
              <input
                type="text"
                value={data.onset}
                onChange={e => update({ onset: e.target.value })}
                placeholder={tr('متى بدأ؟', 'When did it start?')}
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('المدة', 'Duration')}</label>
              <input
                type="text"
                value={data.duration}
                onChange={e => update({ duration: e.target.value })}
                placeholder={tr('مستمر / متقطع', 'Constant / Intermittent')}
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
          </div>

          {/* Aggravating / Relieving */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('عوامل مفاقمة', 'Aggravating Factors')}</label>
              <input
                type="text"
                value={data.aggravatingFactors}
                onChange={e => update({ aggravatingFactors: e.target.value })}
                placeholder={tr('ايش يزيده؟', 'What makes it worse?')}
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('عوامل مخففة', 'Relieving Factors')}</label>
              <input
                type="text"
                value={data.relievingFactors}
                onChange={e => update({ relievingFactors: e.target.value })}
                placeholder={tr('ايش يخففه؟', 'What makes it better?')}
                className="w-full text-xs border rounded px-2 py-1.5"
              />
            </div>
          </div>

          {/* Interventions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">
                {tr('التدخلات', 'Interventions')} ({data.interventions.length})
              </label>
              <button
                onClick={() => setShowInterventionForm(!showInterventionForm)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-3 h-3" />
                {tr('إضافة', 'Add')}
              </button>
            </div>

            {showInterventionForm && (
              <InterventionForm
                tr={tr}
                onAdd={(intv) => {
                  update({ interventions: [...data.interventions, intv] });
                  setShowInterventionForm(false);
                }}
                onCancel={() => setShowInterventionForm(false)}
              />
            )}

            {data.interventions.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {data.interventions.map((intv, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      intv.type === 'PHARMACOLOGICAL' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {intv.type === 'PHARMACOLOGICAL' ? tr('دوائي', 'Pharm') : tr('غير دوائي', 'Non-pharm')}
                    </span>
                    <span className="flex-1 text-foreground">{intv.description}</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {intv.time}
                    </span>
                    {intv.effective !== null && (
                      intv.effective
                        ? <Check className="w-3.5 h-3.5 text-green-600" />
                        : <X className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <button
                      onClick={() => update({ interventions: data.interventions.filter((_, j) => j !== i) })}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reassessment */}
          {data.interventions.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <label className="text-xs font-semibold text-blue-700 mb-2 block">
                {tr('إعادة التقييم بعد التدخل', 'Post-intervention Reassessment')}
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={data.reassessmentScore ?? 0}
                    onChange={e => update({ reassessmentScore: Number(e.target.value) })}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                    <span>0</span><span>5</span><span>10</span>
                  </div>
                </div>
                <span className={`text-sm font-bold ${SEVERITY_CONFIG[getScoreFromSeverity(data.reassessmentScore ?? 0)].colorClass}`}>
                  {data.reassessmentScore ?? 0}/10
                </span>
                {data.reassessmentScore !== null && data.score > 0 && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    data.reassessmentScore < data.score
                      ? 'bg-green-100 text-green-700'
                      : data.reassessmentScore === data.score
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {data.reassessmentScore < data.score
                      ? `↓ ${tr('تحسن', 'Improved')}`
                      : data.reassessmentScore === data.score
                        ? tr('بدون تغيير', 'No change')
                        : `↑ ${tr('زيادة', 'Worsened')}`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('ملاحظات', 'Notes')}</label>
            <textarea
              value={data.notes}
              onChange={e => update({ notes: e.target.value })}
              rows={2}
              placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
              className="w-full text-xs border rounded px-2 py-1.5 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InterventionForm({ tr, onAdd, onCancel }: {
  tr: (ar: string, en: string) => string;
  onAdd: (i: PainIntervention) => void;
  onCancel: () => void;
}) {
  const { language } = useLang();
  const [type, setType] = useState<'PHARMACOLOGICAL' | 'NON_PHARMACOLOGICAL'>('PHARMACOLOGICAL');
  const [desc, setDesc] = useState('');
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

  return (
    <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => setType('PHARMACOLOGICAL')}
          className={`flex-1 text-xs py-1.5 rounded font-medium ${type === 'PHARMACOLOGICAL' ? 'bg-blue-600 text-white' : 'bg-card text-muted-foreground border'}`}
        >
          {tr('دوائي', 'Pharmacological')}
        </button>
        <button
          onClick={() => setType('NON_PHARMACOLOGICAL')}
          className={`flex-1 text-xs py-1.5 rounded font-medium ${type === 'NON_PHARMACOLOGICAL' ? 'bg-green-600 text-white' : 'bg-card text-muted-foreground border'}`}
        >
          {tr('غير دوائي', 'Non-pharmacological')}
        </button>
      </div>

      {type === 'NON_PHARMACOLOGICAL' && (
        <div className="flex flex-wrap gap-1">
          {NON_PHARM_INTERVENTIONS.map(np => (
            <button
              key={np.labelEn}
              onClick={() => setDesc(language === 'ar' ? np.labelAr : np.labelEn)}
              className={`px-2 py-0.5 text-xs rounded border ${desc === (language === 'ar' ? np.labelAr : np.labelEn)
                ? 'bg-green-100 border-green-400 text-green-700'
                : 'bg-card border-border text-muted-foreground hover:border-green-300'}`}
            >
              {tr(np.labelAr, np.labelEn)}
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder={type === 'PHARMACOLOGICAL' ? tr('اسم الدواء والجرعة', 'Medication name & dose') : tr('وصف التدخل', 'Intervention description')}
        className="w-full text-xs border rounded px-2 py-1.5"
      />

      <div className="flex items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="text-xs border rounded px-2 py-1"
        />
        <div className="flex-1" />
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">{tr('إلغاء', 'Cancel')}</button>
        <button
          onClick={() => desc.trim() && onAdd({ type, description: desc.trim(), time, effective: null })}
          disabled={!desc.trim()}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-40"
        >
          {tr('إضافة', 'Add')}
        </button>
      </div>
    </div>
  );
}
