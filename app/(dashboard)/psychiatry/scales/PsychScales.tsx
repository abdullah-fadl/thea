'use client';

import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import useSWR from 'swr';
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  ClipboardList,
  BarChart3,
  Plus,
  TrendingUp,
  Calendar,
  Activity,
  User,
} from 'lucide-react';
import {
  SCALE_DEFINITIONS,
  SCALE_KEYS,
  type ScaleDefinition,
  type ScaleItem,
} from '@/lib/psychiatry/scaleDefinitions';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface Administration {
  id: string;
  patientMasterId: string;
  scaleType: string;
  scaleName: string;
  totalScore: number;
  severityLevel: string;
  severityLabel: string;
  administeredByName?: string;
  administeredAt: string;
  clinicianNotes?: string;
  responses?: any[];
  subscaleScores?: { subscale: string; score: number }[];
  status: string;
}

function severityColor(level: string | undefined): string {
  if (!level) return 'bg-muted text-foreground';
  const l = level.toUpperCase();
  if (l === 'NONE' || l === 'MINIMAL' || l === 'LOW_RISK' || l === 'BELOW_THRESHOLD')
    return 'bg-green-100 text-green-800';
  if (l === 'MILD' || l === 'HAZARDOUS')
    return 'bg-yellow-100 text-yellow-800';
  if (l === 'MODERATE' || l === 'HARMFUL' || l === 'MARKED')
    return 'bg-orange-100 text-orange-800';
  if (l === 'MODERATELY_SEVERE')
    return 'bg-orange-200 text-orange-900';
  if (l === 'SEVERE' || l === 'DEPENDENCE' || l === 'ABOVE_THRESHOLD')
    return 'bg-red-100 text-red-800';
  return 'bg-muted text-foreground';
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function PsychScales() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // ---- State ----
  const [activeScaleTab, setActiveScaleTab] = useState<string>('PHQ9');
  const [showAdminister, setShowAdminister] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const [trendPatientId, setTrendPatientId] = useState('');
  const [filterPatientId, setFilterPatientId] = useState('');

  // ---- Data ----
  const queryParams = new URLSearchParams();
  if (filterPatientId) queryParams.set('patientMasterId', filterPatientId);
  const { data, mutate, isLoading } = useSWR(
    `/api/psychiatry/scales?${queryParams.toString()}`,
    fetcher,
  );
  const allAdministrations: Administration[] = data?.administrations ?? [];

  // ---- Computed KPIs ----
  const totalAdministrations = allAdministrations.length;

  const phq9Scores = allAdministrations
    .filter((a) => a.scaleType === 'PHQ9')
    .map((a) => a.totalScore);
  const phq9Avg =
    phq9Scores.length > 0
      ? (phq9Scores.reduce((s, v) => s + v, 0) / phq9Scores.length).toFixed(1)
      : '--';

  const gad7Scores = allAdministrations
    .filter((a) => a.scaleType === 'GAD7')
    .map((a) => a.totalScore);
  const gad7Avg =
    gad7Scores.length > 0
      ? (gad7Scores.reduce((s, v) => s + v, 0) / gad7Scores.length).toFixed(1)
      : '--';

  const now = new Date();
  const thisMonth = allAdministrations.filter((a) => {
    const d = new Date(a.administeredAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // ---- Filtered by active tab ----
  const filteredByScale = allAdministrations.filter(
    (a) => a.scaleType === activeScaleTab,
  );

  // ---- Trend data for a patient ----
  const trendData = useMemo(() => {
    if (!trendPatientId) return [];
    return allAdministrations
      .filter(
        (a) =>
          a.patientMasterId === trendPatientId && a.scaleType === activeScaleTab,
      )
      .sort(
        (a, b) =>
          new Date(a.administeredAt).getTime() - new Date(b.administeredAt).getTime(),
      );
  }, [allAdministrations, trendPatientId, activeScaleTab]);

  // ---- Active scale definition ----
  const activeDefinition = SCALE_DEFINITIONS[activeScaleTab];

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ---- Header ---- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          {tr('\u0645\u062d\u0631\u0643 \u0627\u0644\u0645\u0642\u0627\u064a\u064a\u0633 \u0627\u0644\u0646\u0641\u0633\u064a\u0629', 'Psychometric Scales Engine')}
        </h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder={tr('\u062a\u0635\u0641\u064a\u0629 \u0628\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u064a\u0636', 'Filter by Patient ID')}
            value={filterPatientId}
            onChange={(e) => setFilterPatientId(e.target.value)}
            className="w-48"
          />
          <Button onClick={() => setShowAdminister(true)}>
            <Plus className="h-4 w-4 me-1" />
            {tr('\u0625\u062c\u0631\u0627\u0621 \u0645\u0642\u064a\u0627\u0633', 'Administer Scale')}
          </Button>
        </div>
      </div>

      {/* ---- KPI Cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {tr('\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062a\u0642\u064a\u064a\u0645\u0627\u062a', 'Total Administrations')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAdministrations}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" />
              {tr('\u0645\u062a\u0648\u0633\u0637 PHQ-9', 'PHQ-9 Avg Score')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{phq9Avg}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {tr('\u0645\u062a\u0648\u0633\u0637 GAD-7', 'GAD-7 Avg Score')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{gad7Avg}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {tr('\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631', 'This Month')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{thisMonth}</p>
          </CardContent>
        </Card>
      </div>

      {/* ---- Scale Tabs ---- */}
      <Tabs value={activeScaleTab} onValueChange={setActiveScaleTab}>
        <TabsList className="flex-wrap">
          {SCALE_KEYS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {key.replace(/(\d)/, '-$1')}
            </TabsTrigger>
          ))}
        </TabsList>

        {SCALE_KEYS.map((scaleKey) => {
          const def = SCALE_DEFINITIONS[scaleKey];
          const scaleData = allAdministrations.filter((a) => a.scaleType === scaleKey);

          return (
            <TabsContent key={scaleKey} value={scaleKey}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    {language === 'ar' ? def.nameAr : def.nameEn}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? def.descriptionAr : def.descriptionEn}
                  </p>
                </CardHeader>
                <CardContent>
                  {scaleData.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      {tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0642\u064a\u064a\u0645\u0627\u062a \u0628\u0639\u062f', 'No administrations yet')}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-start p-2">{tr('\u0627\u0644\u062a\u0627\u0631\u064a\u062e', 'Date')}</th>
                            <th className="text-start p-2">{tr('\u0627\u0644\u0645\u0631\u064a\u0636', 'Patient')}</th>
                            <th className="text-start p-2">{tr('\u0627\u0644\u062f\u0631\u062c\u0629', 'Score')}</th>
                            <th className="text-start p-2">{tr('\u0627\u0644\u0634\u062f\u0629', 'Severity')}</th>
                            <th className="text-start p-2">{tr('\u0627\u0644\u0637\u0628\u064a\u0628', 'Clinician')}</th>
                            <th className="text-start p-2">{tr('\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a', 'Actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scaleData.map((admin) => (
                            <tr key={admin.id} className="border-b hover:bg-muted/50">
                              <td className="p-2">
                                {new Date(admin.administeredAt).toLocaleDateString(
                                  language === 'ar' ? 'ar-SA' : 'en-US',
                                  { year: 'numeric', month: 'short', day: 'numeric' },
                                )}
                              </td>
                              <td className="p-2 font-mono text-xs">
                                {admin.patientMasterId.slice(0, 8)}...
                              </td>
                              <td className="p-2 font-bold">
                                {admin.totalScore} / {def.maxTotal}
                              </td>
                              <td className="p-2">
                                <Badge className={severityColor(admin.severityLevel)}>
                                  {admin.severityLabel || admin.severityLevel}
                                </Badge>
                              </td>
                              <td className="p-2">{admin.administeredByName || '--'}</td>
                              <td className="p-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setTrendPatientId(admin.patientMasterId);
                                    setShowTrend(true);
                                  }}
                                >
                                  <TrendingUp className="h-4 w-4 me-1" />
                                  {tr('\u0627\u0644\u0627\u062a\u062c\u0627\u0647', 'Trend')}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* ---- Administer Dialog ---- */}
      {showAdminister && (
        <AdministerDialog
          language={language}
          tr={tr}
          toast={toast}
          onClose={() => setShowAdminister(false)}
          onSuccess={() => {
            setShowAdminister(false);
            mutate();
          }}
        />
      )}

      {/* ---- Trend Dialog ---- */}
      {showTrend && (
        <TrendDialog
          language={language}
          tr={tr}
          patientId={trendPatientId}
          scaleKey={activeScaleTab}
          data={trendData}
          definition={activeDefinition}
          onClose={() => setShowTrend(false)}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Administer Dialog                                                  */
/* ================================================================== */

function AdministerDialog({
  language,
  tr,
  toast,
  onClose,
  onSuccess,
}: {
  language: string;
  tr: (ar: string, en: string) => string;
  toast: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedScale, setSelectedScale] = useState<string>('PHQ9');
  const [patientId, setPatientId] = useState('');
  const [responses, setResponses] = useState<(number | null)[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const definition = SCALE_DEFINITIONS[selectedScale];

  // Reset responses when scale changes
  const handleScaleChange = useCallback(
    (val: string) => {
      setSelectedScale(val);
      const def = SCALE_DEFINITIONS[val];
      setResponses(new Array(def.items.length).fill(null));
    },
    [],
  );

  // Initialize responses
  useState(() => {
    setResponses(new Array(definition.items.length).fill(null));
  });

  const handleResponse = useCallback(
    (itemIdx: number, value: number) => {
      setResponses((prev) => {
        const next = [...prev];
        next[itemIdx] = value;
        return next;
      });
    },
    [],
  );

  // Running total
  const answeredResponses = responses.filter((r) => r !== null) as number[];
  const runningTotal = answeredResponses.reduce((s, v) => s + v, 0);
  const allAnswered = responses.every((r) => r !== null);

  // Live severity
  const liveSeverity = useMemo(() => {
    if (!allAnswered) return null;
    return definition.getSeverity(runningTotal);
  }, [allAnswered, runningTotal, definition]);

  const handleSubmit = async () => {
    if (!patientId.trim()) {
      toast({ title: tr('\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u064a\u0636 \u0645\u0637\u0644\u0648\u0628', 'Patient ID is required'), variant: 'destructive' });
      return;
    }
    if (!allAnswered) {
      toast({ title: tr('\u064a\u0631\u062c\u0649 \u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0639\u0644\u0649 \u062c\u0645\u064a\u0639 \u0627\u0644\u0639\u0646\u0627\u0635\u0631', 'Please answer all items'), variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const structuredResponses = definition.items.map((item, idx) => ({
        itemNumber: item.number,
        responseValue: responses[idx],
      }));

      const res = await fetch('/api/psychiatry/scales', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId: patientId.trim(),
          scaleType: selectedScale,
          responses: structuredResponses,
          clinicianNotes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error || tr('\u062d\u062f\u062b \u062e\u0637\u0623', 'Error occurred'), variant: 'destructive' });
        return;
      }

      const result = await res.json();
      toast({
        title: tr('\u062a\u0645 \u0625\u062c\u0631\u0627\u0621 \u0627\u0644\u0645\u0642\u064a\u0627\u0633 \u0628\u0646\u062c\u0627\u062d', 'Scale administered successfully'),
        description: `${tr('\u0627\u0644\u062f\u0631\u062c\u0629', 'Score')}: ${result.scoring.totalScore} - ${language === 'ar' ? result.scoring.severityLabelAr : result.scoring.severityLabel}`,
      });
      onSuccess();
    } catch {
      toast({ title: tr('\u062d\u062f\u062b \u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u062a\u0648\u0642\u0639', 'Unexpected error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {tr('\u0625\u062c\u0631\u0627\u0621 \u0645\u0642\u064a\u0627\u0633 \u0646\u0641\u0633\u064a', 'Administer Psychometric Scale')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scale Type + Patient ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{tr('\u0646\u0648\u0639 \u0627\u0644\u0645\u0642\u064a\u0627\u0633', 'Scale Type')}</Label>
              <Select value={selectedScale} onValueChange={handleScaleChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCALE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {language === 'ar'
                        ? SCALE_DEFINITIONS[key].nameAr
                        : SCALE_DEFINITIONS[key].nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u064a\u0636', 'Patient ID')}</Label>
              <Input
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder={tr('\u0623\u062f\u062e\u0644 \u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u064a\u0636', 'Enter patient ID')}
              />
            </div>
          </div>

          {/* Scale description */}
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
            {language === 'ar' ? definition.descriptionAr : definition.descriptionEn}
          </p>

          {/* Running Score + Severity */}
          <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {tr('\u0627\u0644\u062f\u0631\u062c\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629', 'Running Score')}:
              </span>
              <span className="text-xl font-bold text-blue-900 dark:text-blue-100">
                {runningTotal} / {definition.maxTotal}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {tr('\u0627\u0644\u0634\u062f\u0629', 'Severity')}:
              </span>
              {liveSeverity ? (
                <Badge className={severityColor(liveSeverity.level)}>
                  {language === 'ar' ? liveSeverity.labelAr : liveSeverity.labelEn}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {tr('\u0623\u0643\u0645\u0644 \u062c\u0645\u064a\u0639 \u0627\u0644\u0639\u0646\u0627\u0635\u0631', 'Complete all items')}
                </span>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {definition.items.map((item, idx) => (
              <ScaleItemCard
                key={item.number}
                item={item}
                index={idx}
                value={responses[idx]}
                onChange={handleResponse}
                language={language}
                tr={tr}
              />
            ))}
          </div>

          {/* Clinician Notes */}
          <div>
            <Label>{tr('\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u0637\u0628\u064a\u0628', 'Clinician Notes')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tr('\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u062e\u062a\u064a\u0627\u0631\u064a\u0629...', 'Optional notes...')}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {tr('\u0625\u0644\u063a\u0627\u0621', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !allAnswered}>
            {submitting
              ? tr('\u062c\u0627\u0631\u064a \u0627\u0644\u062d\u0641\u0638...', 'Saving...')
              : tr('\u062d\u0641\u0638 \u0648\u062a\u0642\u064a\u064a\u0645', 'Save & Score')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/*  Scale Item Card                                                    */
/* ================================================================== */

function ScaleItemCard({
  item,
  index,
  value,
  onChange,
  language,
  tr,
}: {
  item: ScaleItem;
  index: number;
  value: number | null;
  onChange: (index: number, value: number) => void;
  language: string;
  tr: (ar: string, en: string) => string;
}) {
  const isAnswered = value !== null;

  return (
    <div
      className={`border rounded-lg p-4 transition-colors ${
        isAnswered ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-background'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
          {item.number}
        </span>
        <p className="text-sm font-medium leading-relaxed">
          {language === 'ar' ? item.textAr : item.textEn}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 ms-10">
        {item.options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(index, option.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background text-foreground border-border hover:bg-muted'
              }`}
            >
              {language === 'ar' ? option.labelAr : option.labelEn}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Trend Dialog                                                       */
/* ================================================================== */

function TrendDialog({
  language,
  tr,
  patientId,
  scaleKey,
  data,
  definition,
  onClose,
}: {
  language: string;
  tr: (ar: string, en: string) => string;
  patientId: string;
  scaleKey: string;
  data: Administration[];
  definition: ScaleDefinition;
  onClose: () => void;
}) {
  // Calculate the max score for the bar chart scale
  const maxScore = definition.maxTotal;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {tr('\u0627\u062a\u062c\u0627\u0647 \u0627\u0644\u062f\u0631\u062c\u0627\u062a', 'Score Trend')} - {scaleKey.replace(/(\d)/, '-$1')}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {tr('\u0627\u0644\u0645\u0631\u064a\u0636', 'Patient')}: {patientId.slice(0, 8)}...
          </p>
        </DialogHeader>

        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0631\u064a\u0636', 'No data for this patient')}
          </p>
        ) : (
          <div className="space-y-4">
            {/* Visual Bar Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {tr('\u0627\u0644\u062f\u0631\u062c\u0627\u062a \u0639\u0628\u0631 \u0627\u0644\u0632\u0645\u0646', 'Scores Over Time')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.map((admin) => {
                    const pct = maxScore > 0 ? (admin.totalScore / maxScore) * 100 : 0;
                    return (
                      <div key={admin.id} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                          {new Date(admin.administeredAt).toLocaleDateString(
                            language === 'ar' ? 'ar-SA' : 'en-US',
                            { month: 'short', day: 'numeric' },
                          )}
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-5 relative overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct <= 25
                                ? 'bg-green-500'
                                : pct <= 50
                                  ? 'bg-yellow-500'
                                  : pct <= 75
                                    ? 'bg-orange-500'
                                    : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                            {admin.totalScore}
                          </span>
                        </div>
                        <Badge className={`text-xs flex-shrink-0 ${severityColor(admin.severityLevel)}`}>
                          {admin.severityLabel || admin.severityLevel}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* History Table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {tr('\u0633\u062c\u0644 \u0627\u0644\u062a\u0642\u064a\u064a\u0645\u0627\u062a', 'Administration History')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-start p-2">{tr('\u0627\u0644\u062a\u0627\u0631\u064a\u062e', 'Date')}</th>
                        <th className="text-start p-2">{tr('\u0627\u0644\u062f\u0631\u062c\u0629', 'Score')}</th>
                        <th className="text-start p-2">{tr('\u0627\u0644\u0634\u062f\u0629', 'Severity')}</th>
                        <th className="text-start p-2">{tr('\u0627\u0644\u0637\u0628\u064a\u0628', 'Clinician')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((admin) => (
                        <tr key={admin.id} className="border-b">
                          <td className="p-2">
                            {new Date(admin.administeredAt).toLocaleDateString(
                              language === 'ar' ? 'ar-SA' : 'en-US',
                              { year: 'numeric', month: 'short', day: 'numeric' },
                            )}
                          </td>
                          <td className="p-2 font-bold">
                            {admin.totalScore} / {maxScore}
                          </td>
                          <td className="p-2">
                            <Badge className={severityColor(admin.severityLevel)}>
                              {admin.severityLabel || admin.severityLevel}
                            </Badge>
                          </td>
                          <td className="p-2">{admin.administeredByName || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tr('\u0625\u063a\u0644\u0627\u0642', 'Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
