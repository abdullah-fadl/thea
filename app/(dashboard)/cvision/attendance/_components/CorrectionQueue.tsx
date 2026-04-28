'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionTextarea, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';

import { Loader2, Plus, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Correction {
  id: string;
  correctionId: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  type: string;
  originalCheckIn?: string;
  originalCheckOut?: string;
  correctedCheckIn?: string;
  correctedCheckOut?: string;
  reason: string;
  status: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-500',
  APPROVED: 'bg-green-500',
  REJECTED: 'bg-red-500',
};

export default function CorrectionQueue() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const CORRECTION_TYPES = [
    { value: 'MISSED_PUNCH', label: tr('بصمة مفقودة', 'Missed Punch') },
    { value: 'WRONG_TIME', label: tr('وقت خاطئ', 'Wrong Time Recorded') },
    { value: 'SYSTEM_ERROR', label: tr('خطأ نظام', 'System Error') },
    { value: 'WORK_FROM_HOME', label: tr('عمل من المنزل', 'Work From Home') },
  ];

  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [fetchingOriginal, setFetchingOriginal] = useState(false);
  const [originalRecord, setOriginalRecord] = useState<{
    status?: string;
    actualIn?: string;
    actualOut?: string;
    workedMinutes?: number;
    lateMinutes?: number;
  } | null>(null);
  const [form, setForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'MISSED_PUNCH',
    originalCheckIn: '',
    originalCheckOut: '',
    correctedCheckIn: '',
    correctedCheckOut: '',
    reason: '',
  });

  const loadCorrections = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    const statusParam = filter !== 'ALL' ? `&correctionStatus=${filter}` : '';
    fetch(`/api/cvision/attendance?action=corrections${statusParam}`, { credentials: 'include', signal })
      .then(r => r.json())
      .then(d => setCorrections(d.data?.items || d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/cvision/employees?limit=500', { credentials: 'include', signal: ac.signal })
      .then(r => r.json())
      .then(d => {
        const emps = d.data?.employees || d.employees || d.data?.items || d.data || [];
        setEmployees(Array.isArray(emps) ? emps : []);
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  useEffect(() => { const ac = new AbortController(); loadCorrections(ac.signal); return () => ac.abort(); }, [loadCorrections]);

  // Auto-fetch original attendance when employee + date are selected
  useEffect(() => {
    if (!form.employeeId || !form.date) { setOriginalRecord(null); return; }
    const ac = new AbortController();
    setFetchingOriginal(true);
    const month = form.date.split('-')[1];
    const year = form.date.split('-')[0];
    const targetDay = parseInt(form.date.split('-')[2], 10);
    const targetMonth = parseInt(month, 10);
    const targetYear = parseInt(year, 10);

    fetch(`/api/cvision/attendance?employeeId=${form.employeeId}&month=${month}&year=${year}`, { credentials: 'include', signal: ac.signal })
      .then(r => r.json())
      .then(d => {
        const records = d.data?.attendance || d.data?.items || d.data || [];
        const match = records.find((r: any) => {
          if (!r.date) return false;
          const rd = new Date(r.date);
          if (isNaN(rd.getTime())) {
            const str = typeof r.date === 'string' ? r.date.split('T')[0] : '';
            return str === form.date;
          }
          return rd.getFullYear() === targetYear && (rd.getMonth() + 1) === targetMonth && rd.getDate() === targetDay;
        });

        if (match) {
          const fmtTime = (dt: string | null | undefined) => {
            if (!dt) return '';
            const d = new Date(dt);
            if (isNaN(d.getTime())) return typeof dt === 'string' ? dt : '';
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          };
          setOriginalRecord({
            status: match.status,
            actualIn: fmtTime(match.actualIn),
            actualOut: fmtTime(match.actualOut),
            workedMinutes: match.workedMinutes,
            lateMinutes: match.lateMinutes,
          });
          const inTime = fmtTime(match.actualIn);
          const outTime = fmtTime(match.actualOut);
          setForm(p => ({ ...p, originalCheckIn: inTime, originalCheckOut: outTime, correctedCheckIn: inTime, correctedCheckOut: outTime }));
        } else {
          setOriginalRecord(null);
          setForm(p => ({ ...p, originalCheckIn: '', originalCheckOut: '', correctedCheckIn: '', correctedCheckOut: '' }));
        }
      })
      .catch(() => setOriginalRecord(null))
      .finally(() => setFetchingOriginal(false));
    return () => ac.abort();
  }, [form.employeeId, form.date]);

  async function handleSubmit() {
    if (!form.employeeId || !form.date) {
      toast.error(tr('الموظف والتاريخ مطلوبان', 'Employee and date are required'));
      return;
    }
    setSubmitting(true);
    try {
      const emp = employees.find(e => e.id === form.employeeId);
      const res = await fetch('/api/cvision/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'request-correction',
          ...form,
          reason: form.reason || tr('تصحيح حضور', 'Attendance correction'),
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم إرسال طلب التصحيح', 'Correction request submitted'));
        setIsDialogOpen(false);
        setForm({ employeeId: '', date: new Date().toISOString().split('T')[0], type: 'MISSED_PUNCH', originalCheckIn: '', originalCheckOut: '', correctedCheckIn: '', correctedCheckOut: '', reason: '' });
        loadCorrections();
      } else {
        toast.error(data.error || tr('فشل في الإرسال', 'Failed to submit'));
      }
    } catch {
      toast.error(tr('خطأ في الشبكة', 'Network error'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(correctionId: string) {
    try {
      const res = await fetch('/api/cvision/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'approve-correction', correctionId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم اعتماد التصحيح', 'Correction approved'));
        loadCorrections();
      } else {
        toast.error(data.error || tr('فشل في الاعتماد', 'Failed to approve'));
      }
    } catch {
      toast.error(tr('خطأ في الشبكة', 'Network error'));
    }
  }

  async function handleReject() {
    if (!rejectId || !rejectReason) return;
    try {
      const res = await fetch('/api/cvision/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reject-correction', correctionId: rejectId, rejectionReason: rejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم رفض التصحيح', 'Correction rejected'));
        setRejectId(null);
        setRejectReason('');
        loadCorrections();
      } else {
        toast.error(data.error || tr('فشل في الرفض', 'Failed to reject'));
      }
    } catch {
      toast.error(tr('خطأ في الشبكة', 'Network error'));
    }
  }

  const pendingCount = corrections.filter(c => c.status === 'PENDING').length;

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { PENDING: tr('معلق', 'Pending'), APPROVED: tr('معتمد', 'Approved'), REJECTED: tr('مرفوض', 'Rejected') };
    return map[s] || s;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CVisionSelect
                C={C}
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'ALL', label: tr('كل الطلبات', 'All Requests') },
                  { value: 'PENDING', label: tr('معلق', 'Pending') },
                  { value: 'APPROVED', label: tr('معتمد', 'Approved') },
                  { value: 'REJECTED', label: tr('مرفوض', 'Rejected') },
                ]}
              />
          {pendingCount > 0 && (
            <CVisionBadge C={C} variant="danger">{pendingCount} {tr('معلق', 'pending')}</CVisionBadge>
          )}
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={() => setIsDialogOpen(true)}>
          <Plus style={{ height: 16, width: 16, marginInlineEnd: 4 }} /> {tr('طلب جديد', 'New Request')}
        </CVisionButton>
      </div>

      {/* Table */}
      <CVisionCard C={C}>
        <CVisionCardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
              <Loader2 style={{ height: 24, width: 24, animation: 'spin 1s linear infinite', color: C.textMuted }} />
            </div>
          ) : corrections.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48, color: C.textMuted, fontSize: 13 }}>
              {tr('لا توجد طلبات تصحيح', 'No correction requests found')}
            </div>
          ) : (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('التاريخ', 'Date')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                  <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الأصلي', 'Original')}</CVisionTh>
                  <CVisionTh C={C}>{tr('المصحح', 'Corrected')}</CVisionTh>
                  <CVisionTh C={C}>{tr('السبب', 'Reason')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الإجراءات', 'Actions')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {corrections.map(c => (
                  <CVisionTr C={C} key={c.id}>
                    <CVisionTd style={{ fontSize: 13 }}>{c.date}</CVisionTd>
                    <CVisionTd style={{ fontSize: 13, fontWeight: 500 }}>{c.employeeName || c.employeeId}</CVisionTd>
                    <CVisionTd style={{ fontSize: 13 }}>
                      {CORRECTION_TYPES.find(t => t.value === c.type)?.label || c.type}
                    </CVisionTd>
                    <CVisionTd style={{ fontSize: 12, color: C.textMuted }}>
                      {c.originalCheckIn && `${tr('دخول', 'In')}: ${c.originalCheckIn}`}
                      {c.originalCheckIn && c.originalCheckOut && ' / '}
                      {c.originalCheckOut && `${tr('خروج', 'Out')}: ${c.originalCheckOut}`}
                      {!c.originalCheckIn && !c.originalCheckOut && '—'}
                    </CVisionTd>
                    <CVisionTd style={{ fontSize: 12 }}>
                      {c.correctedCheckIn && `${tr('دخول', 'In')}: ${c.correctedCheckIn}`}
                      {c.correctedCheckIn && c.correctedCheckOut && ' / '}
                      {c.correctedCheckOut && `${tr('خروج', 'Out')}: ${c.correctedCheckOut}`}
                      {!c.correctedCheckIn && !c.correctedCheckOut && '—'}
                    </CVisionTd>
                    <CVisionTd style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.reason}</CVisionTd>
                    <CVisionTd>
                      <CVisionBadge C={C} className={STATUS_BADGE[c.status] || 'bg-gray-500'}>{statusLabel(c.status)}</CVisionBadge>
                    </CVisionTd>
                    <CVisionTd>
                      {c.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 28, paddingLeft: 8, paddingRight: 8, color: C.green }} onClick={() => handleApprove(c.correctionId || c.id)}>
                            <Check style={{ height: 16, width: 16 }} />
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 28, paddingLeft: 8, paddingRight: 8, color: C.red }} onClick={() => { setRejectId(c.correctionId || c.id); setRejectReason(''); }}>
                            <X style={{ height: 16, width: 16 }} />
                          </CVisionButton>
                        </div>
                      )}
                      {c.status === 'REJECTED' && c.rejectionReason && (
                        <span style={{ fontSize: 12, color: C.red }} title={c.rejectionReason}>{c.rejectionReason.slice(0, 30)}...</span>
                      )}
                    </CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* New Correction Dialog */}
      <CVisionDialog C={C} open={isDialogOpen} onClose={() => { setIsDialogOpen(false); setOriginalRecord(null); }} title={tr('تصحيح الحضور', 'Attendance Correction')} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('أرسل تصحيح حضور للمراجعة.', 'Submit an attendance correction for review.')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('الموظف', 'Employee')}</CVisionLabel>
              <CVisionSelect
                C={C}
                value={form.employeeId || undefined}
                placeholder={tr('اختر الموظف', 'Select employee')}
                options={employees.map(emp => (
                    ({ value: emp.id, label: `${emp.firstName} ${emp.lastName}` })
                  ))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('التاريخ', 'Date')}</CVisionLabel>
                <CVisionInput C={C} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('النوع', 'Type')}</CVisionLabel>
                <CVisionSelect
                C={C}
                value={form.type}
                options={CORRECTION_TYPES.map(t => (
                      ({ value: t.value, label: t.label })
                    ))}
              />
              </div>
            </div>

            {/* Original Record Info */}
            {form.employeeId && form.date && (
              <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('السجل الحالي', 'Current Record')}</p>
                {fetchingOriginal ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted }}>
                    <Loader2 style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} /> {tr('جاري التحميل...', 'Loading...')}
                  </div>
                ) : originalRecord ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CVisionBadge C={C} variant={originalRecord.status === 'PRESENT' ? 'default' : originalRecord.status === 'LATE' ? 'secondary' : originalRecord.status === 'ABSENT' ? 'destructive' : 'outline'}>
                        {originalRecord.status}
                      </CVisionBadge>
                      {originalRecord.workedMinutes != null && originalRecord.workedMinutes > 0 && (
                        <span style={{ fontSize: 12, color: C.textMuted }}>
                          {Math.floor(originalRecord.workedMinutes / 60)}{tr('س', 'h')} {originalRecord.workedMinutes % 60}{tr('د', 'm')} {tr('عمل', 'worked')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 13 }}>
                      <div>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{tr('الدخول', 'Check-In')}: </span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{originalRecord.actualIn || '—'}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{tr('الخروج', 'Check-Out')}: </span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{originalRecord.actualOut || '—'}</span>
                      </div>
                    </div>
                    {originalRecord.lateMinutes != null && originalRecord.lateMinutes > 0 && (
                      <p style={{ fontSize: 12, color: C.red }}>{tr('تأخير', 'Late')}: {originalRecord.lateMinutes} {tr('دقيقة', 'min')}</p>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('لا يوجد سجل حضور لهذا التاريخ.', 'No attendance record found for this date.')}</p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('عدّل فقط الوقت الذي يحتاج تصحيح:', 'Edit only the time that needs correction:')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {tr('الدخول', 'Check-In')}
                    {originalRecord && form.correctedCheckIn !== form.originalCheckIn && (
                      <CVisionBadge C={C} variant="outline" style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 0, paddingBottom: 0, color: C.orange }}>{tr('تغير', 'changed')}</CVisionBadge>
                    )}
                  </CVisionLabel>
                  <CVisionInput C={C} type="time" value={form.correctedCheckIn} onChange={e => setForm(p => ({ ...p, correctedCheckIn: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {tr('الخروج', 'Check-Out')}
                    {originalRecord && form.correctedCheckOut !== form.originalCheckOut && (
                      <CVisionBadge C={C} variant="outline" style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 0, paddingBottom: 0, color: C.orange }}>{tr('تغير', 'changed')}</CVisionBadge>
                    )}
                  </CVisionLabel>
                  <CVisionInput C={C} type="time" value={form.correctedCheckOut} onChange={e => setForm(p => ({ ...p, correctedCheckOut: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('السبب', 'Reason')} <span style={{ color: C.textMuted }}>({tr('اختياري', 'optional')})</span></CVisionLabel>
              <CVisionTextarea C={C} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder={tr('مثال: الموظف نسي البصمة، خطأ نظام...', 'e.g. Employee forgot to clock out, system error...')} rows={2} />
            </div>
          </div>

          <div style={{ paddingTop: 12, borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
            <CVisionButton C={C} isDark={isDark} onClick={handleSubmit} disabled={submitting} style={{ width: '100%' }}>
              {submitting ? (
                <><Loader2 style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} /> {tr('جاري الإرسال...', 'Submitting...')}</>
              ) : (
                tr('إرسال الطلب', 'Submit Request')
              )}
            </CVisionButton>
          </div>
      </CVisionDialog>

      {/* Reject Dialog */}
      <CVisionDialog C={C} open={!!rejectId} onClose={() => setRejectId(null)} title={tr('رفض التصحيح', 'Reject Correction')} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('اذكر سبب رفض هذا الطلب.', 'Provide a reason for rejecting this request.')}</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CVisionTextarea C={C} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder={tr('سبب الرفض...', 'Reason for rejection...')} rows={3} />
            <CVisionButton C={C} isDark={isDark} onClick={handleReject} variant="danger" style={{ width: '100%' }} disabled={!rejectReason.trim()}>
              {tr('رفض', 'Reject')}
            </CVisionButton>
          </div>
      </CVisionDialog>
    </div>
  );
}
