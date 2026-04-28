'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Flame, Beef, Droplets, TrendingUp, CalendarDays, Plus,
  Trash2, Search, Users, Utensils, BarChart3, Microscope,
  ChevronRight, AlertCircle, Target,
} from 'lucide-react';

import {
  MEAL_CATEGORY_MAP,
} from '@/lib/nutrition/dietCatalogDefinitions';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface IntakeItem {
  name: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface CalorieIntakeRecord {
  id: string;
  tenantId: string;
  patientMasterId: string;
  recordDate: string;
  mealType: string;
  items: IntakeItem[];
  totalCalories: number;
  totalProtein: number | null;
  totalCarbs: number | null;
  totalFat: number | null;
  intakePercent: number | null;
  fluidIntake: number | null;
  recordedBy: string;
  notes: string | null;
  createdAt: string;
}

interface DailySummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFluid: number;
  meals: Record<string, number>;
  recordCount: number;
}

interface CatalogItem {
  id: string;
  name: string;
  nameAr: string | null;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  servingSize: string | null;
  category: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MEAL_TYPES: { key: string; ar: string; en: string }[] = [
  { key: 'BREAKFAST', ar: 'فطور',               en: 'Breakfast' },
  { key: 'LUNCH',     ar: 'غداء',               en: 'Lunch' },
  { key: 'DINNER',    ar: 'عشاء',               en: 'Dinner' },
  { key: 'SNACK_AM',  ar: 'وجبة خفيفة صباحية',  en: 'AM Snack' },
  { key: 'SNACK_PM',  ar: 'وجبة خفيفة مسائية',  en: 'PM Snack' },
];

const MEAL_ORDER = ['BREAKFAST', 'SNACK_AM', 'LUNCH', 'SNACK_PM', 'DINNER'];

const DAILY_CALORIE_TARGET = 2000;
const DAILY_PROTEIN_TARGET = 50;
const DAILY_FLUID_TARGET = 2000; // mL

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getWeekAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function getMealLabel(key: string, tr: (ar: string, en: string) => string): string {
  const mt = MEAL_TYPES.find(m => m.key === key);
  return mt ? tr(mt.ar, mt.en) : key;
}

function getIntakeColor(pct: number): string {
  if (pct >= 90) return 'text-green-700 bg-green-100';
  if (pct >= 70) return 'text-yellow-700 bg-yellow-100';
  return 'text-red-700 bg-red-100';
}

function getIntakeBg(pct: number): string {
  if (pct >= 90) return 'bg-green-500';
  if (pct >= 70) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function CalorieIntake() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const { toast } = useToast();

  // ─── State ────────────────────────────────────────────────────
  const [patientId, setPatientId] = useState('');
  const [activeTab, setActiveTab] = useState<'daily' | 'trends' | 'analysis'>('daily');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Record form state
  const [formMealType, setFormMealType] = useState('BREAKFAST');
  const [formItems, setFormItems] = useState<IntakeItem[]>([]);
  const [formIntakePercent, setFormIntakePercent] = useState('100');
  const [formFluidIntake, setFormFluidIntake] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');

  // Analysis date range
  const [analysisStart, setAnalysisStart] = useState(getWeekAgoISO());
  const [analysisEnd, setAnalysisEnd] = useState(todayISO());

  // ─── Data Fetching ────────────────────────────────────────────

  // Daily records for selected date
  const dailyUrl = patientId
    ? `/api/nutrition/calorie-intake?patientMasterId=${patientId}&startDate=${selectedDate}&endDate=${selectedDate}`
    : null;
  const { data: dailyData, mutate: mutateDailyData, isLoading: dailyLoading } = useSWR<{ records: CalorieIntakeRecord[] }>(
    dailyUrl,
    fetcher
  );
  const dailyRecords = dailyData?.records ?? [];

  // 7-day summary for trends
  const trendUrl = patientId
    ? `/api/nutrition/calorie-intake?patientMasterId=${patientId}&startDate=${getWeekAgoISO()}&endDate=${todayISO()}&summary=true`
    : null;
  const { data: trendData, isLoading: trendLoading } = useSWR<{ summary: DailySummary[]; records: CalorieIntakeRecord[] }>(
    trendUrl,
    fetcher
  );
  const trendSummary = trendData?.summary ?? [];

  // Analysis range
  const analysisUrl = patientId
    ? `/api/nutrition/calorie-intake?patientMasterId=${patientId}&startDate=${analysisStart}&endDate=${analysisEnd}&summary=true`
    : null;
  const { data: analysisData, isLoading: analysisLoading } = useSWR<{ summary: DailySummary[]; records: CalorieIntakeRecord[] }>(
    analysisUrl,
    fetcher
  );
  const analysisRecords = analysisData?.records ?? [];
  const analysisSummary = analysisData?.summary ?? [];

  // Diet catalog for searching
  const catalogUrl = catalogSearch.trim().length >= 2
    ? `/api/nutrition/diet-catalog?search=${encodeURIComponent(catalogSearch.trim())}&isAvailable=true`
    : null;
  const { data: catalogData } = useSWR<{ items: CatalogItem[] }>(
    catalogUrl,
    fetcher
  );
  const catalogItems = catalogData?.items ?? [];

  // ─── Computed KPIs ────────────────────────────────────────────

  const todayKPIs = useMemo(() => {
    const todayRecs = dailyRecords.filter(
      r => (typeof r.recordDate === 'string' ? r.recordDate.slice(0, 10) : new Date(r.recordDate).toISOString().slice(0, 10)) === selectedDate
    );
    const totalCal = todayRecs.reduce((sum, r) => sum + (r.totalCalories ?? 0), 0);
    const totalProtein = todayRecs.reduce((sum, r) => sum + (r.totalProtein ?? 0), 0);
    const totalFluid = todayRecs.reduce((sum, r) => sum + (r.fluidIntake ?? 0), 0);

    // 7-day average
    const sevenDayTotal = trendSummary.reduce((sum, d) => sum + d.totalCalories, 0);
    const sevenDayAvg = trendSummary.length > 0 ? Math.round(sevenDayTotal / trendSummary.length) : 0;

    return {
      totalCal,
      totalProtein: Math.round(totalProtein * 10) / 10,
      totalFluid,
      sevenDayAvg,
      calPct: Math.round((totalCal / DAILY_CALORIE_TARGET) * 100),
      proteinPct: Math.round((totalProtein / DAILY_PROTEIN_TARGET) * 100),
      fluidPct: Math.round((totalFluid / DAILY_FLUID_TARGET) * 100),
    };
  }, [dailyRecords, trendSummary, selectedDate]);

  // Group daily records by meal type
  const mealGroups = useMemo(() => {
    const groups: Record<string, CalorieIntakeRecord[]> = {};
    for (const mt of MEAL_ORDER) {
      groups[mt] = [];
    }
    for (const rec of dailyRecords) {
      const mt = rec.mealType ?? 'OTHER';
      if (!groups[mt]) groups[mt] = [];
      groups[mt].push(rec);
    }
    return groups;
  }, [dailyRecords]);

  // ─── Form Helpers ─────────────────────────────────────────────

  const resetRecordForm = useCallback(() => {
    setFormMealType('BREAKFAST');
    setFormItems([]);
    setFormIntakePercent('100');
    setFormFluidIntake('');
    setFormNotes('');
    setCatalogSearch('');
  }, []);

  const addBlankItem = useCallback(() => {
    setFormItems(prev => [...prev, { name: '', quantity: 1, calories: 0, protein: 0, carbs: 0, fat: 0 }]);
  }, []);

  const addCatalogItem = useCallback((item: CatalogItem) => {
    setFormItems(prev => [...prev, {
      name: language === 'ar' ? (item.nameAr || item.name) : item.name,
      quantity: 1,
      calories: item.calories ?? 0,
      protein: item.protein ?? 0,
      carbs: item.carbohydrates ?? 0,
      fat: item.fat ?? 0,
    }]);
    setCatalogSearch('');
  }, [language]);

  const updateItem = useCallback((index: number, field: keyof IntakeItem, value: string | number) => {
    setFormItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setFormItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Running total for dialog
  const runningTotal = useMemo(() => {
    return formItems.reduce(
      (acc, item) => {
        const q = Number(item.quantity) || 1;
        return {
          calories: acc.calories + (Number(item.calories) || 0) * q,
          protein: acc.protein + (Number(item.protein) || 0) * q,
          carbs: acc.carbs + (Number(item.carbs) || 0) * q,
          fat: acc.fat + (Number(item.fat) || 0) * q,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [formItems]);

  // ─── Actions ──────────────────────────────────────────────────

  const handleRecordMeal = useCallback(async () => {
    if (!patientId.trim()) {
      toast({ title: tr('يرجى إدخال رقم المريض', 'Please enter patient ID'), variant: 'destructive' });
      return;
    }
    if (formItems.length === 0) {
      toast({ title: tr('يرجى إضافة عنصر واحد على الأقل', 'Please add at least one item'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/nutrition/calorie-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientMasterId: patientId.trim(),
          recordDate: selectedDate,
          mealType: formMealType,
          items: formItems,
          intakePercent: formIntakePercent ? Number(formIntakePercent) : null,
          fluidIntake: formFluidIntake ? Number(formFluidIntake) : null,
          notes: formNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      toast({ title: tr('تم تسجيل الوجبة', 'Meal recorded') });
      mutateDailyData();
      setShowRecordDialog(false);
      resetRecordForm();
    } catch (e: any) {
      toast({ title: e?.message || tr('حدث خطأ', 'An error occurred'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [patientId, selectedDate, formMealType, formItems, formIntakePercent, formFluidIntake, formNotes, mutateDailyData, resetRecordForm, toast, tr]);

  // ─── Analysis computations ────────────────────────────────────

  const analysisKPIs = useMemo(() => {
    if (analysisSummary.length === 0) {
      return { avgCal: 0, avgProtein: 0, avgCarbs: 0, avgFat: 0, carbsPct: 0, proteinPct: 0, fatPct: 0, topItems: [] as { name: string; count: number }[] };
    }
    const days = analysisSummary.length;
    const avgCal = Math.round(analysisSummary.reduce((s, d) => s + d.totalCalories, 0) / days);
    const avgProtein = Math.round(analysisSummary.reduce((s, d) => s + d.totalProtein, 0) / days * 10) / 10;
    const avgCarbs = Math.round(analysisSummary.reduce((s, d) => s + d.totalCarbs, 0) / days * 10) / 10;
    const avgFat = Math.round(analysisSummary.reduce((s, d) => s + d.totalFat, 0) / days * 10) / 10;

    // Macro split by calories: 1g protein = 4 cal, 1g carbs = 4 cal, 1g fat = 9 cal
    const proteinCal = avgProtein * 4;
    const carbsCal = avgCarbs * 4;
    const fatCal = avgFat * 9;
    const totalMacroCal = proteinCal + carbsCal + fatCal || 1;
    const carbsPct = Math.round((carbsCal / totalMacroCal) * 100);
    const proteinPct = Math.round((proteinCal / totalMacroCal) * 100);
    const fatPct = Math.round((fatCal / totalMacroCal) * 100);

    // Most common items
    const itemCounts = new Map<string, number>();
    for (const rec of analysisRecords) {
      const items = (rec.items ?? []) as IntakeItem[];
      for (const item of items) {
        const name = item.name || 'Unknown';
        itemCounts.set(name, (itemCounts.get(name) ?? 0) + (Number(item.quantity) || 1));
      }
    }
    const topItems = Array.from(itemCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    return { avgCal, avgProtein, avgCarbs, avgFat, carbsPct, proteinPct, fatPct, topItems };
  }, [analysisSummary, analysisRecords]);

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div dir={dir} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tr('متابعة السعرات الحرارية', 'Calorie Counting Dashboard')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('تسجيل ومتابعة المدخول الغذائي للمرضى', 'Record and track patient dietary intake')}
          </p>
        </div>
      </div>

      {/* Patient Selector */}
      <div className="bg-card border rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-muted-foreground" />
          <label className="text-sm font-medium text-foreground">{tr('رقم المريض', 'Patient ID')}</label>
          <Input
            className="max-w-[300px]"
            placeholder={tr('أدخل رقم المريض...', 'Enter patient ID...')}
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
          />
          {!patientId.trim() && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {tr('يرجى إدخال رقم المريض لعرض البيانات', 'Please enter a patient ID to view data')}
            </span>
          )}
        </div>
      </div>

      {patientId.trim() && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Flame className="w-4 h-4 text-orange-600" />
                {tr('سعرات اليوم', "Today's Calories")}
              </div>
              <div className="text-2xl font-bold text-foreground">{todayKPIs.totalCal}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getIntakeBg(todayKPIs.calPct)}`}
                    style={{ width: `${Math.min(todayKPIs.calPct, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getIntakeColor(todayKPIs.calPct)}`}>
                  {todayKPIs.calPct}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {tr(`الهدف: ${DAILY_CALORIE_TARGET} kcal`, `Target: ${DAILY_CALORIE_TARGET} kcal`)}
              </p>
            </div>

            <div className="bg-card border rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Beef className="w-4 h-4 text-red-600" />
                {tr('بروتين اليوم', "Today's Protein")}
              </div>
              <div className="text-2xl font-bold text-foreground">{todayKPIs.totalProtein}g</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getIntakeBg(todayKPIs.proteinPct)}`}
                    style={{ width: `${Math.min(todayKPIs.proteinPct, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getIntakeColor(todayKPIs.proteinPct)}`}>
                  {todayKPIs.proteinPct}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {tr(`الهدف: ${DAILY_PROTEIN_TARGET}g`, `Target: ${DAILY_PROTEIN_TARGET}g`)}
              </p>
            </div>

            <div className="bg-card border rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                {tr('متوسط 7 أيام', '7-Day Average')}
              </div>
              <div className="text-2xl font-bold text-blue-700">{todayKPIs.sevenDayAvg}</div>
              <p className="text-xs text-muted-foreground mt-1">{tr('سعرة حرارية / يوم', 'kcal / day')}</p>
            </div>

            <div className="bg-card border rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Droplets className="w-4 h-4 text-cyan-600" />
                {tr('سوائل اليوم', "Today's Fluids")}
              </div>
              <div className="text-2xl font-bold text-foreground">{todayKPIs.totalFluid} mL</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getIntakeBg(todayKPIs.fluidPct)}`}
                    style={{ width: `${Math.min(todayKPIs.fluidPct, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getIntakeColor(todayKPIs.fluidPct)}`}>
                  {todayKPIs.fluidPct}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {tr(`الهدف: ${DAILY_FLUID_TARGET} مل`, `Target: ${DAILY_FLUID_TARGET} mL`)}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-card border rounded-lg shadow-sm">
            <div className="flex border-b">
              {[
                { key: 'daily' as const,    icon: <CalendarDays className="w-4 h-4" />, ar: 'السجل اليومي',     en: 'Daily Log' },
                { key: 'trends' as const,   icon: <BarChart3 className="w-4 h-4" />,    ar: 'الاتجاهات',        en: 'Trends' },
                { key: 'analysis' as const, icon: <Microscope className="w-4 h-4" />,   ar: 'تحليل التغذية',    en: 'Nutrient Analysis' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.icon}
                  {tr(tab.ar, tab.en)}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* ─── Tab 1: Daily Log ──────────────────────────────────── */}
              {activeTab === 'daily' && (
                <div className="space-y-4">
                  {/* Date picker and record button */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      <Input
                        type="date"
                        className="w-[180px]"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                      />
                    </div>
                    <Button size="sm" onClick={() => { resetRecordForm(); setShowRecordDialog(true); }}>
                      <Plus className="w-4 h-4 me-1" />
                      {tr('تسجيل وجبة', 'Record Meal')}
                    </Button>
                  </div>

                  {dailyLoading ? (
                    <div className="p-8 text-center text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
                  ) : dailyRecords.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Utensils className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                      <p>{tr('لا توجد وجبات مسجلة لهذا اليوم', 'No meals recorded for this date')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {MEAL_ORDER.map(mt => {
                        const records = mealGroups[mt] ?? [];
                        if (records.length === 0) return null;
                        const totalCal = records.reduce((s, r) => s + (r.totalCalories ?? 0), 0);
                        const totalProt = records.reduce((s, r) => s + (r.totalProtein ?? 0), 0);
                        const totalCarbs = records.reduce((s, r) => s + (r.totalCarbs ?? 0), 0);
                        const totalFat = records.reduce((s, r) => s + (r.totalFat ?? 0), 0);
                        const totalFluid = records.reduce((s, r) => s + (r.fluidIntake ?? 0), 0);
                        const avgIntake = records.length > 0
                          ? Math.round(records.reduce((s, r) => s + (r.intakePercent ?? 100), 0) / records.length)
                          : 0;

                        return (
                          <div key={mt} className="border rounded-lg overflow-hidden">
                            <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                              <span className="font-medium text-sm text-foreground">
                                {getMealLabel(mt, tr)}
                              </span>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{totalCal} kcal</span>
                                <span>{tr('بروتين', 'Protein')}: {Math.round(totalProt * 10) / 10}g</span>
                                <span>{tr('كربوهيدرات', 'Carbs')}: {Math.round(totalCarbs * 10) / 10}g</span>
                                <span>{tr('دهون', 'Fat')}: {Math.round(totalFat * 10) / 10}g</span>
                                {totalFluid > 0 && <span>{tr('سوائل', 'Fluids')}: {totalFluid} mL</span>}
                                <span className={`px-1.5 py-0.5 rounded ${getIntakeColor(avgIntake)}`}>
                                  {avgIntake}% {tr('تناول', 'intake')}
                                </span>
                              </div>
                            </div>
                            <div className="divide-y">
                              {records.map(rec => (
                                <div key={rec.id} className="px-4 py-2 text-sm">
                                  <div className="flex flex-wrap gap-2">
                                    {(rec.items as IntakeItem[]).map((item, idx) => (
                                      <span key={idx} className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs">
                                        {item.name}
                                        {(item.quantity ?? 1) > 1 && <span className="text-muted-foreground">x{item.quantity}</span>}
                                        <span className="text-muted-foreground">({(Number(item.calories) || 0) * (Number(item.quantity) || 1)} kcal)</span>
                                      </span>
                                    ))}
                                  </div>
                                  {rec.notes && (
                                    <p className="text-xs text-muted-foreground mt-1">{rec.notes}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Tab 2: Trends ────────────────────────────────────── */}
              {activeTab === 'trends' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    {tr('اتجاه السعرات الحرارية - آخر 7 أيام', '7-Day Calorie Trend')}
                  </h3>

                  {trendLoading ? (
                    <div className="p-8 text-center text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
                  ) : trendSummary.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <BarChart3 className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                      <p>{tr('لا توجد بيانات كافية', 'Not enough data available')}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b text-muted-foreground">
                            <th className="px-3 py-2 text-start font-medium">{tr('التاريخ', 'Date')}</th>
                            <th className="px-3 py-2 text-center font-medium">{tr('فطور', 'Breakfast')}</th>
                            <th className="px-3 py-2 text-center font-medium">{tr('غداء', 'Lunch')}</th>
                            <th className="px-3 py-2 text-center font-medium">{tr('عشاء', 'Dinner')}</th>
                            <th className="px-3 py-2 text-center font-medium">{tr('وجبات خفيفة', 'Snacks')}</th>
                            <th className="px-3 py-2 text-center font-medium">{tr('الإجمالي', 'Total')}</th>
                            <th className="px-3 py-2 text-center font-medium">{tr('الهدف', 'Target')}</th>
                            <th className="px-3 py-2 text-center font-medium">{tr('% الهدف', '% Target')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trendSummary.map(day => {
                            const pct = Math.round((day.totalCalories / DAILY_CALORIE_TARGET) * 100);
                            const breakfastCal = day.meals['BREAKFAST'] ?? 0;
                            const lunchCal = day.meals['LUNCH'] ?? 0;
                            const dinnerCal = day.meals['DINNER'] ?? 0;
                            const snacksCal = (day.meals['SNACK_AM'] ?? 0) + (day.meals['SNACK_PM'] ?? 0);

                            return (
                              <tr key={day.date} className="border-b hover:bg-muted/50">
                                <td className="px-3 py-2 font-mono text-xs">{day.date}</td>
                                <td className="px-3 py-2 text-center font-mono">{breakfastCal || '—'}</td>
                                <td className="px-3 py-2 text-center font-mono">{lunchCal || '—'}</td>
                                <td className="px-3 py-2 text-center font-mono">{dinnerCal || '—'}</td>
                                <td className="px-3 py-2 text-center font-mono">{snacksCal || '—'}</td>
                                <td className="px-3 py-2 text-center font-bold">{day.totalCalories}</td>
                                <td className="px-3 py-2 text-center text-muted-foreground">{DAILY_CALORIE_TARGET}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getIntakeColor(pct)}`}>
                                    {pct}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Protein Trend */}
                  {trendSummary.length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-foreground mt-6">
                        {tr('اتجاه البروتين', 'Protein Trend')}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 border-b text-muted-foreground">
                              <th className="px-3 py-2 text-start font-medium">{tr('التاريخ', 'Date')}</th>
                              <th className="px-3 py-2 text-center font-medium">{tr('البروتين (g)', 'Protein (g)')}</th>
                              <th className="px-3 py-2 text-center font-medium">{tr('الهدف', 'Target')}</th>
                              <th className="px-3 py-2 text-center font-medium">{tr('% الهدف', '% Target')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trendSummary.map(day => {
                              const pct = Math.round((day.totalProtein / DAILY_PROTEIN_TARGET) * 100);
                              return (
                                <tr key={day.date} className="border-b hover:bg-muted/50">
                                  <td className="px-3 py-2 font-mono text-xs">{day.date}</td>
                                  <td className="px-3 py-2 text-center font-mono">{Math.round(day.totalProtein * 10) / 10}</td>
                                  <td className="px-3 py-2 text-center text-muted-foreground">{DAILY_PROTEIN_TARGET}g</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getIntakeColor(pct)}`}>
                                      {pct}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Fluid Trend */}
                      <h3 className="text-sm font-semibold text-foreground mt-6">
                        {tr('اتجاه السوائل', 'Fluid Trend')}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 border-b text-muted-foreground">
                              <th className="px-3 py-2 text-start font-medium">{tr('التاريخ', 'Date')}</th>
                              <th className="px-3 py-2 text-center font-medium">{tr('السوائل (مل)', 'Fluids (mL)')}</th>
                              <th className="px-3 py-2 text-center font-medium">{tr('الهدف', 'Target')}</th>
                              <th className="px-3 py-2 text-center font-medium">{tr('% الهدف', '% Target')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trendSummary.map(day => {
                              const pct = day.totalFluid > 0 ? Math.round((day.totalFluid / DAILY_FLUID_TARGET) * 100) : 0;
                              return (
                                <tr key={day.date} className="border-b hover:bg-muted/50">
                                  <td className="px-3 py-2 font-mono text-xs">{day.date}</td>
                                  <td className="px-3 py-2 text-center font-mono">{day.totalFluid || '—'}</td>
                                  <td className="px-3 py-2 text-center text-muted-foreground">{DAILY_FLUID_TARGET} mL</td>
                                  <td className="px-3 py-2 text-center">
                                    {day.totalFluid > 0 ? (
                                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getIntakeColor(pct)}`}>
                                        {pct}%
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ─── Tab 3: Nutrient Analysis ─────────────────────────── */}
              {activeTab === 'analysis' && (
                <div className="space-y-5">
                  {/* Date Range */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-sm text-muted-foreground">{tr('من', 'From')}</label>
                    <Input
                      type="date"
                      className="w-[170px]"
                      value={analysisStart}
                      onChange={e => setAnalysisStart(e.target.value)}
                    />
                    <label className="text-sm text-muted-foreground">{tr('إلى', 'To')}</label>
                    <Input
                      type="date"
                      className="w-[170px]"
                      value={analysisEnd}
                      onChange={e => setAnalysisEnd(e.target.value)}
                    />
                  </div>

                  {analysisLoading ? (
                    <div className="p-8 text-center text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
                  ) : analysisSummary.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Microscope className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                      <p>{tr('لا توجد بيانات للفترة المحددة', 'No data for selected period')}</p>
                    </div>
                  ) : (
                    <>
                      {/* Average Daily Intake */}
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3">
                          {tr('متوسط المدخول اليومي', 'Average Daily Intake')}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="border rounded-lg p-3 text-center">
                            <div className="text-xs text-muted-foreground mb-1">{tr('سعرات', 'Calories')}</div>
                            <div className="text-xl font-bold text-foreground">{analysisKPIs.avgCal}</div>
                            <div className="text-xs text-muted-foreground">kcal / {tr('يوم', 'day')}</div>
                          </div>
                          <div className="border rounded-lg p-3 text-center">
                            <div className="text-xs text-muted-foreground mb-1">{tr('بروتين', 'Protein')}</div>
                            <div className="text-xl font-bold text-foreground">{analysisKPIs.avgProtein}g</div>
                            <div className="text-xs text-muted-foreground">/ {tr('يوم', 'day')}</div>
                          </div>
                          <div className="border rounded-lg p-3 text-center">
                            <div className="text-xs text-muted-foreground mb-1">{tr('كربوهيدرات', 'Carbs')}</div>
                            <div className="text-xl font-bold text-foreground">{analysisKPIs.avgCarbs}g</div>
                            <div className="text-xs text-muted-foreground">/ {tr('يوم', 'day')}</div>
                          </div>
                          <div className="border rounded-lg p-3 text-center">
                            <div className="text-xs text-muted-foreground mb-1">{tr('دهون', 'Fat')}</div>
                            <div className="text-xl font-bold text-foreground">{analysisKPIs.avgFat}g</div>
                            <div className="text-xs text-muted-foreground">/ {tr('يوم', 'day')}</div>
                          </div>
                        </div>
                      </div>

                      {/* Macro Split */}
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3">
                          {tr('توزيع المغذيات الكبرى', 'Macronutrient Split')}
                        </h3>
                        <div className="flex items-center gap-4 flex-wrap">
                          {/* Visual bar */}
                          <div className="flex-1 min-w-[200px]">
                            <div className="flex h-6 rounded-full overflow-hidden">
                              {analysisKPIs.carbsPct > 0 && (
                                <div
                                  className="bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold"
                                  style={{ width: `${analysisKPIs.carbsPct}%` }}
                                >
                                  {analysisKPIs.carbsPct > 10 ? `${analysisKPIs.carbsPct}%` : ''}
                                </div>
                              )}
                              {analysisKPIs.proteinPct > 0 && (
                                <div
                                  className="bg-red-500 flex items-center justify-center text-white text-[10px] font-bold"
                                  style={{ width: `${analysisKPIs.proteinPct}%` }}
                                >
                                  {analysisKPIs.proteinPct > 10 ? `${analysisKPIs.proteinPct}%` : ''}
                                </div>
                              )}
                              {analysisKPIs.fatPct > 0 && (
                                <div
                                  className="bg-yellow-500 flex items-center justify-center text-white text-[10px] font-bold"
                                  style={{ width: `${analysisKPIs.fatPct}%` }}
                                >
                                  {analysisKPIs.fatPct > 10 ? `${analysisKPIs.fatPct}%` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Legend */}
                          <div className="flex gap-4 text-xs">
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                              {tr('كربوهيدرات', 'Carbs')} {analysisKPIs.carbsPct}%
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
                              {tr('بروتين', 'Protein')} {analysisKPIs.proteinPct}%
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block" />
                              {tr('دهون', 'Fat')} {analysisKPIs.fatPct}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Comparison to targets */}
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3">
                          {tr('المقارنة بالأهداف', 'Comparison to Targets')}
                        </h3>
                        <div className="space-y-3">
                          {[
                            { label: tr('سعرات حرارية', 'Calories'), avg: analysisKPIs.avgCal, target: DAILY_CALORIE_TARGET, unit: 'kcal' },
                            { label: tr('بروتين', 'Protein'), avg: analysisKPIs.avgProtein, target: DAILY_PROTEIN_TARGET, unit: 'g' },
                          ].map(row => {
                            const pct = Math.round((row.avg / row.target) * 100);
                            return (
                              <div key={row.label} className="flex items-center gap-3">
                                <span className="text-sm text-foreground w-24">{row.label}</span>
                                <div className="flex-1 bg-muted rounded-full h-3">
                                  <div
                                    className={`h-3 rounded-full transition-all ${getIntakeBg(pct)}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-32 text-end">
                                  {row.avg} / {row.target} {row.unit} ({pct}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Most Common Items */}
                      {analysisKPIs.topItems.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-foreground mb-3">
                            {tr('العناصر الأكثر استهلاكا', 'Most Common Items')}
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {analysisKPIs.topItems.map((item, idx) => (
                              <div key={idx} className="border rounded-lg p-3 flex items-center gap-2">
                                <span className="text-lg font-bold text-muted-foreground">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">{item.count}x {tr('مرة', 'times')}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Record Meal Dialog ───────────────────────────────────── */}
      <Dialog open={showRecordDialog} onOpenChange={(open) => { if (!open) { setShowRecordDialog(false); resetRecordForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle>{tr('تسجيل وجبة', 'Record Meal')}</DialogTitle>
            <DialogDescription>{tr('سجل الوجبة والعناصر الغذائية المتناولة', 'Record meal and consumed food items')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-4">
            {/* Meal Type */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{tr('نوع الوجبة', 'Meal Type')}</label>
              <Select value={formMealType} onValueChange={setFormMealType}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map(m => (
                    <SelectItem key={m.key} value={m.key}>{tr(m.ar, m.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search from catalog */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{tr('بحث في القائمة الغذائية', 'Search Diet Catalog')}</label>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="ps-9"
                  placeholder={tr('اكتب اسم الطعام للبحث...', 'Type food name to search...')}
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                />
              </div>
              {catalogItems.length > 0 && catalogSearch.trim().length >= 2 && (
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-card shadow-sm">
                  {catalogItems.map(ci => (
                    <button
                      key={ci.id}
                      className="w-full text-start px-3 py-2 hover:bg-muted/50 text-sm border-b last:border-0 flex justify-between"
                      onClick={() => addCatalogItem(ci)}
                    >
                      <span>{language === 'ar' ? (ci.nameAr || ci.name) : ci.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {ci.calories ?? 0} kcal {ci.servingSize ? `(${ci.servingSize})` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-muted-foreground">{tr('العناصر', 'Items')}</label>
                <Button variant="outline" size="sm" onClick={addBlankItem}>
                  <Plus className="w-3 h-3 me-1" />
                  {tr('إضافة يدوي', 'Add Manual')}
                </Button>
              </div>

              {formItems.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
                  {tr('ابحث في القائمة أعلاه أو أضف عنصرا يدويا', 'Search catalog above or add a manual item')}
                </div>
              ) : (
                <div className="space-y-2">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-3 bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Input
                          className="flex-1"
                          placeholder={tr('اسم العنصر', 'Item name')}
                          value={item.name}
                          onChange={e => updateItem(idx, 'name', e.target.value)}
                        />
                        <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        <div>
                          <label className="block text-[10px] text-muted-foreground">{tr('الكمية', 'Qty')}</label>
                          <Input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={item.quantity}
                            onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground">{tr('سعرات', 'Cal')}</label>
                          <Input
                            type="number"
                            value={item.calories}
                            onChange={e => updateItem(idx, 'calories', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground">{tr('بروتين (g)', 'Protein')}</label>
                          <Input
                            type="number"
                            step="0.1"
                            value={item.protein}
                            onChange={e => updateItem(idx, 'protein', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground">{tr('كربوهيدرات (g)', 'Carbs')}</label>
                          <Input
                            type="number"
                            step="0.1"
                            value={item.carbs}
                            onChange={e => updateItem(idx, 'carbs', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground">{tr('دهون (g)', 'Fat')}</label>
                          <Input
                            type="number"
                            step="0.1"
                            value={item.fat}
                            onChange={e => updateItem(idx, 'fat', Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Running Total */}
              {formItems.length > 0 && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">{tr('الإجمالي', 'Total')}</span>
                  <div className="flex gap-4 text-sm text-blue-700">
                    <span>{Math.round(runningTotal.calories)} kcal</span>
                    <span>{tr('بروتين', 'P')}: {Math.round(runningTotal.protein * 10) / 10}g</span>
                    <span>{tr('كربو', 'C')}: {Math.round(runningTotal.carbs * 10) / 10}g</span>
                    <span>{tr('دهون', 'F')}: {Math.round(runningTotal.fat * 10) / 10}g</span>
                  </div>
                </div>
              )}
            </div>

            {/* Intake Percent */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                {tr('نسبة التناول', 'Intake Percent')} ({formIntakePercent || 0}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={formIntakePercent || 0}
                onChange={e => setFormIntakePercent(e.target.value)}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Fluid Intake */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{tr('كمية السوائل (مل)', 'Fluid Intake (mL)')}</label>
              <Input
                type="number"
                className="w-[200px]"
                placeholder="0"
                value={formFluidIntake}
                onChange={e => setFormFluidIntake(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{tr('ملاحظات', 'Notes')}</label>
              <textarea
                className="w-full border rounded-md p-2 text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => { setShowRecordDialog(false); resetRecordForm(); }}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button onClick={handleRecordMeal} disabled={saving}>
                {saving ? tr('جاري الحفظ...', 'Saving...') : tr('تسجيل', 'Record')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
