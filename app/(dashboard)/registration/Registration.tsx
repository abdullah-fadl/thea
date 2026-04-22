/**
 * Patient Registration — Thea UI Design
 *
 * Same logic as RegistrationLegacy, restyled with Thea UI design language:
 * - rounded-2xl section cards with Thea borders
 * - patient result rows with avatars (replaces Table)
 * - rounded-xl inputs with thea-input-focus
 * - TheaStatusBadge for patient statuses
 * - uppercase 11px labels
 * - thea-hover-lift + thea-transition-fast
 */
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { TheaStatusBadge } from '@/components/thea-ui';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import allergyCatalog from '@/data/allergy-catalog.json';
import { Search, UserPlus, GitMerge, AlertCircle, Shield } from 'lucide-react';

/* ── Stable components (must be outside Registration to prevent re-mount on every keystroke) ── */
const Section = ({ title, description, icon, children, className = '' }: {
  title: string; description?: string; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) => (
  <div className={`bg-card border border-border rounded-2xl overflow-hidden thea-animate-slide-up ${className}`}>
    <div className="px-5 py-4 border-b border-border flex items-center gap-3">
      {icon && (
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h2 className="font-extrabold text-base text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const TheaLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
    {children}
  </label>
);

const TheaInputField = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full py-2.5 px-3 rounded-xl border-[1.5px] border-border bg-muted/30 text-[13px] text-foreground placeholder:text-muted-foreground outline-none thea-input-focus thea-transition-fast ${props.className || ''}`}
  />
);

const TheaPrimaryBtn = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={`bg-primary text-white rounded-xl font-bold px-5 py-2.5 text-sm thea-transition-fast hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}
  />
);

const TheaOutlineBtn = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={`border border-border rounded-xl text-sm font-medium px-4 py-2.5 thea-transition-fast hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}
  />
);

const TheaSmBtn = ({ children, active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) => (
  <button
    {...props}
    className={`text-[11px] px-3 py-1.5 rounded-xl border font-semibold thea-transition-fast disabled:opacity-50 disabled:cursor-not-allowed ${
      active ? 'bg-primary text-white border-primary' : 'border-border text-foreground hover:bg-muted'
    } ${props.className || ''}`}
  >
    {children}
  </button>
);

/* ══════════════════════════════════════════════════════════════
   صفحة التسجيل – Registration Page (Thea UI Design)
   ══════════════════════════════════════════════════════════════ */
export default function Registration() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/registration');
  const { me } = useMe();

  const tenantId = String(me?.tenantId || '');
  const email = String(me?.user?.email || '');
  const role = String(me?.user?.role || '');
  const canMerge = canAccessChargeConsole({ email, tenantId, role });

  /* ── Search State ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDob, setSearchDob] = useState('');
  const [searchId, setSearchId] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  /* ── Selection & Merge State ── */
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [mergeTarget, setMergeTarget] = useState<any>(null);
  const [mergeSource, setMergeSource] = useState<any>(null);
  const [mergeReason, setMergeReason] = useState('');
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  /* ── Create Patient State ── */
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('UNKNOWN');
  const [nationalId, setNationalId] = useState('');
  const [iqama, setIqama] = useState('');
  const [passport, setPassport] = useState('');
  const [mobile, setMobile] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState('');
  const [allergySearchQuery, setAllergySearchQuery] = useState('');
  const [showAllergyDropdown, setShowAllergyDropdown] = useState(false);
  const [nationality, setNationality] = useState('');
  const [city, setCity] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupApplyOnCreate, setLookupApplyOnCreate] = useState(false);

  /* ── Edit Demographics State ── */
  const [editDemographicsOpen, setEditDemographicsOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editGender, setEditGender] = useState<string>('');
  const [editReason, setEditReason] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  /* ── Ordered Results ── */
  const orderedResults = useMemo(() => {
    const items = Array.isArray(searchResults) ? [...searchResults] : [];
    return items.sort((a, b) => {
      const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aDate !== bDate) return aDate - bDate;
      const aTie = String(a?.id || '');
      const bTie = String(b?.id || '');
      return aTie.localeCompare(bTie);
    });
  }, [searchResults]);

  /* ── Merge auto-clear effects ── */
  useEffect(() => {
    if (!orderedResults.length) return;
    if (mergeTarget?.id) {
      const latest = orderedResults.find((item) => item.id === mergeTarget.id);
      if (latest && String(latest.status || '') === 'MERGED') {
        setMergeTarget(null);
        toast({ title: tr('تم مسح الهدف', 'Target cleared'), description: tr('المريض الهدف تم دمجه.', 'Target patient was merged.'), variant: 'destructive' as const });
      } else if (latest) {
        setMergeTarget(latest);
      }
    }
    if (mergeSource?.id) {
      const latest = orderedResults.find((item) => item.id === mergeSource.id);
      if (latest && String(latest.status || '') === 'MERGED') {
        setMergeSource(null);
        toast({ title: tr('تم مسح المصدر', 'Source cleared'), description: tr('المريض المصدر تم دمجه.', 'Source patient was merged.'), variant: 'destructive' as const });
      } else if (latest) {
        setMergeSource(latest);
      }
    }
  }, [orderedResults, mergeTarget, mergeSource, toast]);

  useEffect(() => {
    const mergedTarget = mergeTarget && String(mergeTarget.status || '') === 'MERGED';
    const mergedSource = mergeSource && String(mergeSource.status || '') === 'MERGED';
    if (mergedTarget) {
      setMergeTarget(null);
      toast({ title: tr('تم مسح الهدف', 'Target cleared'), description: tr('المريض الهدف تم دمجه.', 'Target patient was merged.'), variant: 'destructive' as const });
    }
    if (mergedSource) {
      setMergeSource(null);
      toast({ title: tr('تم مسح المصدر', 'Source cleared'), description: tr('المريض المصدر تم دمجه.', 'Source patient was merged.'), variant: 'destructive' as const });
    }
  }, [mergeTarget, mergeSource, toast]);

  /* ══════════════════════════════════════════════════════════════
     API Functions — identical logic
     ══════════════════════════════════════════════════════════════ */
  const runSearch = async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (searchDob) params.set('dob', searchDob);
      if (searchId.trim()) {
        params.set('nationalId', searchId.trim());
        params.set('iqama', searchId.trim());
        params.set('passport', searchId.trim());
      }
      const res = await fetch(`/api/patients/search?${params.toString()}`, { credentials: 'include' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل البحث', 'Search failed'));
      setSearchResults(Array.isArray(payload.items) ? payload.items : []);
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: (err instanceof Error ? err.message : null) || tr('فشل البحث', 'Search failed'), variant: 'destructive' as const });
    } finally {
      setSearching(false);
    }
  };

  const splitLookupName = (payload: any) => {
    const fullName = String(payload?.fullNameEn || payload?.fullNameAr || '').trim();
    if (!fullName) return { firstName: '', lastName: '' };
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  };

  const toInputDate = (value: any) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };

  const runIdentityLookup = async () => {
    if (!nationalId.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupApplyOnCreate(false);
    try {
      const clientRequestId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `lookup-${Date.now()}`;
      const res = await fetch('/api/identity/lookup', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityType: 'NATIONAL_ID',
          identityValue: nationalId,
          dob: dob || undefined,
          contextArea: 'registration',
          clientRequestId,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.code === 'DOB_REQUIRED' ? tr('تاريخ الميلاد مطلوب للتحقق.', 'Date of birth is required for verification.') : payload?.error || tr('فشل البحث', 'Lookup failed');
        throw new Error(msg);
      }
      setLookupResult(payload);
    } catch (err: unknown) {
      setLookupError((err instanceof Error ? err.message : null) || tr('فشل البحث', 'Lookup failed'));
    } finally {
      setLookupLoading(false);
    }
  };

  function getDisplayNamePart(value: any, fallback: string): string {
    if (value == null || value === '') return fallback;
    if (typeof value === 'object' || (typeof value === 'string' && value.trim().startsWith('{'))) return fallback;
    return String(value).trim();
  }

  const openEditDemographics = (patient: any) => {
    setEditTarget(patient);
    const fullName = String(patient?.fullName || '').trim();
    const parts = fullName ? fullName.split(/\s+/) : [];
    const firstFallback = parts[0] || '';
    const lastFallback = parts.length > 1 ? parts.slice(1).join(' ') : (parts[0] || '');
    setEditFirstName(getDisplayNamePart(patient?.firstName, firstFallback));
    setEditLastName(getDisplayNamePart(patient?.lastName, lastFallback));
    setEditDob(toInputDate(patient?.dob));
    setEditNationalId(patient?.identifiers?.nationalId || patient?.nationalId || '');
    setEditGender(patient?.gender && ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].includes(String(patient.gender).toUpperCase()) ? String(patient.gender).toUpperCase() : '');
    setEditReason('');
    setEditDemographicsOpen(true);
  };

  const saveEditDemographics = async () => {
    if (!editTarget?.id) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(editTarget.id)}/demographics`, {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editFirstName || 'Unknown',
          lastName: editLastName || '',
          dob: editDob || null,
          nationalId: editNationalId || null,
          ...(editGender && { gender: editGender }),
          reason: editReason || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل التحديث', 'Update failed'));
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم تحديث البيانات الديموغرافية.', 'Demographics updated.') });
      setEditDemographicsOpen(false);
      await runSearch();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: (err instanceof Error ? err.message : null) || tr('فشل', 'Failed'), variant: 'destructive' as const });
    } finally {
      setEditSaving(false);
    }
  };

  const createPatient = async () => {
    setCreatingPatient(true);
    try {
      const res = await fetch('/api/patients', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          dob: dob || undefined,
          gender,
          identifiers: { nationalId, iqama, passport },
          mobile: mobile || undefined,
          email: patientEmail || undefined,
          bloodType: bloodType || undefined,
          knownAllergies: selectedAllergies.length ? selectedAllergies : undefined,
          nationality: nationality || undefined,
          city: city || undefined,
          emergencyContact: (emergencyName || emergencyPhone) ? {
            name: emergencyName || undefined,
            phone: emergencyPhone || undefined,
            relation: emergencyRelation || undefined,
          } : undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل إنشاء المريض', 'Failed to create patient'));
      setSelectedPatient(payload.patient || null);
      setDuplicateCandidates(Array.isArray(payload.duplicateCandidates) ? payload.duplicateCandidates : []);
      if (lookupApplyOnCreate && lookupResult?.lookupId && payload?.patient?.id) {
        try {
          const clientRequestId =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `apply-${Date.now()}`;
          await fetch('/api/identity/apply-to-patient', {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lookupId: lookupResult.lookupId,
              patientMasterId: payload.patient.id,
              clientRequestId,
            }),
          });
        } catch {
          // best-effort only
        }
      }
      toast({ title: tr('تم بنجاح', 'Success'), description: payload.noOp ? tr('المريض موجود مسبقاً.', 'Patient already exists.') : tr('تم إنشاء المريض.', 'Patient created.') });
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: (err instanceof Error ? err.message : null) || tr('فشل', 'Failed'), variant: 'destructive' as const });
    } finally {
      setCreatingPatient(false);
    }
  };

  const setAsMergeTarget = (patient: any) => {
    if (mergeSource?.id && mergeSource.id === patient.id) {
      toast({ title: tr('اختيار غير صالح', 'Invalid selection'), description: tr('يجب أن يكون الهدف والمصدر مختلفين.', 'Target and source must be different.') });
      return;
    }
    setMergeTarget(patient);
  };

  const setAsMergeSource = (patient: any) => {
    if (mergeTarget?.id && mergeTarget.id === patient.id) {
      toast({ title: tr('اختيار غير صالح', 'Invalid selection'), description: tr('يجب أن يكون الهدف والمصدر مختلفين.', 'Target and source must be different.') });
      return;
    }
    setMergeSource(patient);
  };

  const runMerge = async () => {
    if (!mergeTarget?.id || !mergeSource?.id || !mergeReason.trim()) {
      toast({ title: tr('بيانات مفقودة', 'Missing data'), description: tr('الهدف والمصدر والسبب مطلوبون.', 'Target, source, and reason are required.') });
      return;
    }
    setMerging(true);
    try {
      const res = await fetch('/api/patients/merge', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePatientId: mergeSource.id,
          targetPatientId: mergeTarget.id,
          reason: mergeReason.trim(),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = payload?.error || tr('فشل الدمج', 'Merge failed');
        toast({ title: tr('خطأ', 'Error'), description: message, variant: 'destructive' as const });
        return;
      }
      toast({ title: tr('تم الدمج بنجاح', 'Merge successful') });
      setMergeTarget(null);
      setMergeSource(null);
      setMergeReason('');
      await runSearch();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: (err instanceof Error ? err.message : null) || tr('فشل الدمج', 'Merge failed'), variant: 'destructive' as const });
    } finally {
      setMerging(false);
      setMergeConfirmOpen(false);
    }
  };

  /* ── Allergy helpers ── */
  const allAllergyItems = allergyCatalog.categories.flatMap(cat =>
    cat.items.map(item => ({ ...item, categoryAr: cat.nameAr, categoryEn: cat.nameEn }))
  );

  const isExclusiveSelected = selectedAllergies.some(id =>
    allergyCatalog.specialOptions.some(opt => opt.id === id && opt.exclusive)
  );

  const toggleAllergy = (id: string) => {
    const isSpecial = allergyCatalog.specialOptions.find(opt => opt.id === id);
    if (isSpecial?.exclusive) {
      setSelectedAllergies(prev => prev.includes(id) ? [] : [id]);
    } else {
      setSelectedAllergies(prev => {
        const withoutExclusive = prev.filter(pid =>
          !allergyCatalog.specialOptions.some(opt => opt.id === pid && opt.exclusive)
        );
        return withoutExclusive.includes(id)
          ? withoutExclusive.filter(pid => pid !== id)
          : [...withoutExclusive, id];
      });
    }
  };

  const addCustomAllergy = () => {
    const trimmed = customAllergy.trim();
    if (trimmed && !selectedAllergies.includes(`CUSTOM:${trimmed}`)) {
      setSelectedAllergies(prev => {
        const withoutExclusive = prev.filter(pid =>
          !allergyCatalog.specialOptions.some(opt => opt.id === pid && opt.exclusive)
        );
        return [...withoutExclusive, `CUSTOM:${trimmed}`];
      });
      setCustomAllergy('');
    }
  };

  const getAllergyLabel = (id: string): string => {
    if (id.startsWith('CUSTOM:')) return id.replace('CUSTOM:', '') + tr(' (مخصص)', ' (custom)');
    const special = allergyCatalog.specialOptions.find(opt => opt.id === id);
    if (special) return language === 'ar' ? special.nameAr : special.nameEn;
    const item = allAllergyItems.find(i => i.id === id);
    return item ? (language === 'ar' ? `${item.nameAr} – ${item.nameEn}` : `${item.nameEn} – ${item.nameAr}`) : id;
  };

  /* ══════════════════════════════════════════════════════════════
     Loading / Unauthorized states
     ══════════════════════════════════════════════════════════════ */
  if (isLoading) {
    return (
      <div className="p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
          <h2 className="font-extrabold text-base">{tr('سجل المرضى', 'Patient Registration')}</h2>
          <p className="text-xs text-muted-foreground mt-1">{tr('جاري التحميل...', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="font-extrabold text-base">{tr('سجل المرضى', 'Patient Registration')}</h2>
          <p className="text-xs text-muted-foreground mt-1">{tr('غير مصرح', 'Unauthorized')}</p>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     Main Render — Thea UI Design
     ══════════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 md:p-6 space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">{tr('سجل المرضى', 'Patient Registration')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('البحث وإنشاء وإدارة سجلات المرضى', 'Search, create, and manage patient records')}</p>
        </div>
        <Link
          href="/search"
          className="border border-border rounded-xl text-sm font-medium px-4 py-2.5 thea-transition-fast hover:bg-muted"
        >
          {tr('البحث الموحد', 'Unified Search')}
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════
         Section 1 — Patient Search
         ════════════════════════════════════════════════════════ */}
      <Section
        title={tr('البحث عن مريض', 'Search Patients')}
        description={tr('ابحث بالاسم أو المعرف أو تاريخ الميلاد', 'Search by name, identifier, or date of birth')}
        icon={<Search className="w-4 h-4" />}
      >
        {/* Search inputs */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <TheaLabel>{tr('بحث بالاسم / المعرف', 'NAME / ID')}</TheaLabel>
            <TheaInputField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr('الاسم أو المعرف', 'Name or ID')}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            />
          </div>
          <div className="space-y-1.5">
            <TheaLabel>{tr('تاريخ الميلاد', 'DATE OF BIRTH')}</TheaLabel>
            <TheaInputField
              type="date"
              value={searchDob}
              onChange={(e) => setSearchDob(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <TheaLabel>{tr('المعرّف', 'IDENTIFIER')}</TheaLabel>
            <TheaInputField
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder={tr('هوية وطنية / إقامة', 'National ID / Iqama')}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            />
          </div>
          <div className="flex items-end">
            <TheaPrimaryBtn onClick={runSearch} disabled={searching} className="w-full">
              {searching ? tr('جاري البحث...', 'Searching...') : tr('بحث', 'Search')}
            </TheaPrimaryBtn>
          </div>
        </div>

        {/* Search Results — card rows */}
        <div className="space-y-2 mt-2">
          {orderedResults.length ? (
            orderedResults.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center gap-3 p-3.5 bg-card border border-border rounded-2xl thea-hover-lift thea-transition-fast"
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6693f5, #3366e6)' }}
                >
                  {(patient.fullName || '?').charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-foreground">{patient.fullName || tr('غير معروف', 'Unknown')}</div>
                  <div className="text-[11px] text-muted-foreground">{patient.mrn || patient.id}</div>
                </div>

                {/* Status badge */}
                <TheaStatusBadge status={patient.status || 'UNKNOWN'} size="sm" />

                {/* Identifier — hidden on mobile */}
                <div className="text-[11px] text-muted-foreground hidden md:block min-w-[80px]">
                  {patient.identifiers?.nationalId || patient.identifiers?.iqama || patient.identifiers?.passport || '—'}
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 shrink-0 flex-wrap">
                  <TheaSmBtn onClick={() => setSelectedPatient(patient)}>
                    {tr('اختيار', 'Select')}
                  </TheaSmBtn>
                  <TheaSmBtn onClick={() => openEditDemographics(patient)}>
                    {tr('تعديل', 'Edit')}
                  </TheaSmBtn>
                  <Link
                    href={`/patient/${patient.id}`}
                    className="text-[11px] px-3 py-1.5 rounded-xl border border-border font-semibold thea-transition-fast hover:bg-muted inline-flex items-center"
                  >
                    {tr('الملف', 'File')}
                  </Link>
                  {canMerge && (
                    <>
                      <TheaSmBtn
                        onClick={() => setAsMergeTarget(patient)}
                        disabled={patient.status === 'MERGED'}
                      >
                        {tr('هدف', 'Target')}
                      </TheaSmBtn>
                      <TheaSmBtn
                        onClick={() => setAsMergeSource(patient)}
                        disabled={patient.status === 'MERGED'}
                      >
                        {tr('مصدر', 'Source')}
                      </TheaSmBtn>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-muted/50 p-8 text-center">
              <Search className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{tr('لا توجد نتائج بعد.', 'No results yet.')}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{tr('ابحث عن مريض للبدء', 'Search for a patient to get started')}</p>
            </div>
          )}
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════
         Section 2 — Merge Patients (admin only)
         ════════════════════════════════════════════════════════ */}
      {canMerge && (
        <Section
          title={tr('دمج المرضى', 'Merge Patients')}
          description={tr('دمج يدوي مع تدقيق وضوابط أمان', 'Manual merge with audit and safety controls')}
          icon={<GitMerge className="w-4 h-4" />}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {/* Target card */}
            <div className={`rounded-2xl border-[1.5px] p-4 thea-transition-fast ${
              mergeTarget ? 'border-primary bg-primary/5' : 'border-dashed border-muted-foreground/30'
            }`}>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {tr('الهدف (يُحتفظ به)', 'Target (kept)')}
              </div>
              {mergeTarget ? (
                <div className="space-y-1.5">
                  <div className="font-bold text-sm">{mergeTarget.fullName || tr('غير معروف', 'Unknown')}</div>
                  <div className="text-[11px] text-muted-foreground">{String(mergeTarget.id || '').slice(0, 8)}</div>
                  <TheaStatusBadge status={mergeTarget.status || 'UNKNOWN'} size="sm" />
                  <div className="text-[11px] text-muted-foreground">
                    {mergeTarget.identifiers?.nationalId || mergeTarget.identifiers?.iqama || mergeTarget.identifiers?.passport || '—'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMergeTarget(null)}
                    className="text-[10px] text-red-500 hover:underline mt-1"
                  >
                    {tr('إزالة', 'Remove')}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{tr('اختر هدفاً من نتائج البحث.', 'Select a target from search results.')}</p>
              )}
            </div>

            {/* Source card */}
            <div className={`rounded-2xl border-[1.5px] p-4 thea-transition-fast ${
              mergeSource ? 'border-orange-500 bg-orange-500/5' : 'border-dashed border-muted-foreground/30'
            }`}>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {tr('المصدر (يُدمج في الهدف)', 'Source (merged into target)')}
              </div>
              {mergeSource ? (
                <div className="space-y-1.5">
                  <div className="font-bold text-sm">{mergeSource.fullName || tr('غير معروف', 'Unknown')}</div>
                  <div className="text-[11px] text-muted-foreground">{String(mergeSource.id || '').slice(0, 8)}</div>
                  <TheaStatusBadge status={mergeSource.status || 'UNKNOWN'} size="sm" />
                  <div className="text-[11px] text-muted-foreground">
                    {mergeSource.identifiers?.nationalId || mergeSource.identifiers?.iqama || mergeSource.identifiers?.passport || '—'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMergeSource(null)}
                    className="text-[10px] text-red-500 hover:underline mt-1"
                  >
                    {tr('إزالة', 'Remove')}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{tr('اختر مصدراً من نتائج البحث.', 'Select a source from search results.')}</p>
              )}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <TheaLabel>{tr('السبب (مطلوب)', 'REASON (REQUIRED)')}</TheaLabel>
            <Textarea
              value={mergeReason}
              onChange={(e) => setMergeReason(e.target.value)}
              placeholder={tr('لماذا هذه السجلات مكررة؟', 'Why are these records duplicates?')}
              className="rounded-xl border-[1.5px] border-border bg-muted/30 text-[13px] thea-input-focus thea-transition-fast min-h-[80px]"
            />
          </div>

          {/* Merge button + confirmation */}
          <AlertDialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
            <button
              type="button"
              disabled={!mergeTarget?.id || !mergeSource?.id || !mergeReason.trim() || merging}
              onClick={() => setMergeConfirmOpen(true)}
              className="bg-red-500 text-white rounded-xl font-bold px-5 py-2.5 text-sm thea-transition-fast hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {merging ? tr('جاري الدمج...', 'Merging...') : tr('دمج الآن', 'Merge Now')}
            </button>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>{tr('تأكيد الدمج', 'Confirm Merge')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tr('سيتم دمج المصدر في الهدف. سيصبح المصدر مدمجاً ولا يمكن استخدامه.', 'The source will be merged into the target. The source will become merged and unusable.')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">{tr('إلغاء', 'Cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={runMerge} className="rounded-xl bg-red-500 hover:bg-red-600">
                  {tr('تأكيد الدمج', 'Confirm Merge')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Section>
      )}

      {/* ════════════════════════════════════════════════════════
         Section 3 — Create Patient
         ════════════════════════════════════════════════════════ */}
      <Section
        title={tr('إنشاء مريض', 'Create Patient')}
        description={tr('يُسمح بالمرضى غير المعروفين', 'Unknown patients are allowed')}
        icon={<UserPlus className="w-4 h-4" />}
      >
        {/* ── Basic Info ── */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <TheaLabel>{tr('الاسم الأول', 'FIRST NAME')}</TheaLabel>
            <TheaInputField value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <TheaLabel>{tr('اسم العائلة', 'LAST NAME')}</TheaLabel>
            <TheaInputField value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <TheaLabel>{tr('تاريخ الميلاد', 'DATE OF BIRTH')}</TheaLabel>
            <TheaInputField type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <TheaLabel>{tr('الجنس', 'GENDER')}</TheaLabel>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="rounded-xl border-[1.5px] border-border bg-muted/30 text-[13px] h-[42px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNKNOWN">{tr('غير معروف', 'Unknown')}</SelectItem>
                <SelectItem value="MALE">{tr('ذكر', 'Male')}</SelectItem>
                <SelectItem value="FEMALE">{tr('أنثى', 'Female')}</SelectItem>
                <SelectItem value="OTHER">{tr('أخرى', 'Other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Identifiers ── */}
        <div className="pt-4 border-t border-border">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{tr('المعرّفات', 'Identifiers')}</h4>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <TheaLabel>{tr('الهوية الوطنية', 'NATIONAL ID')}</TheaLabel>
              <TheaInputField value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <TheaLabel>{tr('الإقامة', 'IQAMA')}</TheaLabel>
              <TheaInputField value={iqama} onChange={(e) => setIqama(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <TheaLabel>{tr('جواز السفر', 'PASSPORT')}</TheaLabel>
              <TheaInputField value={passport} onChange={(e) => setPassport(e.target.value)} />
            </div>
          </div>

          {/* Identity Lookup */}
          <div className="flex items-center justify-between gap-3 mt-3">
            <div className="text-[11px] text-muted-foreground">{tr('تاريخ الميلاد مطلوب للتحقق.', 'Date of birth is required for verification.')}</div>
            <TheaOutlineBtn
              onClick={runIdentityLookup}
              disabled={!nationalId.trim() || lookupLoading}
            >
              <Shield className="w-3.5 h-3.5 inline-block me-1.5" />
              {lookupLoading ? tr('جاري البحث...', 'Looking up...') : tr('التحقق من الهوية', 'Verify Identity')}
            </TheaOutlineBtn>
          </div>

          {lookupError && (
            <div className="text-xs text-destructive mt-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {lookupError}
            </div>
          )}

          {lookupResult && (
            <div className={`mt-3 rounded-xl border-[1.5px] p-4 thea-transition-fast ${
              lookupResult.matchLevel === 'VERIFIED'
                ? 'border-emerald-400/50 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-border bg-muted/30'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  lookupResult.matchLevel === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {lookupResult.matchLevel}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {lookupResult.matchLevel === 'VERIFIED'
                    ? tr('تم التحقق من الهوية عبر البحث الحكومي.', 'Identity verified via government lookup.')
                    : lookupResult.matchLevel === 'PARTIAL'
                    ? tr('تاريخ الميلاد مفقود. تحقق لاحقاً بإدخال تاريخ الميلاد.', 'DOB missing. Verify later by providing DOB.')
                    : tr('لم يتم العثور على تطابق.', 'No match found.')}
                </span>
              </div>
              {lookupResult.payload && (
                <div className="text-xs text-muted-foreground mb-2">
                  {lookupResult.payload.fullNameEn || lookupResult.payload.fullNameAr || '—'} •{' '}
                  {lookupResult.payload.gender || '—'} • {lookupResult.payload.dob || '—'}
                </div>
              )}
              <TheaSmBtn
                onClick={() => {
                  if (!lookupResult?.payload) return;
                  const name = splitLookupName(lookupResult.payload);
                  setFirstName(name.firstName);
                  setLastName(name.lastName);
                  if (lookupResult.payload.gender) setGender(lookupResult.payload.gender);
                  if (lookupResult.payload.dob) setDob(lookupResult.payload.dob);
                  setLookupApplyOnCreate(true);
                }}
                disabled={!lookupResult.payload}
              >
                {tr('تطبيق على المريض', 'Apply to Patient')}
              </TheaSmBtn>
            </div>
          )}
        </div>

        {/* ── Contact Info ── */}
        <div className="pt-4 border-t border-border">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{tr('معلومات التواصل', 'Contact Information')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <TheaLabel>{tr('رقم الجوال', 'MOBILE')}</TheaLabel>
              <TheaInputField value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <TheaLabel>{tr('البريد الإلكتروني', 'EMAIL')}</TheaLabel>
              <TheaInputField value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} placeholder="email@example.com" dir="ltr" />
            </div>
          </div>
        </div>

        {/* ── Medical Info ── */}
        <div className="pt-4 border-t border-border">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{tr('معلومات طبية', 'Medical Information')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <TheaLabel>{tr('فصيلة الدم', 'BLOOD TYPE')}</TheaLabel>
              <Select value={bloodType} onValueChange={setBloodType}>
                <SelectTrigger className="rounded-xl border-[1.5px] border-border bg-muted/30 text-[13px] h-[42px]">
                  <SelectValue placeholder={tr('اختر', 'Select')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <TheaLabel>{tr('الجنسية', 'NATIONALITY')}</TheaLabel>
              <TheaInputField value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder={tr('سعودي', 'Saudi')} />
            </div>
          </div>

          {/* ── Allergies ── */}
          <div className="space-y-2.5 mt-4">
            <TheaLabel>{tr('الحساسية المعروفة', 'KNOWN ALLERGIES')}</TheaLabel>

            {/* Selected allergy tags */}
            {selectedAllergies.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedAllergies.map(id => (
                  <span key={id} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {getAllergyLabel(id)}
                    <button type="button" className="hover:text-red-500 ms-0.5" onClick={() => toggleAllergy(id)}>×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Special options (NKDA, NKA, etc.) */}
            <div className="flex flex-wrap gap-1.5">
              {allergyCatalog.specialOptions.map(opt => (
                <TheaSmBtn
                  key={opt.id}
                  type="button"
                  active={selectedAllergies.includes(opt.id)}
                  onClick={() => toggleAllergy(opt.id)}
                >
                  {language === 'ar' ? opt.nameAr : opt.nameEn}
                </TheaSmBtn>
              ))}
            </div>

            {/* Allergy search dropdown */}
            {!isExclusiveSelected && (
              <div className="relative">
                <TheaInputField
                  placeholder={tr('ابحث عن حساسية...', 'Search for allergy...')}
                  value={allergySearchQuery}
                  onChange={(e) => {
                    setAllergySearchQuery(e.target.value);
                    setShowAllergyDropdown(true);
                  }}
                  onFocus={() => setShowAllergyDropdown(true)}
                />
                {showAllergyDropdown && allergySearchQuery.trim() && (
                  <div className="absolute z-50 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-lg thea-scroll">
                    {allergyCatalog.categories.map(cat => {
                      const filtered = cat.items.filter(item =>
                        item.nameAr.includes(allergySearchQuery) ||
                        item.nameEn.toLowerCase().includes(allergySearchQuery.toLowerCase())
                      );
                      if (!filtered.length) return null;
                      return (
                        <div key={cat.id}>
                          <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50 sticky top-0">
                            {language === 'ar' ? `${cat.nameAr} – ${cat.nameEn}` : `${cat.nameEn} – ${cat.nameAr}`}
                          </div>
                          {filtered.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              className={`w-full ${isRTL ? 'text-right' : 'text-left'} px-3 py-2 text-[12px] hover:bg-muted/50 flex items-center justify-between thea-transition-fast ${
                                selectedAllergies.includes(item.id) ? 'bg-primary/5 font-semibold' : ''
                              }`}
                              onClick={() => {
                                toggleAllergy(item.id);
                                setAllergySearchQuery('');
                                setShowAllergyDropdown(false);
                              }}
                            >
                              <span>{language === 'ar' ? `${item.nameAr} – ${item.nameEn}` : `${item.nameEn} – ${item.nameAr}`}</span>
                              {selectedAllergies.includes(item.id) && <span className="text-primary font-bold">✓</span>}
                            </button>
                          ))}
                        </div>
                      );
                    })}

                    {/* Custom allergy input */}
                    <div className="px-3 py-2.5 border-t border-border">
                      <div className="flex gap-2">
                        <TheaInputField
                          placeholder={tr('حساسية أخرى غير مدرجة...', 'Other unlisted allergy...')}
                          value={customAllergy}
                          onChange={(e) => setCustomAllergy(e.target.value)}
                          className="!py-1.5 text-[12px]"
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomAllergy(); } }}
                        />
                        <TheaSmBtn type="button" onClick={addCustomAllergy} disabled={!customAllergy.trim()}>
                          {tr('إضافة', 'Add')}
                        </TheaSmBtn>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full text-center text-[11px] text-muted-foreground py-1.5 hover:bg-muted/50 thea-transition-fast"
                      onClick={() => { setShowAllergyDropdown(false); setAllergySearchQuery(''); }}
                    >
                      {tr('إغلاق ▲', 'Close ▲')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* City */}
          <div className="space-y-1.5 mt-3">
            <TheaLabel>{tr('المدينة', 'CITY')}</TheaLabel>
            <TheaInputField value={city} onChange={(e) => setCity(e.target.value)} placeholder={tr('الرياض', 'Riyadh')} />
          </div>
        </div>

        {/* ── Emergency Contact ── */}
        <div className="pt-4 border-t border-border">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{tr('جهة اتصال الطوارئ', 'Emergency Contact')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <TheaLabel>{tr('الاسم', 'NAME')}</TheaLabel>
              <TheaInputField value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder={tr('اسم الشخص', 'Contact name')} />
            </div>
            <div className="space-y-1.5">
              <TheaLabel>{tr('رقم الجوال', 'MOBILE')}</TheaLabel>
              <TheaInputField value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <TheaLabel>{tr('الصلة', 'RELATION')}</TheaLabel>
              <Select value={emergencyRelation} onValueChange={setEmergencyRelation}>
                <SelectTrigger className="rounded-xl border-[1.5px] border-border bg-muted/30 text-[13px] h-[42px]">
                  <SelectValue placeholder={tr('اختر', 'Select')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="أب">{tr('أب', 'Father')}</SelectItem>
                  <SelectItem value="أم">{tr('أم', 'Mother')}</SelectItem>
                  <SelectItem value="زوج">{tr('زوج/زوجة', 'Spouse')}</SelectItem>
                  <SelectItem value="ابن">{tr('ابن/ابنة', 'Son/Daughter')}</SelectItem>
                  <SelectItem value="أخ">{tr('أخ/أخت', 'Brother/Sister')}</SelectItem>
                  <SelectItem value="قريب">{tr('قريب', 'Relative')}</SelectItem>
                  <SelectItem value="صديق">{tr('صديق', 'Friend')}</SelectItem>
                  <SelectItem value="أخرى">{tr('أخرى', 'Other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Computed Status + Actions ── */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="space-y-1">
              <TheaLabel>{tr('الحالة المحسوبة', 'COMPUTED STATUS')}</TheaLabel>
              <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full ${
                (nationalId || iqama || passport).trim()
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
              }`}>
                {(nationalId || iqama || passport).trim() ? tr('معروف (تلقائي)', 'Known (auto)') : tr('غير معروف (تلقائي)', 'Unknown (auto)')}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground max-w-[200px] text-end">
              {tr('يتم الكشف تلقائياً من الهوية الوطنية / الإقامة / جواز السفر.', 'Auto-detected from National ID / Iqama / Passport.')}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <TheaPrimaryBtn onClick={createPatient} disabled={creatingPatient}>
              {creatingPatient ? tr('جاري الإنشاء...', 'Creating...') : tr('إنشاء مريض', 'Create Patient')}
            </TheaPrimaryBtn>
            <Link
              href="/registration/insurance"
              className="border border-border rounded-xl text-sm font-medium px-4 py-2.5 thea-transition-fast hover:bg-muted"
            >
              {tr('التأمين (للقراءة فقط)', 'Insurance (read only)')}
            </Link>
          </div>

          {duplicateCandidates.length > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              {tr('مرضى محتمل تكرارهم:', 'Potential duplicate patients:')} {duplicateCandidates.map((c) => c.patientId).join(', ')}
            </div>
          )}
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════
         Edit Demographics Dialog
         ════════════════════════════════════════════════════════ */}
      <Dialog open={editDemographicsOpen} onOpenChange={setEditDemographicsOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تعديل البيانات الديموغرافية', 'Edit Demographics')}</DialogTitle>
            <DialogDescription>{tr('تصحيح الاسم أو تاريخ الميلاد أو الهوية الوطنية (مراقب).', 'Correct name, DOB, or national ID (audited).')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <TheaLabel>{tr('الاسم الأول', 'FIRST NAME')}</TheaLabel>
                <TheaInputField value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <TheaLabel>{tr('اسم العائلة', 'LAST NAME')}</TheaLabel>
                <TheaInputField value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <TheaLabel>{tr('تاريخ الميلاد', 'DATE OF BIRTH')}</TheaLabel>
                <TheaInputField type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <TheaLabel>{tr('الهوية الوطنية', 'NATIONAL ID')}</TheaLabel>
                <TheaInputField value={editNationalId} onChange={(e) => setEditNationalId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <TheaLabel>{tr('الجنس', 'GENDER')}</TheaLabel>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-border bg-muted/30 px-4 py-2.5 text-[13px] thea-input-focus thea-transition-fast"
                >
                  <option value="">{tr('— اختر —', '— Select —')}</option>
                  <option value="MALE">{tr('ذكر', 'Male')}</option>
                  <option value="FEMALE">{tr('أنثى', 'Female')}</option>
                  <option value="OTHER">{tr('آخر', 'Other')}</option>
                  <option value="UNKNOWN">{tr('غير محدد', 'Unknown')}</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <TheaLabel>{tr('السبب (مطلوب في حالة الوفاة أو تصحيح المعرف)', 'REASON (REQUIRED FOR DEATH OR ID CORRECTION)')}</TheaLabel>
              <Textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="rounded-xl border-[1.5px] border-border bg-muted/30 text-[13px] thea-input-focus thea-transition-fast"
              />
            </div>
          </div>
          <DialogFooter>
            <TheaOutlineBtn onClick={() => setEditDemographicsOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </TheaOutlineBtn>
            <TheaPrimaryBtn onClick={saveEditDemographics} disabled={editSaving}>
              {editSaving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </TheaPrimaryBtn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
