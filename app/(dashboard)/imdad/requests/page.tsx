'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

// ==================================================================
// MULTI-USER REQUEST WORKFLOW
//
// Each role accesses via: /imdad/requests?role=HEAD_NURSE
//                         /imdad/requests?role=HOD
//                         /imdad/requests?role=DON
//                         /imdad/requests?role=SUPPLY_CHAIN
//
// Each role sees ONLY what they are authorized to see and do.
// State persists in the ImdadBrain singleton across navigations.
// ==================================================================

const HOSPITAL_ID = '';

interface RoleConfig {
  key: string;
  name: string;
  nameAr: string;
  title: string;
  titleAr: string;
  color: string;
  canCreate: boolean;
  canApprove: boolean;
  approvalRole: string | null; // the role key used in approval chain
  scope: 'own' | 'department' | 'hospital';
}

const ROLES: Record<string, RoleConfig> = {
  HEAD_NURSE: {
    key: 'HEAD_NURSE', name: '', nameAr: '',
    title: 'Head Nurse — ICU', titleAr: 'رئيسة التمريض — العناية المركزة',
    color: 'cyan', canCreate: true, canApprove: false, approvalRole: null, scope: 'own',
  },
  HOD: {
    key: 'HOD', name: '', nameAr: '',
    title: 'Head of Department — ICU', titleAr: 'رئيس القسم — العناية المركزة',
    color: 'amber', canCreate: false, canApprove: true, approvalRole: 'HEAD_OF_DEPARTMENT', scope: 'department',
  },
  DON: {
    key: 'DON', name: '', nameAr: '',
    title: 'Nursing Director', titleAr: 'مديرة التمريض',
    color: 'purple', canCreate: false, canApprove: true, approvalRole: 'DON', scope: 'hospital',
  },
  SUPPLY_CHAIN: {
    key: 'SUPPLY_CHAIN', name: '', nameAr: '',
    title: 'Supply Chain Manager', titleAr: 'مدير سلسلة الإمداد',
    color: 'emerald', canCreate: false, canApprove: true, approvalRole: 'SUPPLY_CHAIN', scope: 'hospital',
  },
};

export default function MultiUserRequestsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const brain = useImdadBrain();
  const searchParams = useSearchParams();

  const router = useRouter();
  const activeRoleKey = searchParams.get('role') || 'HEAD_NURSE';
  const role = ROLES[activeRoleKey] || ROLES.HEAD_NURSE;

  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [formSku, setFormSku] = useState('');
  const [formQty, setFormQty] = useState(500);
  const [formPriority, setFormPriority] = useState<'ROUTINE' | 'URGENT' | 'EMERGENCY'>('ROUTINE');
  const [formJustification, setFormJustification] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);

  // ---- ROLE-SCOPED DATA ----
  const visibleRequests = useMemo(() => {
    const allRequests = brain.requests.filter((r: any) => r.hospitalId === HOSPITAL_ID);
    if (role.scope === 'own') {
      return allRequests.filter((r: any) => r.requestedByRole === 'HEAD_NURSE');
    }
    if (role.scope === 'department') {
      return allRequests.filter((r: any) => r.department === 'ICU');
    }
    return allRequests; // hospital scope
  }, [brain.requests, role.scope]);

  // For approvers: show only requests pending THEIR approval
  const pendingMyApproval = useMemo(() => {
    if (!role.canApprove || !role.approvalRole) return [];
    return visibleRequests.filter((r: any) => {
      const chain = r.approvalChain || [];
      const currentStep = chain[r.currentApprovalStep];
      return currentStep?.role === role.approvalRole && currentStep?.status === 'PENDING';
    });
  }, [visibleRequests, role]);

  const selectedRequest: any = selectedRequestId ? visibleRequests.find((r: any) => r.id === selectedRequestId) : null;

  const matchedItem = brain.inventoryItems.find((i: any) => i.sku === formSku && i.hospitalId === HOSPITAL_ID);
  const skuItems = useMemo(() => {
    const skus = [...new Set(brain.inventoryItems.filter((i: any) => i.hospitalId === HOSPITAL_ID).map((i: any) => i.sku))];
    return skus.map(sku => {
      const item = brain.inventoryItems.find((i: any) => i.sku === sku && i.hospitalId === HOSPITAL_ID);
      return item ? { sku, name: item.name, nameAr: item.nameAr, unit: item.unit, available: (item as any).available, onHand: item.onHand } : null;
    }).filter(Boolean) as any[];
  }, [brain.inventoryItems]);

  function handleCreate() {
    if (!matchedItem) return;
    const result = (brain.createRequest as any)({
      hospitalId: HOSPITAL_ID,
      department: 'ICU', departmentAr: 'العناية المركزة',
      requestedBy: role.name, requestedByAr: role.nameAr, requestedByRole: 'HEAD_NURSE',
      domain: 'MEDICAL_CONSUMABLES' as any,
      items: [{ itemId: matchedItem.id, name: matchedItem.name, nameAr: matchedItem.nameAr, sku: matchedItem.sku, quantity: formQty, unit: matchedItem.unit || 'box', estimatedCost: 15 }],
      priority: formPriority,
      justification: formJustification || 'Stock replenishment for ICU',
      justificationAr: formJustification || 'تعبئة مخزون العناية المركزة',
    });
    if (result) {
      setFormSubmitted(true);
      setSelectedRequestId((result as any).id);
      setTimeout(() => { setView('detail'); setFormSubmitted(false); }, 1000);
    }
  }

  const [actionError, setActionError] = useState<string | null>(null);

  function handleApprove() {
    if (!selectedRequestId || !role.approvalRole) return;
    setActionError(null);
    const result = (brain.approveRequestStep as any)(selectedRequestId, role.approvalRole, `Approved by ${role.name}`);
    if (result && !(result as any).success) setActionError(result.error || 'Approval failed');
  }

  function handleReject() {
    if (!selectedRequestId || !role.approvalRole) return;
    setActionError(null);
    const result = (brain.rejectRequestStep as any)(selectedRequestId, role.approvalRole, `Rejected by ${role.name}`);
    if (result && !(result as any).success) setActionError(result.error || 'Rejection failed');
  }

  const requestAudit = selectedRequestId ? brain.getAuditLog(selectedRequestId) : [];

  const statusColors: Record<string, string> = {
    SUBMITTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    IN_APPROVAL: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
    PO_GENERATED: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    DELIVERED: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  const roleColors: Record<string, string> = { cyan: 'border-cyan-500/30 text-cyan-400', amber: 'border-amber-500/30 text-amber-400', purple: 'border-purple-500/30 text-purple-400', emerald: 'border-emerald-500/30 text-emerald-400' };

  return (
    <div className="min-h-screen bg-[#050a18] text-white" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ====== ROLE SWITCHER BAR ====== */}
      <div className="border-b border-white/10 bg-black/60 backdrop-blur-xl px-6 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-gray-600 shrink-0">{tr('تسجيل دخول كـ', 'Login as')}:</span>
          {Object.values(ROLES).map(r => (
            <button
              key={r.key}
              onClick={() => { router.push(`/imdad/requests?role=${r.key}`); setView('list'); setSelectedRequestId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                activeRoleKey === r.key
                  ? `bg-${r.color}-500/20 ${roleColors[r.color]} border`
                  : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10'
              }`}
            >
              {language === 'ar' ? r.nameAr : r.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* ====== ROLE IDENTITY HEADER ====== */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-10 h-10 rounded-xl bg-${role.color}-500/20 flex items-center justify-center text-${role.color}-400 font-bold text-lg`}>
                {(language === 'ar' ? role.nameAr : role.name).charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold">{language === 'ar' ? role.nameAr : role.name}</h1>
                <p className="text-sm text-gray-500">{language === 'ar' ? role.titleAr : role.title} — {tr('ثيا المركزي', 'Thea Central')}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {role.canApprove && pendingMyApproval.length > 0 && (
              <span className="px-3 py-1.5 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                {pendingMyApproval.length} {tr('بانتظار موافقتك', 'awaiting your approval')}
              </span>
            )}
            {view === 'detail' && (
              <button onClick={() => { setView('list'); setSelectedRequestId(null); }} className="px-4 py-2 rounded-lg text-sm bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10">
                ← {tr('العودة', 'Back')}
              </button>
            )}
            {role.canCreate && view !== 'create' && (
              <button onClick={() => { setView('create'); setFormSubmitted(false); }} className="px-4 py-2 rounded-lg text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
                + {tr('إنشاء طلب', 'Create Request')}
              </button>
            )}
          </div>
        </div>

        {/* ====== SCOPE NOTICE ====== */}
        <div className="bg-white/[0.03] border border-white/5 rounded-lg px-4 py-2 mb-4 text-xs text-gray-500">
          {role.scope === 'own' && tr('ترى طلباتك فقط', 'You see only your own requests')}
          {role.scope === 'department' && tr('ترى طلبات قسمك فقط (العناية المركزة)', 'You see only your department requests (ICU)')}
          {role.scope === 'hospital' && tr('ترى جميع طلبات المستشفى', 'You see all hospital requests')}
          {role.canApprove && ' — ' + tr('يمكنك الموافقة أو الرفض عندما يصل الطلب لمرحلتك', 'You can approve or reject when the request reaches your step')}
          {role.canCreate && ' — ' + tr('يمكنك إنشاء طلبات جديدة', 'You can create new requests')}
          {!role.canCreate && !role.canApprove && ''}
        </div>

        {/* ====== CREATE VIEW (HEAD NURSE ONLY) ====== */}
        {view === 'create' && role.canCreate && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-6 text-cyan-400">{tr('طلب إمداد جديد', 'New Supply Request')}</h2>
              <label className="block text-sm text-gray-400 mb-1">{tr('الصنف', 'Item')}</label>
              <select value={formSku} onChange={e => setFormSku(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white mb-4 outline-none">
                {skuItems.map((item: any) => (
                  <option key={item.sku} value={item.sku} className="bg-[#0a0f1e]">
                    {language === 'ar' ? item.nameAr : item.name} — {item.sku} ({tr('متاح', 'Avail')}: {item.available})
                  </option>
                ))}
              </select>
              {matchedItem && (
                <div className="bg-white/5 rounded-lg p-3 mb-4 flex gap-6 text-sm">
                  <span>{tr('بالمخزن', 'On Hand')}: <strong>{(matchedItem as any).onHand}</strong></span>
                  <span>{tr('متاح', 'Available')}: <strong className={(matchedItem as any).available < matchedItem.reorderPoint ? 'text-red-400' : 'text-emerald-400'}>{matchedItem.available}</strong></span>
                  <span>{tr('نقطة الطلب', 'Reorder')}: <strong className="text-amber-400">{matchedItem.reorderPoint}</strong></span>
                </div>
              )}
              <label className="block text-sm text-gray-400 mb-1">{tr('الكمية', 'Quantity')}</label>
              <input type="number" value={formQty} onChange={e => setFormQty(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white mb-4 outline-none" min={1} />
              <label className="block text-sm text-gray-400 mb-1">{tr('الأولوية', 'Priority')}</label>
              <div className="flex gap-2 mb-4">
                {(['ROUTINE', 'URGENT', 'EMERGENCY'] as const).map(p => (
                  <button key={p} onClick={() => setFormPriority(p)} className={`px-4 py-2 rounded-lg text-sm border ${formPriority === p ? (p === 'ROUTINE' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : p === 'URGENT' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30') : 'bg-white/5 text-gray-500 border-white/10'}`}>
                    {p === 'ROUTINE' ? tr('عادي', 'Routine') : p === 'URGENT' ? tr('عاجل', 'Urgent') : tr('طوارئ', 'Emergency')}
                  </button>
                ))}
              </div>
              <label className="block text-sm text-gray-400 mb-1">{tr('المبرر', 'Justification')}</label>
              <textarea value={formJustification} onChange={e => setFormJustification(e.target.value)} placeholder={tr('سبب الطلب...', 'Reason...')} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white mb-4 outline-none resize-none h-20" />
              <div className="bg-white/5 rounded-lg p-3 mb-6 text-sm">
                {tr('التكلفة المقدرة', 'Estimated Cost')}: <strong className="text-cyan-400 font-mono">{(formQty * 15).toLocaleString()} SAR</strong>
              </div>
              <button onClick={handleCreate} disabled={formSubmitted} className={`w-full py-3 rounded-xl font-bold text-sm ${formSubmitted ? 'bg-emerald-500/30 text-emerald-400' : 'bg-cyan-500 text-black hover:bg-cyan-400'}`}>
                {formSubmitted ? '✓ ' + tr('تم الإرسال!', 'Submitted!') : tr('إرسال الطلب', 'Submit Request')}
              </button>
            </div>
          </div>
        )}

        {/* ====== REQUEST LIST ====== */}
        {view === 'list' && (
          <div className="space-y-3">
            {/* Approver: show pending section first */}
            {role.canApprove && pendingMyApproval.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-amber-400 mb-3 uppercase tracking-wider">
                  ⏳ {tr('بانتظار موافقتك', 'Awaiting Your Approval')} ({pendingMyApproval.length})
                </h3>
                {pendingMyApproval.map((req: any) => (
                  <button key={req.id} onClick={() => { setSelectedRequestId(req.id); setView('detail'); }} className="w-full text-left bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-2 hover:border-amber-500/40 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-cyan-400 font-mono text-sm">{req.code}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">{tr('بانتظار موافقتك', 'NEEDS YOUR APPROVAL')}</span>
                    </div>
                    <p className="text-white font-medium">{req.items?.[0]?.[language === 'ar' ? 'nameAr' : 'name']} × {req.items?.[0]?.quantity}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>{tr('من', 'From')}: {language === 'ar' ? req.requestedByAr : req.requestedBy}</span>
                      <span>{req.totalEstimatedCost?.toLocaleString()} SAR</span>
                      <span>{req.priority}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* All visible requests */}
            <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">
              {role.canApprove ? tr('جميع الطلبات', 'All Requests') : tr('طلباتي', 'My Requests')} ({visibleRequests.length})
            </h3>
            {visibleRequests.length === 0 && (
              <div className="text-center py-16 text-gray-600">
                <p className="text-lg">{role.canCreate ? tr('لا توجد طلبات بعد — أنشئ طلبك الأول', 'No requests yet — create your first') : tr('لا توجد طلبات في نطاقك', 'No requests in your scope')}</p>
              </div>
            )}
            {visibleRequests.filter((r: any) => !pendingMyApproval.includes(r)).map((req: any) => (
              <button key={req.id} onClick={() => { setSelectedRequestId(req.id); setView('detail'); }} className="w-full text-left bg-black/40 border border-white/10 rounded-xl p-4 hover:border-cyan-500/30 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-cyan-400 font-mono text-sm">{req.code}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] border ${statusColors[req.status] || ''}`}>{req.status}</span>
                </div>
                <p className="text-white font-medium">{req.items?.[0]?.[language === 'ar' ? 'nameAr' : 'name']} × {req.items?.[0]?.quantity}</p>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>{tr('من', 'From')}: {language === 'ar' ? req.requestedByAr : req.requestedBy}</span>
                  <span>{req.totalEstimatedCost?.toLocaleString()} SAR</span>
                  <span>{tr('الخطوة', 'Step')}: {req.currentApprovalStep + 1}/{req.approvalChain?.length}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ====== DETAIL VIEW ====== */}
        {view === 'detail' && selectedRequest && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-cyan-400 font-mono text-lg">{(selectedRequest as any).code}</span>
                  <span className={`ms-3 px-3 py-1 rounded-full text-xs border ${statusColors[selectedRequest.status]}`}>{selectedRequest.status}</span>
                </div>
                {(selectedRequest as any).slaBreached && <span className="text-red-400 text-xs animate-pulse">⚠️ SLA BREACHED</span>}
              </div>
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                {selectedRequest.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between py-2">
                    <span>{language === 'ar' ? item.nameAr : item.name} <span className="text-gray-500 text-xs">({item.sku})</span></span>
                    <span className="font-mono text-cyan-400">{item.quantity} {item.unit} — {(item.quantity * item.estimatedCost).toLocaleString()} SAR</span>
                  </div>
                ))}
                <div className="flex justify-between pt-3 mt-2 border-t border-white/10 font-bold">
                  <span>{tr('الإجمالي', 'Total')}</span>
                  <span className="text-cyan-400 font-mono">{(selectedRequest as any).totalEstimatedCost?.toLocaleString()} SAR</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/5 rounded-lg p-3">
                  <span className="text-gray-500">{tr('مقدم الطلب', 'Requested By')}</span>
                  <p className="text-white mt-1">{language === 'ar' ? (selectedRequest as any).requestedByAr : selectedRequest.requestedBy}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <span className="text-gray-500">{tr('القسم', 'Department')}</span>
                  <p className="text-white mt-1">{language === 'ar' ? selectedRequest.departmentAr : selectedRequest.department}</p>
                </div>
              </div>
              {(selectedRequest as any).poCode && (
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4 mt-4">
                  <p className="text-cyan-400 font-bold">{tr('تم إنشاء أمر شراء', 'Purchase Order Generated')}</p>
                  <p className="text-white font-mono mt-1">{(selectedRequest as any).poCode}</p>
                  {(selectedRequest as any).expectedDelivery && <p className="text-gray-400 text-sm mt-1">{tr('التوصيل المتوقع', 'Expected')}: {new Date(selectedRequest.expectedDelivery).toLocaleDateString()}</p>}
                </div>
              )}
            </div>

            {/* APPROVAL CHAIN */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4">{tr('سلسلة الموافقات', 'Approval Chain')}</h3>
              <div className="relative">
                <div className="absolute top-0 bottom-0 w-0.5 bg-white/10" style={{ [language === 'ar' ? 'right' : 'left']: '15px' }} />
                {(selectedRequest as any).approvalChain?.map((step: any, idx: number) => {
                  const isCurrent = idx === (selectedRequest as any).currentApprovalStep && !['REJECTED', 'PO_GENERATED', 'DELIVERED'].includes(selectedRequest.status);
                  const isMyStep = isCurrent && step.status === 'PENDING' && (role.approvalRole === step.role || role.approvalRole === step.escalatedTo);
                  const dotColor = step.status === 'APPROVED' ? 'bg-emerald-500' : step.status === 'REJECTED' ? 'bg-red-500' : step.status === 'PENDING' ? 'bg-amber-500 animate-pulse' : 'bg-gray-600';
                  return (
                    <div key={idx} className="relative flex items-start gap-4 pb-6" style={{ [language === 'ar' ? 'paddingRight' : 'paddingLeft']: '40px' }}>
                      <div className={`absolute w-[14px] h-[14px] rounded-full border-2 border-[#050a18] ${dotColor}`} style={{ [language === 'ar' ? 'right' : 'left']: '9px', top: '4px' }} />
                      <div className={`flex-1 rounded-xl p-4 ${isMyStep ? 'bg-amber-500/10 border-2 border-amber-500/40' : isCurrent ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-white/[0.03] border border-white/5'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{language === 'ar' ? step.roleNameAr : step.roleName}</p>
                            <p className="text-xs text-gray-500">{step.role}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${step.status === 'APPROVED' ? 'text-emerald-400' : step.status === 'REJECTED' ? 'text-red-400' : step.status === 'PENDING' ? 'text-amber-400' : 'text-gray-600'}`}>
                            {step.status === 'APPROVED' ? '✓ ' + tr('معتمد', 'Approved') : step.status === 'REJECTED' ? '✗ ' + tr('مرفوض', 'Rejected') : step.status === 'PENDING' ? '⏳ ' + tr('بانتظار الموافقة', 'Pending') : tr('في الانتظار', 'Waiting')}
                          </span>
                        </div>
                        {step.timestamp && <p className="text-xs text-gray-600 mt-1">{new Date(step.timestamp).toLocaleString()}</p>}
                        {step.comments && <p className="text-xs text-gray-400 mt-1 italic">&quot;{step.comments}&quot;</p>}
                        {step.escalatedTo && <p className="text-xs text-orange-400 mt-1">⚠️ {tr('تم التصعيد إلى', 'Escalated to')}: {step.escalatedTo}</p>}
                        {step.slaHours && step.status === 'PENDING' && <p className="text-[10px] text-gray-600 mt-0.5">SLA: {step.slaHours}h</p>}

                        {/* ONLY show approve/reject if THIS is the logged-in role's step */}
                        {isMyStep && (
                          <div className="flex gap-2 mt-3">
                            <button onClick={handleApprove} className="px-4 py-2 bg-emerald-500 text-black rounded-lg text-sm font-bold hover:bg-emerald-400">
                              ✓ {tr('موافقة', 'Approve')}
                            </button>
                            <button onClick={handleReject} className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-bold hover:bg-red-500/30">
                              ✗ {tr('رفض', 'Reject')}
                            </button>
                          </div>
                        )}
                        {/* If it's pending but NOT this user's role — show who needs to act */}
                        {isCurrent && step.status === 'PENDING' && !isMyStep && (
                          <p className="text-xs text-amber-400/60 mt-2">
                            {tr('بانتظار موافقة', 'Awaiting approval from')} {language === 'ar' ? step.roleNameAr : step.roleName}
                            {role.canCreate && ' — ' + tr('لا يمكنك الموافقة', 'you cannot approve')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 bg-white/5 rounded-lg p-3 flex justify-between text-sm">
                <span className="text-gray-500">{tr('الموعد النهائي', 'SLA Deadline')}</span>
                <span className={(selectedRequest as any).slaBreached ? 'text-red-400' : 'text-emerald-400'}>{new Date(selectedRequest.slaDeadline).toLocaleString()}</span>
              </div>
            </div>

          {/* Error display */}
          {actionError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              ⚠️ {actionError}
            </div>
          )}

          {/* AUDIT TRAIL */}
          {requestAudit.length > 0 && (
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4">{tr('سجل التدقيق', 'Audit Trail')}</h3>
              <div className="space-y-2">
                {requestAudit.map((entry: any) => (
                  <div key={entry.id} className="flex items-start gap-3 text-sm bg-white/[0.02] rounded-lg p-3 border border-white/5">
                    <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                      entry.action === 'CREATED' ? 'bg-blue-400' :
                      entry.action === 'APPROVED' ? 'bg-emerald-400' :
                      entry.action === 'REJECTED' ? 'bg-red-400' :
                      entry.action === 'ESCALATED' ? 'bg-orange-400' :
                      entry.action === 'SLA_BREACHED' ? 'bg-red-500' :
                      'bg-gray-400'
                    }`} />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="text-white font-medium">
                          {entry.action}
                          {entry.stepRole && <span className="text-gray-500"> — {entry.stepRole}</span>}
                        </span>
                        <span className="text-gray-600 text-xs font-mono">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {tr('بواسطة', 'By')}: {entry.performedBy} | {entry.previousState} → {entry.newState}
                      </p>
                      {entry.comments && <p className="text-gray-500 text-xs mt-0.5 italic">&quot;{entry.comments}&quot;</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
