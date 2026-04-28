'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Search, Star, X } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export interface ICD10Code {
  code: string;
  description: string;
  descriptionAr?: string;
  shortDesc?: string;
  shortDescAr?: string;
  isCommon?: boolean;
}

export interface SelectedDiagnosis {
  code: string;
  description: string;
  descriptionAr?: string;
  diagnosisType: 'PRIMARY' | 'SECONDARY';
  notes?: string;
}

interface DiagnosisSelectorProps {
  encounterId: string;
  patientId?: string;
  onSave?: () => void;
  required?: boolean;
}

export function DiagnosisSelector({
  encounterId,
  patientId,
  onSave,
  required = true,
}: DiagnosisSelectorProps) {
  const { language } = useLang();
  const { toast } = useToast();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<SelectedDiagnosis[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load existing diagnoses
  const { data: existingData, mutate: mutateExisting } = useSWR(
    encounterId ? `/api/clinical/diagnoses?encounterId=${encounterId}` : null,
    fetcher
  );

  useEffect(() => {
    if (loaded) return;
    if (existingData?.items && Array.isArray(existingData.items) && existingData.items.length > 0) {
      setSelected(
        existingData.items.map((d: { code: string; description: string; descriptionAr?: string; diagnosisType?: string; isPrimary?: boolean; notes?: string }) => ({
          code: d.code,
          description: d.description,
          descriptionAr: d.descriptionAr || '',
          diagnosisType: (d.diagnosisType || (d.isPrimary ? 'PRIMARY' : 'SECONDARY')) as 'PRIMARY' | 'SECONDARY',
          notes: d.notes || '',
        }))
      );
      setLoaded(true);
    }
  }, [existingData, loaded]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search ICD-10
  const { data: searchData, isLoading: searching } = useSWR(
    debouncedQuery.length >= 2
      ? `/api/clinical/icd10/search?q=${encodeURIComponent(debouncedQuery)}`
      : null,
    fetcher
  );

  const searchResults = searchData?.items || [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-diagnosis-selector]')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (item: ICD10Code) => {
    if (selected.some((s) => s.code === item.code)) {
      toast({ title: tr('التشخيص مضاف مسبقاً', 'Diagnosis already added') });
      return;
    }

    const newDiagnosis: SelectedDiagnosis = {
      code: item.code,
      description: item.shortDesc || item.description,
      descriptionAr: item.shortDescAr || item.descriptionAr || '',
      diagnosisType: selected.length === 0 ? 'PRIMARY' : 'SECONDARY',
    };

    setSelected([...selected, newDiagnosis]);
    setQuery('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemove = (code: string) => {
    const newSelected = selected.filter((s) => s.code !== code);
    // If removed PRIMARY, promote first remaining one
    if (newSelected.length > 0 && !newSelected.some((s) => s.diagnosisType === 'PRIMARY')) {
      newSelected[0] = { ...newSelected[0], diagnosisType: 'PRIMARY' };
    }
    setSelected(newSelected);
  };

  const toggleType = (code: string) => {
    setSelected((prev) => {
      const target = prev.find((s) => s.code === code);
      if (!target) return prev;

      if (target.diagnosisType === 'SECONDARY') {
        // Promote to PRIMARY, demote all others
        return prev.map((s) => ({
          ...s,
          diagnosisType: s.code === code ? 'PRIMARY' as const : 'SECONDARY' as const,
        }));
      }
      // Can't demote the only PRIMARY if there's no other PRIMARY
      return prev;
    });
  };

  const handleSave = async () => {
    if (required && selected.length === 0) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr(
          'يجب إضافة تشخيص واحد على الأقل',
          'At least one diagnosis is required'
        ),
        variant: 'destructive' as const,
      });
      return;
    }

    if (selected.length > 0 && !selected.some((s) => s.diagnosisType === 'PRIMARY')) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('يجب تحديد تشخيص رئيسي', 'A primary diagnosis is required'),
        variant: 'destructive' as const,
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/clinical/diagnoses', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterId,
          patientId,
          diagnoses: selected,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.messageEn || err.error || 'Failed to save');
      }

      toast({ title: tr('تم حفظ التشخيصات', 'Diagnoses saved') });
      mutateExisting();
      onSave?.();
    } catch (err: unknown) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive' as const,
      });
    } finally {
      setSaving(false);
    }
  };

  const displayName = (item: ICD10Code) => {
    if (language === 'ar') {
      return item.shortDescAr || item.descriptionAr || item.shortDesc || item.description;
    }
    return item.shortDesc || item.description;
  };

  return (
    <div
      data-diagnosis-selector
      className="bg-card rounded-2xl border border-border p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          {tr('التشخيص', 'Diagnosis')}
          {required && <span className="text-red-500 text-sm">*</span>}
        </h2>
        <button
          onClick={handleSave}
          disabled={saving || (required && selected.length === 0)}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed thea-transition-fast"
        >
          {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <div className="relative">
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {searching ? (
              <span className="inline-block w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder={tr(
              'ابحث عن تشخيص (بالكود أو الاسم)...',
              'Search diagnosis (by code or name)...'
            )}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            className="w-full ps-10 pe-4 py-3 border border-border rounded-xl text-sm bg-background text-foreground
                        placeholder:text-muted-foreground
                        focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                        thea-transition-fast"
          />
        </div>

        {/* Dropdown Results */}
        {showDropdown && debouncedQuery.length >= 2 && (
          <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto thea-scroll">
            {searching ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {tr('جاري البحث...', 'Searching...')}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {tr('لا توجد نتائج', 'No results')}
              </div>
            ) : (
              searchResults.map((item: ICD10Code) => {
                const alreadySelected = selected.some((s) => s.code === item.code);
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleSelect(item)}
                    disabled={alreadySelected}
                    className="w-full px-4 py-3 text-start hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed
                               border-b border-border last:border-0 thea-transition-fast"
                  >
                    <div className="flex items-center gap-2">
                      {item.isCommon && (
                        <Star className="h-3 w-3 text-amber-500" />
                      )}
                      <span className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {item.code}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-0.5">{displayName(item)}</p>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Selected Diagnoses */}
      {selected.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground mb-2">
            {tr('التشخيصات المختارة:', 'Selected diagnoses:')}
          </p>
          {selected.map((d) => (
            <div
              key={d.code}
              className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleType(d.code)}
                  className={`px-2.5 py-1 text-xs rounded-full font-semibold thea-transition-fast whitespace-nowrap ${
                    d.diagnosisType === 'PRIMARY'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 cursor-pointer'
                  }`}
                  title={tr('اضغط لتغيير النوع', 'Click to change type')}
                >
                  {d.diagnosisType === 'PRIMARY'
                    ? tr('رئيسي', 'Primary')
                    : tr('ثانوي', 'Secondary')}
                </button>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-sm text-muted-foreground shrink-0">
                    {d.code}
                  </span>
                  <span className="text-muted-foreground shrink-0">-</span>
                  <span className="text-sm text-foreground truncate">
                    {language === 'ar' ? d.descriptionAr || d.description : d.description}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(d.code)}
                className="p-1.5 text-muted-foreground hover:text-red-500 thea-transition-fast shrink-0 ms-2"
                title={tr('حذف', 'Remove')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>{tr('لم يتم إضافة تشخيصات بعد', 'No diagnoses added yet')}</p>
          <p className="text-sm mt-1">
            {tr('ابحث واختر التشخيصات من القائمة', 'Search and select diagnoses from the list')}
          </p>
        </div>
      )}

      {/* Help Text */}
      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground mt-4">
          {tr(
            'اضغط على "رئيسي/ثانوي" لتغيير نوع التشخيص',
            'Click "Primary/Secondary" to change diagnosis type'
          )}
        </p>
      )}
    </div>
  );
}

export default DiagnosisSelector;
