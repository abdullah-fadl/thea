'use client';

import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';

// ---------------------------------------------------------------------------
// Bundle definitions
// ---------------------------------------------------------------------------

interface BundleItem {
  key: string;
  ar: string;
  en: string;
}

const VAP_ITEMS: BundleItem[] = [
  { key: 'hob_elevation', ar: 'رفع رأس السرير ≥30°', en: 'HOB elevation ≥30°' },
  { key: 'sedation_vacation', ar: 'إجازة تسكين يومية + SBT', en: 'Daily sedation vacation + SBT' },
  { key: 'oral_care', ar: 'عناية فموية بالكلورهيكسيدين', en: 'Oral care with chlorhexidine' },
  { key: 'dvt_prophylaxis', ar: 'وقاية من الخثار الوريدي العميق', en: 'DVT prophylaxis' },
  { key: 'peptic_ulcer_prophylaxis', ar: 'وقاية من القرحة الهضمية', en: 'Peptic ulcer prophylaxis' },
  { key: 'subglottic_suction', ar: 'شفط تحت المزمار', en: 'Subglottic suctioning' },
  { key: 'circuit_not_changed', ar: 'لم يتم تغيير دائرة التنفس روتينياً', en: 'Ventilator circuit not routinely changed' },
];

const CLABSI_ITEMS: BundleItem[] = [
  { key: 'hand_hygiene', ar: 'نظافة اليدين', en: 'Hand hygiene' },
  { key: 'max_barrier', ar: 'احتياطات الحاجز القصوى', en: 'Maximal barrier precautions' },
  { key: 'chlorhexidine', ar: 'تطهير الجلد بالكلورهيكسيدين', en: 'Chlorhexidine skin antisepsis' },
  { key: 'optimal_site', ar: 'موقع قسطرة مثالي', en: 'Optimal catheter site' },
  { key: 'daily_review', ar: 'مراجعة يومية لضرورة الخط', en: 'Daily review of line necessity' },
  { key: 'dressing_intact', ar: 'الضمادة نظيفة/جافة/سليمة', en: 'Dressing clean/dry/intact' },
];

const CAUTI_ITEMS: BundleItem[] = [
  { key: 'appropriate_indication', ar: 'مؤشر مناسب', en: 'Appropriate indication' },
  { key: 'aseptic_insertion', ar: 'إدخال معقم', en: 'Aseptic insertion' },
  { key: 'properly_secured', ar: 'مثبتة بشكل صحيح', en: 'Properly secured' },
  { key: 'bag_below_bladder', ar: 'كيس التصريف أسفل المثانة', en: 'Drainage bag below bladder' },
  { key: 'daily_necessity_review', ar: 'مراجعة يومية للضرورة', en: 'Daily review of necessity' },
];

const BUNDLE_MAP: Record<string, { items: BundleItem[]; total: number }> = {
  VAP: { items: VAP_ITEMS, total: 7 },
  CLABSI: { items: CLABSI_ITEMS, total: 6 },
  CAUTI: { items: CAUTI_ITEMS, total: 5 },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IcuBundleFormProps {
  episodeId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IcuBundleForm({ episodeId, onSuccess, onCancel }: IcuBundleFormProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('VAP');
  const [saving, setSaving] = useState(false);

  // Per-bundle-type state
  const [checkedItems, setCheckedItems] = useState<Record<string, Record<string, boolean>>>({
    VAP: {},
    CLABSI: {},
    CAUTI: {},
  });
  const [deviationNotes, setDeviationNotes] = useState<Record<string, string>>({
    VAP: '',
    CLABSI: '',
    CAUTI: '',
  });
  const [actionPlans, setActionPlans] = useState<Record<string, string>>({
    VAP: '',
    CLABSI: '',
    CAUTI: '',
  });
  const [lineInsertionDate, setLineInsertionDate] = useState('');
  const [plannedRemovalDate, setPlannedRemovalDate] = useState('');

  // Compute compliance for a bundle type
  const getCompliance = (type: string) => {
    const bundle = BUNDLE_MAP[type];
    if (!bundle) return { compliant: 0, total: 0, percent: 0 };
    const checks = checkedItems[type] || {};
    const compliant = bundle.items.filter((item) => checks[item.key]).length;
    const percent = bundle.total > 0 ? Math.round((compliant / bundle.total) * 100) : 0;
    return { compliant, total: bundle.total, percent };
  };

  const complianceColor = (pct: number) => {
    if (pct >= 90) return 'bg-green-500';
    if (pct >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const complianceBadgeVariant = (pct: number): 'default' | 'secondary' | 'destructive' => {
    if (pct >= 90) return 'default';
    if (pct >= 70) return 'secondary';
    return 'destructive';
  };

  const lineDays = useMemo(() => {
    if (!lineInsertionDate) return 0;
    const start = new Date(lineInsertionDate);
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [lineInsertionDate]);

  const catheterDays = useMemo(() => {
    if (!lineInsertionDate) return 0;
    const start = new Date(lineInsertionDate);
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [lineInsertionDate]);

  const toggleItem = (type: string, key: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [key]: !prev[type]?.[key],
      },
    }));
  };

  const handleSave = async (bundleType: string) => {
    const bundle = BUNDLE_MAP[bundleType];
    if (!bundle) return;

    setSaving(true);
    try {
      const elements = bundle.items.map((item) => ({
        key: item.key,
        label: tr(item.ar, item.en),
        compliant: !!checkedItems[bundleType]?.[item.key],
      }));

      const payload: any = {
        bundleType,
        elements,
        deviationNotes: deviationNotes[bundleType] || '',
        actionPlan: actionPlans[bundleType] || '',
      };

      if (bundleType === 'CLABSI' && lineInsertionDate) {
        payload.lineInsertionDate = lineInsertionDate;
      }
      if (bundleType === 'CAUTI' && plannedRemovalDate) {
        payload.plannedRemovalDate = plannedRemovalDate;
      }
      if (bundleType === 'CAUTI' && lineInsertionDate) {
        payload.lineInsertionDate = lineInsertionDate;
      }

      const res = await fetch(`/api/icu/episodes/${episodeId}/bundle-compliance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }

      toast({
        title: tr('تم الحفظ', 'Saved'),
        description: tr(
          `تم حفظ تدقيق ${bundleType} بنجاح`,
          `${bundleType} audit saved successfully`,
        ),
      });
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err.message || tr('فشل الحفظ', 'Save failed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Render a single bundle tab
  const renderChecklist = (type: string) => {
    const bundle = BUNDLE_MAP[type];
    if (!bundle) return null;
    const { compliant, total, percent } = getCompliance(type);

    return (
      <div className="space-y-4">
        {/* Compliance bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${complianceColor(percent)}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <Badge variant={complianceBadgeVariant(percent)}>
            {compliant}/{total} ({percent}%)
          </Badge>
        </div>

        {/* Checklist items */}
        <div className="space-y-2">
          {bundle.items.map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={!!checkedItems[type]?.[item.key]}
                onCheckedChange={() => toggleItem(type, item.key)}
              />
              <span className="text-sm">{tr(item.ar, item.en)}</span>
            </label>
          ))}
        </div>

        {/* CLABSI-specific: Line insertion date */}
        {type === 'CLABSI' && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Label className="text-sm font-medium">
                {tr('تاريخ إدخال الخط', 'Line insertion date')}
              </Label>
              <Input
                type="date"
                value={lineInsertionDate}
                onChange={(e) => setLineInsertionDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <div className="p-3 bg-muted rounded-lg w-full text-center">
                <span className="text-sm text-muted-foreground">
                  {tr('أيام الخط', 'Line days')}
                </span>
                <p className="text-lg font-bold">{lineDays}</p>
              </div>
            </div>
          </div>
        )}

        {/* CAUTI-specific: catheter dates */}
        {type === 'CAUTI' && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <Label className="text-sm font-medium">
                {tr('تاريخ إدخال القسطرة', 'Catheter insertion date')}
              </Label>
              <Input
                type="date"
                value={lineInsertionDate}
                onChange={(e) => setLineInsertionDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                {tr('تاريخ الإزالة المخطط', 'Planned removal date')}
              </Label>
              <Input
                type="date"
                value={plannedRemovalDate}
                onChange={(e) => setPlannedRemovalDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <div className="p-3 bg-muted rounded-lg w-full text-center">
                <span className="text-sm text-muted-foreground">
                  {tr('أيام القسطرة', 'Catheter days')}
                </span>
                <p className="text-lg font-bold">{catheterDays}</p>
              </div>
            </div>
          </div>
        )}

        {/* Deviation notes */}
        <div>
          <Label className="text-sm font-medium">
            {tr('ملاحظات الانحراف', 'Deviation notes')}
          </Label>
          <Textarea
            placeholder={tr('أي ملاحظات حول عدم الامتثال...', 'Any notes about non-compliance...')}
            value={deviationNotes[type] || ''}
            onChange={(e) =>
              setDeviationNotes((prev) => ({ ...prev, [type]: e.target.value }))
            }
            className="mt-1"
            rows={3}
          />
        </div>

        {/* Action plan */}
        <div>
          <Label className="text-sm font-medium">
            {tr('خطة العمل', 'Action plan')}
          </Label>
          <Textarea
            placeholder={tr(
              'خطة تصحيحية للعناصر غير المتوافقة...',
              'Corrective plan for non-compliant elements...',
            )}
            value={actionPlans[type] || ''}
            onChange={(e) =>
              setActionPlans((prev) => ({ ...prev, [type]: e.target.value }))
            }
            className="mt-1"
            rows={3}
          />
        </div>

        {/* Save */}
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              {tr('إلغاء', 'Cancel')}
            </Button>
          )}
          <Button onClick={() => handleSave(type)} disabled={saving}>
            {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التدقيق', 'Save Audit')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="VAP">
            {tr('VAP — ذات الرئة', 'VAP — Pneumonia')}
          </TabsTrigger>
          <TabsTrigger value="CLABSI">
            {tr('CLABSI — الخط المركزي', 'CLABSI — Central Line')}
          </TabsTrigger>
          <TabsTrigger value="CAUTI">
            {tr('CAUTI — قسطرة بولية', 'CAUTI — Catheter UTI')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="VAP" className="mt-4">
          <h3 className="font-semibold mb-3">
            {tr('حزمة الوقاية من ذات الرئة المرتبطة بالتنفس الصناعي', 'Ventilator-Associated Pneumonia Prevention Bundle')}
          </h3>
          {renderChecklist('VAP')}
        </TabsContent>

        <TabsContent value="CLABSI" className="mt-4">
          <h3 className="font-semibold mb-3">
            {tr('حزمة الوقاية من عدوى الخط المركزي', 'Central Line-Associated Bloodstream Infection Prevention Bundle')}
          </h3>
          {renderChecklist('CLABSI')}
        </TabsContent>

        <TabsContent value="CAUTI" className="mt-4">
          <h3 className="font-semibold mb-3">
            {tr('حزمة الوقاية من عدوى المسالك البولية المرتبطة بالقسطرة', 'Catheter-Associated Urinary Tract Infection Prevention Bundle')}
          </h3>
          {renderChecklist('CAUTI')}
        </TabsContent>
      </Tabs>
    </div>
  );
}
