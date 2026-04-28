'use client';

// =============================================================================
// SpecialtyScoreTools — Scoring Tools Panel
// =============================================================================

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { type SpecialtyScoreTool } from '@/lib/opd/specialtyConfig';
import {
  PHQ9_QUESTIONS, PHQ9_OPTIONS, interpretPHQ9,
  GAD7_QUESTIONS, interpretGAD7,
  GCS_EYE, GCS_VERBAL, GCS_MOTOR, calcGCS,
  IPSS_QUESTIONS, interpretIPSS,
  calcCHADSVASc, calcCentor,
  // Bishop
  BISHOP_DILATION_OPTIONS, BISHOP_EFFACEMENT_OPTIONS, BISHOP_STATION_OPTIONS,
  BISHOP_CONSISTENCY_OPTIONS, BISHOP_POSITION_OPTIONS, calcBishop,
  // 12 new tools
  NIHSS_ITEMS, interpretNIHSS,
  calcWellsPE,
  interpretGRACE,
  PEWS_BEHAVIOR, PEWS_CARDIOVASCULAR, PEWS_RESPIRATORY, interpretPEWS,
  interpretVAS,
  MMSE_DOMAINS, interpretMMSE,
  MOCA_DOMAINS, interpretMoCA,
  CAT_QUESTIONS, interpretCAT,
  FINDRISC_QUESTIONS, interpretFINDRISC,
  calcWellsChild,
  KOOS_SUBSCALES, interpretKOOS,
  POSSUM_PHYSIOLOGICAL, POSSUM_OPERATIVE, interpretPOSSUM,
} from '@/lib/opd/specialtyCalc';
import {
  calculateMEOWS,
  MEOWS_CONSCIOUSNESS_OPTIONS, MEOWS_PROTEINURIA_OPTIONS,
  type MEOWSConsciousness, type MEOWSProteinuria,
} from '@/lib/clinical/meowsCalculator';
import { AlertTriangle } from 'lucide-react';

interface Props {
  tools: SpecialtyScoreTool[];
}

export default function SpecialtyScoreTools({ tools }: Props) {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div className="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
      {/* Tool Tabs */}
      <div className="flex overflow-x-auto border-b border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => setActiveToolId(activeToolId === tool.id ? null : tool.id)}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition ${
              activeToolId === tool.id
                ? 'bg-blue-600 text-white'
                : 'text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/30'
            }`}
          >
            {tr(tool.labelAr, tool.labelEn)}
          </button>
        ))}
      </div>

      {/* Tool Body */}
      {activeToolId && (
        <div className="p-4 bg-card">
          {activeToolId === 'phq9' && <PHQ9Tool />}
          {activeToolId === 'gad7' && <GAD7Tool />}
          {activeToolId === 'gcs' && <GCSTool />}
          {activeToolId === 'ipss' && <IPSSTool />}
          {activeToolId === 'chadsvasc' && <CHADSVAScTool />}
          {activeToolId === 'centor' && <CentorTool />}
          {activeToolId === 'meows' && <MEOWSTool />}
          {activeToolId === 'bishop' && <BishopTool />}
          {activeToolId === 'nihss' && <NIHSSTool />}
          {activeToolId === 'wells_pe' && <WellsPETool />}
          {activeToolId === 'grace' && <GRACETool />}
          {activeToolId === 'pews' && <PEWSTool />}
          {activeToolId === 'vasScale' && <VASTool />}
          {activeToolId === 'mmse' && <MMSETool />}
          {activeToolId === 'moca' && <MoCATool />}
          {activeToolId === 'cat' && <CATTool />}
          {activeToolId === 'diabetesRisk' && <FINDRISCTool />}
          {activeToolId === 'wellsChild' && <WellsChildTool />}
          {activeToolId === 'koos' && <KOOSTool />}
          {activeToolId === 'possum' && <POSSUMTool />}
        </div>
      )}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function ScoreBadge({ score, maxScore, colorClass, label }: { score: number; maxScore?: number; colorClass: string; label: string }) {
  return (
    <span className={`text-sm font-bold px-3 py-1 rounded-full ${colorClass}`}>
      {maxScore !== undefined ? `${score}/${maxScore}` : score} — {label}
    </span>
  );
}

function ResultBox({ colorClass, children }: { colorClass: string; children: React.ReactNode }) {
  return <div className={`p-3 rounded-lg text-sm ${colorClass}`}>{children}</div>;
}

// ── PHQ-9 ─────────────────────────────────────────────────────────────────────
function PHQ9Tool() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const { language } = useLang();
  const isAr = language === 'ar';
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const interpretation = interpretPHQ9(total);
  const allAnswered = PHQ9_QUESTIONS.every(q => scores[q.id] !== undefined);
  const colorClass = total <= 4 ? 'bg-green-100 text-green-700' : total <= 9 ? 'bg-yellow-100 text-yellow-700' : total <= 14 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">PHQ-9 {isAr ? '— استبيان الاكتئاب' : '— Depression Screening'}</h4>
        {allAnswered && <ScoreBadge score={total} maxScore={27} colorClass={colorClass} label={isAr ? interpretation.severityAr : interpretation.severity} />}
      </div>
      <p className="text-xs text-muted-foreground">{isAr ? 'خلال الأسبوعين الماضيين، كم مرة أزعجتك المشاكل التالية؟' : 'Over the past 2 weeks, how often have you been bothered by any of the following?'}</p>
      <div className="space-y-3">
        {PHQ9_QUESTIONS.map(q => (
          <div key={q.id} className="space-y-1.5">
            <p className="text-xs font-medium">{isAr ? q.ar : q.en}</p>
            <div className="flex flex-wrap gap-2">
              {PHQ9_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setScores(p => ({ ...p, [q.id]: opt.value }))}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${scores[q.id] === opt.value ? 'bg-blue-600 border-blue-600 text-white' : 'border-border hover:border-blue-400'}`}>
                  {opt.value} — {isAr ? opt.ar : opt.en}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {allAnswered && <ResultBox colorClass="bg-muted/50/50"><strong>{isAr ? 'التوصية:' : 'Recommendation:'}</strong> {interpretation.recommendation}</ResultBox>}
    </div>
  );
}

// ── GAD-7 ─────────────────────────────────────────────────────────────────────
function GAD7Tool() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const { language } = useLang();
  const isAr = language === 'ar';
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const interpretation = interpretGAD7(total);
  const allAnswered = GAD7_QUESTIONS.every(q => scores[q.id] !== undefined);
  const colorClass = total <= 4 ? 'bg-green-100 text-green-700' : total <= 9 ? 'bg-yellow-100 text-yellow-700' : total <= 14 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
  const opts = [{ v: 0, ar: 'إطلاقاً', en: 'Not at all' }, { v: 1, ar: 'عدة أيام', en: 'Several days' }, { v: 2, ar: 'أكثر من نصف الأيام', en: 'More than half the days' }, { v: 3, ar: 'كل يوم', en: 'Nearly every day' }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">GAD-7 {isAr ? '— استبيان القلق' : '— Anxiety Screening'}</h4>
        {allAnswered && <ScoreBadge score={total} maxScore={21} colorClass={colorClass} label={isAr ? interpretation.severityAr : interpretation.severity} />}
      </div>
      <div className="space-y-3">
        {GAD7_QUESTIONS.map(q => (
          <div key={q.id} className="space-y-1.5">
            <p className="text-xs font-medium">{isAr ? q.ar : q.en}</p>
            <div className="flex flex-wrap gap-2">
              {opts.map(opt => (
                <button key={opt.v} onClick={() => setScores(p => ({ ...p, [q.id]: opt.v }))}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${scores[q.id] === opt.v ? 'bg-blue-600 border-blue-600 text-white' : 'border-border hover:border-blue-400'}`}>
                  {opt.v} — {isAr ? opt.ar : opt.en}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GCS ───────────────────────────────────────────────────────────────────────
function GCSTool() {
  const [eye, setEye] = useState(4);
  const [verbal, setVerbal] = useState(5);
  const [motor, setMotor] = useState(6);
  const { language } = useLang();
  const isAr = language === 'ar';
  const result = calcGCS({ eye, verbal, motor });

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm">Glasgow Coma Scale</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Subscale label={isAr ? 'فتح العينين (E)' : 'Eye Opening (E)'} options={GCS_EYE} value={eye} onChange={setEye} isAr={isAr} />
        <Subscale label={isAr ? 'الاستجابة اللفظية (V)' : 'Verbal Response (V)'} options={GCS_VERBAL} value={verbal} onChange={setVerbal} isAr={isAr} />
        <Subscale label={isAr ? 'الاستجابة الحركية (M)' : 'Motor Response (M)'} options={GCS_MOTOR} value={motor} onChange={setMotor} isAr={isAr} />
      </div>
      <div className={`p-3 rounded-lg text-center font-bold text-lg ${result.total >= 13 ? 'bg-green-100 text-green-700' : result.total >= 9 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
        GCS = {result.total}/15 — {isAr ? result.severityAr : result.severity}
      </div>
    </div>
  );
}

// ── IPSS ──────────────────────────────────────────────────────────────────────
function IPSSTool() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const { language } = useLang();
  const isAr = language === 'ar';
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const interpretation = interpretIPSS(total);
  const allAnswered = IPSS_QUESTIONS.every(q => scores[q.id] !== undefined);
  const colorClass = total <= 7 ? 'bg-green-100 text-green-700' : total <= 19 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">IPSS {isAr ? '— أعراض البروستاتا' : '— Prostate Symptoms'}</h4>
        {allAnswered && <ScoreBadge score={total} maxScore={35} colorClass={colorClass} label={isAr ? interpretation.severityAr : interpretation.severity} />}
      </div>
      <div className="space-y-3">
        {IPSS_QUESTIONS.map(q => (
          <div key={q.id}>
            <p className="text-xs font-medium mb-1.5">{isAr ? q.ar : q.en}</p>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4, 5].map(v => (
                <button key={v} onClick={() => setScores(p => ({ ...p, [q.id]: v }))}
                  className={`w-8 h-8 text-xs rounded-lg border transition ${scores[q.id] === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-border hover:border-blue-400'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CHA₂DS₂-VASc ─────────────────────────────────────────────────────────────
function CHADSVAScTool() {
  const [input, setInput] = useState({ chf: false, hypertension: false, age75: false, diabetes: false, stroke: false, vascular: false, age65to74: false, female: false });
  const { language } = useLang();
  const isAr = language === 'ar';
  const result = calcCHADSVASc(input);
  const items = [
    { key: 'chf', ar: 'فشل القلب الاحتقاني (1)', en: 'CHF (1)' },
    { key: 'hypertension', ar: 'ارتفاع ضغط الدم (1)', en: 'Hypertension (1)' },
    { key: 'age75', ar: 'العمر ≥75 سنة (2)', en: 'Age ≥75 (2)' },
    { key: 'diabetes', ar: 'السكري (1)', en: 'Diabetes (1)' },
    { key: 'stroke', ar: 'سكتة دماغية سابقة (2)', en: 'Prior stroke/TIA (2)' },
    { key: 'vascular', ar: 'مرض وعائي (1)', en: 'Vascular disease (1)' },
    { key: 'age65to74', ar: 'العمر 65-74 (1)', en: 'Age 65-74 (1)' },
    { key: 'female', ar: 'الجنس الأنثوي (1)', en: 'Female sex (1)' },
  ];
  const colorClass = result.score <= 1 ? 'bg-green-100 text-green-700' : result.score <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm">CHA₂DS₂-VASc {isAr ? '— خطر الجلطة في الرجفان الأذيني' : '— Stroke Risk in AF'}</h4>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <CheckItem key={item.key} label={isAr ? item.ar : item.en} checked={(input as Record<string,boolean>)[item.key]} onChange={v => setInput(p => ({ ...p, [item.key]: v }))} />
        ))}
      </div>
      <ResultBox colorClass={colorClass}>
        <p className="font-bold text-lg text-center">{isAr ? 'النقاط:' : 'Score:'} {result.score}</p>
        <p className="text-sm text-center">{isAr ? result.recommendationAr : result.recommendation}</p>
      </ResultBox>
    </div>
  );
}

// ── Centor ────────────────────────────────────────────────────────────────────
function CentorTool() {
  const [input, setInput] = useState({ tonsillarExudate: false, tenderAnteriorCervicalNodes: false, feverHistory: false, noCough: false, age3to14: false });
  const { language } = useLang();
  const isAr = language === 'ar';
  const result = calcCentor(input);
  const items = [
    { key: 'tonsillarExudate', ar: 'إفرازات لوزية', en: 'Tonsillar exudate' },
    { key: 'tenderAnteriorCervicalNodes', ar: 'غدد عنقية أمامية مؤلمة', en: 'Tender anterior cervical nodes' },
    { key: 'feverHistory', ar: 'حمى في التاريخ', en: 'History of fever' },
    { key: 'noCough', ar: 'غياب السعال', en: 'Absence of cough' },
    { key: 'age3to14', ar: 'العمر 3-14 سنة', en: 'Age 3-14' },
  ];
  const colorClass = result.score <= 1 ? 'bg-green-100 text-green-700' : result.score <= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm">Centor Score {isAr ? '— احتمال التهاب الحلق العقدي' : '— Strep Throat Probability'}</h4>
      <div className="space-y-2">
        {items.map(item => (
          <CheckItem key={item.key} label={isAr ? item.ar : item.en} checked={(input as Record<string,boolean>)[item.key]} onChange={v => setInput(p => ({ ...p, [item.key]: v }))} />
        ))}
      </div>
      <ResultBox colorClass={colorClass}>
        <p className="font-bold text-lg text-center">{isAr ? 'النقاط:' : 'Score:'} {result.score}</p>
        <p className="text-sm text-center">{isAr ? result.recommendationAr : result.recommendation}</p>
      </ResultBox>
    </div>
  );
}

// ── MEOWS ─────────────────────────────────────────────────────────────────────
function MEOWSTool() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const [systolicBp, setSystolicBp] = useState('');
  const [diastolicBp, setDiastolicBp] = useState('');
  const [hr, setHr] = useState('');
  const [rr, setRr] = useState('');
  const [temp, setTemp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [consciousness, setConsciousness] = useState<MEOWSConsciousness | ''>('');
  const [proteinuria, setProteinuria] = useState<MEOWSProteinuria | ''>('');

  const result = calculateMEOWS({
    systolicBp: systolicBp ? Number(systolicBp) : null,
    diastolicBp: diastolicBp ? Number(diastolicBp) : null,
    hr: hr ? Number(hr) : null,
    rr: rr ? Number(rr) : null,
    temp: temp ? Number(temp) : null,
    spo2: spo2 ? Number(spo2) : null,
    consciousness: consciousness || null,
    proteinuria: (proteinuria || null) as MEOWSProteinuria | null,
  });

  const hasAnyInput = systolicBp || hr || rr || temp || spo2 || consciousness;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">MEOWS {isAr ? '— تنبيه مبكر توليدي' : '— Modified Early Obstetric Warning Score'}</h4>
        {hasAnyInput && (
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${result.bgClass} ${result.colorClass}`}>
            {result.totalScore} — {isAr ? (
              result.riskLevel === 'NORMAL' ? 'طبيعي' :
              result.riskLevel === 'CAUTION' ? 'تنبيه' :
              result.riskLevel === 'URGENT' ? 'عاجل' : 'طارئ'
            ) : result.riskLevel}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: isAr ? 'ضغط انقباضي (mmHg)' : 'Systolic BP (mmHg)', value: systolicBp, onChange: setSystolicBp },
          { label: isAr ? 'ضغط انبساطي (mmHg)' : 'Diastolic BP (mmHg)', value: diastolicBp, onChange: setDiastolicBp },
          { label: isAr ? 'النبض (bpm)' : 'Heart Rate (bpm)', value: hr, onChange: setHr },
          { label: isAr ? 'التنفس (breaths/min)' : 'Respiratory Rate', value: rr, onChange: setRr },
          { label: isAr ? 'الحرارة (°C)' : 'Temperature (°C)', value: temp, onChange: setTemp },
          { label: 'SpO₂ (%)', value: spo2, onChange: setSpo2 },
        ].map(({ label, value, onChange }) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <input type="number" value={value} onChange={e => onChange(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{isAr ? 'مستوى الوعي' : 'Consciousness'}</p>
          <select value={consciousness} onChange={e => setConsciousness(e.target.value as MEOWSConsciousness | '')}
            className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card">
            <option value="">{isAr ? 'اختر...' : 'Select...'}</option>
            {MEOWS_CONSCIOUSNESS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{isAr ? o.labelAr : o.labelEn}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">{isAr ? 'بروتين البول' : 'Proteinuria'}</p>
          <select value={proteinuria} onChange={e => setProteinuria(e.target.value as MEOWSProteinuria | '')}
            className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card">
            <option value="">{isAr ? 'اختر...' : 'Select...'}</option>
            {MEOWS_PROTEINURIA_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{isAr ? o.labelAr : o.labelEn}</option>
            ))}
          </select>
        </div>
      </div>
      {hasAnyInput && (
        <div className={`p-3 rounded-lg border ${result.bgClass} ${result.borderClass}`}>
          <p className={`font-semibold text-sm ${result.colorClass}`}>{isAr ? result.clinicalResponseAr : result.clinicalResponseEn}</p>
          <p className={`text-xs mt-1 ${result.colorClass}`}>{isAr ? result.monitoringFrequencyAr : result.monitoringFrequencyEn}</p>
          {result.hasSingleTrigger && (
            <p className="text-xs font-bold text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 inline-block" /> {isAr ? 'محفز وحيد — استجابة فورية مطلوبة' : 'Single trigger parameter — immediate response required'}</p>
          )}
        </div>
      )}
      {hasAnyInput && result.parameters.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-muted-foreground border-b">
              <th className="text-left py-1">{isAr ? 'المعامل' : 'Parameter'}</th>
              <th className="text-left py-1">{isAr ? 'القيمة' : 'Value'}</th>
              <th className="text-center py-1">{isAr ? 'النقاط' : 'Score'}</th>
            </tr></thead>
            <tbody>
              {result.parameters.map(p => (
                <tr key={p.parameter} className={`border-b ${p.score >= 3 ? 'text-red-600 font-bold' : p.score >= 2 ? 'text-orange-600' : p.score >= 1 ? 'text-amber-600' : ''}`}>
                  <td className="py-1">{isAr ? p.labelAr : p.labelEn}</td>
                  <td className="py-1">{p.value}</td>
                  <td className="py-1 text-center">{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Bishop Score ──────────────────────────────────────────────────────────────
function BishopTool() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const [dilation, setDilation] = useState<0|1|2|3>(0);
  const [effacement, setEffacement] = useState<0|1|2|3>(0);
  const [station, setStation] = useState<0|1|2|3>(0);
  const [consistency, setConsistency] = useState<0|1|2>(0);
  const [position, setPosition] = useState<0|1|2>(0);

  const result = calcBishop({ dilation, effacement, station, consistency, position });
  const colorClass = result.score >= 8 ? 'bg-green-100 text-green-700' : result.score >= 6 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Bishop Score {isAr ? '— استعداد عنق الرحم' : '— Cervical Ripening'}</h4>
        <ScoreBadge score={result.score} maxScore={13} colorClass={colorClass} label={isAr ? result.interpretationAr : result.interpretation} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Subscale label={isAr ? 'تمدد عنق الرحم' : 'Dilation'} options={BISHOP_DILATION_OPTIONS.map(o => ({ score: o.score, ar: o.labelAr, en: o.labelEn }))} value={dilation} onChange={v => setDilation(v as 0|1|2|3)} isAr={isAr} />
        <Subscale label={isAr ? 'الانمحاء' : 'Effacement'} options={BISHOP_EFFACEMENT_OPTIONS.map(o => ({ score: o.score, ar: o.labelAr, en: o.labelEn }))} value={effacement} onChange={v => setEffacement(v as 0|1|2|3)} isAr={isAr} />
        <Subscale label={isAr ? 'وضع الرأس' : 'Station'} options={BISHOP_STATION_OPTIONS.map(o => ({ score: o.score, ar: o.labelAr, en: o.labelEn }))} value={station} onChange={v => setStation(v as 0|1|2|3)} isAr={isAr} />
        <Subscale label={isAr ? 'قوام عنق الرحم' : 'Consistency'} options={BISHOP_CONSISTENCY_OPTIONS.map(o => ({ score: o.score, ar: o.labelAr, en: o.labelEn }))} value={consistency} onChange={v => setConsistency(v as 0|1|2)} isAr={isAr} />
        <Subscale label={isAr ? 'موضع عنق الرحم' : 'Position'} options={BISHOP_POSITION_OPTIONS.map(o => ({ score: o.score, ar: o.labelAr, en: o.labelEn }))} value={position} onChange={v => setPosition(v as 0|1|2)} isAr={isAr} />
      </div>
      <ResultBox colorClass={colorClass}>
        <p className="font-bold text-center text-base">{isAr ? 'إجمالي:' : 'Total:'} {result.score}/13 — {isAr ? result.interpretationAr : result.interpretation}</p>
        <p className="text-xs text-center mt-1">{isAr ? result.recommendationAr : result.recommendation}</p>
      </ResultBox>
    </div>
  );
}

// ── NIHSS ─────────────────────────────────────────────────────────────────────
function NIHSSTool() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const { language } = useLang();
  const isAr = language === 'ar';
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const allAnswered = NIHSS_ITEMS.every(item => scores[item.id] !== undefined);
  const interpretation = interpretNIHSS(total);
  const colorClass = total === 0 ? 'bg-green-100 text-green-700' : total <= 4 ? 'bg-yellow-100 text-yellow-700' : total <= 15 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">NIHSS {isAr ? '— مقياس السكتة الدماغية' : '— NIH Stroke Scale'}</h4>
        {allAnswered && <ScoreBadge score={total} maxScore={42} colorClass={colorClass} label={isAr ? interpretation.severityAr : interpretation.severity} />}
      </div>
      <div className="space-y-3">
        {NIHSS_ITEMS.map(item => (
          <div key={item.id}>
            <p className="text-xs font-medium mb-1.5">{isAr ? item.labelAr : item.labelEn} (0–{item.max})</p>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: item.max + 1 }, (_, i) => i).map(v => (
                <button key={v} onClick={() => setScores(p => ({ ...p, [item.id]: v }))}
                  className={`w-8 h-8 text-xs rounded-lg border transition ${scores[item.id] === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-border hover:border-blue-400'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {allAnswered && (
        <ResultBox colorClass={colorClass}>
          <p className="font-bold text-center">{total}/42 — {isAr ? interpretation.severityAr : interpretation.severity}</p>
          <p className="text-xs text-center mt-1">{isAr ? interpretation.recommendationAr : interpretation.recommendation}</p>
        </ResultBox>
      )}
    </div>
  );
}

// ── Wells PE ──────────────────────────────────────────────────────────────────
function WellsPETool() {
  const [input, setInput] = useState({ dvtSignsSymptoms: false, alternativeDiagnosisLessLikely: false, hrOver100: false, immobilizationOrSurgery: false, previousDvtOrPe: false, hemoptysis: false, malignancy: false });
  const { language } = useLang();
  const isAr = language === 'ar';
  const result = calcWellsPE(input);
  const items = [
    { key: 'dvtSignsSymptoms', ar: 'علامات وأعراض DVT (+3)', en: 'Clinical signs/symptoms of DVT (+3)' },
    { key: 'alternativeDiagnosisLessLikely', ar: 'التشخيص البديل أقل احتمالاً (+3)', en: 'PE is #1 diagnosis or equally likely (+3)' },
    { key: 'hrOver100', ar: 'معدل القلب > 100 (+1.5)', en: 'Heart rate > 100 bpm (+1.5)' },
    { key: 'immobilizationOrSurgery', ar: 'تثبيت أو جراحة خلال 4 أسابيع (+1.5)', en: 'Immobilization or surgery in past 4 weeks (+1.5)' },
    { key: 'previousDvtOrPe', ar: 'DVT أو PE سابق (+1.5)', en: 'Previous DVT or PE (+1.5)' },
    { key: 'hemoptysis', ar: 'بصق دم (+1)', en: 'Hemoptysis (+1)' },
    { key: 'malignancy', ar: 'سرطان نشط (+1)', en: 'Malignancy (active treatment within 6 mo) (+1)' },
  ];
  const colorClass = result.score <= 1 ? 'bg-green-100 text-green-700' : result.score <= 6 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm">Wells Score {isAr ? '— احتمال الانصمام الرئوي PE' : '— Pulmonary Embolism Probability'}</h4>
      <div className="space-y-2">
        {items.map(item => (
          <CheckItem key={item.key} label={isAr ? item.ar : item.en} checked={(input as Record<string,boolean>)[item.key]} onChange={v => setInput(p => ({ ...p, [item.key]: v }))} />
        ))}
      </div>
      <ResultBox colorClass={colorClass}>
        <p className="font-bold text-center">{isAr ? 'النقاط:' : 'Score:'} {result.score} — {isAr ? result.probabilityAr : result.probability}</p>
        <p className="text-xs text-center mt-1">{isAr ? result.recommendationAr : result.recommendation}</p>
      </ResultBox>
    </div>
  );
}

// ── GRACE ─────────────────────────────────────────────────────────────────────
function GRACETool() {
  const [score, setScore] = useState('');
  const { language } = useLang();
  const isAr = language === 'ar';
  const numScore = Number(score) || 0;
  const interpretation = interpretGRACE(numScore);
  const colorClass = numScore < 109 ? 'bg-green-100 text-green-700' : numScore <= 140 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm">GRACE Score {isAr ? '— خطر متلازمات الشريان التاجي الحادة' : '— ACS Risk Score'}</h4>
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
        {isAr
          ? 'احسب نقاط GRACE من حاسبة الجمعية الأوروبية لأمراض القلب (ESC) أو من أجهزة التصوير السريري، ثم أدخل الإجمالي هنا.'
          : 'Calculate the GRACE score from the ESC calculator or bedside tool, then enter the total below.'
        }
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">{isAr ? 'إجمالي نقاط GRACE (0–372)' : 'GRACE Total Score (0–372)'}</p>
        <input type="number" min={0} max={372} value={score} onChange={e => setScore(e.target.value)}
          className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card" />
      </div>
      {score && (
        <ResultBox colorClass={colorClass}>
          <p className="font-bold text-center">{isAr ? interpretation.riskAr : interpretation.risk} — {interpretation.mortalityEstimate}</p>
          <p className="text-xs text-center mt-1">{isAr ? interpretation.recommendationAr : interpretation.recommendation}</p>
        </ResultBox>
      )}
    </div>
  );
}

// ── PEWS ──────────────────────────────────────────────────────────────────────
function PEWSTool() {
  const [behavior, setBehavior] = useState(0);
  const [cardiovascular, setCardiovascular] = useState(0);
  const [respiratory, setRespiratory] = useState(0);
  const { language } = useLang();
  const isAr = language === 'ar';
  const total = behavior + cardiovascular + respiratory;
  const result = interpretPEWS(total);
  const colorClass = total === 0 ? 'bg-green-100 text-green-700' : total <= 2 ? 'bg-yellow-100 text-yellow-700' : total <= 4 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">PEWS {isAr ? '— تنبيه مبكر للأطفال' : '— Pediatric Early Warning Score'}</h4>
        <ScoreBadge score={total} maxScore={9} colorClass={colorClass} label={isAr ? result.severityAr : result.severity} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Subscale label={isAr ? 'السلوك' : 'Behaviour'} options={PEWS_BEHAVIOR.map(o => ({ score: o.score, ar: o.labelAr, en: o.labelEn }))} value={behavior} onChange={setBehavior} isAr={isAr} />
        <Subscale label={isAr ? 'القلب والأوعية' : 'Cardiovascular'} options={PEWS_CARDIOVASCULAR.map(o => ({ score: o.score, ar: o.labelAr, en: o.labelEn }))} value={cardiovascular} onChange={setCardiovascular} isAr={isAr} />
        <Subscale label={isAr ? 'التنفس' : 'Respiratory'} options={PEWS_RESPIRATORY.map(o => ({ score: o.score, ar: o.labelAr, en: o.labelEn }))} value={respiratory} onChange={setRespiratory} isAr={isAr} />
      </div>
      <ResultBox colorClass={colorClass}>
        <p className="font-bold text-center">{total}/9 — {isAr ? result.severityAr : result.severity}</p>
        <p className="text-xs text-center mt-1">{isAr ? result.actionAr : result.action}</p>
      </ResultBox>
    </div>
  );
}

// ── VAS Pain Scale ────────────────────────────────────────────────────────────
function VASTool() {
  const [score, setScore] = useState<number>(0);
  const { language } = useLang();
  const isAr = language === 'ar';
  const interpretation = interpretVAS(score);
  const colorClass = score === 0 ? 'bg-green-100 text-green-700' : score <= 3 ? 'bg-yellow-100 text-yellow-700' : score <= 6 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm">VAS {isAr ? '— مقياس الألم التناظري البصري' : '— Visual Analogue Scale (Pain)'}</h4>
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>{isAr ? 'لا ألم' : 'No pain'} (0)</span>
          <span className="font-bold text-base">{score}/10</span>
          <span>{isAr ? 'ألم شديد' : 'Worst pain'} (10)</span>
        </div>
        <input type="range" min={0} max={10} value={score} onChange={e => setScore(Number(e.target.value))}
          className="w-full accent-blue-600" />
        <div className="flex justify-between mt-1">
          {[0,1,2,3,4,5,6,7,8,9,10].map(n => <span key={n} className="text-xs text-muted-foreground">{n}</span>)}
        </div>
      </div>
      <ResultBox colorClass={colorClass}>
        <p className="font-bold text-center">{score}/10 — {isAr ? interpretation.severityAr : interpretation.severity}</p>
        <p className="text-xs text-center mt-1">{isAr ? interpretation.managementAr : interpretation.management}</p>
      </ResultBox>
    </div>
  );
}

// ── MMSE ──────────────────────────────────────────────────────────────────────
function MMSETool() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const { language } = useLang();
  const isAr = language === 'ar';
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const allAnswered = MMSE_DOMAINS.every(d => scores[d.id] !== undefined);
  const interpretation = interpretMMSE(total);
  const colorClass = total >= 27 ? 'bg-green-100 text-green-700' : total >= 24 ? 'bg-yellow-100 text-yellow-700' : total >= 18 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">MMSE {isAr ? '— اختبار الحالة العقلية المصغّر' : '— Mini-Mental State Exam'}</h4>
        {allAnswered && <ScoreBadge score={total} maxScore={30} colorClass={colorClass} label={isAr ? interpretation.severityAr : interpretation.severity} />}
      </div>
      <div className="space-y-3">
        {MMSE_DOMAINS.map(domain => (
          <div key={domain.id}>
            <p className="text-xs font-medium mb-1">{isAr ? domain.labelAr : domain.labelEn} (0–{domain.max})</p>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: domain.max + 1 }, (_, i) => i).map(v => (
                <button key={v} onClick={() => setScores(p => ({ ...p, [domain.id]: v }))}
                  className={`w-8 h-8 text-xs rounded-lg border transition ${scores[domain.id] === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-border hover:border-blue-400'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {allAnswered && (
        <ResultBox colorClass={colorClass}>
          <p className="font-bold text-center">{total}/30 — {isAr ? interpretation.severityAr : interpretation.severity}</p>
          <p className="text-xs text-center mt-1">{isAr ? interpretation.recommendationAr : interpretation.recommendation}</p>
        </ResultBox>
      )}
    </div>
  );
}

// ── MoCA ──────────────────────────────────────────────────────────────────────
function MoCATool() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [lowEducation, setLowEducation] = useState(false);
  const { language } = useLang();
  const isAr = language === 'ar';
  const rawTotal = Object.values(scores).reduce((s, v) => s + v, 0);
  const total = Math.min(30, rawTotal + (lowEducation ? 1 : 0));
  const allAnswered = MOCA_DOMAINS.every(d => scores[d.id] !== undefined);
  const interpretation = interpretMoCA(total);
  const colorClass = total >= 26 ? 'bg-green-100 text-green-700' : total >= 18 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">MoCA {isAr ? '— تقييم مونتريال المعرفي' : '— Montreal Cognitive Assessment'}</h4>
        {allAnswered && <ScoreBadge score={total} maxScore={30} colorClass={colorClass} label={isAr ? interpretation.severityAr : interpretation.severity} />}
      </div>
      <div className="space-y-3">
        {MOCA_DOMAINS.map(domain => (
          <div key={domain.id}>
            <p className="text-xs font-medium mb-1">{isAr ? domain.labelAr : domain.labelEn} (0–{domain.max})</p>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: domain.max + 1 }, (_, i) => i).map(v => (
                <button key={v} onClick={() => setScores(p => ({ ...p, [domain.id]: v }))}
                  className={`w-8 h-8 text-xs rounded-lg border transition ${scores[domain.id] === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-border hover:border-blue-400'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <CheckItem label={isAr ? 'تعليم ≤12 سنة (يُضاف نقطة واحدة)' : 'Education ≤12 years (+1 point adjustment)'} checked={lowEducation} onChange={setLowEducation} />
      {allAnswered && (
        <ResultBox colorClass={colorClass}>
          <p className="font-bold text-center">{total}/30 — {isAr ? interpretation.severityAr : interpretation.severity}</p>
          <p className="text-xs text-center mt-1">{isAr ? interpretation.recommendationAr : interpretation.recommendation}</p>
        </ResultBox>
      )}
    </div>
  );
}

// ── CAT ───────────────────────────────────────────────────────────────────────
function CATTool() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const { language } = useLang();
  const isAr = language === 'ar';
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const allAnswered = CAT_QUESTIONS.every(q => scores[q.id] !== undefined);
  const interpretation = interpretCAT(total);
  const colorClass = total <= 9 ? 'bg-green-100 text-green-700' : total <= 20 ? 'bg-yellow-100 text-yellow-700' : total <= 30 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">CAT {isAr ? '— تقييم الانسداد الرئوي المزمن' : '— COPD Assessment Test'}</h4>
        {allAnswered && <ScoreBadge score={total} maxScore={40} colorClass={colorClass} label={isAr ? interpretation.impactAr : interpretation.impact} />}
      </div>
      <p className="text-xs text-muted-foreground">{isAr ? 'لكل سؤال: 0 = لا تأثير، 5 = تأثير شديد' : 'For each item: 0 = no impact, 5 = extreme impact'}</p>
      <div className="space-y-3">
        {CAT_QUESTIONS.map(q => (
          <div key={q.id}>
            <p className="text-xs font-medium mb-1.5">{isAr ? q.labelAr : q.labelEn}</p>
            <div className="flex gap-1.5">
              {[0,1,2,3,4,5].map(v => (
                <button key={v} onClick={() => setScores(p => ({ ...p, [q.id]: v }))}
                  className={`w-8 h-8 text-xs rounded-lg border transition ${scores[q.id] === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-border hover:border-blue-400'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {allAnswered && (
        <ResultBox colorClass={colorClass}>
          <p className="font-bold text-center">{total}/40 — {isAr ? interpretation.impactAr : interpretation.impact}</p>
          <p className="text-xs text-center mt-1">{isAr ? interpretation.recommendationAr : interpretation.recommendation}</p>
        </ResultBox>
      )}
    </div>
  );
}

// ── FINDRISC ──────────────────────────────────────────────────────────────────
function FINDRISCTool() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const { language } = useLang();
  const isAr = language === 'ar';
  const total = Object.values(answers).reduce((s, v) => s + v, 0);
  const allAnswered = FINDRISC_QUESTIONS.every(q => answers[q.id] !== undefined);
  const interpretation = interpretFINDRISC(total);
  const colorClass = total <= 7 ? 'bg-green-100 text-green-700' : total <= 11 ? 'bg-yellow-100 text-yellow-700' : total <= 14 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">FINDRISC {isAr ? '— خطر السكري النوع الثاني' : '— Type 2 Diabetes Risk'}</h4>
        {allAnswered && <ScoreBadge score={total} maxScore={26} colorClass={colorClass} label={isAr ? interpretation.riskAr : interpretation.risk} />}
      </div>
      <div className="space-y-4">
        {FINDRISC_QUESTIONS.map(q => (
          <div key={q.id}>
            <p className="text-xs font-medium mb-1.5">{isAr ? q.labelAr : q.labelEn}</p>
            <div className="space-y-1">
              {q.options.map(opt => (
                <button key={opt.value} onClick={() => setAnswers(p => ({ ...p, [q.id]: opt.value }))}
                  className={`w-full text-left text-xs px-3 py-1.5 rounded-lg border transition ${answers[q.id] === opt.value ? 'bg-blue-600 border-blue-600 text-white' : 'border-border hover:bg-muted/50'}`}>
                  {isAr ? opt.labelAr : opt.labelEn}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {allAnswered && (
        <ResultBox colorClass={colorClass}>
          <p className="font-bold text-center">{total}/26 — {isAr ? interpretation.riskAr : interpretation.risk} ({interpretation.tenYearRisk} 10yr)</p>
          <p className="text-xs text-center mt-1">{isAr ? interpretation.recommendationAr : interpretation.recommendation}</p>
        </ResultBox>
      )}
    </div>
  );
}

// ── Wells Child (DVT Pediatric) ───────────────────────────────────────────────
function WellsChildTool() {
  const [input, setInput] = useState({
    activeOrRecentCancer: false, bedridden3DaysOrMajorSurgery: false,
    calf3cmLargerThanOther: false, collateralSuperficialVeins: false,
    entireLegSwollen: false, localizedTenderness: false,
    pittingEdema: false, paralysisOrRecentPlaster: false,
    previousDvtDocumented: false, alternativeDiagnosisAsLikely: false,
  });
  const { language } = useLang();
  const isAr = language === 'ar';
  const result = calcWellsChild(input);
  const items = [
    { key: 'activeOrRecentCancer', ar: 'سرطان نشط أو علاج حديث (+1)', en: 'Active or recent cancer (+1)' },
    { key: 'bedridden3DaysOrMajorSurgery', ar: 'راحة 3 أيام أو جراحة كبيرة (+1)', en: 'Bedridden ≥3 days or major surgery (+1)' },
    { key: 'calf3cmLargerThanOther', ar: 'تورم ساق 3 سم أكثر من الأخرى (+1)', en: 'Calf 3 cm larger than other (+1)' },
    { key: 'collateralSuperficialVeins', ar: 'أوردة سطحية جانبية (+1)', en: 'Collateral superficial veins (+1)' },
    { key: 'entireLegSwollen', ar: 'تورم الساق بأكملها (+1)', en: 'Entire leg swollen (+1)' },
    { key: 'localizedTenderness', ar: 'ألم موضعي على الأوعية (+1)', en: 'Localized tenderness along veins (+1)' },
    { key: 'pittingEdema', ar: 'وذمة نازة (+1)', en: 'Pitting edema (+1)' },
    { key: 'paralysisOrRecentPlaster', ar: 'شلل أو جبيرة حديثة (+1)', en: 'Paralysis or recent plaster (+1)' },
    { key: 'previousDvtDocumented', ar: 'DVT موثق سابق (+1)', en: 'Previous documented DVT (+1)' },
    { key: 'alternativeDiagnosisAsLikely', ar: 'تشخيص بديل أكثر احتمالاً (-2)', en: 'Alternative diagnosis as likely (-2)' },
  ];
  const colorClass = result.score <= 0 ? 'bg-green-100 text-green-700' : result.score <= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm">Wells {isAr ? '— احتمال DVT الوريدي (أطفال)' : '— DVT Probability (Pediatric)'}</h4>
      <div className="space-y-2">
        {items.map(item => (
          <CheckItem key={item.key} label={isAr ? item.ar : item.en} checked={(input as Record<string,boolean>)[item.key]} onChange={v => setInput(p => ({ ...p, [item.key]: v }))} />
        ))}
      </div>
      <ResultBox colorClass={colorClass}>
        <p className="font-bold text-center">{isAr ? 'النقاط:' : 'Score:'} {result.score} — {isAr ? result.probabilityAr : result.probability}</p>
        <p className="text-xs text-center mt-1">{isAr ? result.recommendationAr : result.recommendation}</p>
      </ResultBox>
    </div>
  );
}

// ── KOOS ──────────────────────────────────────────────────────────────────────
function KOOSTool() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const { language } = useLang();
  const isAr = language === 'ar';
  const filledCount = Object.keys(scores).length;
  const interpretation = interpretKOOS(scores);
  const colorClass = interpretation.average >= 75 ? 'bg-green-100 text-green-700' : interpretation.average >= 50 ? 'bg-yellow-100 text-yellow-700' : interpretation.average >= 25 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">KOOS {isAr ? '— نتائج الركبة' : '— Knee Injury Outcome Score'}</h4>
        {filledCount > 0 && <span className={`text-sm font-bold px-3 py-1 rounded-full ${colorClass}`}>{interpretation.average}% — {isAr ? interpretation.interpretationAr : interpretation.interpretation}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{isAr ? 'أدخل نتيجة كل نطاق (0 = شديد الأثر، 100 = لا أثر)' : 'Enter each subscale score (0 = worst, 100 = best)'}</p>
      <div className="space-y-3">
        {KOOS_SUBSCALES.map(sub => (
          <div key={sub.id}>
            <p className="text-xs font-medium mb-1">{isAr ? sub.labelAr : sub.labelEn}</p>
            <input type="number" min={0} max={100} value={scores[sub.id] ?? ''} onChange={e => setScores(p => ({ ...p, [sub.id]: Number(e.target.value) }))}
              placeholder="0–100" className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card" />
          </div>
        ))}
      </div>
      {filledCount > 0 && (
        <ResultBox colorClass={colorClass}>
          <p className="font-bold text-center">{isAr ? 'متوسط:' : 'Average:'} {interpretation.average}% — {isAr ? interpretation.interpretationAr : interpretation.interpretation}</p>
        </ResultBox>
      )}
    </div>
  );
}

// ── P-POSSUM ──────────────────────────────────────────────────────────────────
function POSSUMTool() {
  const [physScores, setPhysScores] = useState<Record<string, number>>({});
  const [opScores, setOpScores] = useState<Record<string, number>>({});
  const { language } = useLang();
  const isAr = language === 'ar';
  const physTotal = Object.values(physScores).reduce((s, v) => s + v, 0);
  const opTotal = Object.values(opScores).reduce((s, v) => s + v, 0);
  const physComplete = POSSUM_PHYSIOLOGICAL.every(p => physScores[p.id] !== undefined);
  const opComplete = POSSUM_OPERATIVE.every(p => opScores[p.id] !== undefined);
  const allComplete = physComplete && opComplete;
  const result = allComplete ? interpretPOSSUM(physTotal, opTotal) : null;
  const colorClass = !result ? 'bg-muted text-muted-foreground' : result.mortalityRisk < 5 ? 'bg-green-100 text-green-700' : result.mortalityRisk < 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-5">
      <h4 className="font-semibold text-sm">P-POSSUM {isAr ? '— خطر الجراحة' : '— Surgical Risk Score'}</h4>
      <div>
        <p className="text-xs font-bold text-muted-foreground mb-2">{isAr ? 'المعامل الفيزيولوجي' : 'Physiological Parameters'}</p>
        <div className="space-y-3">
          {POSSUM_PHYSIOLOGICAL.map(param => (
            <div key={param.id}>
              <p className="text-xs font-medium mb-1">{isAr ? param.labelAr : param.labelEn}</p>
              <div className="space-y-1">
                {param.options.map(opt => (
                  <button key={opt.value} onClick={() => setPhysScores(p => ({ ...p, [param.id]: opt.value }))}
                    className={`w-full text-left text-xs px-3 py-1.5 rounded-lg border transition ${physScores[param.id] === opt.value ? 'bg-blue-600 border-blue-600 text-white' : 'border-border hover:bg-muted/50'}`}>
                    {isAr ? opt.labelAr : opt.labelEn}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-muted-foreground mb-2">{isAr ? 'المعامل الجراحي' : 'Operative Parameters'}</p>
        <div className="space-y-3">
          {POSSUM_OPERATIVE.map(param => (
            <div key={param.id}>
              <p className="text-xs font-medium mb-1">{isAr ? param.labelAr : param.labelEn}</p>
              <div className="space-y-1">
                {param.options.map(opt => (
                  <button key={opt.value} onClick={() => setOpScores(p => ({ ...p, [param.id]: opt.value }))}
                    className={`w-full text-left text-xs px-3 py-1.5 rounded-lg border transition ${opScores[param.id] === opt.value ? 'bg-blue-600 border-blue-600 text-white' : 'border-border hover:bg-muted/50'}`}>
                    {isAr ? opt.labelAr : opt.labelEn}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {allComplete && result && (
        <ResultBox colorClass={colorClass}>
          <p className="font-bold text-center">{isAr ? result.interpretationAr : result.interpretation}</p>
          <p className="text-xs text-center mt-1">{isAr ? 'معدل وفيات متوقع:' : 'Predicted mortality:'} {result.mortalityRisk}%</p>
          <p className="text-xs text-center">{isAr ? 'معدل مضاعفات متوقع:' : 'Predicted morbidity:'} {result.morbidityRisk}%</p>
        </ResultBox>
      )}
    </div>
  );
}

// ── Shared Sub-components ─────────────────────────────────────────────────────

function Subscale({ label, options, value, onChange, isAr }: {
  label: string;
  options: { score: number; ar: string; en: string }[];
  value: number;
  onChange: (v: number) => void;
  isAr: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold mb-2">{label}</p>
      <div className="space-y-1">
        {options.map(o => (
          <button key={o.score} onClick={() => onChange(o.score)}
            className={`w-full text-left text-xs px-3 py-1.5 rounded-lg border transition ${value === o.score ? 'bg-blue-600 border-blue-600 text-white' : 'border-border hover:bg-muted/50'}`}>
            {o.score} — {isAr ? o.ar : o.en}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded" />
      <span className="text-xs">{label}</span>
    </label>
  );
}
