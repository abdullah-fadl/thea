export type OpdStatusConfig = {
  label: string;
  labelEn?: string;
  bg: string;
  text: string;
  dot: string;
  priority: number;
  step: number;
};

export const OPD_STATUS_CONFIG: Record<string, OpdStatusConfig> = {
  BOOKED: { label: 'محجوز', labelEn: 'Booked', bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-300', priority: 0, step: 0 },
  CHECKED_IN: { label: 'تم الحضور', labelEn: 'Checked in', bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', priority: 6, step: 1 },
  ARRIVED: { label: 'وصل', labelEn: 'Arrived', bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-400', priority: 6, step: 1 },
  WAITING_NURSE: { label: 'انتظار تمريض', labelEn: 'Waiting nurse', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', priority: 7, step: 2 },
  IN_NURSING: { label: 'في التمريض', labelEn: 'In nursing', bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500', priority: 5, step: 3 },
  READY_FOR_DOCTOR: { label: 'جاهز لك', labelEn: 'Ready for doctor', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', priority: 1, step: 4 },
  WAITING_DOCTOR: { label: 'ينتظر', labelEn: 'Waiting', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', priority: 3, step: 4 },
  IN_DOCTOR: { label: 'في الكشف', labelEn: 'In Exam', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', priority: 4, step: 5 },
  PROCEDURE_PENDING: { label: 'إجراء', labelEn: 'Procedure', bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', priority: 8, step: 6 },
  PROCEDURE_DONE_WAITING: { label: 'تم الإجراء', labelEn: 'Procedure done', bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', priority: 2, step: 6 },
  PENDING_PAYMENT: { label: 'بانتظار الدفع', labelEn: 'Pending payment', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', priority: 0, step: 7 },
  COMPLETED: { label: 'مكتمل', labelEn: 'Completed', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', priority: 99, step: 7 },
};

export const DEFAULT_STATUS: OpdStatusConfig = {
  label: 'غير محدد',
  labelEn: 'Not specified',
  bg: 'bg-slate-100',
  text: 'text-slate-500',
  dot: 'bg-slate-400',
  priority: 10,
  step: 0,
};

export const VISIT_TYPE_CONFIG: Record<string, { label: string; labelEn?: string; color: string }> = {
  FVC: { label: 'أول زيارة مع الطبيب', labelEn: 'First visit with doctor', color: 'bg-blue-100 text-blue-700' },
  FVB: { label: 'زيارة محجوزة', labelEn: 'New Visit (Booked)', color: 'bg-green-100 text-green-700' },
  FVH: { label: 'أول زيارة للمستشفى', labelEn: 'First hospital visit', color: 'bg-teal-100 text-teal-700' },
  FU:  { label: 'متابعة', labelEn: 'Follow-up', color: 'bg-amber-100 text-amber-700' },
  RV:  { label: 'زيارة عودة', labelEn: 'Return visit', color: 'bg-purple-100 text-purple-700' },
  REF: { label: 'إحالة', labelEn: 'Referral', color: 'bg-indigo-100 text-indigo-700' },
  NEW: { label: 'زيارة جديدة', labelEn: 'New Visit', color: 'bg-blue-100 text-blue-700' },
  RETURN: { label: 'عودة', labelEn: 'Return', color: 'bg-orange-100 text-orange-700' },
  FOLLOW_UP: { label: 'متابعة', labelEn: 'Follow-up', color: 'bg-amber-100 text-amber-700' },
};

export const DEFAULT_VISIT_TYPE = { label: '—', labelEn: '—', color: 'bg-slate-100 text-slate-600' };

export const SOURCE_TYPE_CONFIG: Record<string, { label: string; labelEn: string; color: string }> = {
  WALK_IN:     { label: 'انتظار', labelEn: 'Walk-in', color: 'bg-orange-100 text-orange-600' },
  APPOINTMENT: { label: 'موعد', labelEn: 'Appointment', color: 'bg-green-100 text-green-600' },
};

const DEFAULT_SOURCE_TYPE = { label: '—', labelEn: '—', color: 'bg-slate-100 text-slate-600' };

export function getSourceTypeConfig(value?: string | null) {
  const key = String(value || '').toUpperCase();
  return SOURCE_TYPE_CONFIG[key] || DEFAULT_SOURCE_TYPE;
}

export function getStatusConfig(value?: string | null) {
  const key = String(value || '').toUpperCase();
  return OPD_STATUS_CONFIG[key] || DEFAULT_STATUS;
}

export function getVisitTypeConfig(value?: string | null) {
  const key = String(value || '').toUpperCase();
  return VISIT_TYPE_CONFIG[key] || DEFAULT_VISIT_TYPE;
}

export const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  URGENT: { label: 'عاجل', color: 'bg-red-100 text-red-800' },
  HIGH: { label: 'مرتفع', color: 'bg-orange-100 text-orange-800' },
  NORMAL: { label: 'عادي', color: 'bg-emerald-100 text-emerald-800' },
  LOW: { label: 'منخفض', color: 'bg-blue-100 text-blue-800' },
};

export const DOCTOR_TABS: Array<{ id: string; label: string; labelEn: string; icon: string }> = [
  { id: 'overview', label: 'ملخص', labelEn: 'Summary', icon: 'clipboard' },
  { id: 'soap', label: 'SOAP', labelEn: 'SOAP', icon: 'file-text' },
  { id: 'diagnosis', label: 'التشخيص', labelEn: 'Diagnosis', icon: 'building-2' },
  { id: 'orders', label: 'الطلبات', labelEn: 'Orders', icon: 'flask-conical' },
  { id: 'prescription', label: 'الوصفة', labelEn: 'Prescription', icon: 'pill' },
  { id: 'results', label: 'النتائج', labelEn: 'Results', icon: 'bar-chart-3' },
  { id: 'referrals', label: 'التحويلات', labelEn: 'Referrals', icon: 'refresh-ccw' },
  { id: 'care-gaps', label: 'الفجوات', labelEn: 'Gaps', icon: 'target' },
  { id: 'smart-report', label: 'التقرير', labelEn: 'Report', icon: 'file' },
  { id: 'discharge', label: 'إنهاء', labelEn: 'Discharge', icon: 'log-out' },
];
