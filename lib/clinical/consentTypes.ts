export interface ConsentType {
  id: string;
  name: string;
  nameAr: string;
  required: boolean;
  content: string;
  contentAr: string;
  requiresDetails?: boolean;
  isRefusal?: boolean;
}

export const CONSENT_TYPES: ConsentType[] = [
  {
    id: 'general_treatment',
    name: 'General Treatment Consent',
    nameAr: 'موافقة على العلاج العام',
    required: true,
    content: 'I consent to receive medical care and treatment at this facility.',
    contentAr: 'أوافق على تلقي الرعاية الطبية والعلاج في هذا المرفق الصحي.',
  },
  {
    id: 'data_privacy',
    name: 'Data Privacy Consent',
    nameAr: 'موافقة على خصوصية البيانات',
    required: true,
    content: 'I consent to the collection and use of my health data for care purposes.',
    contentAr: 'أوافق على جمع واستخدام بياناتي الصحية لأغراض الرعاية.',
  },
  {
    id: 'procedure',
    name: 'Procedure Consent',
    nameAr: 'موافقة على الإجراء',
    required: false,
    requiresDetails: true,
    content: 'I consent to the medical procedure described below. Risks, benefits, and alternatives were explained.',
    contentAr: 'أوافق على الإجراء الطبي الموصوف أدناه. تم شرح المخاطر والفوائد والبدائل.',
  },
  {
    id: 'admission_consent',
    name: 'Admission Consent',
    nameAr: 'موافقة على التنويم',
    required: false,
    content: 'I consent to admission to this healthcare facility for the treatment described.',
    contentAr: 'أوافق على التنويم في هذا المرفق الصحي للعلاج الموصوف.',
  },
  {
    id: 'surgical_consent',
    name: 'Surgical Consent',
    nameAr: 'موافقة على العملية الجراحية',
    required: false,
    requiresDetails: true,
    content: 'I consent to the surgical procedure described below, including anesthesia. All risks, benefits, and alternatives have been explained to me.',
    contentAr: 'أوافق على العملية الجراحية الموصوفة أدناه، بما في ذلك التخدير. تم شرح جميع المخاطر والفوائد والبدائل لي.',
  },
  {
    id: 'pdpl_data_processing',
    name: 'PDPL Data Processing Consent',
    nameAr: 'موافقة على معالجة البيانات الشخصية (نظام حماية البيانات)',
    required: true,
    content: 'I consent to the processing of my personal data as described in the privacy policy, in accordance with the Saudi Personal Data Protection Law (PDPL). I understand my right to withdraw this consent at any time.',
    contentAr: 'أوافق على معالجة بياناتي الشخصية كما هو موضح في سياسة الخصوصية، وفقاً لنظام حماية البيانات الشخصية السعودي. أفهم حقي في سحب هذه الموافقة في أي وقت.',
  },
  // ── Refusal Consent Types ──
  {
    id: 'vitals_refusal',
    name: 'Vitals Refusal',
    nameAr: 'رفض قياس العلامات الحيوية',
    required: false,
    isRefusal: true,
    requiresDetails: true,
    content: 'The patient refuses to have vital signs measured. Risks of declining monitoring have been explained.',
    contentAr: 'يرفض المريض قياس العلامات الحيوية. تم شرح مخاطر رفض المتابعة.',
  },
  {
    id: 'procedure_refusal',
    name: 'Procedure Refusal',
    nameAr: 'رفض الإجراء',
    required: false,
    isRefusal: true,
    requiresDetails: true,
    content: 'The patient refuses the recommended procedure. Risks of declining treatment have been explained.',
    contentAr: 'يرفض المريض الإجراء الموصى به. تم شرح مخاطر رفض العلاج.',
  },
  {
    id: 'treatment_refusal',
    name: 'Treatment Refusal',
    nameAr: 'رفض العلاج',
    required: false,
    isRefusal: true,
    requiresDetails: true,
    content: 'The patient refuses the recommended treatment plan. Consequences have been explained and understood.',
    contentAr: 'يرفض المريض خطة العلاج الموصى بها. تم شرح العواقب وتم استيعابها.',
  },
];

// ── Delivery Methods ──

export type ConsentDeliveryMethod = 'tablet' | 'sms' | 'whatsapp';

export const CONSENT_DELIVERY_METHODS: { key: ConsentDeliveryMethod; label: string; labelAr: string; available: boolean }[] = [
  { key: 'tablet', label: 'Tablet Signature', labelAr: 'توقيع على التابلت', available: true },
  { key: 'sms', label: 'SMS Link', labelAr: 'رابط SMS', available: false },
  { key: 'whatsapp', label: 'WhatsApp', labelAr: 'واتساب', available: false },
];
