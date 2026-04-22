'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ORGANIZATION_TYPE_CATALOG } from '@/lib/organization/catalog';
import { useLang } from '@/hooks/use-lang';

interface ContextPackResponse {
  base: any;
  overlays: any[];
  merged: any;
}

export default function OrgProfile() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const [contextPack, setContextPack] = useState<ContextPackResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newAccreditation, setNewAccreditation] = useState('');
  const [newDocType, setNewDocType] = useState('');
  const [newGlossaryTerm, setNewGlossaryTerm] = useState('');
  const [newGlossaryDefinition, setNewGlossaryDefinition] = useState('');
  const [strictness, setStrictness] = useState<'balanced' | 'strict'>('balanced');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [suggestionsFilter, setSuggestionsFilter] = useState<'ALL' | 'ACCREDITATION' | 'REQUIRED_DOCS' | 'GLOSSARY' | 'RULES'>('ALL');
  const [suggestedOverlays, setSuggestedOverlays] = useState<any[]>([]);
  const [isDraftSuggestions, setIsDraftSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [setupOrgTypeSource, setSetupOrgTypeSource] = useState<'catalog' | 'custom'>('catalog');
  const [setupOrgTypeId, setSetupOrgTypeId] = useState('');
  const [setupOrgTypeName, setSetupOrgTypeName] = useState('');
  const [setupSector, setSetupSector] = useState('');
  const [setupCountryCode, setSetupCountryCode] = useState('');
  const [setupAccreditationSets, setSetupAccreditationSets] = useState('');

  const documentTypeOptions = [
    'policy',
    'sop',
    'workflow',
    'checklist',
    'form',
    'guideline',
    'instruction',
  ];

  const catalogOptions = useMemo(() => ORGANIZATION_TYPE_CATALOG, []);

  const sectorOptions = [
    'healthcare',
    'education',
    'government',
    'manufacturing',
    'logistics',
    'hospitality',
    'finance',
    'energy',
    'telecom',
    'construction',
    'retail',
    'other',
  ];

  const countryOptions = [
    { code: 'SA', label: 'Saudi Arabia' },
    { code: 'AE', label: 'United Arab Emirates' },
    { code: 'QA', label: 'Qatar' },
    { code: 'KW', label: 'Kuwait' },
    { code: 'BH', label: 'Bahrain' },
    { code: 'OM', label: 'Oman' },
    { code: 'US', label: 'United States' },
    { code: 'UK', label: 'United Kingdom' },
    { code: 'EG', label: 'Egypt' },
    { code: 'IN', label: 'India' },
  ];

  useEffect(() => {
    fetchContextPack();
  }, []);

  async function fetchContextPack() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tenant/context-pack', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setContextPack(data);
        setIsSetupRequired(false);
      } else {
        if (response.status === 404 || response.status === 409) {
          setIsSetupRequired(true);
          setContextPack(null);
          return;
        }
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || tr('فشل تحميل حزمة السياق', 'Failed to load context pack'));
      }
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل تحميل ملف المنظمة', 'Failed to load organization profile'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSetupSave() {
    const orgTypeId = setupOrgTypeSource === 'catalog' ? setupOrgTypeId : '';
    const orgTypeName = setupOrgTypeSource === 'custom' ? setupOrgTypeName.trim() : '';
    if (setupOrgTypeSource === 'catalog' && !orgTypeId) {
      toast({ title: tr('خطأ', 'Error'), description: tr('نوع المنظمة مطلوب', 'Organization type is required'), variant: 'destructive' });
      return;
    }
    if (setupOrgTypeSource === 'custom' && !orgTypeName) {
      toast({ title: 'Error', description: 'Custom organization type is required', variant: 'destructive' });
      return;
    }
    if (!setupSector || !setupCountryCode) {
      toast({ title: 'Error', description: 'Sector and country are required', variant: 'destructive' });
      return;
    }
    setIsUpdating(true);
    try {
      const response = await fetch('/api/admin/organization-profile/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orgTypeId,
          orgTypeName,
          orgTypeSource: setupOrgTypeSource,
          sector: setupSector,
          countryCode: setupCountryCode,
          accreditationSets: setupAccreditationSets
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || tr('فشل حفظ ملف المنظمة', 'Failed to save organization profile'));
      }
      toast({ title: tr('نجاح', 'Success'), description: tr('تم حفظ ملف المنظمة', 'Organization profile saved') });
      await fetchContextPack();
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل حفظ ملف المنظمة', 'Failed to save organization profile'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function addOverlay(type: string, payload: Record<string, any>) {
    try {
      const response = await fetch('/api/admin/context-overlays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, payload }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add overlay');
      }
      await fetchContextPack();
      toast({ title: tr('نجاح', 'Success'), description: tr('تمت إضافة التراكب', 'Overlay added') });
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل إضافة التراكب', 'Failed to add overlay'),
        variant: 'destructive',
      });
    }
  }

  async function applySuggestion(suggestion: any) {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/admin/organization-profile/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          suggestionId: suggestion.id,
          type: suggestion.type,
          payload: suggestion.payload,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to apply suggestion');
      }
      await fetchContextPack();
      toast({ title: tr('نجاح', 'Success'), description: tr('تم تطبيق التراكب', 'Overlay applied') });
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل تطبيق الاقتراح', 'Failed to apply suggestion'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function ignoreSuggestion(suggestion: any) {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/admin/organization-profile/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          suggestionId: suggestion.id,
          suggestionType: suggestion.type,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to ignore suggestion');
      }
      await fetchContextPack();
      toast({ title: tr('نجاح', 'Success'), description: tr('تم تجاهل الاقتراح', 'Suggestion ignored') });
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل تجاهل الاقتراح', 'Failed to ignore suggestion'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function removeOverlay(id: string) {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/context-overlays?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || tr('فشل إزالة التراكب', 'Failed to remove overlay'));
      }
      await fetchContextPack();
      toast({ title: tr('نجاح', 'Success'), description: tr('تمت إزالة التراكب', 'Overlay removed') });
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل إزالة التراكب', 'Failed to remove overlay'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">{tr('جارٍ التحميل...', 'Loading...')}</div>
      </div>
    );
  }

  if (!contextPack && !isSetupRequired) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{tr('ملف المنظمة', 'Organization Profile')}</h2>
          <p className="text-sm text-muted-foreground">{tr('لا توجد حزمة سياق متاحة لهذا المستأجر.', 'No context pack available for this tenant.')}</p>
        </div>
      </div>
    );
  }

  if (isSetupRequired) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{tr('ملف المنظمة', 'Organization Profile')}</h1>
          <p className="text-muted-foreground">{tr('الإعداد مطلوب قبل استخدام المنصة.', 'Setup required before using the platform.')}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{tr('الإعداد مطلوب', 'Setup required')}</h2>
          <p className="text-sm text-muted-foreground">
            {tr('نوع المنظمة والقطاع والدولة حقول إلزامية وتُقفل بعد الإعداد.', 'Organization type, sector, and country are mandatory and locked after setup.')}
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                className="rounded-xl"
                type="button"
                variant={setupOrgTypeSource === 'catalog' ? 'default' : 'outline'}
                onClick={() => setSetupOrgTypeSource('catalog')}
              >
                {tr('اختيار من الكتالوج', 'Select from catalog')}
              </Button>
              <Button
                className="rounded-xl"
                type="button"
                variant={setupOrgTypeSource === 'custom' ? 'default' : 'outline'}
                onClick={() => setSetupOrgTypeSource('custom')}
              >
                {tr('نوع منظمة مخصص', 'Custom organization type')}
              </Button>
            </div>
            {setupOrgTypeSource === 'catalog' ? (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع المنظمة *', 'Organization Type *')}</span>
                <Select
                  value={setupOrgTypeId}
                  onValueChange={(value) => {
                    setSetupOrgTypeId(value);
                    const selected = catalogOptions.find((item) => item.orgTypeId === value);
                    if (selected) {
                      setSetupSector(selected.defaultSector);
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('اختر نوع المنظمة', 'Select organization type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogOptions.map((item) => (
                      <SelectItem key={item.orgTypeId} value={item.orgTypeId}>
                        {item.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع منظمة مخصص *', 'Custom Organization Type *')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={setupOrgTypeName}
                  onChange={(e) => setSetupOrgTypeName(e.target.value)}
                  placeholder={tr('مثال: عيادة تخصصية، هيئة مطار', 'e.g., Specialty Clinic, Airport Authority')}
                />
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القطاع *', 'Sector *')}</span>
                <Select value={setupSector} onValueChange={setSetupSector}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('اختر القطاع', 'Select sector')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sectorOptions.map((sector) => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدولة/المنطقة *', 'Country/Region *')}</span>
                <Select value={setupCountryCode} onValueChange={setSetupCountryCode}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tr('اختر الدولة/المنطقة', 'Select country/region')} />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مجموعات الاعتماد (اختياري)', 'Accreditation sets (optional)')}</span>
              <Input
                className="rounded-xl thea-input-focus"
                value={setupAccreditationSets}
                onChange={(e) => setSetupAccreditationSets(e.target.value)}
                placeholder={tr('مثال: ISO 9001, ISO 45001', 'e.g., ISO 9001, ISO 45001')}
              />
            </div>
            <div className="flex justify-end">
              <Button className="rounded-xl" onClick={handleSetupSave} disabled={isUpdating}>
                {isUpdating ? tr('جارٍ الحفظ…', 'Saving…') : tr('حفظ الملف', 'Save profile')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const base = contextPack.base;
  const merged = contextPack.merged;
  const overlays = contextPack.overlays || [];
  const ignoredSuggestionOverlays = overlays.filter(
    (overlay: any) => overlay.type === 'SUGGESTION_PREFS'
  );
  const ignoredSuggestions = ignoredSuggestionOverlays
    .map((overlay: any) => overlay.payload?.suggestionId)
    .filter(Boolean);
  const appliedSuggestionIds = overlays
    .filter((overlay: any) => overlay.type !== 'SUGGESTION_PREFS')
    .map((overlay: any) => overlay.payload?.suggestionId)
    .filter(Boolean);

  async function loadSuggestions() {
    setIsLoadingSuggestions(true);
    try {
      const response = await fetch('/api/admin/organization-profile/suggestions', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || tr('فشل تحميل الاقتراحات', 'Failed to load suggestions'));
      }
      const data = await response.json();
      setSuggestedOverlays(data.suggestions || []);
      setIsDraftSuggestions(Boolean(data.isDraft));
    } catch (error: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error.message || tr('فشل تحميل الاقتراحات', 'Failed to load suggestions'),
        variant: 'destructive',
      });
      setSuggestedOverlays([]);
      setIsDraftSuggestions(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }

  const filteredSuggestions = suggestedOverlays.filter(
    (suggestion) =>
      !ignoredSuggestions.includes(suggestion.id) && !appliedSuggestionIds.includes(suggestion.id)
  );
  const dialogSuggestions = filteredSuggestions.filter((suggestion) =>
    suggestionsFilter === 'ALL' ? true : suggestion.type === suggestionsFilter
  );

  const getSuggestionLayer = (suggestion: any) =>
    suggestion.payload?.layer || 'OPERATIONAL_EXCELLENCE';

  const groupByLayer = (items: any[]) => ({
    FOUNDATION: items.filter((suggestion) => getSuggestionLayer(suggestion) === 'FOUNDATION'),
    ACCREDITATION_READY: items.filter((suggestion) => getSuggestionLayer(suggestion) === 'ACCREDITATION_READY'),
    OPERATIONAL_EXCELLENCE: items.filter((suggestion) => getSuggestionLayer(suggestion) === 'OPERATIONAL_EXCELLENCE'),
    ADVANCED_MATURITY: items.filter((suggestion) => getSuggestionLayer(suggestion) === 'ADVANCED_MATURITY'),
  });

  const suggestionGroups = groupByLayer(dialogSuggestions);
  const inlineSuggestionGroups = groupByLayer(filteredSuggestions);

  async function resetIgnoredSuggestions(type?: 'ACCREDITATION' | 'REQUIRED_DOCS' | 'GLOSSARY' | 'RULES') {
    const ignoredOverlays = overlays.filter((overlay: any) =>
      overlay.type === 'SUGGESTION_PREFS' &&
      (type ? overlay.payload?.suggestionType === type : true)
    );
    if (ignoredOverlays.length === 0) {
      return;
    }
    setIsUpdating(true);
    try {
      await Promise.all(ignoredOverlays.map((overlay: any) => removeOverlay(overlay.id)));
    } finally {
      setIsUpdating(false);
    }
  }
  const appliedOverlayIds = overlays
    .filter((overlay: any) => overlay.type !== 'SUGGESTION_PREFS')
    .map((overlay: any) => overlay.id);

  const renderSuggestionItem = (suggestion: any) => (
    <div key={suggestion.id} className="flex items-center justify-between rounded-xl border border-border p-3 thea-hover-lift thea-transition-fast">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{suggestion.title}</span>
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('مقترح', 'Suggested')}</span>
        </div>
        <div className="text-xs text-muted-foreground">{suggestion.description}</div>
        {(suggestion.payload?.derivedFrom?.organizationType ||
          suggestion.payload?.derivedFrom?.sector ||
          suggestion.payload?.derivedFrom?.country) && (
          <div className="text-[11px] text-muted-foreground">
            {tr('مشتق من', 'Derived from')}: {[
              suggestion.payload?.derivedFrom?.organizationType,
              suggestion.payload?.derivedFrom?.sector,
              suggestion.payload?.derivedFrom?.country,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          className="rounded-xl"
          size="sm"
          onClick={() => applySuggestion(suggestion)}
          disabled={isUpdating}
        >
          {tr('إضافة', 'Add')}
        </Button>
        <Button
          className="rounded-xl"
          size="sm"
          variant="outline"
          onClick={() => ignoreSuggestion(suggestion)}
          disabled={isUpdating}
        >
          {tr('تجاهل', 'Ignore')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{tr('ملف المنظمة', 'Organization Profile')}</h1>
        <p className="text-muted-foreground">
          {tr('اعرض نوع منظمتك المقفل وأضف تراكبات اختيارية.', 'View your locked organization type and add optional overlays.')}
        </p>
      </div>

      {/* Organization Type Card */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{tr('نوع المنظمة', 'Organization Type')}</h2>
        <p className="text-sm text-muted-foreground">{tr('مقفل بعد الإنشاء', 'Locked after creation')}</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع المنظمة', 'Organization Type')}</span>
            <Input className="rounded-xl thea-input-focus" value={base.orgTypeNameSnapshot || '—'} disabled />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القطاع', 'Sector')}</span>
            <Input className="rounded-xl thea-input-focus" value={base.sectorSnapshot || '—'} disabled />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدولة/المنطقة', 'Country/Region')}</span>
            <Input className="rounded-xl thea-input-focus" value={base.countryCode || '—'} disabled />
          </div>
        </div>
      </div>

      {/* Baseline Context Pack Card */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{tr('حزمة السياق الأساسية', 'Baseline Context Pack')}</h2>
        <p className="text-sm text-muted-foreground">{tr('الخط الأساسي التشغيلي الافتراضي لهذا المستأجر', 'Default operational baseline for this tenant')}</p>
        <div className="space-y-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مجموعات الاعتماد', 'Accreditation Sets')}</span>
            <div className="text-sm text-muted-foreground">
              {(merged.accreditationSets || []).join(', ') || tr('لا يوجد', 'None')}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('أنواع المستندات المطلوبة', 'Required Document Types')}</span>
            <div className="text-sm text-muted-foreground">
              {(merged.requiredDocumentTypes || []).join(', ') || tr('لا يوجد', 'None')}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('إعدادات الإرشاد الافتراضية', 'Guidance Defaults')}</span>
            <div className="text-sm text-muted-foreground">
              {tr('الصرامة', 'Strictness')}: {merged.behavior?.strictness || tr('متوازن', 'balanced')}
            </div>
          </div>
        </div>
      </div>

      {/* Overlays Card */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{tr('التراكبات', 'Overlays')}</h2>
        <p className="text-sm text-muted-foreground">{tr('تحسينات اختيارية بناءً على ملف منظمتك', 'Optional enhancements based on your organization profile')}</p>
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التراكبات المقترحة', 'Suggested Overlays')}</span>
              {isDraftSuggestions && (
                <span className="text-xs text-muted-foreground">
                  {tr('تم إعداد تراكبات مقترحة بناءً على المراجع المتاحة. راجعها وطبّق ما يلزم.', 'Suggested overlays prepared based on available references. Review and apply as needed.')}
                </span>
              )}
            </div>
            <div className="flex justify-end">
              <div className="flex items-center gap-2">
                <Button
                  className="rounded-xl"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await loadSuggestions();
                    await resetIgnoredSuggestions();
                    setSuggestionsFilter('ALL');
                    setIsSuggestionsOpen(true);
                  }}
                  disabled={isLoadingSuggestions}
                >
                  {tr('تحديث الاقتراحات', 'Refresh suggestions')}
                </Button>
                <Button
                  className="rounded-xl"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSuggestionsFilter('ALL');
                    if (suggestedOverlays.length === 0) {
                      loadSuggestions().then(() => setIsSuggestionsOpen(true));
                    } else {
                      setIsSuggestionsOpen(true);
                    }
                  }}
                  disabled={isLoadingSuggestions}
                >
                  {tr('اقتراحات المنظمة', 'Organization Suggestions')}
                </Button>
              </div>
            </div>
            {filteredSuggestions.length === 0 ? (
              <div className="text-sm text-muted-foreground">{tr('لا توجد تراكبات مقترحة متاحة', 'No suggested overlays available')}</div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الأساسيات - إلزامي', 'Foundation – Required')}</span>
                  <div className="text-xs text-muted-foreground">
                    {tr('الامتثال والسلامة والجاهزية التنظيمية.', 'Compliance, safety, regulatory readiness.')}
                  </div>
                  {inlineSuggestionGroups.FOUNDATION.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{tr('لا توجد اقتراحات متاحة', 'No suggestions available')}</div>
                  ) : (
                    inlineSuggestionGroups.FOUNDATION.map(renderSuggestionItem)
                  )}
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('جاهزية الاعتماد', 'Accreditation-Ready')}</span>
                  <div className="text-xs text-muted-foreground">
                    {tr('الجاهزية للتدقيق والحوكمة وأطر الجودة.', 'Audit readiness, governance, and quality frameworks.')}
                  </div>
                  {inlineSuggestionGroups.ACCREDITATION_READY.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{tr('لا توجد اقتراحات متاحة', 'No suggestions available')}</div>
                  ) : (
                    inlineSuggestionGroups.ACCREDITATION_READY.map(renderSuggestionItem)
                  )}
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التميّز التشغيلي', 'Operational Excellence')}</span>
                  <div className="text-xs text-muted-foreground">
                    {tr('سير عمل متسق وقوائم فحص وجاهزية تنفيذ.', 'Consistent workflows, checklists, and execution readiness.')}
                  </div>
                  {inlineSuggestionGroups.OPERATIONAL_EXCELLENCE.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{tr('لا توجد اقتراحات متاحة', 'No suggestions available')}</div>
                  ) : (
                    inlineSuggestionGroups.OPERATIONAL_EXCELLENCE.map(renderSuggestionItem)
                  )}
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النضج المتقدم', 'Advanced Maturity')}</span>
                  <div className="text-xs text-muted-foreground">
                    {tr('استشراف المستقبل والتحسين المستمر وجاهزية النمو.', 'Future-proofing, continuous improvement, and growth readiness.')}
                  </div>
                  {inlineSuggestionGroups.ADVANCED_MATURITY.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{tr('لا توجد اقتراحات متاحة', 'No suggestions available')}</div>
                  ) : (
                    inlineSuggestionGroups.ADVANCED_MATURITY.map(renderSuggestionItem)
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاقتراحات المتجاهلة', 'Ignored suggestions')}</span>
            {ignoredSuggestionOverlays.length === 0 ? (
              <div className="text-sm text-muted-foreground">{tr('لا توجد اقتراحات متجاهلة', 'No ignored suggestions')}</div>
            ) : (
              <div className="space-y-2">
                {ignoredSuggestionOverlays.map((overlay: any) => {
                  const suggestion = suggestedOverlays.find(
                    (item) => item.id === overlay.payload?.suggestionId
                  );
                  return (
                    <div key={overlay.id} className="flex items-center justify-between rounded-xl border border-border p-3 thea-hover-lift thea-transition-fast">
                      <div>
                        <div className="text-sm font-medium">
                          {suggestion?.title || overlay.payload?.suggestionId || tr('اقتراح', 'Suggestion')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {suggestion?.description || tr('اقتراح متجاهل', 'Ignored suggestion')}
                        </div>
                      </div>
                      <Button
                        className="rounded-xl"
                        size="sm"
                        variant="outline"
                        onClick={() => removeOverlay(overlay.id)}
                        disabled={isUpdating}
                      >
                        {tr('استعادة', 'Restore')}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التراكبات المطبقة', 'Applied Overlays')}</span>
            {appliedOverlayIds.length === 0 ? (
              <div className="text-sm text-muted-foreground">{tr('لا توجد تراكبات مطبقة', 'No overlays applied')}</div>
            ) : (
              <div className="space-y-2">
                {overlays
                  .filter((overlay: any) => overlay.type !== 'SUGGESTION_PREFS')
                  .map((overlay: any) => (
                    <div key={overlay.id} className="flex items-center justify-between rounded-xl border border-border p-3 thea-hover-lift thea-transition-fast">
                      <div>
                        <div className="text-sm font-medium">{overlay.type}</div>
                        <div className="text-xs text-muted-foreground">
                          {overlay.payload?.items?.join(', ') ||
                            (overlay.payload?.entries
                              ? Object.keys(overlay.payload.entries || {}).join(', ')
                              : tr('تم تطبيق تراكب', 'Overlay applied'))}
                        </div>
                      </div>
                      <Button
                        className="rounded-xl"
                        size="sm"
                        variant="outline"
                        onClick={() => removeOverlay(overlay.id)}
                        disabled={isUpdating}
                      >
                        {tr('إزالة', 'Remove')}
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('إضافة معيار/لائحة إضافية', 'Add additional standard/regulation')}</span>
              <Button
                className="rounded-xl"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await loadSuggestions();
                  await resetIgnoredSuggestions('ACCREDITATION');
                  setSuggestionsFilter('ACCREDITATION');
                  setIsSuggestionsOpen(true);
                }}
                disabled={isLoadingSuggestions}
              >
                {tr('مراجعة الاقتراحات', 'Review suggestions')}
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                className="rounded-xl thea-input-focus"
                value={newAccreditation}
                onChange={(e) => setNewAccreditation(e.target.value)}
                placeholder={tr('مثال: JCI, ISO 9001', 'e.g., JCI, ISO 9001')}
              />
              <Button
                className="rounded-xl"
                onClick={() => {
                  if (!newAccreditation.trim()) return;
                  addOverlay('ACCREDITATION', { items: [newAccreditation.trim()] });
                  setNewAccreditation('');
                }}
              >
                {tr('إضافة', 'Add')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('إضافة نوع مستند مطلوب', 'Add required document type')}</span>
              <Button
                className="rounded-xl"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await loadSuggestions();
                  await resetIgnoredSuggestions('REQUIRED_DOCS');
                  setSuggestionsFilter('REQUIRED_DOCS');
                  setIsSuggestionsOpen(true);
                }}
                disabled={isLoadingSuggestions}
              >
                {tr('مراجعة الاقتراحات', 'Review suggestions')}
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={newDocType} onValueChange={setNewDocType}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('اختر نوع المستند', 'Select document type')} />
                </SelectTrigger>
                <SelectContent>
                  {documentTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="rounded-xl"
                onClick={() => {
                  if (!newDocType) return;
                  addOverlay('REQUIRED_DOCS', { items: [newDocType] });
                  setNewDocType('');
                }}
              >
                {tr('إضافة', 'Add')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('إضافة مصطلح للقاموس', 'Add glossary term')}</span>
              <Button
                className="rounded-xl"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await loadSuggestions();
                  await resetIgnoredSuggestions('GLOSSARY');
                  setSuggestionsFilter('GLOSSARY');
                  setIsSuggestionsOpen(true);
                }}
                disabled={isLoadingSuggestions}
              >
                {tr('مراجعة الاقتراحات', 'Review suggestions')}
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                className="rounded-xl thea-input-focus"
                value={newGlossaryTerm}
                onChange={(e) => setNewGlossaryTerm(e.target.value)}
                placeholder={tr('المصطلح', 'Term')}
              />
              <Input
                className="rounded-xl thea-input-focus"
                value={newGlossaryDefinition}
                onChange={(e) => setNewGlossaryDefinition(e.target.value)}
                placeholder={tr('التعريف', 'Definition')}
              />
            </div>
            <Button
              className="rounded-xl"
              onClick={() => {
                if (!newGlossaryTerm.trim() || !newGlossaryDefinition.trim()) return;
                addOverlay('GLOSSARY', {
                  entries: { [newGlossaryTerm.trim()]: newGlossaryDefinition.trim() },
                });
                setNewGlossaryTerm('');
                setNewGlossaryDefinition('');
              }}
            >
              {tr('إضافة مصطلح', 'Add Term')}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الإعدادات الافتراضية للإرشاد', 'Guidance defaults')}</span>
              <Button
                className="rounded-xl"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await loadSuggestions();
                  await resetIgnoredSuggestions('RULES');
                  setSuggestionsFilter('RULES');
                  setIsSuggestionsOpen(true);
                }}
                disabled={isLoadingSuggestions}
              >
                {tr('مراجعة الاقتراحات', 'Review suggestions')}
              </Button>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={strictness} onValueChange={(value) => setStrictness(value as 'balanced' | 'strict')}>
                <SelectTrigger className="w-48 rounded-xl">
                  <SelectValue placeholder={tr('اختر مستوى الصرامة', 'Select strictness')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">{tr('متوازن', 'Balanced')}</SelectItem>
                  <SelectItem value="strict">{tr('صارم', 'Strict')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="rounded-xl"
                onClick={() => {
                  addOverlay('RULES', { rules: { strictness } });
                }}
              >
                {tr('تحديث', 'Update')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isSuggestionsOpen} onOpenChange={setIsSuggestionsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('اقتراحات المنظمة', 'Organization Suggestions')}</DialogTitle>
            <DialogDescription>
              {tr('خيارات مقترحة بناءً على ملف المنظمة. طبّق فقط ما تحتاجه.', 'Suggested options based on organization profile. Apply only what you need.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 overflow-y-auto pr-2 max-h-[70vh]">
            <div className="space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الأساسيات - إلزامي', 'Foundation – Required')}</span>
              <div className="text-xs text-muted-foreground">
                {tr('الامتثال والسلامة والجاهزية التنظيمية.', 'Compliance, safety, regulatory readiness.')}
              </div>
              {isLoadingSuggestions ? (
                <div className="text-sm text-muted-foreground">{tr('جارٍ تحميل الاقتراحات...', 'Loading suggestions...')}</div>
              ) : suggestionGroups.FOUNDATION.length === 0 ? (
                <div className="text-sm text-muted-foreground">{tr('لا توجد اقتراحات متاحة', 'No suggestions available')}</div>
              ) : (
                suggestionGroups.FOUNDATION.map(renderSuggestionItem)
              )}
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('جاهزية الاعتماد', 'Accreditation-Ready')}</span>
              <div className="text-xs text-muted-foreground">
                {tr('الجاهزية للتدقيق والحوكمة وأطر الجودة.', 'Audit readiness, governance, and quality frameworks.')}
              </div>
              {isLoadingSuggestions ? (
                <div className="text-sm text-muted-foreground">{tr('جارٍ تحميل الاقتراحات...', 'Loading suggestions...')}</div>
              ) : suggestionGroups.ACCREDITATION_READY.length === 0 ? (
                <div className="text-sm text-muted-foreground">{tr('لا توجد اقتراحات متاحة', 'No suggestions available')}</div>
              ) : (
                suggestionGroups.ACCREDITATION_READY.map(renderSuggestionItem)
              )}
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التميّز التشغيلي', 'Operational Excellence')}</span>
              <div className="text-xs text-muted-foreground">
                {tr('سير عمل متسق وقوائم فحص وجاهزية تنفيذ.', 'Consistent workflows, checklists, and execution readiness.')}
              </div>
              {isLoadingSuggestions ? (
                <div className="text-sm text-muted-foreground">{tr('جارٍ تحميل الاقتراحات...', 'Loading suggestions...')}</div>
              ) : suggestionGroups.OPERATIONAL_EXCELLENCE.length === 0 ? (
                <div className="text-sm text-muted-foreground">{tr('لا توجد اقتراحات متاحة', 'No suggestions available')}</div>
              ) : (
                suggestionGroups.OPERATIONAL_EXCELLENCE.map(renderSuggestionItem)
              )}
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النضج المتقدم', 'Advanced Maturity')}</span>
              <div className="text-xs text-muted-foreground">
                {tr('استشراف المستقبل والتحسين المستمر وجاهزية النمو.', 'Future-proofing, continuous improvement, and growth readiness.')}
              </div>
              {isLoadingSuggestions ? (
                <div className="text-sm text-muted-foreground">{tr('جارٍ تحميل الاقتراحات...', 'Loading suggestions...')}</div>
              ) : suggestionGroups.ADVANCED_MATURITY.length === 0 ? (
                <div className="text-sm text-muted-foreground">{tr('لا توجد اقتراحات متاحة', 'No suggestions available')}</div>
              ) : (
                suggestionGroups.ADVANCED_MATURITY.map(renderSuggestionItem)
              )}
            </div>
          </div>
          <DialogFooter>
            <Button className="rounded-xl" variant="outline" onClick={() => setIsSuggestionsOpen(false)}>
              {tr('إغلاق', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
