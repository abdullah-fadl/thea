'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertOctagon, CheckCircle2, Circle, Siren, Zap } from 'lucide-react';
import {
  type SepsisInput,
  DEFAULT_SEPSIS_INPUT, screenSepsis, SEPSIS_RISK_CFG,
} from '@/lib/clinical/sepsisScreening';
import { useLang } from '@/hooks/use-lang';

interface SepsisScreeningProps {
  vitals: { sbp?: number | null; rr?: number | null; temp?: number | null; hr?: number | null };
  gcsScore?: number | null;
  onChange?: (input: SepsisInput) => void;
}

export function SepsisScreening({ vitals, gcsScore, onChange }: SepsisScreeningProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [expanded, setExpanded] = useState(false);
  const [suspectedInfection, setSuspectedInfection] = useState(false);
  const [wbc, setWbc] = useState('');
  const [lactate, setLactate] = useState('');

  const input: SepsisInput = useMemo(() => ({
    sbp: vitals.sbp,
    rr: vitals.rr,
    gcsScore,
    temp: vitals.temp,
    hr: vitals.hr,
    wbc: wbc ? Number(wbc) : null,
    lactate: lactate ? Number(lactate) : null,
    suspectedInfection,
  }), [vitals, gcsScore, wbc, lactate, suspectedInfection]);

  const result = useMemo(() => screenSepsis(input), [input]);
  const cfg = SEPSIS_RISK_CFG[result.risk];

  const hasAnyData = vitals.sbp != null || vitals.rr != null || vitals.temp != null || vitals.hr != null;
  if (!hasAnyData && result.risk === 'NEGATIVE') return null;

  return (
    <div className={`border rounded-lg overflow-hidden ${result.risk === 'SEPSIS_ALERT' ? 'ring-2 ring-red-400 animate-pulse' : cfg.border}`}>
      <button onClick={() => setExpanded(!expanded)} className={`w-full flex items-center justify-between p-3 ${cfg.bg} transition-colors`}>
        <div className="flex items-center gap-2">
          {result.risk === 'SEPSIS_ALERT' ? <Siren className={`w-5 h-5 ${cfg.text}`} /> : <AlertOctagon className={`w-4 h-4 ${cfg.text}`} />}
          <span className={`font-semibold text-sm ${cfg.text}`}>{tr('فحص الإنتان', 'Sepsis Screening')}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} ring-1 ring-current/20`}>
            {tr(cfg.labelAr, cfg.labelEn)}
          </span>
          <span className="text-xs text-muted-foreground">qSOFA {result.qsofaScore}/3 • SIRS {result.sirsScore}/4</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Suspected infection toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={suspectedInfection} onChange={e => { setSuspectedInfection(e.target.checked); onChange?.({ ...input, suspectedInfection: e.target.checked }); }}
              className="rounded border-border text-red-600 focus:ring-red-500" />
            <span className="text-xs font-medium text-foreground">{tr('اشتباه عدوى / إنتان', 'Suspected Infection')}</span>
          </label>

          {/* qSOFA */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">qSOFA ({result.qsofaScore}/3)</label>
            <div className="space-y-1">
              {result.qsofaCriteria.map(c => (
                <div key={c.id} className={`flex items-center gap-2 p-1.5 rounded text-xs ${c.met ? 'bg-red-50' : 'bg-muted/50'}`}>
                  {c.met ? <CheckCircle2 className="w-3.5 h-3.5 text-red-600" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className={c.met ? 'text-red-700 font-medium' : 'text-muted-foreground'}>{tr(c.labelAr, c.labelEn)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SIRS */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">SIRS ({result.sirsScore}/4)</label>
            <div className="space-y-1">
              {result.sirsCriteria.map(c => (
                <div key={c.id} className={`flex items-center gap-2 p-1.5 rounded text-xs ${c.met ? 'bg-orange-50' : 'bg-muted/50'}`}>
                  {c.met ? <CheckCircle2 className="w-3.5 h-3.5 text-orange-600" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className={c.met ? 'text-orange-700 font-medium' : 'text-muted-foreground'}>{tr(c.labelAr, c.labelEn)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Optional lab inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">{tr('كريات بيضاء (WBC K/μL)', 'WBC (K/μL)')}</label>
              <input type="number" value={wbc} onChange={e => setWbc(e.target.value)} placeholder="4-12" className="w-full text-xs border rounded px-2 py-1" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">{tr('لاكتات (mmol/L)', 'Lactate (mmol/L)')}</label>
              <input type="number" value={lactate} onChange={e => setLactate(e.target.value)} placeholder="<2" className="w-full text-xs border rounded px-2 py-1" />
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className={`p-2.5 rounded-lg ${cfg.bg} border ${cfg.border}`}>
              <p className={`text-xs font-semibold ${cfg.text} mb-1`}><Zap className="h-3.5 w-3.5 inline mr-1" />{tr('التوصيات:', 'Recommendations:')}</p>
              <ul className="space-y-0.5">
                {result.recommendations.map((r, i) => (
                  <li key={i} className={`text-xs ${cfg.text}`}>• {tr(r.labelAr, r.labelEn)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
