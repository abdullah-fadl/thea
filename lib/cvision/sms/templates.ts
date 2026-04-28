const SMS_TEMPLATES: Record<string, string> = {
  leave_approved: 'تمت الموافقة على إجازتك من {{startDate}} إلى {{endDate}}',
  leave_rejected: 'تم رفض طلب إجازتك. السبب: {{reason}}',
  loan_approved: 'تمت الموافقة على سلفتك بمبلغ {{amount}} ريال',
  iqama_expiry: 'تنبيه: إقامة الموظف {{name}} تنتهي خلال {{days}} يوم',
  contract_expiry: 'تنبيه: عقد {{name}} ينتهي خلال {{days}} يوم',
  passport_expiry: 'تنبيه: جواز سفر {{name}} ينتهي خلال {{days}} يوم',
  otp: 'رمز التحقق: {{code}} — صالح لمدة 5 دقائق',
  salary_transfer: 'تم تحويل راتب شهر {{month}} بمبلغ {{amount}} ريال',
  training_reminder: 'تذكير: دورة "{{courseTitle}}" تبدأ في {{date}}',
  approval_pending: 'لديك طلب بانتظار موافقتك: {{requestType}} من {{employeeName}}',
  welcome: 'مرحباً {{name}}! تم إنشاء حسابك في CVision HR. رابط الدخول: {{url}}',
};

export function renderSMSTemplate(templateKey: string, variables: Record<string, string>): string {
  let text = SMS_TEMPLATES[templateKey] || templateKey;
  Object.entries(variables).forEach(([k, v]) => {
    const ek = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); text = text.replace(new RegExp(`\\{\\{${ek}\\}\\}`, 'g'), v);
  });
  return text;
}

export { SMS_TEMPLATES };
