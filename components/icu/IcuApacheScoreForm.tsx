'use client';

import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/* ------------------------------------------------------------------ */
/*  APACHE II APS scoring ranges                                       */
/* ------------------------------------------------------------------ */
function tempScore(v: number | null): number {
  if (v == null) return 0;
  if (v >= 41) return 4;
  if (v >= 39) return 3;
  if (v >= 38.5) return 1;
  if (v >= 36) return 0;
  if (v >= 34) return 1;
  if (v >= 32) return 2;
  if (v >= 30) return 3;
  return 4;
}

function mapScoreFn(v: number | null): number {
  if (v == null) return 0;
  if (v >= 160) return 4;
  if (v >= 130) return 3;
  if (v >= 110) return 2;
  if (v >= 70) return 0;
  if (v >= 50) return 2;
  return 4;
}

function hrScore(v: number | null): number {
  if (v == null) return 0;
  if (v >= 180) return 4;
  if (v >= 140) return 3;
  if (v >= 110) return 2;
  if (v >= 70) return 0;
  if (v >= 55) return 2;
  if (v >= 40) return 3;
  return 4;
}

function rrScore(v: number | null): number {
  if (v == null) return 0;
  if (v >= 50) return 4;
  if (v >= 35) return 3;
  if (v >= 25) return 1;
  if (v >= 12) return 0;
  if (v >= 10) return 1;
  if (v >= 6) return 2;
  return 4;
}

function oxyScore(fio2: number | null, pao2: number | null, aaDO2: number | null): number {
  if (fio2 != null && fio2 >= 0.5 && aaDO2 != null) {
    if (aaDO2 >= 500) return 4;
    if (aaDO2 >= 350) return 3;
    if (aaDO2 >= 200) return 2;
    return 0;
  }
  if (pao2 != null) {
    if (pao2 > 70) return 0;
    if (pao2 >= 61) return 1;
    if (pao2 >= 55) return 3;
    return 4;
  }
  return 0;
}

function phScore(v: number | null): number {
  if (v == null) return 0;
  if (v >= 7.7) return 4;
  if (v >= 7.6) return 3;
  if (v >= 7.5) return 1;
  if (v >= 7.33) return 0;
  if (v >= 7.25) return 2;
  if (v >= 7.15) return 3;
  return 4;
}

function naScore(v: number | null): number {
  if (v == null) return 0;
  if (v >= 180) return 4;
  if (v >= 160) return 3;
  if (v >= 155) return 2;
  if (v >= 150) return 1;
  if (v >= 130) return 0;
  if (v >= 120) return 2;
  if (v >= 111) return 3;
  return 4;
}

function kScore(v: number | null): number {
  if (v == null) return 0;
  if (v >= 7) return 4;
  if (v >= 6) return 3;
  if (v >= 5.5) return 1;
  if (v >= 3.5) return 0;
  if (v >= 3) return 1;
  if (v >= 2.5) return 2;
  return 4;
}

function crScore(v: number | null, arf: boolean): number {
  if (v == null) return 0;
  const mult = arf ? 2 : 1;
  if (v >= 3.5) return 4 * mult;
  if (v >= 2) return 3 * mult;
  if (v >= 1.5) return 2 * mult;
  if (v >= 0.6) return 0;
  return 2 * mult;
}

function hctScore(v: number | null): number {
  if (v == null) return 0;
  if (v >= 60) return 4;
  if (v >= 50) return 2;
  if (v >= 46) return 1;
  if (v >= 30) return 0;
  if (v >= 20) return 2;
  return 4;
}

function wbcScoreFn(v: number | null): number {
  if (v == null) return 0;
  if (v >= 40) return 4;
  if (v >= 20) return 2;
  if (v >= 15) return 1;
  if (v >= 3) return 0;
  if (v >= 1) return 2;
  return 4;
}

function gcsScoreFn(gcs: number | null): number {
  if (gcs == null) return 0;
  return 15 - gcs; // APACHE II GCS component = 15 - GCS
}

function agePointsFn(bracket: string): number {
  switch (bracket) {
    case '<44': return 0;
    case '45-54': return 2;
    case '55-64': return 3;
    case '65-74': return 5;
    case '>=75': return 6;
    default: return 0;
  }
}

function chronicPoints(conditions: string[], emergency: boolean): number {
  if (conditions.length === 0) return 0;
  return emergency ? 5 : 2;
}

function predictedMortality(totalScore: number): number {
  if (totalScore <= 4) return 4;
  if (totalScore <= 9) return 8;
  if (totalScore <= 14) return 15;
  if (totalScore <= 19) return 25;
  if (totalScore <= 24) return 40;
  if (totalScore <= 29) return 55;
  if (totalScore <= 34) return 73;
  return 85;
}

function riskLabel(totalScore: number, tr: (ar: string, en: string) => string): string {
  if (totalScore <= 4) return tr('منخفض', 'Low');
  if (totalScore <= 9) return tr('متوسط', 'Moderate');
  if (totalScore <= 14) return tr('مرتفع', 'High');
  if (totalScore <= 19) return tr('مرتفع جدا', 'Very High');
  return tr('حرج', 'Critical');
}

function riskColor(totalScore: number): string {
  if (totalScore <= 4) return 'bg-green-100 text-green-800 border-green-300';
  if (totalScore <= 9) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (totalScore <= 14) return 'bg-orange-100 text-orange-800 border-orange-300';
  if (totalScore <= 19) return 'bg-red-100 text-red-800 border-red-300';
  return 'bg-red-200 text-red-900 border-red-500';
}

interface Props {
  onSubmit: (data: Record<string, any>) => void;
  saving?: boolean;
}

export default function IcuApacheScoreForm({ onSubmit, saving }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // Raw values
  const [temperature, setTemperature] = useState<string>('');
  const [map, setMap] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('');
  const [fio2, setFio2] = useState<string>('');
  const [pao2, setPao2] = useState<string>('');
  const [aaDO2, setAaDO2] = useState<string>('');
  const [arterialPh, setArterialPh] = useState<string>('');
  const [sodium, setSodium] = useState<string>('');
  const [potassium, setPotassium] = useState<string>('');
  const [creatinine, setCreatinine] = useState<string>('');
  const [hematocrit, setHematocrit] = useState<string>('');
  const [wbc, setWbc] = useState<string>('');
  const [gcs, setGcs] = useState<string>('15');
  const [acuteRenalFailure, setAcuteRenalFailure] = useState(false);

  // Age
  const [ageBracket, setAgeBracket] = useState('<44');

  // Chronic health
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [emergencySurgery, setEmergencySurgery] = useState(false);

  // Notes
  const [notes, setNotes] = useState('');

  // Computed scores
  const computed = useMemo(() => {
    const tVal = temperature ? parseFloat(temperature) : null;
    const mapVal = map ? parseFloat(map) : null;
    const hrVal = heartRate ? parseFloat(heartRate) : null;
    const rrVal = respiratoryRate ? parseFloat(respiratoryRate) : null;
    const fio2Val = fio2 ? parseFloat(fio2) : null;
    const pao2Val = pao2 ? parseFloat(pao2) : null;
    const aaDO2Val = aaDO2 ? parseFloat(aaDO2) : null;
    const phVal = arterialPh ? parseFloat(arterialPh) : null;
    const naVal = sodium ? parseFloat(sodium) : null;
    const kVal = potassium ? parseFloat(potassium) : null;
    const crVal = creatinine ? parseFloat(creatinine) : null;
    const hctVal = hematocrit ? parseFloat(hematocrit) : null;
    const wbcVal = wbc ? parseFloat(wbc) : null;
    const gcsVal = gcs ? parseInt(gcs) : null;

    const ts = tempScore(tVal);
    const ms = mapScoreFn(mapVal);
    const hrs = hrScore(hrVal);
    const rrs = rrScore(rrVal);
    const os = oxyScore(fio2Val, pao2Val, aaDO2Val);
    const phs = phScore(phVal);
    const nas = naScore(naVal);
    const ks = kScore(kVal);
    const crs = crScore(crVal, acuteRenalFailure);
    const hcts = hctScore(hctVal);
    const wbcs = wbcScoreFn(wbcVal);
    const gcss = gcsScoreFn(gcsVal);

    const aps = ts + ms + hrs + rrs + os + phs + nas + ks + crs + hcts + wbcs + gcss;
    const ap = agePointsFn(ageBracket);
    const cp = chronicPoints(chronicConditions, emergencySurgery);
    const total = aps + ap + cp;
    const mortality = predictedMortality(total);

    return {
      temperatureScore: ts, mapScore: ms, heartRateScore: hrs, respiratoryRateScore: rrs,
      oxygenationScore: os, arterialPhScore: phs, sodiumScore: nas, potassiumScore: ks,
      creatinineScore: crs, hematocritScore: hcts, wbcScore: wbcs, gcsScore: gcss,
      apsTotal: aps, agePoints: ap, chronicHealthPoints: cp, totalScore: total, mortality,
    };
  }, [temperature, map, heartRate, respiratoryRate, fio2, pao2, aaDO2, arterialPh, sodium, potassium, creatinine, hematocrit, wbc, gcs, acuteRenalFailure, ageBracket, chronicConditions, emergencySurgery]);

  const toggleChronic = (key: string) => {
    setChronicConditions((prev) => prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]);
  };

  const handleSave = () => {
    onSubmit({
      temperature: temperature ? parseFloat(temperature) : null,
      meanArterialPressure: map ? parseFloat(map) : null,
      heartRate: heartRate ? parseFloat(heartRate) : null,
      respiratoryRate: respiratoryRate ? parseFloat(respiratoryRate) : null,
      fio2: fio2 ? parseFloat(fio2) : null,
      pao2: pao2 ? parseFloat(pao2) : null,
      aaDO2: aaDO2 ? parseFloat(aaDO2) : null,
      arterialPh: arterialPh ? parseFloat(arterialPh) : null,
      sodium: sodium ? parseFloat(sodium) : null,
      potassium: potassium ? parseFloat(potassium) : null,
      creatinine: creatinine ? parseFloat(creatinine) : null,
      hematocrit: hematocrit ? parseFloat(hematocrit) : null,
      wbc: wbc ? parseFloat(wbc) : null,
      gcs: gcs ? parseInt(gcs) : null,
      ...computed,
      chronicLiver: chronicConditions.includes('liver'),
      chronicCardiovascular: chronicConditions.includes('cardiovascular'),
      chronicRespiratory: chronicConditions.includes('respiratory'),
      chronicRenal: chronicConditions.includes('renal'),
      chronicImmunocompromised: chronicConditions.includes('immunocompromised'),
      emergencySurgery,
      notes,
    });
  };

  const CHRONIC_OPTIONS = [
    { key: 'liver', ar: 'كبد', en: 'Liver' },
    { key: 'cardiovascular', ar: 'قلب وأوعية', en: 'Cardiovascular' },
    { key: 'respiratory', ar: 'جهاز تنفسي', en: 'Respiratory' },
    { key: 'renal', ar: 'كلوي', en: 'Renal' },
    { key: 'immunocompromised', ar: 'نقص مناعة', en: 'Immunocompromised' },
  ];

  const AGE_OPTIONS = [
    { value: '<44', ar: '< 44 (0 نقاط)', en: '< 44 (0 pts)' },
    { value: '45-54', ar: '45-54 (2 نقاط)', en: '45-54 (2 pts)' },
    { value: '55-64', ar: '55-64 (3 نقاط)', en: '55-64 (3 pts)' },
    { value: '65-74', ar: '65-74 (5 نقاط)', en: '65-74 (5 pts)' },
    { value: '>=75', ar: '>= 75 (6 نقاط)', en: '>= 75 (6 pts)' },
  ];

  const ScoreChip = ({ score }: { score: number }) => (
    <Badge variant="outline" className={`ml-2 ${score > 0 ? 'bg-orange-100 text-orange-800' : 'bg-muted/50 text-muted-foreground'}`}>
      {score}
    </Badge>
  );

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
      {/* ---- Vital Signs ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('العلامات الحيوية', 'Vital Signs')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Temperature */}
          <div>
            <Label className="flex items-center gap-1">
              {tr('الحرارة', 'Temperature')} (<span className="text-xs">°C</span>)
              <ScoreChip score={computed.temperatureScore} />
            </Label>
            <Input type="number" step="0.1" placeholder="36.0 - 41.0" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </div>
          {/* MAP */}
          <div>
            <Label className="flex items-center gap-1">
              {tr('ضغط الشرياني المتوسط', 'MAP')} (mmHg)
              <ScoreChip score={computed.mapScore} />
            </Label>
            <Input type="number" placeholder="70 - 160" value={map} onChange={(e) => setMap(e.target.value)} />
          </div>
          {/* Heart Rate */}
          <div>
            <Label className="flex items-center gap-1">
              {tr('معدل النبض', 'Heart Rate')} (bpm)
              <ScoreChip score={computed.heartRateScore} />
            </Label>
            <Input type="number" placeholder="60 - 180" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} />
          </div>
          {/* Respiratory Rate */}
          <div>
            <Label className="flex items-center gap-1">
              {tr('معدل التنفس', 'Respiratory Rate')} (/min)
              <ScoreChip score={computed.respiratoryRateScore} />
            </Label>
            <Input type="number" placeholder="12 - 50" value={respiratoryRate} onChange={(e) => setRespiratoryRate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* ---- Oxygenation ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {tr('الأكسجة', 'Oxygenation')}
            <ScoreChip score={computed.oxygenationScore} />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>FiO2</Label>
            <Input type="number" step="0.01" placeholder="0.21 - 1.0" value={fio2} onChange={(e) => setFio2(e.target.value)} />
          </div>
          <div>
            <Label>PaO2 (mmHg)</Label>
            <Input type="number" placeholder="55 - 100" value={pao2} onChange={(e) => setPao2(e.target.value)} />
          </div>
          <div>
            <Label>A-aDO2 (mmHg)</Label>
            <Input type="number" placeholder={tr('فقط إذا FiO2 >= 0.5', 'Only if FiO2 >= 0.5')} value={aaDO2} onChange={(e) => setAaDO2(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* ---- Lab Values ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('القيم المخبرية', 'Lab Values')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="flex items-center gap-1">
              {tr('الرقم الهيدروجيني', 'Arterial pH')}
              <ScoreChip score={computed.arterialPhScore} />
            </Label>
            <Input type="number" step="0.01" placeholder="7.15 - 7.70" value={arterialPh} onChange={(e) => setArterialPh(e.target.value)} />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              {tr('الصوديوم', 'Sodium')} (mEq/L)
              <ScoreChip score={computed.sodiumScore} />
            </Label>
            <Input type="number" placeholder="110 - 180" value={sodium} onChange={(e) => setSodium(e.target.value)} />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              {tr('البوتاسيوم', 'Potassium')} (mEq/L)
              <ScoreChip score={computed.potassiumScore} />
            </Label>
            <Input type="number" step="0.1" placeholder="2.5 - 7.0" value={potassium} onChange={(e) => setPotassium(e.target.value)} />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              {tr('الكرياتينين', 'Creatinine')} (mg/dL)
              <ScoreChip score={computed.creatinineScore} />
            </Label>
            <Input type="number" step="0.1" placeholder="0.6 - 3.5" value={creatinine} onChange={(e) => setCreatinine(e.target.value)} />
            <label className="flex items-center gap-2 mt-1 text-xs">
              <input type="checkbox" checked={acuteRenalFailure} onChange={(e) => setAcuteRenalFailure(e.target.checked)} />
              {tr('فشل كلوي حاد (مضاعفة النقاط)', 'Acute Renal Failure (double points)')}
            </label>
          </div>
          <div>
            <Label className="flex items-center gap-1">
              {tr('الهيماتوكريت', 'Hematocrit')} (%)
              <ScoreChip score={computed.hematocritScore} />
            </Label>
            <Input type="number" step="0.1" placeholder="20 - 60" value={hematocrit} onChange={(e) => setHematocrit(e.target.value)} />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              {tr('كريات الدم البيضاء', 'WBC')} (x10^3)
              <ScoreChip score={computed.wbcScore} />
            </Label>
            <Input type="number" step="0.1" placeholder="1 - 40" value={wbc} onChange={(e) => setWbc(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* ---- GCS ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {tr('مقياس غلاسكو للوعي', 'Glasgow Coma Scale')}
            <ScoreChip score={computed.gcsScore} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full sm:w-1/2">
            <Label>GCS (3-15)</Label>
            <Input type="number" min={3} max={15} value={gcs} onChange={(e) => setGcs(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">{tr('نقاط APACHE = 15 - GCS', 'APACHE points = 15 - GCS')}</p>
          </div>
        </CardContent>
      </Card>

      {/* ---- Age ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {tr('العمر', 'Age')}
            <ScoreChip score={computed.agePoints} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={ageBracket} onValueChange={setAgeBracket}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{tr(opt.ar, opt.en)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* ---- Chronic Health ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {tr('الأمراض المزمنة', 'Chronic Health')}
            <ScoreChip score={computed.chronicHealthPoints} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {CHRONIC_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={chronicConditions.includes(opt.key)} onChange={() => toggleChronic(opt.key)} />
                {tr(opt.ar, opt.en)}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={emergencySurgery} onChange={(e) => setEmergencySurgery(e.target.checked)} />
            {tr('جراحة طوارئ', 'Emergency Surgery')}
          </label>
          <p className="text-xs text-muted-foreground">
            {tr(
              'إذا وجد مرض مزمن: 5 نقاط لجراحة الطوارئ، 2 نقاط للعمليات الاختيارية',
              'If chronic disease present: 5 pts for emergency surgery, 2 pts for elective',
            )}
          </p>
        </CardContent>
      </Card>

      {/* ---- Summary ---- */}
      <Card className={`border-2 ${riskColor(computed.totalScore)}`}>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs font-medium">{tr('نقاط APS', 'APS Points')}</p>
              <p className="text-2xl font-bold">{computed.apsTotal}</p>
            </div>
            <div>
              <p className="text-xs font-medium">{tr('العمر + المزمنة', 'Age + Chronic')}</p>
              <p className="text-2xl font-bold">{computed.agePoints + computed.chronicHealthPoints}</p>
            </div>
            <div>
              <p className="text-xs font-medium">{tr('المجموع الكلي', 'Total Score')}</p>
              <p className="text-3xl font-extrabold">{computed.totalScore}</p>
            </div>
            <div>
              <p className="text-xs font-medium">{tr('الوفيات المتوقعة', 'Predicted Mortality')}</p>
              <p className="text-2xl font-bold">{computed.mortality}%</p>
            </div>
          </div>
          <div className="flex justify-center mt-3">
            <Badge className={`text-sm px-4 py-1 ${riskColor(computed.totalScore)}`}>
              {riskLabel(computed.totalScore, tr)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ---- Notes ---- */}
      <div>
        <Label>{tr('ملاحظات', 'Notes')}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tr('ملاحظات إضافية...', 'Additional notes...')} />
      </div>

      {/* ---- Save ---- */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التقييم', 'Save Assessment')}
        </Button>
      </div>
    </div>
  );
}
