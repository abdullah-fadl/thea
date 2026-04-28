'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { PatientSummary } from '@/components/clinical/PatientSummary';
import { SmartReferralDialog } from '@/components/clinical/SmartReferralDialog';
import { FollowUpScheduler } from '@/components/clinical/FollowUpScheduler';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useMe } from '@/lib/hooks/useMe';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { useConfirm } from '@/components/ui/confirm-modal';
import { Lock, Check, Undo2, Eye, FileText } from 'lucide-react';
import dynamic from 'next/dynamic';
const SpecialtyExamSection = dynamic(() => import('@/components/opd/SpecialtyExamSection'), { ssr: false });

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function OverviewPanel({ visitId, onNavigateBack }: { visitId: string; onNavigateBack?: () => void }) {
  const router = useRouter();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { me, isLoading: meLoading } = useMe();

  // Permission check — only clinical staff (doctors, nurses, admin) can access visits
  // Reception has opd.visit.view but should NOT access clinical visit pages
  const userPermissions: string[] = me?.user?.permissions || [];
  const canViewVisit =
    userPermissions.includes('opd.visit.edit') ||
    userPermissions.includes('opd.nursing.edit') ||
    userPermissions.includes('opd.nursing.flow') ||
    userPermissions.includes('opd.doctor.visit.view') ||
    me?.user?.role === 'admin';

  const { data: summary } = useSWR(
    canViewVisit ? `/api/opd/encounters/${visitId}/summary` : null,
    fetcher
  );
  const { data: nursing } = useSWR(
    canViewVisit ? `/api/opd/encounters/${visitId}/nursing` : null,
    fetcher
  );
  const { data: opdData } = useSWR(
    canViewVisit ? `/api/opd/encounters/${visitId}` : null,
    fetcher
  );

  const latest = Array.isArray(nursing?.items) ? nursing.items[0] : null;
  const nursingVitals = latest?.vitals || latest?.latestVitals || null;

  // Fallback: if nursing data has no vitals, try fetching from summary
  const vitals = nursingVitals || summary?.latestVitals || {};

  const patientId = summary?.patient?.id;
  const patientName = summary?.patient?.fullName || '\u2014';
  const patientMrn = summary?.patient?.mrn || '\u2014';
  const opd = opdData?.opd || {};
  const providerData = opdData?.provider;
  const providerId = providerData?.providerId || '';
  const providerName =
    (language === 'ar' && providerData?.providerNameAr)
      ? providerData.providerNameAr
      : providerData?.providerName || '';
  const specialtyCode = providerData?.specialtyCode || '';
  const specialtyName = '';

  const { toast } = useToast();
  const { confirm: showConfirm, prompt: showPrompt } = useConfirm();
  const [showReferral, setShowReferral] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [returningToNurse, setReturningToNurse] = useState(false);
  const [showAddendum, setShowAddendum] = useState(false);
  const [addendumText, setAddendumText] = useState('');
  const [addendumReason, setAddendumReason] = useState('');
  const [savingAddendum, setSavingAddendum] = useState(false);

  // Ophthalmology — doctor-only fields
  const isOphthalmology = ['ophthalmology', 'optometry', 'ophthal'].some(
    (s) => specialtyCode.toLowerCase().includes(s)
  );
  const [ophBcvaOD, setOphBcvaOD] = useState('');
  const [ophBcvaOS, setOphBcvaOS] = useState('');
  const [ophNearVisionOD, setOphNearVisionOD] = useState('');
  const [ophNearVisionOS, setOphNearVisionOS] = useState('');
  const [ophRefractionOD, setOphRefractionOD] = useState('');
  const [ophRefractionOS, setOphRefractionOS] = useState('');
  const [ophPD, setOphPD] = useState('');
  const [ophColorVision, setOphColorVision] = useState('');
  const [ophKReadingsOD, setOphKReadingsOD] = useState('');
  const [ophKReadingsOS, setOphKReadingsOS] = useState('');
  const [ophCoverTest, setOphCoverTest] = useState('');
  const [ophAccommodation, setOphAccommodation] = useState('');
  const [ophNPC, setOphNPC] = useState('');
  const [ophStereopsis, setOphStereopsis] = useState('');
  const [savingOph, setSavingOph] = useState(false);

  const ophData = (opd?.clinicExtensions as Record<string, unknown> | undefined)?.ophthalmology as Record<string, string> || {};

  useEffect(() => {
    if (!ophData) return;
    setOphBcvaOD(ophData.bcvaOD ?? '');
    setOphBcvaOS(ophData.bcvaOS ?? '');
    setOphNearVisionOD(ophData.nearVisionOD ?? '');
    setOphNearVisionOS(ophData.nearVisionOS ?? '');
    setOphRefractionOD(ophData.refractionOD ?? '');
    setOphRefractionOS(ophData.refractionOS ?? '');
    setOphPD(ophData.pd ?? '');
    setOphColorVision(ophData.colorVision ?? '');
    setOphKReadingsOD(ophData.kReadingsOD ?? '');
    setOphKReadingsOS(ophData.kReadingsOS ?? '');
    setOphCoverTest(ophData.coverTest ?? '');
    setOphAccommodation(ophData.accommodation ?? '');
    setOphNPC(ophData.npc ?? '');
    setOphStereopsis(ophData.stereopsis ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opdData]);

  const saveOphthalmologyDoctor = async () => {
    setSavingOph(true);
    try {
      const res = await fetch(`/api/opd/encounters/${visitId}/clinic-extensions`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opdClinicExtensions: {
            ophthalmology: {
              // Preserve nurse fields
              visualAcuityOD: ophData.visualAcuityOD ?? null,
              visualAcuityOS: ophData.visualAcuityOS ?? null,
              autoRefractionOD: ophData.autoRefractionOD ?? null,
              autoRefractionOS: ophData.autoRefractionOS ?? null,
              iopOD: ophData.iopOD ?? null,
              iopOS: ophData.iopOS ?? null,
              // Doctor fields
              bcvaOD: ophBcvaOD || null,
              bcvaOS: ophBcvaOS || null,
              nearVisionOD: ophNearVisionOD || null,
              nearVisionOS: ophNearVisionOS || null,
              refractionOD: ophRefractionOD || null,
              refractionOS: ophRefractionOS || null,
              pd: ophPD || null,
              colorVision: ophColorVision || null,
              kReadingsOD: ophKReadingsOD || null,
              kReadingsOS: ophKReadingsOS || null,
              coverTest: ophCoverTest || null,
              accommodation: ophAccommodation || null,
              npc: ophNPC || null,
              stereopsis: ophStereopsis || null,
            },
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      toast({ title: tr('تم حفظ فحوصات العيون', 'Ophthalmology exam saved') });
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' as const });
    } finally {
      setSavingOph(false);
    }
  };

  const navigateBack = () => {
    if (onNavigateBack) {
      onNavigateBack();
    } else {
      router.push('/opd/doctor-station');
    }
  };

  const handleCompleteVisit = async (acknowledgeOpenOrders = false) => {
    if (!acknowledgeOpenOrders) {
      if (!confirm(tr('هل تريد إنهاء هذه الزيارة؟', 'Do you want to complete this visit?'))) return;
    }
    setCompleting(true);
    try {
      const flowRes = await fetch(`/api/opd/encounters/${visitId}/flow-state`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdFlowState: 'COMPLETED', acknowledgeOpenOrders }),
      });
      const flowPayload = await flowRes.json().catch(() => ({}));

      if (!flowRes.ok) {
        if (flowPayload.error === 'PENDING_ORDERS_WARNING' && flowPayload.requiresAcknowledgement) {
          setCompleting(false);
          const msg = language === 'ar' ? flowPayload.message : flowPayload.messageEn;
          const proceed = await showConfirm(
            `${msg}\n\n${tr('المريض سيتوجه للاستقبال لتسديد رسوم الطلبات.', 'The patient will be routed to reception to pay for pending orders.')}`
          );
          if (proceed) return handleCompleteVisit(true);
          return;
        }
        throw new Error(flowPayload.messageEn || flowPayload.error || tr('فشل إنهاء الزيارة', 'Failed to complete visit'));
      }

      await fetch(`/api/opd/encounters/${visitId}/timestamps`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opdTimestamps: { doctorEndAt: new Date().toISOString() } }),
      });

      navigateBack();
    } catch (err: any) {
      toast({ title: err.message || tr('خطأ أثناء إنهاء الزيارة', 'Error completing visit'), variant: 'destructive' });
    } finally {
      setCompleting(false);
    }
  };

  const handleReturnToNursing = async () => {
    const reason = await showPrompt(tr('سبب إرجاع المريض للتمريض:', 'Reason for returning patient to nursing:'));
    if (reason === null) return; // cancelled
    setReturningToNurse(true);
    try {
      const flowRes = await fetch(`/api/opd/encounters/${visitId}/flow-state`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opdFlowState: 'WAITING_NURSE',
          returnReason: reason.trim() || tr('الطبيب طلب إعادة التقييم', 'Doctor requested re-assessment'),
        }),
      });
      if (!flowRes.ok) {
        const err = await flowRes.json().catch(() => ({}));
        throw new Error(err.error || tr('فشلت العملية', 'Failed'));
      }
      toast({ title: tr('تم إرجاع المريض للتمريض', 'Patient returned to nursing') });
      navigateBack();
    } catch (err: any) {
      alert(err.message || tr('خطأ', 'Error'));
    } finally {
      setReturningToNurse(false);
    }
  };

  const handleSaveAddendum = async () => {
    if (!addendumText.trim() || !addendumReason.trim()) return;
    setSavingAddendum(true);
    try {
      const res = await fetch(`/api/opd/encounters/${visitId}/doctor`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAddendum: true,
          noteType: 'FREE',
          freeText: addendumText.trim(),
          addendumReason: addendumReason.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || tr('فشلت العملية', 'Failed'));
      }
      toast({ title: tr('تم حفظ الملاحظة الإضافية', 'Addendum saved') });
      setShowAddendum(false);
      setAddendumText('');
      setAddendumReason('');
    } catch (err: any) {
      alert(err.message || tr('خطأ', 'Error'));
    } finally {
      setSavingAddendum(false);
    }
  };

  if (meLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400 text-sm">{tr('جاري التحميل...', 'Loading...')}</div>
      </div>
    );
  }

  if (!canViewVisit) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="text-4xl"><Lock className="h-10 w-10 text-slate-400 mx-auto" /></div>
          <h2 className="text-lg font-semibold text-slate-800">{tr('غير مصرح بالوصول', 'Access denied')}</h2>
          <p className="text-sm text-slate-500">{tr('ليس لديك صلاحية للوصول لصفحة الزيارة الطبية', 'You do not have permission to access the clinical visit page')}</p>
          <button
            onClick={() => navigateBack()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            {tr('العودة لمحطة الطبيب', 'Back to doctor station')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {patientId && <PatientSummary patientId={patientId} encounterId={visitId} />}
      <div className="bg-card rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-slate-900">{tr('ملخص الزيارة', 'Visit Summary')}</h2>
          {canViewVisit && summary?.opd?.opdFlowState &&
            ['IN_DOCTOR', 'PROCEDURE_DONE_WAITING'].includes(summary.opd.opdFlowState) && (
            <div className="flex gap-2">
              <button
                onClick={() => handleCompleteVisit()}
                disabled={completing}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {completing ? tr('جاري الإنهاء...', 'Completing...') : <><span>{tr('إنهاء الزيارة', 'Complete visit')}</span> <Check className="h-4 w-4 inline-block" /></>}
              </button>
              <button
                onClick={handleReturnToNursing}
                disabled={returningToNurse}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
              >
                {returningToNurse ? tr('جاري الإرجاع...', 'Returning...') : <><Undo2 className="h-4 w-4 inline-block" /> <span>{tr('إرجاع للتمريض', 'Return to nursing')}</span></>}
              </button>
            </div>
          )}
        </div>
        <div className="text-sm text-slate-600">
          <div>{tr('المريض', 'Patient')}: {summary?.patient?.fullName || '\u2014'}</div>
          <div>{tr('رقم الملف', 'MRN')}: {summary?.patient?.mrn || '\u2014'}</div>
          <div>{tr('الحالة', 'Status')}: {summary?.visit?.status || '\u2014'}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Doctor-only buttons */}
          {userPermissions.includes('opd.doctor.encounter.view') && (
            <>
              <button
                onClick={() => setShowReferral(true)}
                className="px-3 py-2 rounded-lg border border-indigo-300 text-sm text-indigo-700 hover:bg-indigo-50"
              >
                {tr('تحويل', 'Refer')}
              </button>
              <button
                onClick={() => setShowFollowUp(true)}
                className="px-3 py-2 rounded-lg border border-green-300 text-sm text-green-700 hover:bg-green-50"
              >
                {tr('موعد متابعة', 'Follow-up')}
              </button>
              <a
                href={`/opd/visit/${visitId}/prescription-print`}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
              >
                {tr('طباعة الوصفة', 'Print prescription')}
              </a>
              <a
                href={`/opd/visit/${visitId}/excuse-print`}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
              >
                {tr('طباعة إذن غياب', 'Print absence slip')}
              </a>
            </>
          )}
          {/* Visit report - available to all who can view visits */}
          <a
            href={`/opd/visit/${visitId}/visit-report-print`}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
          >
            {tr('طباعة تقرير الزيارة', 'Print visit report')}
          </a>
          {/* Addendum button - show only when COMPLETED and doctor */}
          {summary?.opd?.opdFlowState === 'COMPLETED' && userPermissions.includes('opd.doctor.encounter.view') && (
            <button
              onClick={() => setShowAddendum(!showAddendum)}
              className="px-3 py-2 rounded-lg border border-amber-300 text-sm text-amber-700 hover:bg-amber-50"
            >
              <FileText className="h-4 w-4 inline-block" /> {tr('إضافة ملاحظة', 'Add addendum')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">{tr('آخر العلامات الحيوية', 'Latest Vitals')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">{tr('ضغط الدم', 'BP')} BP</div>
            <div className="font-medium text-slate-800">{vitals?.bp || '\u2014'}</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">{tr('النبض', 'Pulse')} HR</div>
            <div className="font-medium text-slate-800">{vitals?.hr ?? '\u2014'}</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">{tr('الحرارة', 'Temp')} Temp</div>
            <div className="font-medium text-slate-800">{vitals?.temp ?? '\u2014'}</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">{tr('تشبع الأكسجين', 'SpO2')} SpO2</div>
            <div className="font-medium text-slate-800">{vitals?.spo2 ?? '\u2014'}</div>
          </div>
        </div>

        {/* Nurse-recorded eye measurements (read-only) */}
        {isOphthalmology && (ophData.visualAcuityOD || ophData.iopOD || ophData.autoRefractionOD) && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{tr('قياسات التمريض', 'Nurse Measurements')}</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {ophData.visualAcuityOD && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">VA — OD</div>
                  <div className="font-medium text-slate-800">{ophData.visualAcuityOD}</div>
                </div>
              )}
              {ophData.visualAcuityOS && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">VA — OS</div>
                  <div className="font-medium text-slate-800">{ophData.visualAcuityOS}</div>
                </div>
              )}
              {ophData.iopOD && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">IOP — OD</div>
                  <div className="font-medium text-slate-800">{ophData.iopOD}</div>
                </div>
              )}
              {ophData.iopOS && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">IOP — OS</div>
                  <div className="font-medium text-slate-800">{ophData.iopOS}</div>
                </div>
              )}
              {ophData.autoRefractionOD && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">Auto-Ref — OD</div>
                  <div className="font-medium text-slate-800">{ophData.autoRefractionOD}</div>
                </div>
              )}
              {ophData.autoRefractionOS && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">Auto-Ref — OS</div>
                  <div className="font-medium text-slate-800">{ophData.autoRefractionOS}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Doctor / Specialist ophthalmology exam section */}
      {isOphthalmology && (
        <div className="bg-card rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Eye className="h-4 w-4 inline-block" /> {tr('فحوصات العيون — الطبيب / الأخصائي', 'Ophthalmology Exam — Doctor / Specialist')}
          </h3>

          {/* BCVA */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{tr('حدة البصر مع التصحيح (BCVA)', 'Best Corrected VA (BCVA)')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">OD</label>
                <input value={ophBcvaOD} onChange={(e) => setOphBcvaOD(e.target.value)} placeholder="20/20" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">OS</label>
                <input value={ophBcvaOS} onChange={(e) => setOphBcvaOS(e.target.value)} placeholder="20/20" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          </div>

          {/* Near Vision */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{tr('النظر القريب', 'Near Vision')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">OD</label>
                <input value={ophNearVisionOD} onChange={(e) => setOphNearVisionOD(e.target.value)} placeholder="N5" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">OS</label>
                <input value={ophNearVisionOS} onChange={(e) => setOphNearVisionOS(e.target.value)} placeholder="N6" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          </div>

          {/* Refraction */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{tr('الانكسار (Refraction)', 'Refraction')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">OD</label>
                <input value={ophRefractionOD} onChange={(e) => setOphRefractionOD(e.target.value)} placeholder="-0.50/-0.50×180" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">OS</label>
                <input value={ophRefractionOS} onChange={(e) => setOphRefractionOS(e.target.value)} placeholder="-0.50/-0.50×180" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          </div>

          {/* K Readings */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{tr('قراءات الكيراتومتر (K Readings)', 'Keratometry (K Readings)')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">OD</label>
                <input value={ophKReadingsOD} onChange={(e) => setOphKReadingsOD(e.target.value)} placeholder="43.50@180 / 44.25@90" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">OS</label>
                <input value={ophKReadingsOS} onChange={(e) => setOphKReadingsOS(e.target.value)} placeholder="43.25@175 / 44.00@85" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          </div>

          {/* PD + Color Vision */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{tr('المسافة الحدقية (PD)', 'Pupillary Distance (PD)')}</p>
              <input value={ophPD} onChange={(e) => setOphPD(e.target.value)} placeholder="64 mm" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{tr('رؤية الألوان', 'Color Vision')}</p>
              <select value={ophColorVision} onChange={(e) => setOphColorVision(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">{tr('اختر...', 'Select...')}</option>
                <option value="normal">{tr('طبيعي', 'Normal')}</option>
                <option value="abnormal">{tr('غير طبيعي', 'Abnormal')}</option>
                <option value="not_tested">{tr('لم يُفحص', 'Not tested')}</option>
              </select>
            </div>
          </div>

          {/* Cover Test + Accommodation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{tr('اختبار الغطاء', 'Cover Test')}</p>
              <select value={ophCoverTest} onChange={(e) => setOphCoverTest(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">{tr('اختر...', 'Select...')}</option>
                <option value="orthophoria">{tr('طبيعي (Ortho)', 'Orthophoria')}</option>
                <option value="esophoria">{tr('إنسي خفي (Eso)', 'Esophoria')}</option>
                <option value="exophoria">{tr('صدغي خفي (Exo)', 'Exophoria')}</option>
                <option value="esotropia">{tr('حَوَل إنسي (ET)', 'Esotropia')}</option>
                <option value="exotropia">{tr('حَوَل صدغي (XT)', 'Exotropia')}</option>
                <option value="hyperphoria">{tr('فوقي خفي (Hyper)', 'Hyperphoria')}</option>
              </select>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{tr('التكيف (Accommodation)', 'Accommodation')}</p>
              <input value={ophAccommodation} onChange={(e) => setOphAccommodation(e.target.value)} placeholder="10 D" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          {/* NPC + Stereopsis */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{tr('نقطة التقارب القريبة (NPC)', 'Near Point of Convergence (NPC)')}</p>
              <input value={ophNPC} onChange={(e) => setOphNPC(e.target.value)} placeholder="8 cm" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{tr('الرؤية المجسمة (Stereopsis)', 'Stereopsis')}</p>
              <select value={ophStereopsis} onChange={(e) => setOphStereopsis(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">{tr('اختر...', 'Select...')}</option>
                <option value="normal_40">{tr('طبيعي 40 ث.قوسية', 'Normal 40 sec arc')}</option>
                <option value="normal_60">{tr('طبيعي 60 ث.قوسية', 'Normal 60 sec arc')}</option>
                <option value="reduced_100">{tr('ضعيف 100 ث.قوسية', 'Reduced 100 sec arc')}</option>
                <option value="reduced_200">{tr('ضعيف جداً 200+', 'Reduced 200+ sec arc')}</option>
                <option value="absent">{tr('غائبة', 'Absent')}</option>
                <option value="not_tested">{tr('لم تُفحص', 'Not tested')}</option>
              </select>
            </div>
          </div>

          <button
            onClick={saveOphthalmologyDoctor}
            disabled={savingOph}
            className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {savingOph ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ فحوصات العيون', 'Save Eye Exam')}
          </button>
        </div>
      )}

      {showAddendum && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 space-y-3">
          <h3 className="font-semibold text-amber-900">{tr('إضافة ملاحظة', 'Addendum')}</h3>
          <p className="text-xs text-amber-600">{tr('يمكن إضافة ملاحظة خلال 24 ساعة من إنهاء الزيارة', 'You can add an addendum within 24 hours of completing the visit')}</p>
          <textarea
            placeholder={tr('سبب الإضافة (مطلوب)', 'Reason (required)')}
            value={addendumReason}
            onChange={(e) => setAddendumReason(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm"
          />
          <textarea
            placeholder={tr('نص الملاحظة', 'Addendum text')}
            value={addendumText}
            onChange={(e) => setAddendumText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveAddendum}
              disabled={savingAddendum || !addendumText.trim() || !addendumReason.trim()}
              className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {savingAddendum ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ الملاحظة', 'Save addendum')}
            </button>
            <button
              onClick={() => setShowAddendum(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {tr('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Specialty Exam — shown for all non-ophthalmology specialties */}
      {specialtyCode && !['ophthalmology', 'optometry', 'ophthal', 'eye'].some(c => specialtyCode.toLowerCase().includes(c)) && (
        <SpecialtyExamSection specialtyCode={specialtyCode} visitId={visitId} />
      )}

      {showReferral && patientId && (
        <SmartReferralDialog
          open={showReferral}
          onClose={() => setShowReferral(false)}
          encounterId={visitId}
          patientId={patientId}
          patientName={patientName}
          fromProviderId={providerId || undefined}
          fromProviderName={providerName || undefined}
          fromSpecialtyCode={specialtyCode || undefined}
          fromSpecialtyName={specialtyName || undefined}
          onSuccess={() => setShowReferral(false)}
        />
      )}

      <Dialog open={showFollowUp} onOpenChange={setShowFollowUp}>
        <DialogContent className="max-w-4xl p-0">
          {patientId && (
            <FollowUpScheduler
              encounterId={visitId}
              patientId={patientId}
              patientName={patientName}
              currentProviderId={providerId}
              currentProviderName={providerName}
              currentSpecialtyCode={specialtyCode}
              onScheduled={() => setShowFollowUp(false)}
              onCancel={() => setShowFollowUp(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
