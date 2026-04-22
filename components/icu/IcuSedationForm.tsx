'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/* ------------------------------------------------------------------ */
/*  RASS Levels                                                        */
/* ------------------------------------------------------------------ */
const RASS_LEVELS = [
  { score: 4, ar: 'هيجان شديد', en: 'Combative', desc_ar: 'عنيف، خطر فوري على الموظفين', desc_en: 'Violent, immediate danger to staff' },
  { score: 3, ar: 'هياج شديد', en: 'Very Agitated', desc_ar: 'يسحب الأنابيب، عدواني', desc_en: 'Pulls tubes/catheters, aggressive' },
  { score: 2, ar: 'هياج', en: 'Agitated', desc_ar: 'حركات متكررة غير هادفة، يقاوم المنفسة', desc_en: 'Frequent non-purposeful movement, fights ventilator' },
  { score: 1, ar: 'حركة زائدة', en: 'Restless', desc_ar: 'قلق خفيف ولكن لا يتحرك بشكل عدواني', desc_en: 'Anxious, apprehensive but not aggressive' },
  { score: 0, ar: 'متيقظ وهادئ', en: 'Alert & Calm', desc_ar: 'يقظ ومتفاعل بشكل طبيعي', desc_en: 'Spontaneously attentive to caregiver' },
  { score: -1, ar: 'نعسان', en: 'Drowsy', desc_ar: 'ليس متيقظا كاملا لكن يبقى مستيقظا >10 ثوان', desc_en: 'Not fully alert but has sustained awakening >10s' },
  { score: -2, ar: 'تخدير خفيف', en: 'Light Sedation', desc_ar: 'يستيقظ لفترة قصيرة مع تواصل بصري <10 ثوان', desc_en: 'Briefly awakens with eye contact <10s' },
  { score: -3, ar: 'تخدير متوسط', en: 'Moderate Sedation', desc_ar: 'حركة أو فتح العين للصوت (بدون تواصل بصري)', desc_en: 'Movement or eye opening to voice (no eye contact)' },
  { score: -4, ar: 'تخدير عميق', en: 'Deep Sedation', desc_ar: 'لا استجابة للصوت، يستجيب للتحفيز الجسدي', desc_en: 'No response to voice, responds to physical stimulation' },
  { score: -5, ar: 'غير قابل للإيقاظ', en: 'Unarousable', desc_ar: 'لا استجابة للصوت أو التحفيز الجسدي', desc_en: 'No response to voice or physical stimulation' },
];

/* ------------------------------------------------------------------ */
/*  SAS Levels                                                         */
/* ------------------------------------------------------------------ */
const SAS_LEVELS = [
  { score: 7, ar: 'هياج خطير', en: 'Dangerous Agitation', desc_ar: 'يسحب الأجهزة، يحاول مغادرة السرير', desc_en: 'Pulling at devices, trying to remove tubes' },
  { score: 6, ar: 'هياج شديد جدا', en: 'Very Agitated', desc_ar: 'لا يهدأ رغم التعليمات المتكررة، يعض الأنبوب', desc_en: 'Does not calm despite verbal reminding, bites tube' },
  { score: 5, ar: 'هياج', en: 'Agitated', desc_ar: 'قلق أو عصبي، يحاول الجلوس، يهدأ بالتوجيه', desc_en: 'Anxious, attempting to sit up, calms with verbal instructions' },
  { score: 4, ar: 'هادئ ومتعاون', en: 'Calm & Cooperative', desc_ar: 'هادئ، يستيقظ بسهولة، يتبع الأوامر', desc_en: 'Calm, awakens easily, follows commands' },
  { score: 3, ar: 'مخدّر', en: 'Sedated', desc_ar: 'يصعب إيقاظه، يستيقظ بالتحفيز اللفظي/الجسدي الخفيف', desc_en: 'Difficult to arouse, awakens to gentle shaking' },
  { score: 2, ar: 'تخدير شديد', en: 'Very Sedated', desc_ar: 'يستيقظ للتحفيز الجسدي، لا يتبع الأوامر', desc_en: 'Arouses to physical stimuli, does not follow commands' },
  { score: 1, ar: 'غير قابل للإيقاظ', en: 'Unarousable', desc_ar: 'استجابة ضئيلة أو معدومة للتحفيز المؤلم', desc_en: 'Minimal or no response to noxious stimuli' },
];

const PAIN_TOOLS = [
  { value: 'NRS', ar: 'مقياس التصنيف الرقمي (NRS)', en: 'Numeric Rating Scale (NRS)' },
  { value: 'BPS', ar: 'مقياس الألم السلوكي (BPS)', en: 'Behavioral Pain Scale (BPS)' },
  { value: 'CPOT', ar: 'أداة ملاحظة الألم الحرجة (CPOT)', en: 'Critical-Care Pain Observation Tool (CPOT)' },
];

interface Props {
  onSubmit: (data: Record<string, any>) => void;
  saving?: boolean;
}

export default function IcuSedationForm({ onSubmit, saving }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [scaleType, setScaleType] = useState<'RASS' | 'SAS'>('RASS');
  const [score, setScore] = useState<number | null>(null);
  const [targetScore, setTargetScore] = useState<string>('');
  const [painScore, setPainScore] = useState<number | null>(null);
  const [painTool, setPainTool] = useState('NRS');
  const [drugs, setDrugs] = useState<{ drug: string; dose: string; rate: string; unit: string }[]>([]);
  const [interventions, setInterventions] = useState<string[]>([]);
  const [newIntervention, setNewIntervention] = useState('');
  const [notes, setNotes] = useState('');

  const levels = scaleType === 'RASS' ? RASS_LEVELS : SAS_LEVELS;
  const isOnTarget = score != null && targetScore !== '' ? score === Number(targetScore) : null;

  const addDrug = () => setDrugs([...drugs, { drug: '', dose: '', rate: '', unit: 'mcg/kg/min' }]);
  const updateDrug = (idx: number, field: string, val: string) => {
    const copy = [...drugs];
    (copy[idx] as Record<string, string>)[field] = val;
    setDrugs(copy);
  };
  const removeDrug = (idx: number) => setDrugs(drugs.filter((_, i) => i !== idx));

  const addIntervention = () => {
    if (newIntervention.trim()) {
      setInterventions([...interventions, newIntervention.trim()]);
      setNewIntervention('');
    }
  };
  const removeIntervention = (idx: number) => setInterventions(interventions.filter((_, i) => i !== idx));

  const handleSave = () => {
    if (score == null) return;
    onSubmit({
      scaleType,
      score,
      targetScore: targetScore !== '' ? Number(targetScore) : null,
      painScore,
      painTool,
      sedationDrugs: drugs.filter((d) => d.drug.trim()),
      interventions,
      notes,
    });
  };

  const scoreColor = (s: number) => {
    if (scaleType === 'RASS') {
      if (s >= 3) return 'bg-red-600 text-white hover:bg-red-700';
      if (s >= 1) return 'bg-orange-500 text-white hover:bg-orange-600';
      if (s === 0) return 'bg-green-600 text-white hover:bg-green-700';
      if (s >= -2) return 'bg-blue-400 text-white hover:bg-blue-500';
      return 'bg-indigo-700 text-white hover:bg-indigo-800';
    }
    // SAS
    if (s >= 6) return 'bg-red-600 text-white hover:bg-red-700';
    if (s >= 5) return 'bg-orange-500 text-white hover:bg-orange-600';
    if (s === 4) return 'bg-green-600 text-white hover:bg-green-700';
    if (s >= 3) return 'bg-blue-400 text-white hover:bg-blue-500';
    return 'bg-indigo-700 text-white hover:bg-indigo-800';
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="space-y-6 max-h-[70vh] overflow-y-auto px-1">

      {/* ---- Scale Type Toggle ---- */}
      <Tabs value={scaleType} onValueChange={(v) => { setScaleType(v as 'RASS' | 'SAS'); setScore(null); }}>
        <TabsList className="w-full">
          <TabsTrigger value="RASS" className="flex-1">RASS</TabsTrigger>
          <TabsTrigger value="SAS" className="flex-1">SAS</TabsTrigger>
        </TabsList>

        {/* ---- RASS Scale ---- */}
        <TabsContent value="RASS" className="mt-4">
          <div className="grid gap-2">
            {RASS_LEVELS.map((level) => (
              <button
                key={level.score}
                type="button"
                onClick={() => setScore(level.score)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-start transition-all ${score === level.score ? `ring-2 ring-offset-1 ring-primary ${scoreColor(level.score)}` : 'hover:bg-muted/50'}`}
              >
                <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${score === level.score ? 'bg-white/30' : scoreColor(level.score)}`}>
                  {level.score > 0 ? `+${level.score}` : level.score}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{tr(level.ar, level.en)}</p>
                  <p className="text-xs opacity-80">{tr(level.desc_ar, level.desc_en)}</p>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* ---- SAS Scale ---- */}
        <TabsContent value="SAS" className="mt-4">
          <div className="grid gap-2">
            {SAS_LEVELS.map((level) => (
              <button
                key={level.score}
                type="button"
                onClick={() => setScore(level.score)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-start transition-all ${score === level.score ? `ring-2 ring-offset-1 ring-primary ${scoreColor(level.score)}` : 'hover:bg-muted/50'}`}
              >
                <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${score === level.score ? 'bg-white/30' : scoreColor(level.score)}`}>
                  {level.score}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{tr(level.ar, level.en)}</p>
                  <p className="text-xs opacity-80">{tr(level.desc_ar, level.desc_en)}</p>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ---- Target ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('المستهدف', 'Target')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex-1">
            <Label>{tr(`${scaleType} المستهدف`, `Target ${scaleType}`)}</Label>
            <Input type="number" placeholder={scaleType === 'RASS' ? '-5 to +4' : '1 to 7'} value={targetScore} onChange={(e) => setTargetScore(e.target.value)} />
          </div>
          {isOnTarget != null && (
            <Badge className={`mt-5 ${isOnTarget ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isOnTarget ? tr('في المستهدف', 'On Target') : tr('خارج المستهدف', 'Off Target')}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* ---- Pain ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('تقييم الألم', 'Pain Assessment')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{tr('أداة التقييم', 'Pain Tool')}</Label>
            <Select value={painTool} onValueChange={setPainTool}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAIN_TOOLS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{tr(t.ar, t.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tr('درجة الألم', 'Pain Score')} (0-10)</Label>
            <div className="flex gap-1 mt-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPainScore(i)}
                  className={`w-9 h-9 rounded-md text-sm font-bold border transition-all ${
                    painScore === i
                      ? 'ring-2 ring-primary bg-primary text-primary-foreground'
                      : i <= 3 ? 'bg-green-50 hover:bg-green-100 text-green-800'
                      : i <= 6 ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-800'
                      : 'bg-red-50 hover:bg-red-100 text-red-800'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Sedation Drugs ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            {tr('أدوية التخدير', 'Sedation Drugs')}
            <Button variant="outline" size="sm" onClick={addDrug}>{tr('+ إضافة', '+ Add')}</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {drugs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              {tr('لم يتم إضافة أدوية', 'No drugs added')}
            </p>
          )}
          {drugs.map((d, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-2 items-end">
              <div className="col-span-2">
                <Label>{tr('الدواء', 'Drug')}</Label>
                <Input placeholder={tr('مثل: بروبوفول', 'e.g. Propofol')} value={d.drug} onChange={(e) => updateDrug(idx, 'drug', e.target.value)} />
              </div>
              <div>
                <Label>{tr('الجرعة', 'Dose')}</Label>
                <Input placeholder="50" value={d.dose} onChange={(e) => updateDrug(idx, 'dose', e.target.value)} />
              </div>
              <div>
                <Label>{tr('المعدل', 'Rate')}</Label>
                <Input placeholder="5" value={d.rate} onChange={(e) => updateDrug(idx, 'rate', e.target.value)} />
              </div>
              <div className="flex gap-1">
                <div className="flex-1">
                  <Label>{tr('الوحدة', 'Unit')}</Label>
                  <Input value={d.unit} onChange={(e) => updateDrug(idx, 'unit', e.target.value)} />
                </div>
                <Button variant="ghost" size="sm" className="mt-5 text-red-500" onClick={() => removeDrug(idx)}>X</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ---- Interventions ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('التدخلات', 'Interventions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={tr('أضف تدخل...', 'Add intervention...')}
              value={newIntervention}
              onChange={(e) => setNewIntervention(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIntervention(); } }}
            />
            <Button variant="outline" onClick={addIntervention}>{tr('إضافة', 'Add')}</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {interventions.map((item, idx) => (
              <Badge key={idx} variant="secondary" className="gap-1">
                {item}
                <button type="button" className="ml-1 text-xs font-bold" onClick={() => removeIntervention(idx)}>x</button>
              </Badge>
            ))}
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
        <Button onClick={handleSave} disabled={saving || score == null}>
          {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التقييم', 'Save Assessment')}
        </Button>
      </div>
    </div>
  );
}
