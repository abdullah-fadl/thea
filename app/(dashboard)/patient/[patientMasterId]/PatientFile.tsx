'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Activity, HeartPulse, List, NotebookText, Pill, Stethoscope, CalendarClock } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { translations } from '@/lib/i18n';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ProblemList } from '@/components/clinical/ProblemList';
import { HomeMedications, type HomeMedication } from '@/components/clinical/HomeMedications';
import { AllergiesManager } from '@/components/clinical/AllergiesManager';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const TIMELINE_ICONS: Record<string, any> = {
  ENCOUNTER_OPENED: Stethoscope,
  ENCOUNTER_CLOSED: Stethoscope,
  CLINICAL_NOTE: NotebookText,
  ORDER_PLACED: Pill,
  RESULT_READY: Activity,
  RESULT_ACK: Activity,
  TASK_COMPLETED: List,
  DISCHARGE_FINALIZED: CalendarClock,
  DEATH_DECLARED: HeartPulse,
  DEATH_FINALIZED: HeartPulse,
  IDENTITY_LOOKUP: Activity,
};

function formatAge(dob: any) {
  const date = dob ? new Date(dob) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return `${years}`;
}

export default function PatientFile({ params }: { params: { patientMasterId: string } }) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { hasPermission, isLoading } = useRoutePermission('/patient');
  const patientMasterId = String(params.patientMasterId || '');
  const t = translations[language] || translations.ar;

  const { data, mutate } = useSWR(
    hasPermission && patientMasterId ? `/api/patient-profile/${encodeURIComponent(patientMasterId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: homeMedsData, mutate: mutateHomeMeds } = useSWR(
    hasPermission && patientMasterId ? `/api/clinical/home-medications/${encodeURIComponent(patientMasterId)}` : null,
    fetcher
  );

  const patient = data?.patient || null;
  const mrn = data?.mrn || null;
  const activeEncounter = data?.activeEncounter || null;
  const encounters = Array.isArray(data?.encounters) ? data.encounters : [];
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const clinicalSnapshot = data?.clinicalSnapshot || null;
  const billingSnapshot = data?.billingSnapshot || null;
  const homeMedications: HomeMedication[] = Array.isArray(homeMedsData?.items) ? homeMedsData.items : [];
  const deathFinalized = Boolean(data?.deathFinalized);

  const [showPast, setShowPast] = useState(false);
  const { me } = useMe();
  const { toast } = useToast();
  const permissions = me?.user?.permissions || [];
  const canEditDemographics = permissions.includes('patients.master.edit');
  const [editOpen, setEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editMiddleName, setEditMiddleName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editIqama, setEditIqama] = useState('');
  const [editPassport, setEditPassport] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editReason, setEditReason] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const patientName = useMemo(() => {
    if (!patient) return 'Unknown';
    return [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ') || patient.fullName || 'Unknown';
  }, [patient]);

  const namePreview = useMemo(() => {
    const parts = [editFirstName, editMiddleName, editLastName].map((v) => String(v || '').trim()).filter(Boolean);
    return parts.join(' ').trim() || 'Unknown';
  }, [editFirstName, editMiddleName, editLastName]);

  const knownPatient = Boolean(patient?.identifiers?.nationalId || patient?.identifiers?.iqama || patient?.identifiers?.passport);
  const roleLower = String(me?.user?.role || '').toLowerCase();
  const canCorrectIdentifiers = roleLower.includes('admin') || roleLower === 'registration_supervisor';

  const toInputDate = (value: any) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };

  const openEdit = () => {
    setEditFirstName(patient?.firstName || '');
    setEditMiddleName(patient?.middleName || '');
    setEditLastName(patient?.lastName || '');
    setEditDob(toInputDate(patient?.dob));
    setEditNationalId(patient?.identifiers?.nationalId || '');
    setEditIqama(patient?.identifiers?.iqama || '');
    setEditPassport(patient?.identifiers?.passport || '');
    const g = patient?.gender && ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].includes(String(patient.gender).toUpperCase()) ? String(patient.gender).toUpperCase() : '';
    setEditGender(g);
    setEditReason('');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!canEditDemographics || !patientMasterId) return;
    setSavingEdit(true);
    try {
      const clientRequestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `name-${Date.now()}`;
      const res = await fetch(`/api/patients/${encodeURIComponent(patientMasterId)}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-client-request-id': clientRequestId,
        },
        body: JSON.stringify({
          firstName: editFirstName,
          middleName: editMiddleName,
          lastName: editLastName,
          dob: editDob || null,
          gender: editGender || undefined,
          identifiers: {
            nationalId: editNationalId,
            iqama: editIqama,
            passport: editPassport,
          },
          reason: editReason,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.code === 'REASON_REQUIRED'
          ? 'Reason is required for known patients.'
          : payload?.error || 'Failed to update name';
        throw new Error(msg);
      }
      await mutate();
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم تحديث اسم المريض.', 'Patient name updated.') });
      setEditOpen(false);
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const addHomeMedication = async (med: Omit<HomeMedication, 'id'>) => {
    if (!patientMasterId) return;
    try {
      const res = await fetch(`/api/clinical/home-medications/${encodeURIComponent(patientMasterId)}`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(med),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to add medication');
      await mutateHomeMeds();
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تمت إضافة الدواء المنزلي.', 'Home medication added.') });
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' });
    }
  };

  const updateHomeMedication = async (id: string, med: Partial<HomeMedication>) => {
    if (!patientMasterId) return;
    try {
      const res = await fetch(
        `/api/clinical/home-medications/${encodeURIComponent(patientMasterId)}/${encodeURIComponent(id)}`,
        {
          credentials: 'include',
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(med),
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to update medication');
      await mutateHomeMeds();
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم تحديث الدواء المنزلي.', 'Home medication updated.') });
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' });
    }
  };

  const deleteHomeMedication = async (id: string) => {
    if (!patientMasterId) return;
    try {
      const res = await fetch(
        `/api/clinical/home-medications/${encodeURIComponent(patientMasterId)}/${encodeURIComponent(id)}`,
        { credentials: 'include', method: 'DELETE' }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to delete medication');
      await mutateHomeMeds();
      toast({ title: tr('تم الحذف', 'Deleted'), description: tr('تمت إزالة الدواء المنزلي.', 'Home medication removed.') });
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' });
    }
  };

  const verifyHomeMedication = async (id: string) => {
    if (!patientMasterId) return;
    await updateHomeMedication(id, { isVerified: true, verifiedAt: new Date().toISOString() });
  };

  const statusBadge = deathFinalized
    ? { label: t.common.deceased || 'Deceased', style: 'destructive' as const }
    : activeEncounter
    ? { label: t.common.active || 'Active', style: 'default' as const }
    : encounters.length
    ? { label: t.common.discharged || 'Discharged', style: 'outline' as const }
    : { label: t.common.unknown || 'Unknown', style: 'secondary' as const };

  const identityBadge = patient?.identityVerification?.matchLevel
    ? {
        label: `Identity ${patient.identityVerification.matchLevel}`,
        style: patient.identityVerification.matchLevel === 'VERIFIED' ? 'default' as const : 'secondary' as const,
      }
    : null;

  const badgeClass = (style: string) => {
    switch (style) {
      case 'destructive':
        return 'inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive';
      case 'outline':
        return 'inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground';
      case 'secondary':
        return 'inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground';
      default:
        return 'inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary';
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border border-border rounded-2xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="text-lg font-semibold text-foreground">{patientName}</div>
            <div className="text-sm text-muted-foreground">
              {t.common.patientProfile || 'Patient Profile'} • {mrn ? `MRN ${mrn}` : 'MRN —'}
            </div>
            <div className="text-xs text-muted-foreground">
              {patient?.identifiers?.nationalId || '—'} / {patient?.identifiers?.iqama || '—'} / {patient?.identifiers?.passport || '—'}
            </div>
            <div className="text-xs text-muted-foreground">
              {patient?.gender || '—'} • {t.common.age || 'Age'} {formatAge(patient?.dob)}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={badgeClass(statusBadge.style)}>{statusBadge.label}</span>
              {identityBadge ? <span className={badgeClass(identityBadge.style)}>{identityBadge.label}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditDemographics ? (
              <Button className="rounded-xl" variant="outline" onClick={openEdit}>
                Edit Demographics
              </Button>
            ) : null}
            {activeEncounter?.deepLink ? (
              <Button className="rounded-xl" asChild>
                <Link href={activeEncounter.deepLink}>{t.common.openActiveEncounter || 'Open Active Encounter'}</Link>
              </Button>
            ) : null}
            <Button className="rounded-xl" variant="outline" asChild>
              <Link href={`/patient/${encodeURIComponent(patientMasterId)}/journey`}>{t.common.viewFullJourney || 'View Full Journey'}</Link>
            </Button>
            <Button className="rounded-xl" variant="outline" asChild>
              <Link href={`/patient/${encodeURIComponent(patientMasterId)}/growth`}>Growth Charts</Link>
            </Button>
            <Button className="rounded-xl" variant="outline" asChild>
              <Link href="/search">{t.common.searchAnotherPatient || 'Search Another Patient'}</Link>
            </Button>
          </div>
        </div>
      </div>

      {deathFinalized ? (
        <div className="rounded-2xl bg-card border border-destructive p-6 space-y-4">
          <div className="p-4 text-sm text-destructive">
            {t.common.deceasedBanner || 'This patient is marked as deceased.'}
          </div>
        </div>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Demographics</DialogTitle>
            <DialogDescription>Update patient name (audit-first).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">First Name</span>
                <Input className="rounded-xl thea-input-focus" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Middle Name</span>
                <Input className="rounded-xl thea-input-focus" value={editMiddleName} onChange={(e) => setEditMiddleName(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last Name</span>
                <Input className="rounded-xl thea-input-focus" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Display name: <span className="font-medium text-foreground">{namePreview}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date of Birth</span>
                <Input className="rounded-xl thea-input-focus" type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gender</span>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm thea-input-focus"
                >
                  <option value="">— Select —</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </div>
              <div className="flex items-center text-xs text-muted-foreground md:col-span-2">
                {knownPatient ? 'Changes are audited and require justification.' : 'Changes are audited.'}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">National ID</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={editNationalId}
                  onChange={(e) => setEditNationalId(e.target.value)}
                  disabled={Boolean(patient?.identifiers?.nationalId) && !canCorrectIdentifiers}
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Iqama</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={editIqama}
                  onChange={(e) => setEditIqama(e.target.value)}
                  disabled={Boolean(patient?.identifiers?.iqama) && !canCorrectIdentifiers}
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Passport</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={editPassport}
                  onChange={(e) => setEditPassport(e.target.value)}
                  disabled={Boolean(patient?.identifiers?.passport) && !canCorrectIdentifiers}
                />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reason{knownPatient ? ' (required for known patients)' : ' (optional)'}</span>
              <Textarea className="rounded-xl thea-input-focus" value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Reason for correction" />
            </div>
          </div>
          <DialogFooter>
            <Button className="rounded-xl" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t.common.encounterSummary || 'Encounter Summary'}</h2>
        <p className="text-sm text-muted-foreground">{t.common.encounterSummaryDesc || 'Active encounter and chronological history.'}</p>
        <div className="space-y-4 text-sm">
          <div className="rounded border border-border p-3">
            <div className="font-medium">{t.common.activeEncounter || 'Active Encounter'}</div>
            {activeEncounter ? (
              <div className="flex items-center justify-between mt-2">
                <div className="space-y-1">
                  <div>{activeEncounter.encounterType} • {activeEncounter.status}</div>
                  <div className="text-xs text-muted-foreground">
                    {activeEncounter.location || '—'}
                  </div>
                </div>
                {activeEncounter.deepLink ? (
                  <Button className="rounded-xl" size="sm" variant="outline" asChild>
                    <Link href={activeEncounter.deepLink}>{t.common.open || 'Open'}</Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground mt-2">{t.common.noActiveEncounter || 'No active encounter.'}</div>
            )}
          </div>
          {!encounters.length ? (
            <div className="text-xs text-muted-foreground">{t.common.noEncounters || 'No encounters found.'}</div>
          ) : null}

          <div>
            <Button className="rounded-xl" variant="outline" size="sm" onClick={() => setShowPast((prev) => !prev)}>
              {showPast ? t.common.hidePastEncounters || 'Hide Past Encounters' : t.common.showPastEncounters || 'Show Past Encounters'}
            </Button>
            {showPast ? (
              <div className="mt-3 space-y-2">
                {encounters.filter((e: any) => !e.isActive).length ? (
                  encounters
                    .filter((e: any) => !e.isActive)
                    .map((item: any) => (
                      <div key={item.encounterCoreId} className="flex items-center justify-between rounded border border-border p-2">
                        <div>
                          <div className="font-medium">
                            {item.encounterType} • {item.openedAt ? new Date(item.openedAt).toLocaleString() : '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.status} {item.outcome ? `• ${item.outcome}` : ''}
                          </div>
                        </div>
                        {item.deepLink ? (
                          <Button className="rounded-xl" size="sm" variant="outline" asChild>
                            <Link href={item.deepLink}>{t.common.open || 'Open'}</Link>
                          </Button>
                        ) : null}
                      </div>
                    ))
                ) : (
                  <div className="text-xs text-muted-foreground">{t.common.noPastEncounters || 'No past encounters.'}</div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t.common.clinicalTimeline || 'Clinical Timeline'}</h2>
        <p className="text-sm text-muted-foreground">{t.common.clinicalTimelineDesc || 'Unified, read-only timeline.'}</p>
        <div className="space-y-2 text-sm">
          {timeline.length ? (
            timeline.map((entry: any) => {
              const Icon = TIMELINE_ICONS[entry.type] || Activity;
              return (
                <div key={entry.id} className="flex items-center justify-between border border-border rounded-md p-2">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{entry.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.ts ? new Date(entry.ts).toLocaleString() : '—'}
                      </div>
                    </div>
                  </div>
                  {entry.deepLink ? (
                    <Button className="rounded-xl" size="sm" variant="outline" asChild>
                      <Link href={entry.deepLink}>{t.common.open || 'Open'}</Link>
                    </Button>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">{t.common.noTimeline || 'No timeline events.'}</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t.common.problemList || 'Problem List'}</h2>
        <p className="text-sm text-muted-foreground">{t.common.problemListDesc || 'Active and resolved problems.'}</p>
        <ProblemList patientId={patientMasterId} editable />
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t.common.allergies || 'Allergies'}</h2>
        <p className="text-sm text-muted-foreground">{t.common.allergiesDesc || 'Manage allergies and NKDA status.'}</p>
        <AllergiesManager patientId={patientMasterId} />
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t.common.homeMedications || 'Home Medications'}</h2>
        <p className="text-sm text-muted-foreground">{t.common.homeMedicationsDesc || 'Patient reported medications.'}</p>
        <HomeMedications
          patientId={patientMasterId}
          medications={homeMedications}
          onAdd={addHomeMedication}
          onUpdate={updateHomeMedication}
          onDelete={deleteHomeMedication}
          onVerify={verifyHomeMedication}
          editable
        />
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t.common.quickClinicalSnapshot || 'Quick Clinical Snapshot'}</h2>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded border border-border p-3">
            <div className="text-xs text-muted-foreground">{t.common.latestVitals || 'Latest vitals'}</div>
            <div className="mt-1 text-xs">
              {clinicalSnapshot?.latestVitals
                ? `BP ${clinicalSnapshot.latestVitals.systolic ?? '—'}/${clinicalSnapshot.latestVitals.diastolic ?? '—'} • HR ${clinicalSnapshot.latestVitals.hr ?? '—'} • RR ${clinicalSnapshot.latestVitals.rr ?? '—'} • Temp ${clinicalSnapshot.latestVitals.temp ?? '—'} • SpO2 ${clinicalSnapshot.latestVitals.spo2 ?? '—'}`
                : '—'}
            </div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="text-xs text-muted-foreground">{t.common.activeDiagnoses || 'Active diagnoses'}</div>
            <div className="mt-1 text-xs">
              {(clinicalSnapshot?.activeDiagnoses || []).length
                ? (clinicalSnapshot.activeDiagnoses || []).join(', ')
                : '—'}
            </div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="text-xs text-muted-foreground">{t.common.activeOrdersCount || 'Active orders'}</div>
            <div className="mt-1 text-sm font-medium">{clinicalSnapshot?.activeOrdersCount ?? 0}</div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="text-xs text-muted-foreground">{t.common.pendingResultsCount || 'Pending results'}</div>
            <div className="mt-1 text-sm font-medium">{clinicalSnapshot?.pendingResultsCount ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t.common.billingSnapshot || 'Billing Snapshot'}</h2>
        <div className="space-y-3 text-sm">
          {billingSnapshot ? (
            <>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded border border-border p-3">
                  <div className="text-xs text-muted-foreground">{t.common.totalCharges || 'Total charges'}</div>
                  <div className="text-sm font-medium">{billingSnapshot.totalCharges}</div>
                </div>
                <div className="rounded border border-border p-3">
                  <div className="text-xs text-muted-foreground">{t.common.totalPayments || 'Total payments'}</div>
                  <div className="text-sm font-medium">{billingSnapshot.totalPayments}</div>
                </div>
                <div className="rounded border border-border p-3">
                  <div className="text-xs text-muted-foreground">{t.common.balance || 'Balance'}</div>
                  <div className="text-sm font-medium">{billingSnapshot.balance}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {t.common.billingLock || 'Lock'}: {billingSnapshot.lockStatus} • {t.common.billingPosting || 'Posting'}: {billingSnapshot.postingStatus}
              </div>
              {billingSnapshot.statementLink ? (
                <Button className="rounded-xl" size="sm" variant="outline" asChild>
                  <Link href={billingSnapshot.statementLink}>{t.common.openBillingStatement || 'Open Billing Statement'}</Link>
                </Button>
              ) : null}
            </>
          ) : (
            <div className="text-xs text-muted-foreground">{t.common.noBillingSnapshot || 'No billing data.'}</div>
          )}
        </div>
      </div>
    </div>
  );
}
