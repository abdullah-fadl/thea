/**
 * Bedside Procedure Checklist
 * Pre-built safety checklists for common nursing procedures.
 * Aligned with WHO Patient Safety, JCI, and CBAHI standards.
 */

export type ProcedureStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ChecklistItem {
  id: string;
  labelAr: string;
  labelEn: string;
  checked: boolean;
  timestamp?: string;
  note?: string;
}

export interface ProcedureRecord {
  id: string;
  templateId: string;
  status: ProcedureStatus;
  startedAt: string | null;
  completedAt: string | null;
  performedBy: string;
  items: ChecklistItem[];
  complications: string;
  patientResponse: string;
  notes: string;
}

export interface ProceduresData {
  procedures: ProcedureRecord[];
}

export interface ProcedureTemplate {
  id: string;
  labelAr: string;
  labelEn: string;
  category: string;
  icon: string;
  items: Omit<ChecklistItem, 'checked' | 'timestamp' | 'note'>[];
}

export const DEFAULT_PROCEDURES_DATA: ProceduresData = { procedures: [] };

export const PROCEDURE_TEMPLATES: ProcedureTemplate[] = [
  {
    id: 'iv_insertion',
    labelAr: 'تركيب كانيولا وريدية',
    labelEn: 'IV Cannulation',
    category: 'vascular',
    icon: 'syringe',
    items: [
      { id: 'iv_1', labelAr: 'التحقق من هوية المريض', labelEn: 'Verify patient identity' },
      { id: 'iv_2', labelAr: 'التحقق من أمر الطبيب', labelEn: 'Verify physician order' },
      { id: 'iv_3', labelAr: 'تحضير المعدات اللازمة', labelEn: 'Prepare equipment' },
      { id: 'iv_4', labelAr: 'نظافة اليدين', labelEn: 'Perform hand hygiene' },
      { id: 'iv_5', labelAr: 'لبس القفازات', labelEn: 'Don gloves' },
      { id: 'iv_6', labelAr: 'اختيار الموقع المناسب', labelEn: 'Select appropriate site' },
      { id: 'iv_7', labelAr: 'تعقيم الموقع', labelEn: 'Disinfect insertion site' },
      { id: 'iv_8', labelAr: 'إدخال الكانيولا', labelEn: 'Insert cannula' },
      { id: 'iv_9', labelAr: 'التأكد من رجوع الدم', labelEn: 'Confirm blood return' },
      { id: 'iv_10', labelAr: 'تثبيت الكانيولا', labelEn: 'Secure cannula with dressing' },
      { id: 'iv_11', labelAr: 'تسجيل التاريخ والحجم على اللاصق', labelEn: 'Label with date and gauge size' },
      { id: 'iv_12', labelAr: 'التخلص من الأدوات الحادة', labelEn: 'Dispose sharps safely' },
      { id: 'iv_13', labelAr: 'توثيق الإجراء', labelEn: 'Document procedure' },
    ],
  },
  {
    id: 'urinary_catheter',
    labelAr: 'تركيب قسطرة بولية',
    labelEn: 'Urinary Catheterization',
    category: 'urinary',
    icon: 'hospital',
    items: [
      { id: 'uc_1', labelAr: 'التحقق من هوية المريض', labelEn: 'Verify patient identity' },
      { id: 'uc_2', labelAr: 'التحقق من أمر الطبيب والمؤشر', labelEn: 'Verify order and indication' },
      { id: 'uc_3', labelAr: 'شرح الإجراء للمريض', labelEn: 'Explain procedure to patient' },
      { id: 'uc_4', labelAr: 'تحضير المعدات المعقمة', labelEn: 'Prepare sterile equipment' },
      { id: 'uc_5', labelAr: 'نظافة اليدين', labelEn: 'Perform hand hygiene' },
      { id: 'uc_6', labelAr: 'وضعية المريض المناسبة', labelEn: 'Position patient appropriately' },
      { id: 'uc_7', labelAr: 'تنظيف المنطقة بالمطهر', labelEn: 'Cleanse with antiseptic' },
      { id: 'uc_8', labelAr: 'إدخال القسطرة بتقنية معقمة', labelEn: 'Insert catheter using sterile technique' },
      { id: 'uc_9', labelAr: 'التأكد من تدفق البول', labelEn: 'Confirm urine flow' },
      { id: 'uc_10', labelAr: 'نفخ البالون', labelEn: 'Inflate balloon' },
      { id: 'uc_11', labelAr: 'تثبيت كيس التجميع', labelEn: 'Secure drainage bag below bladder' },
      { id: 'uc_12', labelAr: 'توثيق الحجم ونوع القسطرة وكمية البول', labelEn: 'Document size, type, and output' },
    ],
  },
  {
    id: 'wound_dressing',
    labelAr: 'تغيير ضمادة الجرح',
    labelEn: 'Wound Dressing Change',
    category: 'wound',
    icon: 'bandage',
    items: [
      { id: 'wd_1', labelAr: 'التحقق من هوية المريض', labelEn: 'Verify patient identity' },
      { id: 'wd_2', labelAr: 'مراجعة أمر العناية بالجرح', labelEn: 'Review wound care order' },
      { id: 'wd_3', labelAr: 'تقييم الألم قبل الإجراء', labelEn: 'Assess pain before procedure' },
      { id: 'wd_4', labelAr: 'نظافة اليدين', labelEn: 'Perform hand hygiene' },
      { id: 'wd_5', labelAr: 'لبس القفازات النظيفة', labelEn: 'Don clean gloves' },
      { id: 'wd_6', labelAr: 'إزالة الضمادة القديمة', labelEn: 'Remove old dressing' },
      { id: 'wd_7', labelAr: 'تقييم الجرح (حجم، لون، إفرازات)', labelEn: 'Assess wound (size, color, drainage)' },
      { id: 'wd_8', labelAr: 'تنظيف الجرح', labelEn: 'Cleanse wound' },
      { id: 'wd_9', labelAr: 'تطبيق الضمادة الجديدة', labelEn: 'Apply new dressing' },
      { id: 'wd_10', labelAr: 'تسجيل التاريخ على الضمادة', labelEn: 'Label dressing with date' },
      { id: 'wd_11', labelAr: 'التخلص من المواد الملوثة', labelEn: 'Dispose contaminated materials' },
      { id: 'wd_12', labelAr: 'توثيق حالة الجرح', labelEn: 'Document wound status' },
    ],
  },
  {
    id: 'blood_draw',
    labelAr: 'سحب عينة دم',
    labelEn: 'Blood Draw / Venipuncture',
    category: 'lab',
    icon: 'droplets',
    items: [
      { id: 'bd_1', labelAr: 'التحقق من هوية المريض (اسم + رقم)', labelEn: 'Verify patient identity (name + MRN)' },
      { id: 'bd_2', labelAr: 'التحقق من الطلب المخبري', labelEn: 'Verify lab order' },
      { id: 'bd_3', labelAr: 'التأكد من حالة الصيام إذا لزم', labelEn: 'Confirm fasting status if required' },
      { id: 'bd_4', labelAr: 'تحضير الأنابيب الصحيحة', labelEn: 'Prepare correct tubes' },
      { id: 'bd_5', labelAr: 'نظافة اليدين ولبس القفازات', labelEn: 'Hand hygiene and don gloves' },
      { id: 'bd_6', labelAr: 'ربط الرباط الضاغط', labelEn: 'Apply tourniquet' },
      { id: 'bd_7', labelAr: 'تعقيم الموقع', labelEn: 'Disinfect site' },
      { id: 'bd_8', labelAr: 'سحب العينة', labelEn: 'Perform venipuncture' },
      { id: 'bd_9', labelAr: 'تعبئة الأنابيب بالترتيب الصحيح', labelEn: 'Fill tubes in correct order' },
      { id: 'bd_10', labelAr: 'الضغط على الموقع', labelEn: 'Apply pressure to site' },
      { id: 'bd_11', labelAr: 'تسمية العينات أمام المريض', labelEn: 'Label specimens at bedside' },
      { id: 'bd_12', labelAr: 'التخلص من الأدوات الحادة', labelEn: 'Dispose sharps safely' },
    ],
  },
  {
    id: 'medication_admin',
    labelAr: 'إعطاء دواء',
    labelEn: 'Medication Administration',
    category: 'medication',
    icon: 'pill',
    items: [
      { id: 'ma_1', labelAr: 'المريض الصحيح', labelEn: 'Right Patient' },
      { id: 'ma_2', labelAr: 'الدواء الصحيح', labelEn: 'Right Medication' },
      { id: 'ma_3', labelAr: 'الجرعة الصحيحة', labelEn: 'Right Dose' },
      { id: 'ma_4', labelAr: 'الطريقة الصحيحة', labelEn: 'Right Route' },
      { id: 'ma_5', labelAr: 'الوقت الصحيح', labelEn: 'Right Time' },
      { id: 'ma_6', labelAr: 'التوثيق الصحيح', labelEn: 'Right Documentation' },
      { id: 'ma_7', labelAr: 'السبب الصحيح', labelEn: 'Right Reason' },
      { id: 'ma_8', labelAr: 'الاستجابة الصحيحة', labelEn: 'Right Response' },
      { id: 'ma_9', labelAr: 'التحقق من الحساسية', labelEn: 'Check allergies' },
      { id: 'ma_10', labelAr: 'التحقق من تفاعلات الأدوية', labelEn: 'Check drug interactions' },
      { id: 'ma_11', labelAr: 'تثقيف المريض عن الدواء', labelEn: 'Educate patient about medication' },
    ],
  },
  {
    id: 'ngt_insertion',
    labelAr: 'تركيب أنبوب أنفي معدي',
    labelEn: 'NG Tube Insertion',
    category: 'gastric',
    icon: 'wrench',
    items: [
      { id: 'ng_1', labelAr: 'التحقق من هوية المريض', labelEn: 'Verify patient identity' },
      { id: 'ng_2', labelAr: 'التحقق من أمر الطبيب', labelEn: 'Verify physician order' },
      { id: 'ng_3', labelAr: 'شرح الإجراء للمريض', labelEn: 'Explain procedure to patient' },
      { id: 'ng_4', labelAr: 'قياس طول الأنبوب (أنف-أذن-معدة)', labelEn: 'Measure tube length (NEX method)' },
      { id: 'ng_5', labelAr: 'وضعية فاولر العالية', labelEn: 'Position in high Fowler\'s' },
      { id: 'ng_6', labelAr: 'تزليق الأنبوب', labelEn: 'Lubricate tube tip' },
      { id: 'ng_7', labelAr: 'إدخال الأنبوب', labelEn: 'Insert tube' },
      { id: 'ng_8', labelAr: 'التأكد من الموضع (شفط + أشعة)', labelEn: 'Verify placement (aspirate + X-ray)' },
      { id: 'ng_9', labelAr: 'تثبيت الأنبوب', labelEn: 'Secure tube' },
      { id: 'ng_10', labelAr: 'توثيق الحجم وعلامة التثبيت', labelEn: 'Document size and insertion mark' },
    ],
  },
  {
    id: 'oxygen_therapy',
    labelAr: 'بدء علاج بالأكسجين',
    labelEn: 'Oxygen Therapy Initiation',
    category: 'respiratory',
    icon: 'wind',
    items: [
      { id: 'o2_1', labelAr: 'التحقق من أمر الطبيب (تدفق + جهاز)', labelEn: 'Verify order (flow rate + device)' },
      { id: 'o2_2', labelAr: 'تقييم العلامات الحيوية الأساسية', labelEn: 'Assess baseline vitals' },
      { id: 'o2_3', labelAr: 'قياس SpO2 قبل البدء', labelEn: 'Check SpO2 before starting' },
      { id: 'o2_4', labelAr: 'اختيار الجهاز المناسب', labelEn: 'Select appropriate device' },
      { id: 'o2_5', labelAr: 'ضبط التدفق', labelEn: 'Set flow rate' },
      { id: 'o2_6', labelAr: 'تطبيق الجهاز على المريض', labelEn: 'Apply device to patient' },
      { id: 'o2_7', labelAr: 'مراقبة SpO2 بعد 15 دقيقة', labelEn: 'Monitor SpO2 after 15 minutes' },
      { id: 'o2_8', labelAr: 'علامة "لا تدخين/لهب" مرئية', labelEn: 'Ensure No Smoking sign visible' },
      { id: 'o2_9', labelAr: 'توثيق البدء والاستجابة', labelEn: 'Document initiation and response' },
    ],
  },
  {
    id: 'blood_transfusion',
    labelAr: 'نقل دم',
    labelEn: 'Blood Transfusion',
    category: 'transfusion',
    icon: 'circle-dot',
    items: [
      { id: 'bt_1', labelAr: 'التحقق من أمر الطبيب وموافقة المريض', labelEn: 'Verify order and patient consent' },
      { id: 'bt_2', labelAr: 'مطابقة هوية المريض مع كيس الدم (ممرضتان)', labelEn: 'Match patient ID with blood bag (2 nurses)' },
      { id: 'bt_3', labelAr: 'التحقق من فصيلة الدم والتوافق', labelEn: 'Verify blood type and crossmatch' },
      { id: 'bt_4', labelAr: 'التحقق من صلاحية الكيس', labelEn: 'Check expiry and bag integrity' },
      { id: 'bt_5', labelAr: 'قياس العلامات الحيوية الأساسية', labelEn: 'Record baseline vitals' },
      { id: 'bt_6', labelAr: 'تشغيل المحلول الملحي أولاً', labelEn: 'Prime with normal saline' },
      { id: 'bt_7', labelAr: 'بدء النقل ببطء (أول 15 دقيقة)', labelEn: 'Start slowly — stay for first 15 min' },
      { id: 'bt_8', labelAr: 'قياس العلامات الحيوية بعد 15 دقيقة', labelEn: 'Recheck vitals at 15 minutes' },
      { id: 'bt_9', labelAr: 'مراقبة علامات التفاعل', labelEn: 'Monitor for transfusion reaction signs' },
      { id: 'bt_10', labelAr: 'قياس العلامات الحيوية عند الانتهاء', labelEn: 'Final vitals post-transfusion' },
      { id: 'bt_11', labelAr: 'توثيق الكمية والمدة', labelEn: 'Document volume and duration' },
    ],
  },
];

export function createProcedureFromTemplate(template: ProcedureTemplate): ProcedureRecord {
  return {
    id: `proc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    templateId: template.id,
    status: 'NOT_STARTED',
    startedAt: null,
    completedAt: null,
    performedBy: '',
    items: template.items.map(it => ({ ...it, checked: false })),
    complications: '',
    patientResponse: '',
    notes: '',
  };
}
