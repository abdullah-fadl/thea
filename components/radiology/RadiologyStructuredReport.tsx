'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  Save,
  FileText,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */
type ReportType = 'FREE_TEXT' | 'BI_RADS' | 'LUNG_RADS' | 'TI_RADS' | 'PI_RADS' | 'LI_RADS';

interface RadiologyStructuredReportProps {
  orderId: string;
  studyId?: string;
  modality?: string;
  patientName?: string;
  mrn?: string;
  onSaved?: () => void;
}

/* ─── BI-RADS data ───────────────────────────────────────────────────── */
const BIRADS_CATEGORIES = [
  { value: '0', en: '0 - Incomplete', ar: '0 - غير مكتمل' },
  { value: '1', en: '1 - Negative', ar: '1 - سلبي' },
  { value: '2', en: '2 - Benign', ar: '2 - حميد' },
  { value: '3', en: '3 - Probably Benign', ar: '3 - حميد على الأرجح' },
  { value: '4a', en: '4a - Low Suspicion', ar: '4a - شك منخفض' },
  { value: '4b', en: '4b - Moderate Suspicion', ar: '4b - شك متوسط' },
  { value: '4c', en: '4c - High Suspicion', ar: '4c - شك مرتفع' },
  { value: '5', en: '5 - Highly Suggestive of Malignancy', ar: '5 - مؤشر قوي للخبث' },
  { value: '6', en: '6 - Known Biopsy-Proven Malignancy', ar: '6 - خبث مؤكد بالخزعة' },
];

const BIRADS_RECOMMENDATIONS: Record<string, { en: string; ar: string }> = {
  '0': { en: 'Additional imaging evaluation needed', ar: 'يحتاج تقييم تصويري إضافي' },
  '1': { en: 'Routine screening', ar: 'فحص دوري روتيني' },
  '2': { en: 'Routine screening', ar: 'فحص دوري روتيني' },
  '3': { en: 'Short-interval follow-up (6 months)', ar: 'متابعة قصيرة المدى (6 أشهر)' },
  '4a': { en: 'Tissue diagnosis recommended', ar: 'يوصى بالتشخيص النسيجي' },
  '4b': { en: 'Tissue diagnosis recommended', ar: 'يوصى بالتشخيص النسيجي' },
  '4c': { en: 'Tissue diagnosis recommended', ar: 'يوصى بالتشخيص النسيجي' },
  '5': { en: 'Tissue diagnosis required', ar: 'يتطلب تشخيص نسيجي' },
  '6': { en: 'Surgical excision when clinically appropriate', ar: 'استئصال جراحي حسب السياق السريري' },
};

/* ─── Lung-RADS data ─────────────────────────────────────────────────── */
const LUNG_RADS_CATEGORIES = [
  { value: '1', en: '1 - Negative', ar: '1 - سلبي' },
  { value: '2', en: '2 - Benign Appearance', ar: '2 - مظهر حميد' },
  { value: '3', en: '3 - Probably Benign', ar: '3 - حميد على الأرجح' },
  { value: '4A', en: '4A - Suspicious', ar: '4A - مشبوه' },
  { value: '4B', en: '4B - Very Suspicious', ar: '4B - مشبوه جدا' },
  { value: '4X', en: '4X - Additional Features', ar: '4X - سمات إضافية' },
];

const LUNG_RADS_RECOMMENDATIONS: Record<string, { en: string; ar: string }> = {
  '1': { en: 'Continue annual screening with LDCT in 12 months', ar: 'متابعة سنوية بالتصوير المقطعي منخفض الجرعة بعد 12 شهر' },
  '2': { en: 'Continue annual screening with LDCT in 12 months', ar: 'متابعة سنوية بالتصوير المقطعي منخفض الجرعة بعد 12 شهر' },
  '3': { en: 'Short-term follow-up LDCT in 6 months', ar: 'متابعة بالتصوير المقطعي منخفض الجرعة بعد 6 أشهر' },
  '4A': { en: 'Short-term follow-up LDCT in 3 months; PET/CT may be used', ar: 'متابعة بعد 3 أشهر؛ يمكن استخدام PET/CT' },
  '4B': { en: 'Chest CT with or without contrast, PET/CT and/or tissue sampling', ar: 'تصوير مقطعي للصدر مع/بدون تباين، PET/CT و/أو خزعة' },
  '4X': { en: 'Chest CT with or without contrast, PET/CT and/or tissue sampling', ar: 'تصوير مقطعي للصدر مع/بدون تباين، PET/CT و/أو خزعة' },
};

/* ─── TI-RADS data ───────────────────────────────────────────────────── */
const TIRADS_COMPOSITION = [
  { value: 'cystic', en: 'Cystic / Almost completely cystic (0 pts)', ar: 'كيسي / شبه كيسي بالكامل (0 نقاط)', points: 0 },
  { value: 'spongiform', en: 'Spongiform (0 pts)', ar: 'إسفنجي (0 نقاط)', points: 0 },
  { value: 'mixed', en: 'Mixed cystic and solid (1 pt)', ar: 'مختلط كيسي وصلب (1 نقطة)', points: 1 },
  { value: 'solid_almost', en: 'Solid or almost completely solid (2 pts)', ar: 'صلب أو شبه صلب بالكامل (2 نقاط)', points: 2 },
];

const TIRADS_ECHOGENICITY = [
  { value: 'anechoic', en: 'Anechoic (0 pts)', ar: 'عديم الصدى (0 نقاط)', points: 0 },
  { value: 'hyperechoic', en: 'Hyperechoic / Isoechoic (1 pt)', ar: 'مفرط الصدى / متساوي الصدى (1 نقطة)', points: 1 },
  { value: 'hypoechoic', en: 'Hypoechoic (2 pts)', ar: 'ناقص الصدى (2 نقاط)', points: 2 },
  { value: 'very_hypoechoic', en: 'Very Hypoechoic (3 pts)', ar: 'شديد نقص الصدى (3 نقاط)', points: 3 },
];

const TIRADS_SHAPE = [
  { value: 'wider', en: 'Wider-than-tall (0 pts)', ar: 'أعرض من الطول (0 نقاط)', points: 0 },
  { value: 'taller', en: 'Taller-than-wide (3 pts)', ar: 'أطول من العرض (3 نقاط)', points: 3 },
];

const TIRADS_MARGIN = [
  { value: 'smooth', en: 'Smooth (0 pts)', ar: 'أملس (0 نقاط)', points: 0 },
  { value: 'ill_defined', en: 'Ill-defined (0 pts)', ar: 'غير محدد (0 نقاط)', points: 0 },
  { value: 'lobulated', en: 'Lobulated / Irregular (2 pts)', ar: 'مفصص / غير منتظم (2 نقاط)', points: 2 },
  { value: 'extrathyroidal', en: 'Extra-thyroidal extension (3 pts)', ar: 'امتداد خارج الدرقية (3 نقاط)', points: 3 },
];

const TIRADS_FOCI = [
  { value: 'none', en: 'None / Large comet-tail (0 pts)', ar: 'لا يوجد / ذيل مذنب كبير (0 نقاط)', points: 0 },
  { value: 'macrocalc', en: 'Macrocalcifications (1 pt)', ar: 'تكلسات كبيرة (1 نقطة)', points: 1 },
  { value: 'peripheral', en: 'Peripheral / Rim calcifications (2 pts)', ar: 'تكلسات محيطية (2 نقاط)', points: 2 },
  { value: 'punctate', en: 'Punctate echogenic foci (3 pts)', ar: 'بؤر صدى نقطية (3 نقاط)', points: 3 },
];

function getTiRadsCategory(score: number): { category: string; en: string; ar: string } {
  if (score <= 1) return { category: 'TR1', en: 'TR1 - Benign', ar: 'TR1 - حميد' };
  if (score === 2) return { category: 'TR2', en: 'TR2 - Not Suspicious', ar: 'TR2 - غير مشبوه' };
  if (score === 3) return { category: 'TR3', en: 'TR3 - Mildly Suspicious', ar: 'TR3 - مشبوه بدرجة خفيفة' };
  if (score >= 4 && score <= 6) return { category: 'TR4', en: 'TR4 - Moderately Suspicious', ar: 'TR4 - مشبوه بدرجة متوسطة' };
  return { category: 'TR5', en: 'TR5 - Highly Suspicious', ar: 'TR5 - مشبوه بدرجة عالية' };
}

function getTiRadsRecommendation(category: string, sizeStr: string, lang: string): string {
  const size = parseFloat(sizeStr) || 0;
  const recs: Record<string, { en: string; ar: string }> = {
    TR1: { en: 'No FNA or follow-up needed', ar: 'لا حاجة لخزعة أو متابعة' },
    TR2: { en: 'No FNA or follow-up needed', ar: 'لا حاجة لخزعة أو متابعة' },
    TR3: {
      en: size >= 2.5 ? 'FNA recommended' : size >= 1.5 ? 'Follow-up recommended' : 'No FNA needed',
      ar: size >= 2.5 ? 'يوصى بخزعة بالإبرة الدقيقة' : size >= 1.5 ? 'يوصى بالمتابعة' : 'لا حاجة لخزعة',
    },
    TR4: {
      en: size >= 1.5 ? 'FNA recommended' : size >= 1.0 ? 'Follow-up recommended' : 'No FNA needed',
      ar: size >= 1.5 ? 'يوصى بخزعة بالإبرة الدقيقة' : size >= 1.0 ? 'يوصى بالمتابعة' : 'لا حاجة لخزعة',
    },
    TR5: {
      en: size >= 1.0 ? 'FNA recommended' : size >= 0.5 ? 'Follow-up or FNA recommended' : 'Annual follow-up',
      ar: size >= 1.0 ? 'يوصى بخزعة بالإبرة الدقيقة' : size >= 0.5 ? 'يوصى بالمتابعة أو الخزعة' : 'متابعة سنوية',
    },
  };
  const rec = recs[category];
  return rec ? (lang === 'ar' ? rec.ar : rec.en) : '';
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function RadiologyStructuredReport({
  orderId,
  studyId,
  modality,
  patientName,
  mrn,
  onSaved,
}: RadiologyStructuredReportProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // Common state
  const [reportType, setReportType] = useState<ReportType>('FREE_TEXT');
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [comparisonStudies, setComparisonStudies] = useState('');
  const [clinicalInfo, setClinicalInfo] = useState('');
  const [criticalFinding, setCriticalFinding] = useState(false);
  const [saving, setSaving] = useState(false);

  // BI-RADS state
  const [biComposition, setBiComposition] = useState('');
  const [biMassShape, setBiMassShape] = useState('');
  const [biMassMargin, setBiMassMargin] = useState('');
  const [biMassDensity, setBiMassDensity] = useState('');
  const [biCalcMorphology, setBiCalcMorphology] = useState('');
  const [biCalcDistribution, setBiCalcDistribution] = useState('');
  const [biAssociatedFeatures, setBiAssociatedFeatures] = useState<string[]>([]);
  const [biCategory, setBiCategory] = useState('');

  // Lung-RADS state
  const [lungNoduleSize, setLungNoduleSize] = useState('');
  const [lungNoduleType, setLungNoduleType] = useState('');
  const [lungCategory, setLungCategory] = useState('');

  // TI-RADS state
  const [tiComposition, setTiComposition] = useState('');
  const [tiEchogenicity, setTiEchogenicity] = useState('');
  const [tiShape, setTiShape] = useState('');
  const [tiMargin, setTiMargin] = useState('');
  const [tiFoci, setTiFoci] = useState('');
  const [tiNoduleSize, setTiNoduleSize] = useState('');

  // PI-RADS state
  const [piCategory, setPiCategory] = useState('');

  // LI-RADS state
  const [liCategory, setLiCategory] = useState('');

  // TI-RADS auto-calculation
  const tiScore = useMemo(() => {
    let total = 0;
    const comp = TIRADS_COMPOSITION.find((c) => c.value === tiComposition);
    if (comp) total += comp.points;
    const echo = TIRADS_ECHOGENICITY.find((e) => e.value === tiEchogenicity);
    if (echo) total += echo.points;
    const shape = TIRADS_SHAPE.find((s) => s.value === tiShape);
    if (shape) total += shape.points;
    const margin = TIRADS_MARGIN.find((m) => m.value === tiMargin);
    if (margin) total += margin.points;
    const foci = TIRADS_FOCI.find((f) => f.value === tiFoci);
    if (foci) total += foci.points;
    return total;
  }, [tiComposition, tiEchogenicity, tiShape, tiMargin, tiFoci]);

  const tiCategory = useMemo(() => getTiRadsCategory(tiScore), [tiScore]);
  const tiRecommendation = useMemo(
    () => getTiRadsRecommendation(tiCategory.category, tiNoduleSize, language),
    [tiCategory, tiNoduleSize, language]
  );

  // Auto-generate recommendation from category
  const activeRecommendation = useMemo(() => {
    if (reportType === 'BI_RADS' && biCategory) {
      const rec = BIRADS_RECOMMENDATIONS[biCategory];
      return rec ? (language === 'ar' ? rec.ar : rec.en) : '';
    }
    if (reportType === 'LUNG_RADS' && lungCategory) {
      const rec = LUNG_RADS_RECOMMENDATIONS[lungCategory];
      return rec ? (language === 'ar' ? rec.ar : rec.en) : '';
    }
    if (reportType === 'TI_RADS') return tiRecommendation;
    return '';
  }, [reportType, biCategory, lungCategory, tiRecommendation, language]);

  // Build template data
  const buildTemplateData = useCallback(() => {
    switch (reportType) {
      case 'BI_RADS':
        return {
          composition: biComposition,
          mass: { shape: biMassShape, margin: biMassMargin, density: biMassDensity },
          calcifications: { morphology: biCalcMorphology, distribution: biCalcDistribution },
          associatedFeatures: biAssociatedFeatures,
          category: biCategory,
        };
      case 'LUNG_RADS':
        return {
          noduleSize: lungNoduleSize,
          noduleType: lungNoduleType,
          category: lungCategory,
        };
      case 'TI_RADS':
        return {
          composition: tiComposition,
          echogenicity: tiEchogenicity,
          shape: tiShape,
          margin: tiMargin,
          echogenicFoci: tiFoci,
          noduleSize: tiNoduleSize,
          score: tiScore,
          category: tiCategory.category,
        };
      case 'PI_RADS':
        return { category: piCategory };
      case 'LI_RADS':
        return { category: liCategory };
      default:
        return {};
    }
  }, [
    reportType, biComposition, biMassShape, biMassMargin, biMassDensity,
    biCalcMorphology, biCalcDistribution, biAssociatedFeatures, biCategory,
    lungNoduleSize, lungNoduleType, lungCategory,
    tiComposition, tiEchogenicity, tiShape, tiMargin, tiFoci, tiNoduleSize, tiScore, tiCategory,
    piCategory, liCategory,
  ]);

  const handleSave = async (status: 'DRAFT' | 'FINAL') => {
    if (status === 'FINAL' && !findings.trim() && reportType === 'FREE_TEXT') {
      toast({ title: tr('النتائج مطلوبة', 'Findings are required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const categoryValue =
        reportType === 'BI_RADS' ? biCategory :
        reportType === 'LUNG_RADS' ? lungCategory :
        reportType === 'TI_RADS' ? tiCategory.category :
        reportType === 'PI_RADS' ? piCategory :
        reportType === 'LI_RADS' ? liCategory : undefined;

      const res = await fetch('/api/radiology/structured-report', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          studyId,
          reportType,
          modality,
          findings,
          impression,
          comparisonStudies,
          clinicalInfo,
          criticalFinding,
          templateData: buildTemplateData(),
          category: categoryValue,
          categoryScore: reportType === 'TI_RADS' ? tiScore : undefined,
          recommendation: activeRecommendation || undefined,
          status,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({
        title: status === 'FINAL'
          ? tr('تم إصدار التقرير النهائي', 'Final report issued')
          : tr('تم حفظ المسودة', 'Draft saved'),
      });
      onSaved?.();
    } catch {
      toast({ title: tr('فشل حفظ التقرير', 'Failed to save report'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /* ─── Render helpers for each template ─────────────────────────────── */
  const selectField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: { value: string; en: string; ar: string }[]
  ) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {language === 'ar' ? o.ar : o.en}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const renderBiRads = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">{tr('قالب BI-RADS', 'BI-RADS Template')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {selectField(tr('تركيب الثدي', 'Breast Composition'), biComposition, setBiComposition, [
          { value: 'a', en: 'a - Almost entirely fatty', ar: 'أ - دهني بالكامل تقريبا' },
          { value: 'b', en: 'b - Scattered fibroglandular', ar: 'ب - ليفي غدي متفرق' },
          { value: 'c', en: 'c - Heterogeneously dense', ar: 'ج - كثيف غير متجانس' },
          { value: 'd', en: 'd - Extremely dense', ar: 'د - كثيف للغاية' },
        ])}
        {selectField(tr('شكل الكتلة', 'Mass Shape'), biMassShape, setBiMassShape, [
          { value: 'oval', en: 'Oval', ar: 'بيضاوي' },
          { value: 'round', en: 'Round', ar: 'دائري' },
          { value: 'irregular', en: 'Irregular', ar: 'غير منتظم' },
        ])}
        {selectField(tr('حدود الكتلة', 'Mass Margin'), biMassMargin, setBiMassMargin, [
          { value: 'circumscribed', en: 'Circumscribed', ar: 'محدد' },
          { value: 'obscured', en: 'Obscured', ar: 'مموه' },
          { value: 'microlobulated', en: 'Microlobulated', ar: 'مفصص دقيق' },
          { value: 'indistinct', en: 'Indistinct', ar: 'غير واضح' },
          { value: 'spiculated', en: 'Spiculated', ar: 'شوكي' },
        ])}
        {selectField(tr('كثافة الكتلة', 'Mass Density'), biMassDensity, setBiMassDensity, [
          { value: 'high', en: 'High density', ar: 'كثافة عالية' },
          { value: 'equal', en: 'Equal density', ar: 'كثافة متساوية' },
          { value: 'low', en: 'Low density', ar: 'كثافة منخفضة' },
          { value: 'fat', en: 'Fat-containing', ar: 'محتوي على دهون' },
        ])}
        {selectField(tr('شكل التكلسات', 'Calcification Morphology'), biCalcMorphology, setBiCalcMorphology, [
          { value: 'none', en: 'None', ar: 'لا يوجد' },
          { value: 'typically_benign', en: 'Typically benign', ar: 'حميدة عادة' },
          { value: 'amorphous', en: 'Amorphous', ar: 'غير محددة الشكل' },
          { value: 'coarse_heterogeneous', en: 'Coarse heterogeneous', ar: 'خشنة غير متجانسة' },
          { value: 'fine_pleomorphic', en: 'Fine pleomorphic', ar: 'دقيقة متعددة الأشكال' },
          { value: 'fine_linear', en: 'Fine linear / branching', ar: 'دقيقة خطية / متفرعة' },
        ])}
        {selectField(tr('توزيع التكلسات', 'Calcification Distribution'), biCalcDistribution, setBiCalcDistribution, [
          { value: 'diffuse', en: 'Diffuse', ar: 'منتشر' },
          { value: 'regional', en: 'Regional', ar: 'إقليمي' },
          { value: 'grouped', en: 'Grouped / Clustered', ar: 'مجمع / عنقودي' },
          { value: 'linear', en: 'Linear', ar: 'خطي' },
          { value: 'segmental', en: 'Segmental', ar: 'قطعي' },
        ])}
      </div>

      {/* Associated features */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          {tr('سمات مصاحبة', 'Associated Features')}
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'architectural_distortion', en: 'Architectural Distortion', ar: 'تشوه معماري' },
            { value: 'skin_retraction', en: 'Skin Retraction', ar: 'انكماش الجلد' },
            { value: 'skin_thickening', en: 'Skin Thickening', ar: 'سماكة الجلد' },
            { value: 'axillary_adenopathy', en: 'Axillary Adenopathy', ar: 'تضخم العقد الإبطية' },
            { value: 'nipple_retraction', en: 'Nipple Retraction', ar: 'انكماش الحلمة' },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setBiAssociatedFeatures((prev) =>
                  prev.includes(f.value) ? prev.filter((x) => x !== f.value) : [...prev, f.value]
                );
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                biAssociatedFeatures.includes(f.value)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
              }`}
            >
              {language === 'ar' ? f.ar : f.en}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      {selectField(tr('التصنيف BI-RADS', 'BI-RADS Category'), biCategory, setBiCategory, BIRADS_CATEGORIES)}

      {biCategory && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
            {tr('التوصية:', 'Recommendation:')}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-400">{activeRecommendation}</p>
        </div>
      )}
    </div>
  );

  const renderLungRads = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">{tr('قالب Lung-RADS', 'Lung-RADS Template')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">{tr('حجم العقدة (مم)', 'Nodule Size (mm)')}</label>
          <Input
            type="number"
            value={lungNoduleSize}
            onChange={(e) => setLungNoduleSize(e.target.value)}
            placeholder="mm"
          />
        </div>
        {selectField(tr('نوع العقدة', 'Nodule Type'), lungNoduleType, setLungNoduleType, [
          { value: 'solid', en: 'Solid', ar: 'صلب' },
          { value: 'part_solid', en: 'Part-Solid', ar: 'شبه صلب' },
          { value: 'ground_glass', en: 'Ground-Glass', ar: 'زجاجي أرضي' },
        ])}
        {selectField(tr('التصنيف Lung-RADS', 'Lung-RADS Category'), lungCategory, setLungCategory, LUNG_RADS_CATEGORIES)}
      </div>
      {lungCategory && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
            {tr('التوصية:', 'Recommendation:')}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-400">{activeRecommendation}</p>
        </div>
      )}
    </div>
  );

  const renderTiRads = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">{tr('قالب TI-RADS', 'TI-RADS Template')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {selectField(tr('التركيب', 'Composition'), tiComposition, setTiComposition, TIRADS_COMPOSITION)}
        {selectField(tr('الصدى', 'Echogenicity'), tiEchogenicity, setTiEchogenicity, TIRADS_ECHOGENICITY)}
        {selectField(tr('الشكل', 'Shape'), tiShape, setTiShape, TIRADS_SHAPE)}
        {selectField(tr('الحدود', 'Margin'), tiMargin, setTiMargin, TIRADS_MARGIN)}
        {selectField(tr('البؤر الصدائية', 'Echogenic Foci'), tiFoci, setTiFoci, TIRADS_FOCI)}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">{tr('حجم العقدة (سم)', 'Nodule Size (cm)')}</label>
          <Input
            type="number"
            step="0.1"
            value={tiNoduleSize}
            onChange={(e) => setTiNoduleSize(e.target.value)}
            placeholder="cm"
          />
        </div>
      </div>

      {/* Score and category display */}
      <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-xl">
        <div>
          <span className="text-sm font-medium text-muted-foreground">{tr('النقاط:', 'Score:')}</span>
          <span className="text-lg font-bold text-foreground ms-2">{tiScore}</span>
        </div>
        <div>
          <span className="text-sm font-medium text-muted-foreground">{tr('التصنيف:', 'Category:')}</span>
          <Badge className="ms-2 text-sm">{language === 'ar' ? tiCategory.ar : tiCategory.en}</Badge>
        </div>
      </div>

      {tiRecommendation && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
            {tr('التوصية بناء على الحجم:', 'Size-based Recommendation:')}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-400">{tiRecommendation}</p>
        </div>
      )}
    </div>
  );

  const renderPiRads = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">{tr('قالب PI-RADS', 'PI-RADS Template')}</h3>
      {selectField(tr('التصنيف PI-RADS', 'PI-RADS Category'), piCategory, setPiCategory, [
        { value: '1', en: '1 - Very Low (clinically significant cancer is highly unlikely)', ar: '1 - منخفض جدا (احتمال السرطان ضعيف جدا)' },
        { value: '2', en: '2 - Low (clinically significant cancer is unlikely)', ar: '2 - منخفض (احتمال السرطان ضعيف)' },
        { value: '3', en: '3 - Intermediate (equivocal)', ar: '3 - متوسط (غير حاسم)' },
        { value: '4', en: '4 - High (clinically significant cancer is likely)', ar: '4 - مرتفع (احتمال السرطان مرجح)' },
        { value: '5', en: '5 - Very High (clinically significant cancer is highly likely)', ar: '5 - مرتفع جدا (احتمال السرطان مرجح جدا)' },
      ])}
    </div>
  );

  const renderLiRads = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">{tr('قالب LI-RADS', 'LI-RADS Template')}</h3>
      {selectField(tr('التصنيف LI-RADS', 'LI-RADS Category'), liCategory, setLiCategory, [
        { value: 'LR-NC', en: 'LR-NC - Non-categorizable', ar: 'LR-NC - غير قابل للتصنيف' },
        { value: 'LR-1', en: 'LR-1 - Definitely Benign', ar: 'LR-1 - حميد بالتأكيد' },
        { value: 'LR-2', en: 'LR-2 - Probably Benign', ar: 'LR-2 - حميد على الأرجح' },
        { value: 'LR-3', en: 'LR-3 - Intermediate Probability', ar: 'LR-3 - احتمال متوسط' },
        { value: 'LR-4', en: 'LR-4 - Probably HCC', ar: 'LR-4 - على الأرجح سرطان كبدي' },
        { value: 'LR-5', en: 'LR-5 - Definitely HCC', ar: 'LR-5 - سرطان كبدي مؤكد' },
        { value: 'LR-M', en: 'LR-M - Probably or Definitely Malignant', ar: 'LR-M - خبيث على الأرجح أو مؤكد' },
        { value: 'LR-TIV', en: 'LR-TIV - Tumor in Vein', ar: 'LR-TIV - ورم في الوريد' },
      ])}
    </div>
  );

  return (
    <div className="space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Patient info banner */}
      {patientName && (
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-xl text-sm">
          <span className="font-medium text-foreground">{patientName}</span>
          {mrn && <span className="text-muted-foreground">MRN: {mrn}</span>}
          {modality && <Badge className="text-xs">{modality}</Badge>}
        </div>
      )}

      {/* Template selector */}
      <Card className="p-4 space-y-3">
        <label className="text-sm font-semibold text-foreground">
          {tr('نوع التقرير', 'Report Template')}
        </label>
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'FREE_TEXT' as const, ar: 'نص حر', en: 'Free Text' },
            { key: 'BI_RADS' as const, ar: 'BI-RADS (الثدي)', en: 'BI-RADS (Breast)' },
            { key: 'LUNG_RADS' as const, ar: 'Lung-RADS', en: 'Lung-RADS' },
            { key: 'TI_RADS' as const, ar: 'TI-RADS (الدرقية)', en: 'TI-RADS (Thyroid)' },
            { key: 'PI_RADS' as const, ar: 'PI-RADS (البروستات)', en: 'PI-RADS (Prostate)' },
            { key: 'LI_RADS' as const, ar: 'LI-RADS (الكبد)', en: 'LI-RADS (Liver)' },
          ]).map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={reportType === t.key ? 'default' : 'outline'}
              onClick={() => setReportType(t.key)}
              className="text-xs"
            >
              {tr(t.ar, t.en)}
            </Button>
          ))}
        </div>
      </Card>

      {/* Template-specific fields */}
      <Card className="p-4">
        {reportType === 'BI_RADS' && renderBiRads()}
        {reportType === 'LUNG_RADS' && renderLungRads()}
        {reportType === 'TI_RADS' && renderTiRads()}
        {reportType === 'PI_RADS' && renderPiRads()}
        {reportType === 'LI_RADS' && renderLiRads()}
        {reportType === 'FREE_TEXT' && (
          <p className="text-sm text-muted-foreground">
            {tr('تقرير نص حر بدون قالب محدد', 'Free text report without a specific template')}
          </p>
        )}
      </Card>

      {/* Common fields */}
      <Card className="p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {tr('المعلومات السريرية', 'Clinical Information')}
          </label>
          <Textarea
            value={clinicalInfo}
            onChange={(e) => setClinicalInfo(e.target.value)}
            rows={2}
            placeholder={tr('المعلومات السريرية ودواعي الفحص...', 'Clinical information and indication...')}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {tr('دراسات مقارنة', 'Comparison Studies')}
          </label>
          <Input
            value={comparisonStudies}
            onChange={(e) => setComparisonStudies(e.target.value)}
            placeholder={tr('دراسات سابقة للمقارنة...', 'Prior studies for comparison...')}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {tr('النتائج', 'Findings')} *
          </label>
          <Textarea
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            rows={6}
            placeholder={tr('اكتب نتائج الفحص...', 'Enter examination findings...')}
            className="text-sm font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {tr('الانطباع', 'Impression')} *
          </label>
          <Textarea
            value={impression}
            onChange={(e) => setImpression(e.target.value)}
            rows={3}
            placeholder={tr('الخلاصة والتوصيات...', 'Summary and recommendations...')}
            className="text-sm font-mono"
          />
        </div>

        {/* Critical finding toggle */}
        <div className="flex items-center gap-3 p-3 border rounded-xl bg-red-50 dark:bg-red-950/20">
          <button
            type="button"
            onClick={() => setCriticalFinding((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              criticalFinding ? 'bg-red-600' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
                criticalFinding ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className={`h-4 w-4 ${criticalFinding ? 'text-red-600' : 'text-muted-foreground'}`} />
            <span
              className={`text-sm font-medium ${
                criticalFinding ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'
              }`}
            >
              {tr('نتيجة حرجة - تتطلب إبلاغا فوريا', 'Critical Finding - Requires Immediate Notification')}
            </span>
          </div>
        </div>
      </Card>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => handleSave('DRAFT')} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" />
          {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ مسودة', 'Save Draft')}
        </Button>
        <Button
          onClick={() => handleSave('FINAL')}
          disabled={saving || (!findings.trim() && !impression.trim())}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
        >
          <CheckCircle2 className="h-4 w-4" />
          {saving ? tr('جاري الإصدار...', 'Issuing...') : tr('إصدار التقرير النهائي', 'Issue Final Report')}
        </Button>
      </div>
    </div>
  );
}
