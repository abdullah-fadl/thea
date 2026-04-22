// =============================================================================
// Appointment Reminder Templates — NEW FILE (no existing code modified)
// =============================================================================

export interface ReminderVars {
  patientName: string;
  patientNameAr?: string;
  doctorName: string;
  doctorNameAr?: string;
  clinicName: string;
  clinicNameAr?: string;
  appointmentDate: string; // formatted date
  appointmentDateAr?: string;
  appointmentTime: string;
  confirmUrl?: string;
  cancelUrl?: string;
  hospitalName?: string;
  hospitalNameAr?: string;
}

export const DEFAULT_TEMPLATES = {
  // ── SMS Templates ──
  SMS_BEFORE_24H_AR: (v: ReminderVars) =>
    `عزيزي/عزيزتي ${v.patientNameAr || v.patientName}، نذكرك بموعدك غداً ${v.appointmentDateAr || v.appointmentDate} الساعة ${v.appointmentTime} مع د. ${v.doctorNameAr || v.doctorName} في ${v.clinicNameAr || v.clinicName}. ${v.confirmUrl ? `للتأكيد: ${v.confirmUrl}` : ''} ${v.cancelUrl ? `للإلغاء: ${v.cancelUrl}` : ''}`.trim(),

  SMS_BEFORE_24H_EN: (v: ReminderVars) =>
    `Dear ${v.patientName}, reminder: your appointment is tomorrow ${v.appointmentDate} at ${v.appointmentTime} with Dr. ${v.doctorName} at ${v.clinicName}. ${v.confirmUrl ? `Confirm: ${v.confirmUrl}` : ''} ${v.cancelUrl ? `Cancel: ${v.cancelUrl}` : ''}`.trim(),

  SMS_BEFORE_2H_AR: (v: ReminderVars) =>
    `تذكير: موعدك بعد ساعتين (${v.appointmentTime}) مع د. ${v.doctorNameAr || v.doctorName}. يرجى الحضور قبل ١٥ دقيقة.`,

  SMS_BEFORE_2H_EN: (v: ReminderVars) =>
    `Reminder: your appointment is in 2 hours (${v.appointmentTime}) with Dr. ${v.doctorName}. Please arrive 15 minutes early.`,

  // ── Portal / Push Templates ──
  PUSH_BEFORE_24H_AR: (v: ReminderVars) =>
    `موعدك غداً الساعة ${v.appointmentTime} مع د. ${v.doctorNameAr || v.doctorName}`,

  PUSH_BEFORE_24H_EN: (v: ReminderVars) =>
    `Your appointment is tomorrow at ${v.appointmentTime} with Dr. ${v.doctorName}`,

  PUSH_BEFORE_2H_AR: (v: ReminderVars) =>
    `تذكير: موعدك بعد ساعتين (${v.appointmentTime})`,

  PUSH_BEFORE_2H_EN: (v: ReminderVars) =>
    `Reminder: appointment in 2 hours (${v.appointmentTime})`,

  // ── Email Subject Lines ──
  EMAIL_SUBJECT_AR: (v: ReminderVars) =>
    `تذكير بموعدك — ${v.appointmentDate}`,

  EMAIL_SUBJECT_EN: (v: ReminderVars) =>
    `Appointment Reminder — ${v.appointmentDate}`,
};

export function renderTemplate(
  templateKey: keyof typeof DEFAULT_TEMPLATES,
  vars: ReminderVars,
  customTemplate?: string
): string {
  if (customTemplate) {
    return customTemplate
      .replace(/\{patientName\}/g, vars.patientName)
      .replace(/\{patientNameAr\}/g, vars.patientNameAr ?? vars.patientName)
      .replace(/\{doctorName\}/g, vars.doctorName)
      .replace(/\{doctorNameAr\}/g, vars.doctorNameAr ?? vars.doctorName)
      .replace(/\{clinicName\}/g, vars.clinicName)
      .replace(/\{clinicNameAr\}/g, vars.clinicNameAr ?? vars.clinicName)
      .replace(/\{appointmentDate\}/g, vars.appointmentDate)
      .replace(/\{appointmentTime\}/g, vars.appointmentTime)
      .replace(/\{confirmUrl\}/g, vars.confirmUrl ?? '')
      .replace(/\{cancelUrl\}/g, vars.cancelUrl ?? '');
  }
  return DEFAULT_TEMPLATES[templateKey](vars);
}

export function formatDate(date: Date, lang: 'ar' | 'en'): string {
  return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
