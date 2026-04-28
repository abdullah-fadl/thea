'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  UtensilsCrossed, Plus, Search, Filter, Package, CheckCircle,
  LayoutGrid, AlertTriangle, Leaf, X, Download, Eye, Edit2,
  Coffee, Salad, Moon, Apple, GlassWater, Pill, ChevronDown,
} from 'lucide-react';

import {
  MEAL_CATEGORIES, MEAL_CATEGORY_MAP,
  DIET_TYPES, DIET_TYPE_MAP,
  ALLERGENS, ALLERGEN_MAP,
  TEXTURES, TEXTURE_MAP,
  NUTRIENT_DAILY_VALUES,
  SEED_CATALOG,
} from '@/lib/nutrition/dietCatalogDefinitions';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DietCatalogItem {
  id: string;
  tenantId: string;
  name: string;
  nameAr: string | null;
  category: string;
  dietTypes: string[];
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  fiber: number | null;
  sodium: number | null;
  potassium: number | null;
  sugar: number | null;
  servingSize: string | null;
  allergens: string[];
  texture: string | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isHalal: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KPIs {
  totalItems: number;
  availableItems: number;
  categoriesCovered: number;
  withAllergens: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

function getCategoryIcon(cat: string) {
  switch (cat) {
    case 'BREAKFAST': return <Coffee className="w-4 h-4" />;
    case 'LUNCH':     return <Salad className="w-4 h-4" />;
    case 'DINNER':    return <Moon className="w-4 h-4" />;
    case 'SNACK':     return <Apple className="w-4 h-4" />;
    case 'BEVERAGE':  return <GlassWater className="w-4 h-4" />;
    case 'SUPPLEMENT':return <Pill className="w-4 h-4" />;
    default:          return <UtensilsCrossed className="w-4 h-4" />;
  }
}

function getCategoryColor(cat: string): string {
  switch (cat) {
    case 'BREAKFAST': return 'bg-amber-100 text-amber-800';
    case 'LUNCH':     return 'bg-green-100 text-green-800';
    case 'DINNER':    return 'bg-indigo-100 text-indigo-800';
    case 'SNACK':     return 'bg-pink-100 text-pink-800';
    case 'BEVERAGE':  return 'bg-sky-100 text-sky-800';
    case 'SUPPLEMENT':return 'bg-purple-100 text-purple-800';
    default:          return 'bg-muted text-muted-foreground';
  }
}

function getDietColor(dt: string): string {
  switch (dt) {
    case 'REGULAR':       return 'bg-muted text-foreground';
    case 'DIABETIC':      return 'bg-blue-100 text-blue-700';
    case 'RENAL':         return 'bg-orange-100 text-orange-700';
    case 'CARDIAC':       return 'bg-red-100 text-red-700';
    case 'LOW_SODIUM':    return 'bg-teal-100 text-teal-700';
    case 'HIGH_PROTEIN':  return 'bg-emerald-100 text-emerald-700';
    case 'GLUTEN_FREE':   return 'bg-yellow-100 text-yellow-700';
    default:              return 'bg-muted text-muted-foreground';
  }
}

function getAllergenColor(): string {
  return 'bg-red-50 text-red-700 border border-red-200';
}

const NONE = '__NONE__';

// ─── Component ──────────────────────────────────────────────────────────────────

export default function DietCatalog() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const { toast } = useToast();

  // ─── Filter State ─────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState(NONE);
  const [filterDietType, setFilterDietType] = useState(NONE);
  const [filterTexture, setFilterTexture] = useState(NONE);
  const [excludeAllergens, setExcludeAllergens] = useState<string[]>([]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);

  // ─── Dialog State ─────────────────────────────────────────────
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editItem, setEditItem] = useState<DietCatalogItem | null>(null);
  const [detailItem, setDetailItem] = useState<DietCatalogItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // ─── Form State ───────────────────────────────────────────────
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formCategory, setFormCategory] = useState('BREAKFAST');
  const [formServingSize, setFormServingSize] = useState('');
  const [formCalories, setFormCalories] = useState('');
  const [formProtein, setFormProtein] = useState('');
  const [formCarbs, setFormCarbs] = useState('');
  const [formFat, setFormFat] = useState('');
  const [formFiber, setFormFiber] = useState('');
  const [formSodium, setFormSodium] = useState('');
  const [formPotassium, setFormPotassium] = useState('');
  const [formSugar, setFormSugar] = useState('');
  const [formDietTypes, setFormDietTypes] = useState<string[]>([]);
  const [formAllergens, setFormAllergens] = useState<string[]>([]);
  const [formTexture, setFormTexture] = useState('REGULAR');
  const [formIsVegetarian, setFormIsVegetarian] = useState(false);
  const [formIsVegan, setFormIsVegan] = useState(false);
  const [formIsHalal, setFormIsHalal] = useState(true);
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formNotes, setFormNotes] = useState('');

  // ─── Build Query ──────────────────────────────────────────────
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (filterCategory !== NONE) params.set('category', filterCategory);
    if (filterDietType !== NONE) params.set('dietType', filterDietType);
    if (filterTexture !== NONE) params.set('texture', filterTexture);
    if (excludeAllergens.length > 0) params.set('excludeAllergens', excludeAllergens.join(','));
    if (availableOnly) params.set('isAvailable', 'true');
    const str = params.toString();
    return str ? `?${str}` : '';
  }, [search, filterCategory, filterDietType, filterTexture, excludeAllergens, availableOnly]);

  const { data, mutate, isLoading } = useSWR<{ items: DietCatalogItem[]; kpis: KPIs }>(
    `/api/nutrition/diet-catalog${queryParams}`,
    fetcher
  );

  const items = data?.items ?? [];
  const kpis = data?.kpis ?? { totalItems: 0, availableItems: 0, categoriesCovered: 0, withAllergens: 0 };

  // ─── Form Helpers ─────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setFormName('');
    setFormNameAr('');
    setFormCategory('BREAKFAST');
    setFormServingSize('');
    setFormCalories('');
    setFormProtein('');
    setFormCarbs('');
    setFormFat('');
    setFormFiber('');
    setFormSodium('');
    setFormPotassium('');
    setFormSugar('');
    setFormDietTypes([]);
    setFormAllergens([]);
    setFormTexture('REGULAR');
    setFormIsVegetarian(false);
    setFormIsVegan(false);
    setFormIsHalal(true);
    setFormIsAvailable(true);
    setFormNotes('');
  }, []);

  const populateForm = useCallback((item: DietCatalogItem) => {
    setFormName(item.name);
    setFormNameAr(item.nameAr ?? '');
    setFormCategory(item.category);
    setFormServingSize(item.servingSize ?? '');
    setFormCalories(item.calories != null ? String(item.calories) : '');
    setFormProtein(item.protein != null ? String(item.protein) : '');
    setFormCarbs(item.carbohydrates != null ? String(item.carbohydrates) : '');
    setFormFat(item.fat != null ? String(item.fat) : '');
    setFormFiber(item.fiber != null ? String(item.fiber) : '');
    setFormSodium(item.sodium != null ? String(item.sodium) : '');
    setFormPotassium(item.potassium != null ? String(item.potassium) : '');
    setFormSugar(item.sugar != null ? String(item.sugar) : '');
    setFormDietTypes(item.dietTypes ?? []);
    setFormAllergens(item.allergens ?? []);
    setFormTexture(item.texture ?? 'REGULAR');
    setFormIsVegetarian(item.isVegetarian);
    setFormIsVegan(item.isVegan);
    setFormIsHalal(item.isHalal);
    setFormIsAvailable(item.isAvailable);
    setFormNotes(item.notes ?? '');
  }, []);

  const toggleArrayValue = useCallback((arr: string[], val: string): string[] => {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
  }, []);

  // ─── Actions ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!formName.trim() || !formCategory) {
      toast({ title: tr('الاسم والفئة مطلوبان', 'Name and category are required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        nameAr: formNameAr.trim() || null,
        category: formCategory,
        servingSize: formServingSize.trim() || null,
        calories: formCalories ? Number(formCalories) : null,
        protein: formProtein ? Number(formProtein) : null,
        carbohydrates: formCarbs ? Number(formCarbs) : null,
        fat: formFat ? Number(formFat) : null,
        fiber: formFiber ? Number(formFiber) : null,
        sodium: formSodium ? Number(formSodium) : null,
        potassium: formPotassium ? Number(formPotassium) : null,
        sugar: formSugar ? Number(formSugar) : null,
        dietTypes: formDietTypes,
        allergens: formAllergens,
        texture: formTexture,
        isVegetarian: formIsVegetarian,
        isVegan: formIsVegan,
        isHalal: formIsHalal,
        isAvailable: formIsAvailable,
        notes: formNotes.trim() || null,
      };

      if (editItem) {
        payload.id = editItem.id;
        await fetch('/api/nutrition/diet-catalog', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        toast({ title: tr('تم تحديث العنصر', 'Item updated') });
      } else {
        await fetch('/api/nutrition/diet-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        toast({ title: tr('تم إضافة العنصر', 'Item added') });
      }
      mutate();
      setShowAddDialog(false);
      setEditItem(null);
      resetForm();
    } catch {
      toast({ title: tr('حدث خطأ', 'An error occurred'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [
    formName, formNameAr, formCategory, formServingSize, formCalories, formProtein,
    formCarbs, formFat, formFiber, formSodium, formPotassium, formSugar, formDietTypes,
    formAllergens, formTexture, formIsVegetarian, formIsVegan, formIsHalal, formIsAvailable,
    formNotes, editItem, mutate, resetForm, toast, tr,
  ]);

  const handleBulkImport = useCallback(async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/nutrition/diet-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bulkSeed: true, items: SEED_CATALOG }),
      });
      const result = await res.json();
      toast({ title: tr(`تم استيراد ${result.imported ?? SEED_CATALOG.length} عنصر`, `Imported ${result.imported ?? SEED_CATALOG.length} items`) });
      mutate();
    } catch {
      toast({ title: tr('فشل الاستيراد', 'Import failed'), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  }, [mutate, toast, tr]);

  const handleToggleAvailability = useCallback(async (item: DietCatalogItem) => {
    try {
      await fetch('/api/nutrition/diet-catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: item.id, isAvailable: !item.isAvailable }),
      });
      mutate();
    } catch {
      toast({ title: tr('حدث خطأ', 'An error occurred'), variant: 'destructive' });
    }
  }, [mutate, toast, tr]);

  const openEdit = useCallback((item: DietCatalogItem) => {
    populateForm(item);
    setEditItem(item);
    setShowAddDialog(true);
  }, [populateForm]);

  const openAdd = useCallback(() => {
    resetForm();
    setEditItem(null);
    setShowAddDialog(true);
  }, [resetForm]);

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div dir={dir} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tr('قائمة الأغذية', 'Diet Catalog')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('قاعدة بيانات الأطعمة والمشروبات والمكملات الغذائية', 'Food, beverage, and supplement database')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleBulkImport} disabled={importing}>
            <Download className="w-4 h-4 me-1" />
            {importing
              ? tr('جاري الاستيراد...', 'Importing...')
              : tr('استيراد القائمة الافتراضية', 'Import Seed Catalog')}
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 me-1" />
            {tr('إضافة عنصر', 'Add Item')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Package className="w-4 h-4" />
            {tr('إجمالي العناصر', 'Total Items')}
          </div>
          <div className="text-2xl font-bold text-foreground">{kpis.totalItems}</div>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            {tr('عناصر متاحة', 'Available Items')}
          </div>
          <div className="text-2xl font-bold text-green-700">{kpis.availableItems}</div>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <LayoutGrid className="w-4 h-4 text-blue-600" />
            {tr('الفئات المغطاة', 'Categories Covered')}
          </div>
          <div className="text-2xl font-bold text-blue-700">{kpis.categoriesCovered}</div>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            {tr('عناصر بمسببات حساسية', 'Items with Allergens')}
          </div>
          <div className="text-2xl font-bold text-orange-700">{kpis.withAllergens}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border rounded-lg p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="ps-9"
              placeholder={tr('بحث بالاسم...', 'Search by name...')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Category */}
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={tr('الفئة', 'Category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{tr('كل الفئات', 'All Categories')}</SelectItem>
              {MEAL_CATEGORIES.map(c => (
                <SelectItem key={c.key} value={c.key}>
                  {tr(c.labelAr, c.labelEn)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Diet Type */}
          <Select value={filterDietType} onValueChange={setFilterDietType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={tr('نوع الحمية', 'Diet Type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{tr('كل الأنظمة', 'All Diet Types')}</SelectItem>
              {DIET_TYPES.map(d => (
                <SelectItem key={d.key} value={d.key}>
                  {tr(d.labelAr, d.labelEn)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Texture */}
          <Select value={filterTexture} onValueChange={setFilterTexture}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={tr('القوام', 'Texture')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{tr('كل الأنواع', 'All Textures')}</SelectItem>
              {TEXTURES.map(t => (
                <SelectItem key={t.key} value={t.key}>
                  {tr(t.labelAr, t.labelEn)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Allergen exclusion toggle */}
          <Button
            variant={excludeAllergens.length > 0 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAllergenFilter(!showAllergenFilter)}
          >
            <Filter className="w-4 h-4 me-1" />
            {tr('استبعاد مسببات الحساسية', 'Exclude Allergens')}
            {excludeAllergens.length > 0 && (
              <span className="ms-1 bg-white/20 rounded-full px-1.5 text-xs">{excludeAllergens.length}</span>
            )}
          </Button>
          {/* Available only */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={availableOnly} onCheckedChange={(v) => setAvailableOnly(v === true)} />
            {tr('المتاح فقط', 'Available Only')}
          </label>
        </div>

        {/* Allergen exclusion dropdown */}
        {showAllergenFilter && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground self-center">
              {tr('استبعاد العناصر التي تحتوي على:', 'Exclude items containing:')}
            </span>
            {ALLERGENS.map(a => (
              <label key={a.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox
                  checked={excludeAllergens.includes(a.key)}
                  onCheckedChange={() =>
                    setExcludeAllergens(prev =>
                      prev.includes(a.key) ? prev.filter(x => x !== a.key) : [...prev, a.key]
                    )
                  }
                />
                {tr(a.labelAr, a.labelEn)}
              </label>
            ))}
            {excludeAllergens.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setExcludeAllergens([])}>
                <X className="w-3 h-3 me-1" />
                {tr('مسح', 'Clear')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            {tr('جاري التحميل...', 'Loading...')}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium">{tr('لا توجد عناصر', 'No items found')}</p>
            <p className="text-sm mt-1">
              {tr('استخدم زر "استيراد القائمة الافتراضية" لإضافة عناصر أولية', 'Use "Import Seed Catalog" to add initial items')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b text-muted-foreground">
                  <th className="px-4 py-3 text-start font-medium">{tr('الاسم', 'Name')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الفئة', 'Category')}</th>
                  <th className="px-4 py-3 text-center font-medium">{tr('سعرات', 'Cal')}</th>
                  <th className="px-4 py-3 text-center font-medium">{tr('بروتين', 'Protein')}</th>
                  <th className="px-4 py-3 text-center font-medium">{tr('كربوهيدرات', 'Carbs')}</th>
                  <th className="px-4 py-3 text-center font-medium">{tr('دهون', 'Fat')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الحصة', 'Serving')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('أنظمة غذائية', 'Diet Types')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('مسببات الحساسية', 'Allergens')}</th>
                  <th className="px-4 py-3 text-center font-medium">{tr('متاح', 'Available')}</th>
                  <th className="px-4 py-3 text-center font-medium">{tr('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: DietCatalogItem) => (
                  <tr key={item.id} className="border-b hover:bg-muted/50 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {language === 'ar' ? (item.nameAr || item.name) : item.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {language === 'ar' ? item.name : (item.nameAr || '')}
                      </div>
                    </td>
                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(item.category)}`}>
                        {getCategoryIcon(item.category)}
                        {MEAL_CATEGORY_MAP[item.category]
                          ? tr(MEAL_CATEGORY_MAP[item.category].labelAr, MEAL_CATEGORY_MAP[item.category].labelEn)
                          : item.category}
                      </span>
                    </td>
                    {/* Nutrients */}
                    <td className="px-4 py-3 text-center font-mono text-foreground">{item.calories ?? '—'}</td>
                    <td className="px-4 py-3 text-center font-mono text-foreground">{item.protein != null ? `${item.protein}g` : '—'}</td>
                    <td className="px-4 py-3 text-center font-mono text-foreground">{item.carbohydrates != null ? `${item.carbohydrates}g` : '—'}</td>
                    <td className="px-4 py-3 text-center font-mono text-foreground">{item.fat != null ? `${item.fat}g` : '—'}</td>
                    {/* Serving */}
                    <td className="px-4 py-3 text-muted-foreground text-xs">{item.servingSize ?? '—'}</td>
                    {/* Diet Types */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(item.dietTypes ?? []).slice(0, 3).map(dt => (
                          <span key={dt} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getDietColor(dt)}`}>
                            {DIET_TYPE_MAP[dt] ? tr(DIET_TYPE_MAP[dt].labelAr, DIET_TYPE_MAP[dt].labelEn) : dt}
                          </span>
                        ))}
                        {(item.dietTypes ?? []).length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{(item.dietTypes ?? []).length - 3}</span>
                        )}
                      </div>
                    </td>
                    {/* Allergens */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(item.allergens ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          (item.allergens ?? []).map(a => (
                            <span key={a} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getAllergenColor()}`}>
                              {ALLERGEN_MAP[a] ? tr(ALLERGEN_MAP[a].labelAr, ALLERGEN_MAP[a].labelEn) : a}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    {/* Available */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleAvailability(item)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          item.isAvailable
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-muted text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {item.isAvailable ? tr('متاح', 'Yes') : tr('غير متاح', 'No')}
                      </button>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailItem(item)} title={tr('تفاصيل', 'Details')}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(item)} title={tr('تعديل', 'Edit')}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && items.length > 0 && (
          <div className="px-4 py-3 border-t bg-muted/50 text-xs text-muted-foreground">
            {tr(`عرض ${items.length} عنصر`, `Showing ${items.length} items`)}
          </div>
        )}
      </div>

      {/* ─── Add / Edit Dialog ───────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); setEditItem(null); resetForm(); } else { setShowAddDialog(true); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle>
              {editItem ? tr('تعديل عنصر', 'Edit Item') : tr('إضافة عنصر جديد', 'Add New Item')}
            </DialogTitle>
            <DialogDescription>
              {editItem
                ? tr('تحديث تفاصيل العنصر الغذائي', 'Update food item details')
                : tr('إضافة عنصر غذائي جديد للقائمة', 'Add a new food item to the catalog')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-4">
            {/* Basic Info */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{tr('المعلومات الأساسية', 'Basic Information')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('الاسم (إنجليزي)', 'Name (EN)')}</label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Grilled Chicken" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('الاسم (عربي)', 'Name (AR)')}</label>
                  <Input value={formNameAr} onChange={e => setFormNameAr(e.target.value)} placeholder="دجاج مشوي" dir="rtl" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('الفئة', 'Category')}</label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MEAL_CATEGORIES.map(c => (
                        <SelectItem key={c.key} value={c.key}>{tr(c.labelAr, c.labelEn)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('حجم الحصة', 'Serving Size')}</label>
                  <Input value={formServingSize} onChange={e => setFormServingSize(e.target.value)} placeholder="150g" />
                </div>
              </div>
            </div>

            {/* Nutrition Facts */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{tr('القيم الغذائية', 'Nutrition Facts')}</h3>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('سعرات (kcal)', 'Calories (kcal)')}</label>
                  <Input type="number" value={formCalories} onChange={e => setFormCalories(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('بروتين (g)', 'Protein (g)')}</label>
                  <Input type="number" step="0.1" value={formProtein} onChange={e => setFormProtein(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('كربوهيدرات (g)', 'Carbs (g)')}</label>
                  <Input type="number" step="0.1" value={formCarbs} onChange={e => setFormCarbs(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('دهون (g)', 'Fat (g)')}</label>
                  <Input type="number" step="0.1" value={formFat} onChange={e => setFormFat(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('ألياف (g)', 'Fiber (g)')}</label>
                  <Input type="number" step="0.1" value={formFiber} onChange={e => setFormFiber(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('صوديوم (mg)', 'Sodium (mg)')}</label>
                  <Input type="number" step="0.1" value={formSodium} onChange={e => setFormSodium(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('بوتاسيوم (mg)', 'Potassium (mg)')}</label>
                  <Input type="number" step="0.1" value={formPotassium} onChange={e => setFormPotassium(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{tr('سكر (g)', 'Sugar (g)')}</label>
                  <Input type="number" step="0.1" value={formSugar} onChange={e => setFormSugar(e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>

            {/* Diet Compatibility */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{tr('التوافق مع الأنظمة الغذائية', 'Diet Compatibility')}</h3>
              <div className="flex flex-wrap gap-2">
                {DIET_TYPES.map(d => (
                  <label key={d.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={formDietTypes.includes(d.key)}
                      onCheckedChange={() => setFormDietTypes(prev => toggleArrayValue(prev, d.key))}
                    />
                    {tr(d.labelAr, d.labelEn)}
                  </label>
                ))}
              </div>
            </div>

            {/* Allergens */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{tr('مسببات الحساسية', 'Allergens')}</h3>
              <div className="flex flex-wrap gap-2">
                {ALLERGENS.map(a => (
                  <label key={a.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={formAllergens.includes(a.key)}
                      onCheckedChange={() => setFormAllergens(prev => toggleArrayValue(prev, a.key))}
                    />
                    {tr(a.labelAr, a.labelEn)}
                  </label>
                ))}
              </div>
            </div>

            {/* Texture */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{tr('القوام', 'Texture')}</h3>
              <Select value={formTexture} onValueChange={setFormTexture}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEXTURES.map(t => (
                    <SelectItem key={t.key} value={t.key}>{tr(t.labelAr, t.labelEn)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dietary Flags */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{tr('التصنيفات الغذائية', 'Dietary Flags')}</h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={formIsVegetarian} onCheckedChange={(v) => setFormIsVegetarian(v === true)} />
                  <Leaf className="w-4 h-4 text-green-600" />
                  {tr('نباتي', 'Vegetarian')}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={formIsVegan} onCheckedChange={(v) => setFormIsVegan(v === true)} />
                  <Leaf className="w-4 h-4 text-emerald-600" />
                  {tr('نباتي صرف', 'Vegan')}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={formIsHalal} onCheckedChange={(v) => setFormIsHalal(v === true)} />
                  {tr('حلال', 'Halal')}
                </label>
              </div>
            </div>

            {/* Availability */}
            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={formIsAvailable} onCheckedChange={(v) => setFormIsAvailable(v === true)} />
                <span className="font-medium">{tr('متاح حاليا', 'Currently Available')}</span>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{tr('ملاحظات', 'Notes')}</label>
              <textarea
                className="w-full border rounded-md p-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditItem(null); resetForm(); }}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving
                  ? tr('جاري الحفظ...', 'Saving...')
                  : editItem
                    ? tr('تحديث', 'Update')
                    : tr('إضافة', 'Add')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Nutritional Detail Dialog ───────────────────────────── */}
      <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle>
              {detailItem
                ? (language === 'ar' ? (detailItem.nameAr || detailItem.name) : detailItem.name)
                : ''}
            </DialogTitle>
            <DialogDescription>
              {detailItem
                ? (language === 'ar' ? detailItem.name : (detailItem.nameAr || ''))
                : ''}
            </DialogDescription>
          </DialogHeader>

          {detailItem && (
            <div className="space-y-5 mt-4">
              {/* Category & Serving */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(detailItem.category)}`}>
                  {getCategoryIcon(detailItem.category)}
                  {MEAL_CATEGORY_MAP[detailItem.category]
                    ? tr(MEAL_CATEGORY_MAP[detailItem.category].labelAr, MEAL_CATEGORY_MAP[detailItem.category].labelEn)
                    : detailItem.category}
                </span>
                {detailItem.servingSize && (
                  <span className="text-sm text-muted-foreground">
                    {tr('الحصة:', 'Serving:')} {detailItem.servingSize}
                  </span>
                )}
                {detailItem.texture && TEXTURE_MAP[detailItem.texture] && (
                  <span className="text-sm text-muted-foreground">
                    {tr('القوام:', 'Texture:')} {tr(TEXTURE_MAP[detailItem.texture].labelAr, TEXTURE_MAP[detailItem.texture].labelEn)}
                  </span>
                )}
              </div>

              {/* Nutrition Facts Label */}
              <div className="border-2 border-black rounded-lg p-4 bg-card">
                <h3 className="text-lg font-black border-b-8 border-black pb-1 mb-2">
                  {tr('القيم الغذائية', 'Nutrition Facts')}
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {tr('لكل حصة', 'Per serving')} {detailItem.servingSize ? `(${detailItem.servingSize})` : ''}
                </p>
                <div className="border-t-4 border-black pt-1 space-y-1">
                  <NutritionRow
                    label={tr('السعرات الحرارية', 'Calories')}
                    value={detailItem.calories != null ? `${detailItem.calories}` : '—'}
                    unit="kcal"
                    bold
                    dv={detailItem.calories != null ? Math.round((detailItem.calories / NUTRIENT_DAILY_VALUES.calories) * 100) : null}
                    tr={tr}
                  />
                  <div className="border-t border-border" />
                  <NutritionRow
                    label={tr('الدهون الكلية', 'Total Fat')}
                    value={detailItem.fat != null ? `${detailItem.fat}` : '—'}
                    unit="g"
                    bold
                    dv={detailItem.fat != null ? Math.round((detailItem.fat / NUTRIENT_DAILY_VALUES.fat) * 100) : null}
                    tr={tr}
                  />
                  <div className="border-t border-border" />
                  <NutritionRow
                    label={tr('صوديوم', 'Sodium')}
                    value={detailItem.sodium != null ? `${detailItem.sodium}` : '—'}
                    unit="mg"
                    bold
                    dv={detailItem.sodium != null ? Math.round((detailItem.sodium / NUTRIENT_DAILY_VALUES.sodium) * 100) : null}
                    tr={tr}
                  />
                  <div className="border-t border-border" />
                  <NutritionRow
                    label={tr('الكربوهيدرات الكلية', 'Total Carbohydrate')}
                    value={detailItem.carbohydrates != null ? `${detailItem.carbohydrates}` : '—'}
                    unit="g"
                    bold
                    dv={detailItem.carbohydrates != null ? Math.round((detailItem.carbohydrates / NUTRIENT_DAILY_VALUES.carbohydrates) * 100) : null}
                    tr={tr}
                  />
                  <NutritionRow
                    label={tr('ألياف غذائية', 'Dietary Fiber')}
                    value={detailItem.fiber != null ? `${detailItem.fiber}` : '—'}
                    unit="g"
                    indent
                    dv={detailItem.fiber != null ? Math.round((detailItem.fiber / NUTRIENT_DAILY_VALUES.fiber) * 100) : null}
                    tr={tr}
                  />
                  <NutritionRow
                    label={tr('سكريات', 'Sugars')}
                    value={detailItem.sugar != null ? `${detailItem.sugar}` : '—'}
                    unit="g"
                    indent
                    dv={detailItem.sugar != null ? Math.round((detailItem.sugar / NUTRIENT_DAILY_VALUES.sugar) * 100) : null}
                    tr={tr}
                  />
                  <div className="border-t-4 border-black" />
                  <NutritionRow
                    label={tr('البروتين', 'Protein')}
                    value={detailItem.protein != null ? `${detailItem.protein}` : '—'}
                    unit="g"
                    bold
                    dv={detailItem.protein != null ? Math.round((detailItem.protein / NUTRIENT_DAILY_VALUES.protein) * 100) : null}
                    tr={tr}
                  />
                  <div className="border-t border-border" />
                  <NutritionRow
                    label={tr('بوتاسيوم', 'Potassium')}
                    value={detailItem.potassium != null ? `${detailItem.potassium}` : '—'}
                    unit="mg"
                    dv={detailItem.potassium != null ? Math.round((detailItem.potassium / NUTRIENT_DAILY_VALUES.potassium) * 100) : null}
                    tr={tr}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 border-t pt-1">
                  {tr('* النسبة المئوية للقيم اليومية مبنية على نظام غذائي 2000 سعرة حرارية', '* Percent Daily Values are based on a 2,000 calorie diet')}
                </p>
              </div>

              {/* Diet Compatibility */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">{tr('التوافق مع الأنظمة الغذائية', 'Diet Compatibility')}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(detailItem.dietTypes ?? []).length === 0 ? (
                    <span className="text-sm text-muted-foreground">{tr('غير محدد', 'Not specified')}</span>
                  ) : (
                    (detailItem.dietTypes ?? []).map(dt => (
                      <span key={dt} className={`inline-block px-2 py-1 rounded text-xs font-medium ${getDietColor(dt)}`}>
                        {DIET_TYPE_MAP[dt] ? tr(DIET_TYPE_MAP[dt].labelAr, DIET_TYPE_MAP[dt].labelEn) : dt}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Allergen Warnings */}
              {(detailItem.allergens ?? []).length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <h4 className="text-sm font-semibold text-red-700">{tr('تحذير: مسببات الحساسية', 'Warning: Allergens')}</h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(detailItem.allergens ?? []).map(a => (
                      <span key={a} className={`inline-block px-2 py-1 rounded text-xs font-medium ${getAllergenColor()}`}>
                        {ALLERGEN_MAP[a] ? tr(ALLERGEN_MAP[a].labelAr, ALLERGEN_MAP[a].labelEn) : a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dietary Flags */}
              <div className="flex flex-wrap gap-3">
                {detailItem.isVegetarian && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-medium">
                    <Leaf className="w-3 h-3" /> {tr('نباتي', 'Vegetarian')}
                  </span>
                )}
                {detailItem.isVegan && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-medium">
                    <Leaf className="w-3 h-3" /> {tr('نباتي صرف', 'Vegan')}
                  </span>
                )}
                {detailItem.isHalal && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-100 text-teal-700 text-xs font-medium">
                    {tr('حلال', 'Halal')}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${detailItem.isAvailable ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                  {detailItem.isAvailable ? tr('متاح', 'Available') : tr('غير متاح', 'Unavailable')}
                </span>
              </div>

              {/* Notes */}
              {detailItem.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">{tr('ملاحظات', 'Notes')}</h4>
                  <p className="text-sm text-muted-foreground">{detailItem.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Nutrition Row Sub-component ────────────────────────────────────────────────

function NutritionRow({
  label,
  value,
  unit,
  bold,
  indent,
  dv,
  tr,
}: {
  label: string;
  value: string;
  unit: string;
  bold?: boolean;
  indent?: boolean;
  dv: number | null;
  tr: (ar: string, en: string) => string;
}) {
  return (
    <div className={`flex items-center justify-between text-sm py-0.5 ${indent ? 'ps-4' : ''}`}>
      <span className={bold ? 'font-bold' : ''}>
        {label} <span className="font-normal">{value} {unit}</span>
      </span>
      {dv != null && (
        <span className="font-bold text-xs">{dv}% {tr('ق.ي.', 'DV')}</span>
      )}
    </div>
  );
}
