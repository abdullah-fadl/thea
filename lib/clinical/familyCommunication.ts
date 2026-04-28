/**
 * Family Communication Log
 * Structured documentation of all communications with patient's family/guardians.
 * Supports JCI/CBAHI requirements for family engagement documentation.
 */

export type CommMethod = 'IN_PERSON' | 'PHONE' | 'VIDEO' | 'MESSAGE' | 'WRITTEN';
export type CommTopic = 'DIAGNOSIS' | 'TREATMENT_PLAN' | 'PROGNOSIS' | 'PROCEDURE_CONSENT' | 'DISCHARGE_PLAN' | 'MEDICATION' | 'FOLLOW_UP' | 'CONDITION_UPDATE' | 'TEST_RESULTS' | 'REFERRAL' | 'PALLIATIVE' | 'OTHER';
export type FamilyRelation = 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING' | 'GUARDIAN' | 'OTHER';
export type EmotionalState = 'CALM' | 'ANXIOUS' | 'DISTRESSED' | 'ANGRY' | 'ACCEPTING' | 'CONFUSED';

export interface FamilyContact {
  name: string;
  relation: FamilyRelation;
  relationOther?: string;
  phone?: string;
  isDecisionMaker: boolean;
}

export interface FamilyCommunicationEntry {
  id: string;
  timestamp: string;
  contact: FamilyContact;
  method: CommMethod;
  topics: CommTopic[];
  summary: string;
  familyQuestions: string;
  familyEmotionalState: EmotionalState;
  informedConsent: boolean;
  interpreterUsed: boolean;
  interpreterLanguage?: string;
  followUpNeeded: boolean;
  followUpNote?: string;
  communicatedBy: string;
}

export interface FamilyCommData {
  contacts: FamilyContact[];
  entries: FamilyCommunicationEntry[];
}

export const DEFAULT_FAMILY_COMM: FamilyCommData = {
  contacts: [],
  entries: [],
};

export const COMM_METHODS: { value: CommMethod; labelAr: string; labelEn: string; icon: string }[] = [
  { value: 'IN_PERSON', labelAr: 'حضوري', labelEn: 'In Person', icon: 'user' },
  { value: 'PHONE', labelAr: 'هاتف', labelEn: 'Phone', icon: 'phone' },
  { value: 'VIDEO', labelAr: 'مكالمة فيديو', labelEn: 'Video Call', icon: 'video' },
  { value: 'MESSAGE', labelAr: 'رسالة نصية', labelEn: 'Message', icon: 'message-square' },
  { value: 'WRITTEN', labelAr: 'مكتوب', labelEn: 'Written', icon: 'file-text' },
];

export const COMM_TOPICS: { value: CommTopic; labelAr: string; labelEn: string }[] = [
  { value: 'DIAGNOSIS', labelAr: 'التشخيص', labelEn: 'Diagnosis' },
  { value: 'TREATMENT_PLAN', labelAr: 'خطة العلاج', labelEn: 'Treatment Plan' },
  { value: 'PROGNOSIS', labelAr: 'التوقعات', labelEn: 'Prognosis' },
  { value: 'PROCEDURE_CONSENT', labelAr: 'موافقة إجراء', labelEn: 'Procedure Consent' },
  { value: 'DISCHARGE_PLAN', labelAr: 'خطة الخروج', labelEn: 'Discharge Plan' },
  { value: 'MEDICATION', labelAr: 'الأدوية', labelEn: 'Medication' },
  { value: 'FOLLOW_UP', labelAr: 'المتابعة', labelEn: 'Follow-up' },
  { value: 'CONDITION_UPDATE', labelAr: 'تحديث الحالة', labelEn: 'Condition Update' },
  { value: 'TEST_RESULTS', labelAr: 'نتائج الفحوصات', labelEn: 'Test Results' },
  { value: 'REFERRAL', labelAr: 'تحويل', labelEn: 'Referral' },
  { value: 'PALLIATIVE', labelAr: 'رعاية تلطيفية', labelEn: 'Palliative Care' },
  { value: 'OTHER', labelAr: 'أخرى', labelEn: 'Other' },
];

export const FAMILY_RELATIONS: { value: FamilyRelation; labelAr: string; labelEn: string }[] = [
  { value: 'SPOUSE', labelAr: 'زوج/زوجة', labelEn: 'Spouse' },
  { value: 'PARENT', labelAr: 'والد/والدة', labelEn: 'Parent' },
  { value: 'CHILD', labelAr: 'ابن/ابنة', labelEn: 'Child' },
  { value: 'SIBLING', labelAr: 'أخ/أخت', labelEn: 'Sibling' },
  { value: 'GUARDIAN', labelAr: 'ولي أمر', labelEn: 'Guardian' },
  { value: 'OTHER', labelAr: 'أخرى', labelEn: 'Other' },
];

export const EMOTIONAL_STATES: { value: EmotionalState; labelAr: string; labelEn: string; emoji: string }[] = [
  { value: 'CALM', labelAr: 'هادئ', labelEn: 'Calm', emoji: 'smile' },
  { value: 'ANXIOUS', labelAr: 'قلق', labelEn: 'Anxious', emoji: 'frown' },
  { value: 'DISTRESSED', labelAr: 'متوتر', labelEn: 'Distressed', emoji: 'alert-circle' },
  { value: 'ANGRY', labelAr: 'غاضب', labelEn: 'Angry', emoji: 'angry' },
  { value: 'ACCEPTING', labelAr: 'متقبل', labelEn: 'Accepting', emoji: 'thumbs-up' },
  { value: 'CONFUSED', labelAr: 'مرتبك', labelEn: 'Confused', emoji: 'help-circle' },
];
