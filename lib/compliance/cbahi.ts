/**
 * CBAHI (Saudi Central Board for Accreditation of Healthcare Institutions)
 * Standards Mapping Engine
 *
 * Comprehensive registry of CBAHI accreditation standards with automated
 * compliance checking against Thea EHR data.
 */

import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MeasurableElement {
  id: string;        // e.g., "PC.1.ME1"
  text: string;
  textAr: string;
  evidenceRequired: string[];
  automatedCheck?: (tenantId: string) => Promise<ComplianceResult>;
}

export interface CbahiStandard {
  id: string;                    // e.g., "PC.1"
  domain: string;                // e.g., "PC"
  domainName: string;            // e.g., "Patient Care"
  domainNameAr: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  measurableElements: MeasurableElement[];
  theaModuleMapping: string[];
  evidenceTypes: string[];
  priority: 'essential' | 'standard' | 'advanced';
}

export interface ComplianceResult {
  standardId: string;
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
  score: number;   // 0-100
  evidence: string[];
  gaps: string[];
  recommendations: string[];
}

export interface DomainScore {
  domain: string;
  domainName: string;
  domainNameAr: string;
  totalStandards: number;
  assessedStandards: number;
  compliant: number;
  partial: number;
  nonCompliant: number;
  notApplicable: number;
  score: number; // 0-100
}

export interface FullAuditResult {
  overallScore: number;
  overallStatus: 'ready' | 'partial' | 'not_ready';
  domainScores: DomainScore[];
  findings: ComplianceResult[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Domain Definitions
// ---------------------------------------------------------------------------

export const CBAHI_DOMAINS: Record<string, { name: string; nameAr: string }> = {
  LD: { name: 'Leadership', nameAr: 'القيادة' },
  PC: { name: 'Patient Care', nameAr: 'رعاية المرضى' },
  NS: { name: 'Nursing Services', nameAr: 'خدمات التمريض' },
  MM: { name: 'Medication Management', nameAr: 'إدارة الأدوية' },
  IC: { name: 'Infection Control', nameAr: 'مكافحة العدوى' },
  QM: { name: 'Quality Management', nameAr: 'إدارة الجودة' },
  FMS: { name: 'Facility Management and Safety', nameAr: 'إدارة المنشأة والسلامة' },
  IM: { name: 'Information Management', nameAr: 'إدارة المعلومات' },
  HR: { name: 'Human Resources', nameAr: 'الموارد البشرية' },
  RI: { name: 'Rights and Responsibilities', nameAr: 'الحقوق والمسؤوليات' },
};

// ---------------------------------------------------------------------------
// Standards Registry
// ---------------------------------------------------------------------------

export const CBAHI_STANDARDS: CbahiStandard[] = [
  // =========================================================================
  // LD — Leadership (LD.1 – LD.7)
  // =========================================================================
  {
    id: 'LD.1', domain: 'LD',
    domainName: 'Leadership', domainNameAr: 'القيادة',
    title: 'Governance and Accountability',
    titleAr: 'الحوكمة والمساءلة',
    description: 'The governing body is responsible for the organization\'s direction, management, and accountability.',
    descriptionAr: 'الهيئة الإدارية مسؤولة عن توجيه المنظمة وإدارتها ومساءلتها.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'users', 'roles'],
    evidenceTypes: ['document', 'report', 'certificate'],
    measurableElements: [
      { id: 'LD.1.ME1', text: 'Governance structure is documented', textAr: 'هيكل الحوكمة موثق', evidenceRequired: ['Organization chart', 'Governance policy'] },
      { id: 'LD.1.ME2', text: 'Governing body responsibilities are defined', textAr: 'مسؤوليات الهيئة الإدارية محددة', evidenceRequired: ['Terms of reference', 'Job descriptions'] },
      { id: 'LD.1.ME3', text: 'Regular governance meetings are conducted', textAr: 'تُعقد اجتماعات الحوكمة بانتظام', evidenceRequired: ['Meeting minutes', 'Attendance records'] },
    ],
  },
  {
    id: 'LD.2', domain: 'LD',
    domainName: 'Leadership', domainNameAr: 'القيادة',
    title: 'Strategic Planning',
    titleAr: 'التخطيط الاستراتيجي',
    description: 'The organization develops and implements a strategic plan aligned with its mission and vision.',
    descriptionAr: 'تضع المنظمة خطة استراتيجية متوافقة مع رسالتها ورؤيتها وتنفذها.',
    priority: 'essential',
    theaModuleMapping: ['admin'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'LD.2.ME1', text: 'Strategic plan is developed and approved', textAr: 'الخطة الاستراتيجية معتمدة', evidenceRequired: ['Strategic plan document'] },
      { id: 'LD.2.ME2', text: 'Strategic objectives have measurable indicators', textAr: 'الأهداف الاستراتيجية لها مؤشرات قابلة للقياس', evidenceRequired: ['KPI dashboard', 'Balanced scorecard'] },
      { id: 'LD.2.ME3', text: 'Annual operational plans are aligned with strategic plan', textAr: 'الخطط التشغيلية السنوية متوافقة مع الخطة الاستراتيجية', evidenceRequired: ['Operational plan', 'Progress reports'] },
    ],
  },
  {
    id: 'LD.3', domain: 'LD',
    domainName: 'Leadership', domainNameAr: 'القيادة',
    title: 'Ethics Management',
    titleAr: 'إدارة الأخلاقيات',
    description: 'The organization has an ethics management framework including a code of conduct.',
    descriptionAr: 'لدى المنظمة إطار لإدارة الأخلاقيات يشمل مدونة سلوك.',
    priority: 'standard',
    theaModuleMapping: ['admin', 'policies'],
    evidenceTypes: ['document', 'certificate'],
    measurableElements: [
      { id: 'LD.3.ME1', text: 'Code of conduct is established and disseminated', textAr: 'مدونة السلوك مُعتمدة ومُعممة', evidenceRequired: ['Code of conduct policy', 'Staff acknowledgment records'] },
      { id: 'LD.3.ME2', text: 'Ethics committee is established', textAr: 'لجنة الأخلاقيات مُشكّلة', evidenceRequired: ['Committee charter', 'Meeting minutes'] },
      { id: 'LD.3.ME3', text: 'Ethics consultations are documented', textAr: 'الاستشارات الأخلاقية موثقة', evidenceRequired: ['Consultation log'] },
    ],
  },
  {
    id: 'LD.4', domain: 'LD',
    domainName: 'Leadership', domainNameAr: 'القيادة',
    title: 'Organizational Structure',
    titleAr: 'الهيكل التنظيمي',
    description: 'The organization has a defined organizational structure with clear reporting relationships.',
    descriptionAr: 'للمنظمة هيكل تنظيمي محدد بعلاقات إبلاغ واضحة.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'clinical-infra'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'LD.4.ME1', text: 'Organizational chart is current and approved', textAr: 'الهيكل التنظيمي محدّث ومعتمد', evidenceRequired: ['Organization chart'] },
      { id: 'LD.4.ME2', text: 'Departments and units are defined with scope of services', textAr: 'الأقسام والوحدات محددة بنطاق خدماتها', evidenceRequired: ['Department scope documents'] },
      { id: 'LD.4.ME3', text: 'Leadership positions have job descriptions', textAr: 'المناصب القيادية لها وصف وظيفي', evidenceRequired: ['Job descriptions'] },
    ],
  },
  {
    id: 'LD.5', domain: 'LD',
    domainName: 'Leadership', domainNameAr: 'القيادة',
    title: 'Resource Management',
    titleAr: 'إدارة الموارد',
    description: 'The organization plans and allocates resources to meet patient needs.',
    descriptionAr: 'تخطط المنظمة وتخصص الموارد لتلبية احتياجات المرضى.',
    priority: 'standard',
    theaModuleMapping: ['admin', 'scheduling', 'equipment-mgmt'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'LD.5.ME1', text: 'Budgeting process includes clinical department input', textAr: 'عملية الموازنة تشمل مدخلات الأقسام السريرية', evidenceRequired: ['Budget documents', 'Meeting minutes'] },
      { id: 'LD.5.ME2', text: 'Resource allocation is reviewed periodically', textAr: 'يتم مراجعة تخصيص الموارد دوريًا', evidenceRequired: ['Review reports'] },
      { id: 'LD.5.ME3', text: 'Equipment acquisition follows a defined process', textAr: 'اقتناء المعدات يتبع عملية محددة', evidenceRequired: ['Procurement policy', 'Capital plan'] },
    ],
  },

  // =========================================================================
  // PC — Patient Care (PC.1 – PC.7)
  // =========================================================================
  {
    id: 'PC.1', domain: 'PC',
    domainName: 'Patient Care', domainNameAr: 'رعاية المرضى',
    title: 'Patient Assessment',
    titleAr: 'تقييم المرضى',
    description: 'All patients receive an initial assessment upon admission that includes medical, nursing, and psychosocial needs.',
    descriptionAr: 'يخضع جميع المرضى لتقييم أولي عند الدخول يشمل الاحتياجات الطبية والتمريضية والنفسية الاجتماعية.',
    priority: 'essential',
    theaModuleMapping: ['opd', 'er', 'ipd', 'registration'],
    evidenceTypes: ['report', 'log', 'screenshot'],
    measurableElements: [
      {
        id: 'PC.1.ME1', text: 'Initial assessment is completed within defined timeframe', textAr: 'يُستكمل التقييم الأولي ضمن الإطار الزمني المحدد',
        evidenceRequired: ['Assessment completion rates', 'Time logs'],
        automatedCheck: async (tenantId: string) => checkPatientAssessmentCompletion(tenantId),
      },
      { id: 'PC.1.ME2', text: 'Assessment includes medical history, physical examination, and nursing assessment', textAr: 'التقييم يشمل التاريخ الطبي والفحص السريري والتقييم التمريضي', evidenceRequired: ['Sample charts', 'Audit results'] },
      { id: 'PC.1.ME3', text: 'Reassessment is performed at regular intervals', textAr: 'يتم إعادة التقييم على فترات منتظمة', evidenceRequired: ['Reassessment documentation', 'Policy'] },
    ],
  },
  {
    id: 'PC.2', domain: 'PC',
    domainName: 'Patient Care', domainNameAr: 'رعاية المرضى',
    title: 'Care Planning',
    titleAr: 'تخطيط الرعاية',
    description: 'An individualized care plan is developed and documented for each patient.',
    descriptionAr: 'يُوضع ويُوثق خطة رعاية فردية لكل مريض.',
    priority: 'essential',
    theaModuleMapping: ['opd', 'ipd', 'orders'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      {
        id: 'PC.2.ME1', text: 'Care plans are documented for each patient', textAr: 'خطط الرعاية موثقة لكل مريض',
        evidenceRequired: ['Care plan audit', 'Sample records'],
        automatedCheck: async (tenantId: string) => checkCarePlans(tenantId),
      },
      { id: 'PC.2.ME2', text: 'Care plans include patient/family involvement', textAr: 'خطط الرعاية تتضمن مشاركة المريض/الأسرة', evidenceRequired: ['Consent forms', 'Education records'] },
      { id: 'PC.2.ME3', text: 'Care plans are reviewed and updated regularly', textAr: 'خطط الرعاية تُراجع وتُحدّث بانتظام', evidenceRequired: ['Review logs'] },
    ],
  },
  {
    id: 'PC.3', domain: 'PC',
    domainName: 'Patient Care', domainNameAr: 'رعاية المرضى',
    title: 'Pain Management',
    titleAr: 'إدارة الألم',
    description: 'Patients have the right to appropriate assessment and management of pain.',
    descriptionAr: 'يحق للمرضى تقييم وإدارة الألم بشكل مناسب.',
    priority: 'essential',
    theaModuleMapping: ['opd', 'ipd', 'er', 'orders'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      { id: 'PC.3.ME1', text: 'Pain assessment is performed on all patients', textAr: 'يُجرى تقييم الألم لجميع المرضى', evidenceRequired: ['Pain assessment tools', 'Documentation audit'] },
      { id: 'PC.3.ME2', text: 'Pain management protocols are established', textAr: 'بروتوكولات إدارة الألم مُعتمدة', evidenceRequired: ['Pain management policy', 'Protocol documents'] },
      { id: 'PC.3.ME3', text: 'Pain reassessment is documented after interventions', textAr: 'يُوثق إعادة تقييم الألم بعد التدخلات', evidenceRequired: ['Chart audit results'] },
    ],
  },
  {
    id: 'PC.4', domain: 'PC',
    domainName: 'Patient Care', domainNameAr: 'رعاية المرضى',
    title: 'Surgical and Anesthesia Care',
    titleAr: 'الرعاية الجراحية والتخدير',
    description: 'Surgical and anesthesia services are planned and provided safely with appropriate documentation.',
    descriptionAr: 'تُخطط وتُقدم خدمات الجراحة والتخدير بأمان مع التوثيق المناسب.',
    priority: 'essential',
    theaModuleMapping: ['or'],
    evidenceTypes: ['report', 'log', 'document'],
    measurableElements: [
      { id: 'PC.4.ME1', text: 'Surgical time-out procedure is implemented', textAr: 'إجراء التوقف الجراحي مُطبّق', evidenceRequired: ['Time-out checklist compliance', 'WHO checklist logs'] },
      { id: 'PC.4.ME2', text: 'Pre-anesthesia assessment is documented', textAr: 'تقييم ما قبل التخدير موثق', evidenceRequired: ['Anesthesia records', 'Pre-op assessment forms'] },
      { id: 'PC.4.ME3', text: 'Surgical site marking is performed', textAr: 'يتم تحديد الموقع الجراحي', evidenceRequired: ['Site marking audit', 'Compliance reports'] },
    ],
  },
  {
    id: 'PC.5', domain: 'PC',
    domainName: 'Patient Care', domainNameAr: 'رعاية المرضى',
    title: 'Blood and Blood Products Use',
    titleAr: 'استخدام الدم ومنتجات الدم',
    description: 'Blood and blood products are administered safely following established protocols.',
    descriptionAr: 'يُعطى الدم ومنتجاته بأمان وفقاً للبروتوكولات المعتمدة.',
    priority: 'essential',
    theaModuleMapping: ['blood-bank', 'orders'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      { id: 'PC.5.ME1', text: 'Blood transfusion policy is established', textAr: 'سياسة نقل الدم مُعتمدة', evidenceRequired: ['Transfusion policy', 'Consent forms'] },
      { id: 'PC.5.ME2', text: 'Double verification is performed before transfusion', textAr: 'يتم التحقق المزدوج قبل نقل الدم', evidenceRequired: ['Verification logs', 'Audit results'] },
      { id: 'PC.5.ME3', text: 'Transfusion reactions are reported and monitored', textAr: 'تُبلغ وتُراقب ردود فعل نقل الدم', evidenceRequired: ['Incident reports', 'Reaction tracking'] },
    ],
  },

  // =========================================================================
  // NS — Nursing Services (NS.1 – NS.5)
  // =========================================================================
  {
    id: 'NS.1', domain: 'NS',
    domainName: 'Nursing Services', domainNameAr: 'خدمات التمريض',
    title: 'Nursing Staffing and Competency',
    titleAr: 'التوظيف والكفاءة التمريضية',
    description: 'Adequate nursing staff with appropriate competencies are available to meet patient needs.',
    descriptionAr: 'يتوفر كادر تمريضي كافٍ بكفاءات مناسبة لتلبية احتياجات المرضى.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'users', 'clinical-infra'],
    evidenceTypes: ['document', 'report', 'certificate'],
    measurableElements: [
      { id: 'NS.1.ME1', text: 'Nurse-to-patient ratio meets standards', textAr: 'نسبة الممرضين للمرضى تلبي المعايير', evidenceRequired: ['Staffing reports', 'Ratio calculations'] },
      { id: 'NS.1.ME2', text: 'Nursing competency assessments are current', textAr: 'تقييمات الكفاءة التمريضية محدّثة', evidenceRequired: ['Competency records', 'Skills checklists'] },
      { id: 'NS.1.ME3', text: 'Orientation program exists for new nurses', textAr: 'يوجد برنامج تهيئة للممرضين الجدد', evidenceRequired: ['Orientation checklist', 'Training records'] },
    ],
  },
  {
    id: 'NS.2', domain: 'NS',
    domainName: 'Nursing Services', domainNameAr: 'خدمات التمريض',
    title: 'Nursing Documentation',
    titleAr: 'التوثيق التمريضي',
    description: 'Nursing assessments and care are accurately and promptly documented.',
    descriptionAr: 'يُوثق التقييم والرعاية التمريضية بدقة وفي الوقت المناسب.',
    priority: 'essential',
    theaModuleMapping: ['opd', 'ipd', 'er'],
    evidenceTypes: ['report', 'log', 'screenshot'],
    measurableElements: [
      {
        id: 'NS.2.ME1', text: 'Nursing notes are documented for all encounters', textAr: 'ملاحظات التمريض موثقة لجميع المقابلات',
        evidenceRequired: ['Documentation audit'],
        automatedCheck: async (tenantId: string) => checkNursingDocumentation(tenantId),
      },
      { id: 'NS.2.ME2', text: 'Vital signs documentation is timely', textAr: 'توثيق العلامات الحيوية في الوقت المناسب', evidenceRequired: ['Vital signs logs', 'Timeliness audit'] },
      { id: 'NS.2.ME3', text: 'Handover documentation is standardized', textAr: 'توثيق تسليم المناوبة موحد', evidenceRequired: ['Handover forms', 'SBAR documentation'] },
    ],
  },
  {
    id: 'NS.3', domain: 'NS',
    domainName: 'Nursing Services', domainNameAr: 'خدمات التمريض',
    title: 'Patient Education by Nursing',
    titleAr: 'تثقيف المرضى من التمريض',
    description: 'Nurses provide patient and family education as part of the care process.',
    descriptionAr: 'يقدم الممرضون التثقيف للمريض والأسرة كجزء من عملية الرعاية.',
    priority: 'standard',
    theaModuleMapping: ['patient-education', 'opd', 'ipd'],
    evidenceTypes: ['report', 'document'],
    measurableElements: [
      { id: 'NS.3.ME1', text: 'Patient education needs are assessed', textAr: 'يُقيّم احتياجات تثقيف المرضى', evidenceRequired: ['Assessment tools', 'Education plans'] },
      { id: 'NS.3.ME2', text: 'Education is documented in the patient record', textAr: 'يُوثق التثقيف في سجل المريض', evidenceRequired: ['Education records', 'Chart audit'] },
      { id: 'NS.3.ME3', text: 'Patient comprehension is verified', textAr: 'يتم التحقق من استيعاب المريض', evidenceRequired: ['Teach-back documentation', 'Comprehension assessments'] },
    ],
  },
  {
    id: 'NS.4', domain: 'NS',
    domainName: 'Nursing Services', domainNameAr: 'خدمات التمريض',
    title: 'Fall Prevention',
    titleAr: 'الوقاية من السقوط',
    description: 'A fall prevention program is implemented for all patients.',
    descriptionAr: 'يُطبق برنامج للوقاية من السقوط لجميع المرضى.',
    priority: 'essential',
    theaModuleMapping: ['ipd', 'er', 'quality'],
    evidenceTypes: ['report', 'log', 'document'],
    measurableElements: [
      { id: 'NS.4.ME1', text: 'Fall risk assessment is performed on admission', textAr: 'يُجرى تقييم خطر السقوط عند الدخول', evidenceRequired: ['Fall risk assessment forms', 'Screening tool'] },
      { id: 'NS.4.ME2', text: 'Prevention interventions are implemented for at-risk patients', textAr: 'تُطبق تدخلات الوقاية للمرضى المعرضين للخطر', evidenceRequired: ['Intervention logs', 'Care plan documentation'] },
      { id: 'NS.4.ME3', text: 'Fall events are reported and analyzed', textAr: 'تُبلغ وتُحلل حوادث السقوط', evidenceRequired: ['Incident reports', 'Analysis reports'] },
    ],
  },
  {
    id: 'NS.5', domain: 'NS',
    domainName: 'Nursing Services', domainNameAr: 'خدمات التمريض',
    title: 'Restraint Use',
    titleAr: 'استخدام القيود',
    description: 'Restraints are used only when clinically indicated and with appropriate monitoring.',
    descriptionAr: 'تُستخدم القيود فقط عند وجود دواعٍ سريرية مع المراقبة المناسبة.',
    priority: 'standard',
    theaModuleMapping: ['ipd', 'er'],
    evidenceTypes: ['document', 'log'],
    measurableElements: [
      { id: 'NS.5.ME1', text: 'Restraint policy is established', textAr: 'سياسة استخدام القيود مُعتمدة', evidenceRequired: ['Restraint policy', 'Order forms'] },
      { id: 'NS.5.ME2', text: 'Physician order is obtained for restraint use', textAr: 'يُحصل على أمر طبي لاستخدام القيود', evidenceRequired: ['Order documentation', 'Chart review'] },
      { id: 'NS.5.ME3', text: 'Restrained patients are monitored per protocol', textAr: 'يُراقب المرضى المقيّدون وفق البروتوكول', evidenceRequired: ['Monitoring logs', 'Assessment records'] },
    ],
  },

  // =========================================================================
  // MM — Medication Management (MM.1 – MM.6)
  // =========================================================================
  {
    id: 'MM.1', domain: 'MM',
    domainName: 'Medication Management', domainNameAr: 'إدارة الأدوية',
    title: 'Formulary Management',
    titleAr: 'إدارة القائمة الدوائية',
    description: 'A hospital formulary is maintained and regularly updated.',
    descriptionAr: 'تُحتفظ بقائمة دوائية للمستشفى وتُحدّث بانتظام.',
    priority: 'essential',
    theaModuleMapping: ['pharmacy', 'billing'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      {
        id: 'MM.1.ME1', text: 'Formulary is established and accessible', textAr: 'القائمة الدوائية مُعتمدة ومتاحة',
        evidenceRequired: ['Formulary document', 'Access logs'],
        automatedCheck: async (tenantId: string) => checkFormularyExists(tenantId),
      },
      { id: 'MM.1.ME2', text: 'Pharmacy and Therapeutics Committee oversees formulary', textAr: 'لجنة الصيدلة والعلاج تشرف على القائمة الدوائية', evidenceRequired: ['P&T committee charter', 'Meeting minutes'] },
      { id: 'MM.1.ME3', text: 'Formulary is reviewed and updated annually', textAr: 'تُراجع القائمة الدوائية وتُحدّث سنويًا', evidenceRequired: ['Review records', 'Update logs'] },
    ],
  },
  {
    id: 'MM.2', domain: 'MM',
    domainName: 'Medication Management', domainNameAr: 'إدارة الأدوية',
    title: 'High-Alert Medications',
    titleAr: 'الأدوية عالية الخطورة',
    description: 'High-alert medications are identified and managed with additional safeguards.',
    descriptionAr: 'تُحدد الأدوية عالية الخطورة وتُدار بإجراءات حماية إضافية.',
    priority: 'essential',
    theaModuleMapping: ['pharmacy', 'orders'],
    evidenceTypes: ['document', 'log', 'report'],
    measurableElements: [
      {
        id: 'MM.2.ME1', text: 'High-alert medications list is maintained', textAr: 'قائمة الأدوية عالية الخطورة مُحدّثة',
        evidenceRequired: ['High-alert list', 'Storage verification'],
        automatedCheck: async (tenantId: string) => checkHighAlertMedications(tenantId),
      },
      { id: 'MM.2.ME2', text: 'Double-check process exists for high-alert medications', textAr: 'عملية التحقق المزدوج موجودة للأدوية عالية الخطورة', evidenceRequired: ['Verification logs', 'Policy document'] },
      { id: 'MM.2.ME3', text: 'Staff are trained on high-alert medications handling', textAr: 'الكوادر مدربة على التعامل مع الأدوية عالية الخطورة', evidenceRequired: ['Training records', 'Competency assessments'] },
    ],
  },
  {
    id: 'MM.3', domain: 'MM',
    domainName: 'Medication Management', domainNameAr: 'إدارة الأدوية',
    title: 'Look-Alike/Sound-Alike (LASA) Medications',
    titleAr: 'الأدوية المتشابهة بالشكل والاسم',
    description: 'LASA medications are identified and strategies are implemented to reduce errors.',
    descriptionAr: 'تُحدد الأدوية المتشابهة وتُنفذ استراتيجيات للحد من الأخطاء.',
    priority: 'essential',
    theaModuleMapping: ['pharmacy'],
    evidenceTypes: ['document', 'log'],
    measurableElements: [
      { id: 'MM.3.ME1', text: 'LASA list is maintained and updated', textAr: 'قائمة LASA محدّثة', evidenceRequired: ['LASA list', 'Update records'] },
      { id: 'MM.3.ME2', text: 'Tall-man lettering or other differentiation strategies are used', textAr: 'تُستخدم استراتيجيات التمييز مثل الأحرف الكبيرة', evidenceRequired: ['Labeling examples', 'Storage photos'] },
      { id: 'MM.3.ME3', text: 'Staff awareness on LASA medications is assessed', textAr: 'يُقيّم وعي الكوادر بالأدوية المتشابهة', evidenceRequired: ['Training records', 'Awareness surveys'] },
    ],
  },
  {
    id: 'MM.4', domain: 'MM',
    domainName: 'Medication Management', domainNameAr: 'إدارة الأدوية',
    title: 'Medication Prescribing',
    titleAr: 'وصف الأدوية',
    description: 'Medication prescribing follows standardized processes with complete orders.',
    descriptionAr: 'يتبع وصف الأدوية عمليات موحدة بأوامر مكتملة.',
    priority: 'essential',
    theaModuleMapping: ['opd', 'orders', 'pharmacy'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      {
        id: 'MM.4.ME1', text: 'Medication orders contain required elements', textAr: 'تحتوي أوامر الأدوية على العناصر المطلوبة',
        evidenceRequired: ['Order audit', 'Completeness reports'],
        automatedCheck: async (tenantId: string) => checkMedicationOrders(tenantId),
      },
      { id: 'MM.4.ME2', text: 'Verbal orders are limited and verified', textAr: 'الأوامر الشفهية محدودة ومُتحقق منها', evidenceRequired: ['Verbal order policy', 'Read-back logs'] },
      { id: 'MM.4.ME3', text: 'Allergy checking is performed before prescribing', textAr: 'يُفحص الحساسية قبل الوصف', evidenceRequired: ['Allergy check logs', 'System screenshots'] },
    ],
  },
  {
    id: 'MM.5', domain: 'MM',
    domainName: 'Medication Management', domainNameAr: 'إدارة الأدوية',
    title: 'Medication Dispensing',
    titleAr: 'صرف الأدوية',
    description: 'Medications are dispensed accurately with appropriate labeling and storage.',
    descriptionAr: 'تُصرف الأدوية بدقة مع الملصقات والتخزين المناسب.',
    priority: 'essential',
    theaModuleMapping: ['pharmacy'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      { id: 'MM.5.ME1', text: 'Medications are dispensed by qualified pharmacists', textAr: 'تُصرف الأدوية بواسطة صيادلة مؤهلين', evidenceRequired: ['Pharmacist credentials', 'Dispensing logs'] },
      { id: 'MM.5.ME2', text: 'Unit-dose system is utilized', textAr: 'نظام الجرعة الواحدة مُستخدم', evidenceRequired: ['System documentation', 'Process flow'] },
      { id: 'MM.5.ME3', text: 'Dispensing errors are tracked and analyzed', textAr: 'أخطاء الصرف تُتبع وتُحلل', evidenceRequired: ['Error reports', 'Trend analysis'] },
    ],
  },
  {
    id: 'MM.6', domain: 'MM',
    domainName: 'Medication Management', domainNameAr: 'إدارة الأدوية',
    title: 'Medication Administration',
    titleAr: 'إعطاء الأدوية',
    description: 'Medication administration follows the five rights: right patient, drug, dose, route, time.',
    descriptionAr: 'يتبع إعطاء الأدوية الحقوق الخمسة: المريض الصحيح، الدواء الصحيح، الجرعة الصحيحة، الطريقة الصحيحة، الوقت الصحيح.',
    priority: 'essential',
    theaModuleMapping: ['ipd', 'orders', 'pharmacy'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      { id: 'MM.6.ME1', text: 'Five rights are verified before each administration', textAr: 'يُتحقق من الحقوق الخمسة قبل كل إعطاء', evidenceRequired: ['Administration records', 'Barcode scanning logs'] },
      { id: 'MM.6.ME2', text: 'Medication administration is documented timely', textAr: 'يُوثق إعطاء الأدوية في الوقت المناسب', evidenceRequired: ['MAR records', 'Timeliness audit'] },
      { id: 'MM.6.ME3', text: 'Adverse drug reactions are reported', textAr: 'تُبلغ التفاعلات الدوائية الضارة', evidenceRequired: ['ADR reports', 'Tracking logs'] },
    ],
  },

  // =========================================================================
  // IC — Infection Control (IC.1 – IC.5)
  // =========================================================================
  {
    id: 'IC.1', domain: 'IC',
    domainName: 'Infection Control', domainNameAr: 'مكافحة العدوى',
    title: 'Infection Prevention and Control Program',
    titleAr: 'برنامج الوقاية من العدوى ومكافحتها',
    description: 'A comprehensive infection prevention and control program is implemented.',
    descriptionAr: 'يُطبق برنامج شامل للوقاية من العدوى ومكافحتها.',
    priority: 'essential',
    theaModuleMapping: ['infection-control', 'quality'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      {
        id: 'IC.1.ME1', text: 'Infection control committee is active', textAr: 'لجنة مكافحة العدوى فعّالة',
        evidenceRequired: ['Committee charter', 'Meeting minutes'],
        automatedCheck: async (tenantId: string) => checkInfectionControlProgram(tenantId),
      },
      { id: 'IC.1.ME2', text: 'Infection control plan is annually updated', textAr: 'خطة مكافحة العدوى تُحدّث سنويًا', evidenceRequired: ['IC plan', 'Annual report'] },
      { id: 'IC.1.ME3', text: 'Infection control practitioner(s) are designated', textAr: 'ممارسو مكافحة العدوى مُعيّنون', evidenceRequired: ['Job descriptions', 'Appointment letters'] },
    ],
  },
  {
    id: 'IC.2', domain: 'IC',
    domainName: 'Infection Control', domainNameAr: 'مكافحة العدوى',
    title: 'Hand Hygiene',
    titleAr: 'نظافة اليدين',
    description: 'Hand hygiene compliance is monitored and meets targets.',
    descriptionAr: 'يُراقب الالتزام بنظافة اليدين ويستوفي الأهداف.',
    priority: 'essential',
    theaModuleMapping: ['infection-control', 'quality'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      { id: 'IC.2.ME1', text: 'Hand hygiene policy follows WHO five moments', textAr: 'سياسة نظافة اليدين تتبع لحظات منظمة الصحة العالمية الخمس', evidenceRequired: ['Policy document', 'Posters'] },
      { id: 'IC.2.ME2', text: 'Hand hygiene compliance rate is monitored monthly', textAr: 'يُراقب معدل الالتزام بنظافة اليدين شهريًا', evidenceRequired: ['Audit reports', 'Compliance rates'] },
      { id: 'IC.2.ME3', text: 'Hand hygiene products are available at point of care', textAr: 'منتجات نظافة اليدين متوفرة عند نقطة الرعاية', evidenceRequired: ['Supply audit', 'Dispenser locations'] },
    ],
  },
  {
    id: 'IC.3', domain: 'IC',
    domainName: 'Infection Control', domainNameAr: 'مكافحة العدوى',
    title: 'Isolation Precautions',
    titleAr: 'احتياطات العزل',
    description: 'Isolation precautions are implemented based on transmission mode.',
    descriptionAr: 'تُطبق احتياطات العزل بناءً على طريقة الانتقال.',
    priority: 'essential',
    theaModuleMapping: ['infection-control', 'ipd', 'er'],
    evidenceTypes: ['document', 'log'],
    measurableElements: [
      { id: 'IC.3.ME1', text: 'Isolation policy covers all transmission categories', textAr: 'سياسة العزل تشمل جميع فئات الانتقال', evidenceRequired: ['Isolation policy', 'Signage'] },
      { id: 'IC.3.ME2', text: 'Isolation rooms are identified and maintained', textAr: 'غرف العزل محددة وصالحة', evidenceRequired: ['Room inventory', 'Maintenance records'] },
      { id: 'IC.3.ME3', text: 'PPE is available for isolation procedures', textAr: 'معدات الحماية الشخصية متوفرة لإجراءات العزل', evidenceRequired: ['PPE supply audit', 'Stock records'] },
    ],
  },
  {
    id: 'IC.4', domain: 'IC',
    domainName: 'Infection Control', domainNameAr: 'مكافحة العدوى',
    title: 'Healthcare-Associated Infection Surveillance',
    titleAr: 'ترصد العدوى المرتبطة بالرعاية الصحية',
    description: 'HAI surveillance data is collected, analyzed, and used for improvement.',
    descriptionAr: 'تُجمع بيانات ترصد العدوى المرتبطة بالرعاية الصحية وتُحلل وتُستخدم للتحسين.',
    priority: 'essential',
    theaModuleMapping: ['infection-control', 'quality'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      {
        id: 'IC.4.ME1', text: 'HAI rates are tracked for key indicators', textAr: 'تُتبع معدلات العدوى للمؤشرات الرئيسية',
        evidenceRequired: ['Surveillance reports', 'Dashboard screenshots'],
        automatedCheck: async (tenantId: string) => checkHAISurveillance(tenantId),
      },
      { id: 'IC.4.ME2', text: 'Bundle compliance is monitored for device-related infections', textAr: 'يُراقب الالتزام بالحزم للعدوى المرتبطة بالأجهزة', evidenceRequired: ['Bundle compliance reports'] },
      { id: 'IC.4.ME3', text: 'HAI data is reported to Infection Control Committee', textAr: 'تُبلغ بيانات العدوى للجنة مكافحة العدوى', evidenceRequired: ['Meeting minutes', 'Reports'] },
    ],
  },
  {
    id: 'IC.5', domain: 'IC',
    domainName: 'Infection Control', domainNameAr: 'مكافحة العدوى',
    title: 'Sterilization and Disinfection',
    titleAr: 'التعقيم والتطهير',
    description: 'Sterilization and disinfection processes meet established standards.',
    descriptionAr: 'عمليات التعقيم والتطهير تستوفي المعايير المعتمدة.',
    priority: 'essential',
    theaModuleMapping: ['cssd', 'infection-control'],
    evidenceTypes: ['report', 'log', 'certificate'],
    measurableElements: [
      { id: 'IC.5.ME1', text: 'CSSD follows validated sterilization processes', textAr: 'يتبع قسم التعقيم عمليات تعقيم مُصدّقة', evidenceRequired: ['Sterilization logs', 'Validation records'] },
      { id: 'IC.5.ME2', text: 'Biological indicators are used for sterilization monitoring', textAr: 'تُستخدم مؤشرات بيولوجية لمراقبة التعقيم', evidenceRequired: ['BI test results', 'Monitoring logs'] },
      { id: 'IC.5.ME3', text: 'Recall system exists for sterilization failures', textAr: 'يوجد نظام استدعاء لحالات فشل التعقيم', evidenceRequired: ['Recall policy', 'Incident logs'] },
    ],
  },

  // =========================================================================
  // QM — Quality Management (QM.1 – QM.5)
  // =========================================================================
  {
    id: 'QM.1', domain: 'QM',
    domainName: 'Quality Management', domainNameAr: 'إدارة الجودة',
    title: 'Quality Improvement Plan',
    titleAr: 'خطة تحسين الجودة',
    description: 'The organization has a quality improvement plan that is reviewed annually.',
    descriptionAr: 'لدى المنظمة خطة لتحسين الجودة تُراجع سنويًا.',
    priority: 'essential',
    theaModuleMapping: ['quality'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'QM.1.ME1', text: 'Quality plan is documented and approved', textAr: 'خطة الجودة موثقة ومعتمدة', evidenceRequired: ['Quality plan document', 'Approval records'] },
      { id: 'QM.1.ME2', text: 'Quality objectives are measurable', textAr: 'أهداف الجودة قابلة للقياس', evidenceRequired: ['KPI list', 'Target values'] },
      { id: 'QM.1.ME3', text: 'Quality plan is reviewed and updated annually', textAr: 'تُراجع خطة الجودة وتُحدّث سنويًا', evidenceRequired: ['Review minutes', 'Updated plan'] },
    ],
  },
  {
    id: 'QM.2', domain: 'QM',
    domainName: 'Quality Management', domainNameAr: 'إدارة الجودة',
    title: 'Patient Safety Program',
    titleAr: 'برنامج سلامة المرضى',
    description: 'A patient safety program is implemented with defined International Patient Safety Goals.',
    descriptionAr: 'يُطبق برنامج لسلامة المرضى بأهداف سلامة المرضى الدولية المحددة.',
    priority: 'essential',
    theaModuleMapping: ['quality', 'admin'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'QM.2.ME1', text: 'Patient Safety Goals are defined and monitored', textAr: 'أهداف سلامة المرضى محددة ومُراقبة', evidenceRequired: ['IPSG compliance reports'] },
      { id: 'QM.2.ME2', text: 'Patient identification process uses two identifiers', textAr: 'عملية تحديد هوية المريض تستخدم معرّفين', evidenceRequired: ['ID policy', 'Compliance audit'] },
      { id: 'QM.2.ME3', text: 'Critical results reporting process is established', textAr: 'عملية الإبلاغ عن النتائج الحرجة مُعتمدة', evidenceRequired: ['Critical values policy', 'Response time data'] },
    ],
  },
  {
    id: 'QM.3', domain: 'QM',
    domainName: 'Quality Management', domainNameAr: 'إدارة الجودة',
    title: 'Incident Reporting and Near-Miss',
    titleAr: 'الإبلاغ عن الحوادث وحالات الاقتراب من الخطأ',
    description: 'An incident reporting system captures adverse events and near-misses with root cause analysis.',
    descriptionAr: 'نظام إبلاغ عن الحوادث يرصد الأحداث الضارة وحالات الاقتراب من الخطأ مع تحليل السبب الجذري.',
    priority: 'essential',
    theaModuleMapping: ['quality'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      {
        id: 'QM.3.ME1', text: 'Incident reporting system is active', textAr: 'نظام الإبلاغ عن الحوادث فعّال',
        evidenceRequired: ['Incident count', 'System screenshots'],
        automatedCheck: async (tenantId: string) => checkIncidentReporting(tenantId),
      },
      { id: 'QM.3.ME2', text: 'Near-misses are reported and analyzed', textAr: 'حالات الاقتراب من الخطأ تُبلغ وتُحلل', evidenceRequired: ['Near-miss reports', 'Analysis summaries'] },
      { id: 'QM.3.ME3', text: 'Root cause analysis is performed for serious events', textAr: 'يُجرى تحليل السبب الجذري للأحداث الخطيرة', evidenceRequired: ['RCA reports', 'Action plans'] },
    ],
  },
  {
    id: 'QM.4', domain: 'QM',
    domainName: 'Quality Management', domainNameAr: 'إدارة الجودة',
    title: 'Key Performance Indicators',
    titleAr: 'مؤشرات الأداء الرئيسية',
    description: 'Clinical and operational KPIs are monitored and benchmarked.',
    descriptionAr: 'تُراقب مؤشرات الأداء السريرية والتشغيلية وتُقارن بالمعايير.',
    priority: 'essential',
    theaModuleMapping: ['quality', 'analytics'],
    evidenceTypes: ['report', 'screenshot'],
    measurableElements: [
      {
        id: 'QM.4.ME1', text: 'Clinical KPIs are defined and collected', textAr: 'مؤشرات الأداء السريرية محددة ومُجمعة',
        evidenceRequired: ['KPI dashboard', 'Data collection forms'],
        automatedCheck: async (tenantId: string) => checkKPITracking(tenantId),
      },
      { id: 'QM.4.ME2', text: 'KPI results are reported to leadership', textAr: 'نتائج المؤشرات تُبلغ للقيادة', evidenceRequired: ['Leadership reports', 'Meeting minutes'] },
      { id: 'QM.4.ME3', text: 'Benchmarking is performed with peer organizations', textAr: 'تُجرى المقارنة المرجعية مع المنظمات المماثلة', evidenceRequired: ['Benchmarking reports'] },
    ],
  },
  {
    id: 'QM.5', domain: 'QM',
    domainName: 'Quality Management', domainNameAr: 'إدارة الجودة',
    title: 'Clinical Audit',
    titleAr: 'التدقيق السريري',
    description: 'Regular clinical audits are conducted to evaluate care quality.',
    descriptionAr: 'تُجرى تدقيقات سريرية منتظمة لتقييم جودة الرعاية.',
    priority: 'standard',
    theaModuleMapping: ['quality', 'admin'],
    evidenceTypes: ['report', 'document'],
    measurableElements: [
      { id: 'QM.5.ME1', text: 'Clinical audit plan is developed', textAr: 'خطة التدقيق السريري مُعدّة', evidenceRequired: ['Audit plan', 'Schedule'] },
      { id: 'QM.5.ME2', text: 'Audit findings lead to improvement actions', textAr: 'نتائج التدقيق تؤدي لإجراءات تحسين', evidenceRequired: ['Action plans', 'Follow-up reports'] },
      { id: 'QM.5.ME3', text: 'Re-audit is conducted to verify improvement', textAr: 'يُجرى إعادة تدقيق للتحقق من التحسين', evidenceRequired: ['Re-audit results', 'Comparison data'] },
    ],
  },

  // =========================================================================
  // FMS — Facility Management and Safety (FMS.1 – FMS.5)
  // =========================================================================
  {
    id: 'FMS.1', domain: 'FMS',
    domainName: 'Facility Management and Safety', domainNameAr: 'إدارة المنشأة والسلامة',
    title: 'Safety Management Program',
    titleAr: 'برنامج إدارة السلامة',
    description: 'The organization has a comprehensive safety management program.',
    descriptionAr: 'لدى المنظمة برنامج شامل لإدارة السلامة.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'quality'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'FMS.1.ME1', text: 'Safety management plan is documented', textAr: 'خطة إدارة السلامة موثقة', evidenceRequired: ['Safety plan', 'Annual review'] },
      { id: 'FMS.1.ME2', text: 'Safety walkrounds are conducted regularly', textAr: 'تُجرى جولات السلامة بانتظام', evidenceRequired: ['Walkround reports', 'Action logs'] },
      { id: 'FMS.1.ME3', text: 'Safety incidents are reported and trended', textAr: 'حوادث السلامة تُبلغ وتُتبع الاتجاهات', evidenceRequired: ['Incident data', 'Trend reports'] },
    ],
  },
  {
    id: 'FMS.2', domain: 'FMS',
    domainName: 'Facility Management and Safety', domainNameAr: 'إدارة المنشأة والسلامة',
    title: 'Fire Safety',
    titleAr: 'السلامة من الحريق',
    description: 'Fire safety measures are in place and regularly tested.',
    descriptionAr: 'إجراءات السلامة من الحريق مطبقة وتُختبر بانتظام.',
    priority: 'essential',
    theaModuleMapping: ['admin'],
    evidenceTypes: ['document', 'report', 'certificate'],
    measurableElements: [
      { id: 'FMS.2.ME1', text: 'Fire safety plan is implemented', textAr: 'خطة السلامة من الحريق مُطبقة', evidenceRequired: ['Fire safety plan', 'Evacuation maps'] },
      { id: 'FMS.2.ME2', text: 'Fire drills are conducted per schedule', textAr: 'تُجرى تدريبات الحريق حسب الجدول', evidenceRequired: ['Drill records', 'Schedule'] },
      { id: 'FMS.2.ME3', text: 'Fire suppression equipment is inspected regularly', textAr: 'معدات إطفاء الحريق تُفحص بانتظام', evidenceRequired: ['Inspection records', 'Certificates'] },
    ],
  },
  {
    id: 'FMS.3', domain: 'FMS',
    domainName: 'Facility Management and Safety', domainNameAr: 'إدارة المنشأة والسلامة',
    title: 'Medical Equipment Management',
    titleAr: 'إدارة المعدات الطبية',
    description: 'Medical equipment is maintained and managed effectively.',
    descriptionAr: 'تُصان وتُدار المعدات الطبية بفعالية.',
    priority: 'essential',
    theaModuleMapping: ['equipment-mgmt'],
    evidenceTypes: ['report', 'log', 'certificate'],
    measurableElements: [
      {
        id: 'FMS.3.ME1', text: 'Medical equipment inventory is maintained', textAr: 'جرد المعدات الطبية مُحدّث',
        evidenceRequired: ['Equipment inventory', 'Database screenshots'],
        automatedCheck: async (tenantId: string) => checkEquipmentManagement(tenantId),
      },
      { id: 'FMS.3.ME2', text: 'Preventive maintenance schedule is followed', textAr: 'جدول الصيانة الوقائية مُتبع', evidenceRequired: ['PM schedule', 'Completion records'] },
      { id: 'FMS.3.ME3', text: 'Equipment operators are trained and competent', textAr: 'مشغلو المعدات مدربون وأكفاء', evidenceRequired: ['Training records', 'Competency files'] },
    ],
  },
  {
    id: 'FMS.4', domain: 'FMS',
    domainName: 'Facility Management and Safety', domainNameAr: 'إدارة المنشأة والسلامة',
    title: 'Emergency and Disaster Preparedness',
    titleAr: 'الاستعداد للطوارئ والكوارث',
    description: 'The organization has emergency and disaster preparedness plans.',
    descriptionAr: 'لدى المنظمة خطط للاستعداد للطوارئ والكوارث.',
    priority: 'essential',
    theaModuleMapping: ['admin'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'FMS.4.ME1', text: 'Emergency preparedness plan is established', textAr: 'خطة الاستعداد للطوارئ مُعتمدة', evidenceRequired: ['Emergency plan', 'Contact lists'] },
      { id: 'FMS.4.ME2', text: 'Disaster drills are conducted annually', textAr: 'تُجرى تدريبات الكوارث سنويًا', evidenceRequired: ['Drill records', 'After-action reports'] },
      { id: 'FMS.4.ME3', text: 'Business continuity plan exists', textAr: 'خطة استمرارية الأعمال موجودة', evidenceRequired: ['BCP document', 'Test results'] },
    ],
  },
  {
    id: 'FMS.5', domain: 'FMS',
    domainName: 'Facility Management and Safety', domainNameAr: 'إدارة المنشأة والسلامة',
    title: 'Hazardous Materials Management',
    titleAr: 'إدارة المواد الخطرة',
    description: 'Hazardous materials and waste are managed safely.',
    descriptionAr: 'تُدار المواد الخطرة والنفايات بأمان.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'infection-control'],
    evidenceTypes: ['document', 'report', 'log'],
    measurableElements: [
      { id: 'FMS.5.ME1', text: 'Hazardous materials inventory is maintained', textAr: 'جرد المواد الخطرة مُحدّث', evidenceRequired: ['Chemical inventory', 'MSDS/SDS sheets'] },
      { id: 'FMS.5.ME2', text: 'Waste segregation protocol is followed', textAr: 'بروتوكول فصل النفايات مُتبع', evidenceRequired: ['Waste management policy', 'Audit reports'] },
      { id: 'FMS.5.ME3', text: 'Spill response procedures are defined and tested', textAr: 'إجراءات الاستجابة للانسكاب محددة ومُختبرة', evidenceRequired: ['Spill kits', 'Drill records'] },
    ],
  },

  // =========================================================================
  // IM — Information Management (IM.1 – IM.5)
  // =========================================================================
  {
    id: 'IM.1', domain: 'IM',
    domainName: 'Information Management', domainNameAr: 'إدارة المعلومات',
    title: 'Medical Records Management',
    titleAr: 'إدارة السجلات الطبية',
    description: 'Medical records are maintained completely, accurately, and securely.',
    descriptionAr: 'تُحفظ السجلات الطبية بشكل كامل ودقيق وآمن.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'opd', 'ipd', 'er'],
    evidenceTypes: ['report', 'screenshot', 'document'],
    measurableElements: [
      {
        id: 'IM.1.ME1', text: 'Medical records are complete and legible', textAr: 'السجلات الطبية مكتملة ومقروءة',
        evidenceRequired: ['Chart audit results', 'Completeness rates'],
        automatedCheck: async (tenantId: string) => checkMedicalRecordsCompleteness(tenantId),
      },
      { id: 'IM.1.ME2', text: 'Medical records are securely stored', textAr: 'السجلات الطبية مخزنة بأمان', evidenceRequired: ['Security measures', 'Access controls'] },
      { id: 'IM.1.ME3', text: 'Records retention policy is established', textAr: 'سياسة الاحتفاظ بالسجلات مُعتمدة', evidenceRequired: ['Retention policy', 'Destruction logs'] },
    ],
  },
  {
    id: 'IM.2', domain: 'IM',
    domainName: 'Information Management', domainNameAr: 'إدارة المعلومات',
    title: 'Data Confidentiality and Privacy',
    titleAr: 'سرية البيانات والخصوصية',
    description: 'Patient information confidentiality and privacy are protected.',
    descriptionAr: 'تُحمى سرية وخصوصية معلومات المرضى.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'settings'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'IM.2.ME1', text: 'Confidentiality policy is established', textAr: 'سياسة السرية مُعتمدة', evidenceRequired: ['Confidentiality policy', 'Staff agreements'] },
      { id: 'IM.2.ME2', text: 'Access to patient information is role-based', textAr: 'الوصول لمعلومات المرضى يعتمد على الدور', evidenceRequired: ['Access control matrix', 'System screenshots'] },
      { id: 'IM.2.ME3', text: 'Privacy breaches are reported and investigated', textAr: 'تُبلغ وتُحقق حالات انتهاك الخصوصية', evidenceRequired: ['Breach reports', 'Investigation records'] },
    ],
  },
  {
    id: 'IM.3', domain: 'IM',
    domainName: 'Information Management', domainNameAr: 'إدارة المعلومات',
    title: 'Clinical Documentation Standards',
    titleAr: 'معايير التوثيق السريري',
    description: 'Clinical documentation meets defined standards for accuracy and timeliness.',
    descriptionAr: 'التوثيق السريري يستوفي المعايير المحددة للدقة والتوقيت.',
    priority: 'essential',
    theaModuleMapping: ['opd', 'ipd', 'er'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      {
        id: 'IM.3.ME1', text: 'Clinical notes are documented within defined timeframes', textAr: 'تُوثق الملاحظات السريرية ضمن الإطار الزمني المحدد',
        evidenceRequired: ['Timeliness audit', 'Documentation rates'],
        automatedCheck: async (tenantId: string) => checkClinicalNotesCompleteness(tenantId),
      },
      { id: 'IM.3.ME2', text: 'Discharge summaries are completed before/at discharge', textAr: 'ملخصات الخروج تُستكمل قبل/عند الخروج', evidenceRequired: ['Discharge summary completion rate'] },
      { id: 'IM.3.ME3', text: 'Documentation abbreviation list is standardized', textAr: 'قائمة الاختصارات في التوثيق موحدة', evidenceRequired: ['Approved abbreviation list', 'Do-not-use list'] },
    ],
  },
  {
    id: 'IM.4', domain: 'IM',
    domainName: 'Information Management', domainNameAr: 'إدارة المعلومات',
    title: 'Information Technology Security',
    titleAr: 'أمن تقنية المعلومات',
    description: 'IT systems are secured with appropriate controls and disaster recovery plans.',
    descriptionAr: 'أنظمة تقنية المعلومات مؤمنة بضوابط مناسبة وخطط تعافي من الكوارث.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'settings'],
    evidenceTypes: ['document', 'report', 'certificate'],
    measurableElements: [
      { id: 'IM.4.ME1', text: 'IT security policy is established', textAr: 'سياسة أمن تقنية المعلومات مُعتمدة', evidenceRequired: ['IT security policy', 'Risk assessment'] },
      { id: 'IM.4.ME2', text: 'Data backup and recovery procedures are tested', textAr: 'إجراءات النسخ الاحتياطي والاستعادة مُختبرة', evidenceRequired: ['Backup logs', 'Recovery test results'] },
      { id: 'IM.4.ME3', text: 'Cybersecurity measures are implemented', textAr: 'إجراءات الأمن السيبراني مُطبقة', evidenceRequired: ['Security audit', 'Penetration test results'] },
    ],
  },
  {
    id: 'IM.5', domain: 'IM',
    domainName: 'Information Management', domainNameAr: 'إدارة المعلومات',
    title: 'Consent Documentation',
    titleAr: 'توثيق الموافقة',
    description: 'Informed consent is obtained and documented appropriately.',
    descriptionAr: 'يتم الحصول على الموافقة المستنيرة وتوثيقها بشكل مناسب.',
    priority: 'essential',
    theaModuleMapping: ['opd', 'or', 'ipd'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      {
        id: 'IM.5.ME1', text: 'Consent forms are signed for applicable procedures', textAr: 'نماذج الموافقة مُوقعة للإجراءات المعنية',
        evidenceRequired: ['Consent audit', 'Completion rates'],
        automatedCheck: async (tenantId: string) => checkConsentDocumentation(tenantId),
      },
      { id: 'IM.5.ME2', text: 'Consent process includes explanation of risks', textAr: 'عملية الموافقة تتضمن شرح المخاطر', evidenceRequired: ['Consent form content review'] },
      { id: 'IM.5.ME3', text: 'Consent is obtained in patient\'s language', textAr: 'يتم الحصول على الموافقة بلغة المريض', evidenceRequired: ['Multilingual consent forms', 'Interpreter logs'] },
    ],
  },

  // =========================================================================
  // HR — Human Resources (HR.1 – HR.5)
  // =========================================================================
  {
    id: 'HR.1', domain: 'HR',
    domainName: 'Human Resources', domainNameAr: 'الموارد البشرية',
    title: 'Credentialing and Privileging',
    titleAr: 'التصديق والصلاحيات',
    description: 'All clinical staff undergo credentialing and privileging processes.',
    descriptionAr: 'يخضع جميع الكوادر السريرية لعمليات التصديق ومنح الصلاحيات.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'users', 'clinical-infra'],
    evidenceTypes: ['document', 'certificate', 'report'],
    measurableElements: [
      {
        id: 'HR.1.ME1', text: 'Credentialing files are complete for all clinical staff', textAr: 'ملفات التصديق مكتملة لجميع الكوادر السريرية',
        evidenceRequired: ['Credential files', 'Verification records'],
        automatedCheck: async (tenantId: string) => checkCredentialing(tenantId),
      },
      { id: 'HR.1.ME2', text: 'Privileges are granted based on credentials', textAr: 'تُمنح الصلاحيات بناءً على الاعتمادات', evidenceRequired: ['Privilege forms', 'Committee approvals'] },
      { id: 'HR.1.ME3', text: 'Re-credentialing is performed per policy', textAr: 'إعادة التصديق تتم وفق السياسة', evidenceRequired: ['Re-credentialing records', 'Timeline compliance'] },
    ],
  },
  {
    id: 'HR.2', domain: 'HR',
    domainName: 'Human Resources', domainNameAr: 'الموارد البشرية',
    title: 'Staff Competency Assessment',
    titleAr: 'تقييم كفاءة الكوادر',
    description: 'Staff competency is assessed initially and on an ongoing basis.',
    descriptionAr: 'تُقيّم كفاءة الكوادر عند التعيين وبشكل مستمر.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'users'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'HR.2.ME1', text: 'Competency assessment tools are defined per position', textAr: 'أدوات تقييم الكفاءة محددة لكل وظيفة', evidenceRequired: ['Competency tools', 'Checklists'] },
      { id: 'HR.2.ME2', text: 'Annual performance evaluation is completed', textAr: 'يُستكمل تقييم الأداء السنوي', evidenceRequired: ['Evaluation forms', 'Completion rates'] },
      { id: 'HR.2.ME3', text: 'Competency gaps lead to training plans', textAr: 'الفجوات في الكفاءة تؤدي لخطط تدريب', evidenceRequired: ['Training plans', 'Gap analysis'] },
    ],
  },
  {
    id: 'HR.3', domain: 'HR',
    domainName: 'Human Resources', domainNameAr: 'الموارد البشرية',
    title: 'Continuing Education',
    titleAr: 'التعليم المستمر',
    description: 'Staff receive ongoing education and training.',
    descriptionAr: 'يحصل الكوادر على التعليم والتدريب المستمر.',
    priority: 'standard',
    theaModuleMapping: ['admin'],
    evidenceTypes: ['document', 'certificate', 'report'],
    measurableElements: [
      { id: 'HR.3.ME1', text: 'Annual training plan is developed', textAr: 'خطة التدريب السنوية مُعدّة', evidenceRequired: ['Training plan', 'Calendar'] },
      { id: 'HR.3.ME2', text: 'Mandatory training completion is tracked', textAr: 'يُتتبع إتمام التدريب الإلزامي', evidenceRequired: ['Training records', 'Completion rates'] },
      { id: 'HR.3.ME3', text: 'CME/CPD hours are documented', textAr: 'ساعات التعليم الطبي المستمر موثقة', evidenceRequired: ['CME logs', 'Certificates'] },
    ],
  },
  {
    id: 'HR.4', domain: 'HR',
    domainName: 'Human Resources', domainNameAr: 'الموارد البشرية',
    title: 'Employee Health Program',
    titleAr: 'برنامج صحة الموظفين',
    description: 'An employee health program addresses screening, immunization, and workplace safety.',
    descriptionAr: 'يعالج برنامج صحة الموظفين الفحص والتطعيم وسلامة بيئة العمل.',
    priority: 'standard',
    theaModuleMapping: ['admin'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'HR.4.ME1', text: 'Pre-employment health screening is performed', textAr: 'يُجرى الفحص الصحي ما قبل التوظيف', evidenceRequired: ['Screening records', 'Medical fitness forms'] },
      { id: 'HR.4.ME2', text: 'Staff immunization records are current', textAr: 'سجلات تطعيم الكوادر محدّثة', evidenceRequired: ['Immunization records', 'Compliance data'] },
      { id: 'HR.4.ME3', text: 'Workplace injuries are tracked and managed', textAr: 'إصابات العمل تُتبع وتُعالج', evidenceRequired: ['Injury logs', 'Workers compensation records'] },
    ],
  },
  {
    id: 'HR.5', domain: 'HR',
    domainName: 'Human Resources', domainNameAr: 'الموارد البشرية',
    title: 'Staff Orientation',
    titleAr: 'تهيئة الكوادر',
    description: 'All new staff undergo comprehensive orientation.',
    descriptionAr: 'يخضع جميع الكوادر الجدد لتهيئة شاملة.',
    priority: 'standard',
    theaModuleMapping: ['admin'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'HR.5.ME1', text: 'General orientation program is established', textAr: 'برنامج التهيئة العام مُعتمد', evidenceRequired: ['Orientation program', 'Checklist'] },
      { id: 'HR.5.ME2', text: 'Department-specific orientation is provided', textAr: 'يُقدم توجيه خاص بالقسم', evidenceRequired: ['Department orientation records'] },
      { id: 'HR.5.ME3', text: 'Orientation completion is documented', textAr: 'إتمام التهيئة موثق', evidenceRequired: ['Completion records', 'Sign-off forms'] },
    ],
  },

  // =========================================================================
  // RI — Rights and Responsibilities (RI.1 – RI.5)
  // =========================================================================
  {
    id: 'RI.1', domain: 'RI',
    domainName: 'Rights and Responsibilities', domainNameAr: 'الحقوق والمسؤوليات',
    title: 'Patient Rights Policy',
    titleAr: 'سياسة حقوق المرضى',
    description: 'A patient rights policy is established, communicated, and enforced.',
    descriptionAr: 'سياسة حقوق المرضى مُعتمدة ومُعممة ومُطبقة.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'registration'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'RI.1.ME1', text: 'Patient rights and responsibilities are documented', textAr: 'حقوق ومسؤوليات المرضى موثقة', evidenceRequired: ['Patient rights policy', 'Brochures'] },
      { id: 'RI.1.ME2', text: 'Patient rights are communicated at admission', textAr: 'تُبلغ حقوق المرضى عند الدخول', evidenceRequired: ['Admission materials', 'Patient acknowledgment'] },
      { id: 'RI.1.ME3', text: 'Staff are trained on patient rights', textAr: 'الكوادر مدربون على حقوق المرضى', evidenceRequired: ['Training records', 'Curriculum'] },
    ],
  },
  {
    id: 'RI.2', domain: 'RI',
    domainName: 'Rights and Responsibilities', domainNameAr: 'الحقوق والمسؤوليات',
    title: 'Informed Consent',
    titleAr: 'الموافقة المستنيرة',
    description: 'Informed consent is obtained for all applicable procedures and treatments.',
    descriptionAr: 'يتم الحصول على الموافقة المستنيرة لجميع الإجراءات والعلاجات المعنية.',
    priority: 'essential',
    theaModuleMapping: ['opd', 'or', 'ipd', 'er'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      { id: 'RI.2.ME1', text: 'Informed consent policy is established', textAr: 'سياسة الموافقة المستنيرة مُعتمدة', evidenceRequired: ['Consent policy', 'Form templates'] },
      { id: 'RI.2.ME2', text: 'Consent includes risks, benefits, and alternatives', textAr: 'الموافقة تتضمن المخاطر والفوائد والبدائل', evidenceRequired: ['Consent form review', 'Chart audit'] },
      { id: 'RI.2.ME3', text: 'Consent is obtained by treating physician', textAr: 'يتم الحصول على الموافقة بواسطة الطبيب المعالج', evidenceRequired: ['Physician signatures', 'Consent audit'] },
    ],
  },
  {
    id: 'RI.3', domain: 'RI',
    domainName: 'Rights and Responsibilities', domainNameAr: 'الحقوق والمسؤوليات',
    title: 'Patient Complaints Management',
    titleAr: 'إدارة شكاوى المرضى',
    description: 'A patient complaints management system is established and accessible.',
    descriptionAr: 'نظام إدارة شكاوى المرضى مُنشأ ومتاح.',
    priority: 'essential',
    theaModuleMapping: ['quality', 'admin'],
    evidenceTypes: ['report', 'log'],
    measurableElements: [
      { id: 'RI.3.ME1', text: 'Complaint process is communicated to patients', textAr: 'عملية الشكاوى مُبلغة للمرضى', evidenceRequired: ['Signage', 'Brochures', 'Website info'] },
      { id: 'RI.3.ME2', text: 'Complaints are tracked and resolved timely', textAr: 'الشكاوى تُتبع وتُحل في الوقت المناسب', evidenceRequired: ['Complaint log', 'Resolution time data'] },
      { id: 'RI.3.ME3', text: 'Complaint trends are analyzed for improvement', textAr: 'تُحلل اتجاهات الشكاوى للتحسين', evidenceRequired: ['Trend reports', 'Action plans'] },
    ],
  },
  {
    id: 'RI.4', domain: 'RI',
    domainName: 'Rights and Responsibilities', domainNameAr: 'الحقوق والمسؤوليات',
    title: 'Patient Privacy',
    titleAr: 'خصوصية المرضى',
    description: 'Patient privacy is maintained during care and in information handling.',
    descriptionAr: 'تُحافظ على خصوصية المرضى أثناء الرعاية وفي التعامل مع المعلومات.',
    priority: 'essential',
    theaModuleMapping: ['admin', 'opd', 'ipd', 'er'],
    evidenceTypes: ['document', 'report'],
    measurableElements: [
      { id: 'RI.4.ME1', text: 'Physical privacy is maintained during examinations', textAr: 'الخصوصية الجسدية مُحافظ عليها أثناء الفحوصات', evidenceRequired: ['Room setup audit', 'Patient surveys'] },
      { id: 'RI.4.ME2', text: 'Information privacy controls are in place', textAr: 'ضوابط خصوصية المعلومات مطبقة', evidenceRequired: ['Access logs', 'Privacy audit'] },
      { id: 'RI.4.ME3', text: 'Photography/recording policy exists', textAr: 'سياسة التصوير/التسجيل موجودة', evidenceRequired: ['Photography policy', 'Consent forms'] },
    ],
  },
  {
    id: 'RI.5', domain: 'RI',
    domainName: 'Rights and Responsibilities', domainNameAr: 'الحقوق والمسؤوليات',
    title: 'Advance Directives',
    titleAr: 'التوجيهات المسبقة',
    description: 'The organization respects and implements advance directives.',
    descriptionAr: 'تحترم المنظمة وتنفذ التوجيهات المسبقة.',
    priority: 'standard',
    theaModuleMapping: ['registration', 'ipd'],
    evidenceTypes: ['document', 'log'],
    measurableElements: [
      { id: 'RI.5.ME1', text: 'Advance directive policy is established', textAr: 'سياسة التوجيهات المسبقة مُعتمدة', evidenceRequired: ['Policy document', 'Forms'] },
      { id: 'RI.5.ME2', text: 'Patients are asked about advance directives', textAr: 'يُسأل المرضى عن التوجيهات المسبقة', evidenceRequired: ['Admission screening', 'Documentation'] },
      { id: 'RI.5.ME3', text: 'Advance directives are accessible in patient record', textAr: 'التوجيهات المسبقة متاحة في سجل المريض', evidenceRequired: ['Record review', 'Flagging system'] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Automated Compliance Check Functions
// ---------------------------------------------------------------------------

async function checkPatientAssessmentCompletion(tenantId: string): Promise<ComplianceResult> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const totalEncounters = await prisma.encounterCore.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    });
    const withNotes = await prisma.clinicalNote.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    });
    const rate = totalEncounters > 0 ? (withNotes / totalEncounters) * 100 : 0;
    const score = Math.min(100, Math.round(rate));
    return {
      standardId: 'PC.1',
      status: score >= 90 ? 'compliant' : score >= 60 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${withNotes} clinical notes found for ${totalEncounters} encounters in last 30 days (${score}%)`],
      gaps: score < 90 ? [`Assessment completion rate (${score}%) is below 90% target`] : [],
      recommendations: score < 90 ? ['Implement mandatory assessment checklist at registration', 'Set up alerts for incomplete assessments'] : [],
    };
  } catch {
    return fallbackResult('PC.1', 'Unable to query patient assessment data');
  }
}

async function checkCarePlans(tenantId: string): Promise<ComplianceResult> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const episodes = await prisma.ipdEpisode.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    });
    // Count distinct episodes that have at least one care plan via IpdCarePlan model
    const carePlanEpisodes = await prisma.ipdCarePlan.groupBy({
      by: ['episodeId'],
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    });
    const withCarePlans = carePlanEpisodes.length;
    const rate = episodes > 0 ? (withCarePlans / episodes) * 100 : 0;
    const score = Math.min(100, Math.round(rate));
    return {
      standardId: 'PC.2',
      status: score >= 90 ? 'compliant' : score >= 60 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${withCarePlans} of ${episodes} IPD episodes have care plans (${score}%)`],
      gaps: score < 90 ? [`Care plan documentation rate (${score}%) is below 90% target`] : [],
      recommendations: score < 90 ? ['Implement care plan template in IPD workflow', 'Add care plan completion to admission checklist'] : [],
    };
  } catch {
    return fallbackResult('PC.2', 'Unable to query care plan data');
  }
}

async function checkNursingDocumentation(tenantId: string): Promise<ComplianceResult> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const encounters = await prisma.encounterCore.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    });
    const nursingNotes = await prisma.clinicalNote.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo }, noteType: { in: ['nursing', 'nursing_assessment', 'NURSING'] } },
    });
    const rate = encounters > 0 ? Math.min(100, (nursingNotes / encounters) * 100) : 0;
    const score = Math.round(rate);
    return {
      standardId: 'NS.2',
      status: score >= 85 ? 'compliant' : score >= 50 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${nursingNotes} nursing notes for ${encounters} encounters in last 30 days`],
      gaps: score < 85 ? [`Nursing documentation rate (${score}%) below 85% target`] : [],
      recommendations: score < 85 ? ['Standardize nursing note templates', 'Enable nursing note reminders'] : [],
    };
  } catch {
    return fallbackResult('NS.2', 'Unable to query nursing documentation data');
  }
}

async function checkFormularyExists(tenantId: string): Promise<ComplianceResult> {
  try {
    const medCount = await prisma.medicationCatalog.count({
      where: { tenantId },
    });
    const score = medCount >= 50 ? 100 : medCount >= 10 ? 70 : medCount > 0 ? 40 : 0;
    return {
      standardId: 'MM.1',
      status: score >= 80 ? 'compliant' : score >= 40 ? 'partial' : 'non_compliant',
      score,
      evidence: [`Medication catalog contains ${medCount} items`],
      gaps: medCount < 50 ? ['Formulary may be incomplete — fewer than 50 medications cataloged'] : [],
      recommendations: medCount < 50 ? ['Complete medication catalog setup', 'Establish P&T committee to manage formulary'] : [],
    };
  } catch {
    return fallbackResult('MM.1', 'Unable to query medication catalog');
  }
}

async function checkHighAlertMedications(tenantId: string): Promise<ComplianceResult> {
  try {
    // Check if there are medications flagged as controlled (high-alert) in the catalog
    const highAlertCount = await prisma.medicationCatalog.count({
      where: { tenantId, isControlled: true },
    });
    const totalMeds = await prisma.medicationCatalog.count({
      where: { tenantId },
    });
    const score = highAlertCount > 0 ? (totalMeds > 0 ? 80 : 60) : 0;
    return {
      standardId: 'MM.2',
      status: score >= 80 ? 'compliant' : score >= 40 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${highAlertCount} high-alert medications identified in catalog of ${totalMeds}`],
      gaps: highAlertCount === 0 ? ['No high-alert medications flagged in system'] : [],
      recommendations: highAlertCount === 0 ? ['Identify and flag high-alert medications in catalog', 'Implement double-check workflow for high-alert meds'] : [],
    };
  } catch {
    return fallbackResult('MM.2', 'Unable to query high-alert medication data');
  }
}

async function checkMedicationOrders(tenantId: string): Promise<ComplianceResult> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const totalOrders = await prisma.ordersHub.count({
      where: { tenantId, kind: 'MEDICATION', createdAt: { gte: thirtyDaysAgo } },
    });
    // Check for orders that have all required fields
    const completeOrders = await prisma.ordersHub.count({
      where: {
        tenantId,
        kind: 'MEDICATION',
        createdAt: { gte: thirtyDaysAgo },
        createdByUserId: { not: null },
        patientMasterId: { not: null },
      },
    });
    const rate = totalOrders > 0 ? (completeOrders / totalOrders) * 100 : 0;
    const score = Math.min(100, Math.round(rate));
    return {
      standardId: 'MM.4',
      status: score >= 95 ? 'compliant' : score >= 70 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${completeOrders} of ${totalOrders} medication orders have complete required fields (${score}%)`],
      gaps: score < 95 ? [`Order completeness rate (${score}%) below 95% target`] : [],
      recommendations: score < 95 ? ['Enforce mandatory fields in order forms', 'Implement allergy checking at order entry'] : [],
    };
  } catch {
    return fallbackResult('MM.4', 'Unable to query medication order data');
  }
}

async function checkInfectionControlProgram(tenantId: string): Promise<ComplianceResult> {
  try {
    const surveillanceCount = await prisma.infectionSurveillance.count({
      where: { tenantId },
    });
    const recentSurveillance = await prisma.infectionSurveillance.count({
      where: { tenantId, createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
    });
    const score = recentSurveillance >= 5 ? 90 : recentSurveillance >= 1 ? 60 : surveillanceCount > 0 ? 30 : 0;
    return {
      standardId: 'IC.1',
      status: score >= 80 ? 'compliant' : score >= 40 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${surveillanceCount} total surveillance records, ${recentSurveillance} in last 90 days`],
      gaps: recentSurveillance < 5 ? ['Infection surveillance activity is below expected frequency'] : [],
      recommendations: recentSurveillance < 5 ? ['Increase surveillance data collection frequency', 'Designate infection control practitioner'] : [],
    };
  } catch {
    return fallbackResult('IC.1', 'Unable to query infection control data');
  }
}

async function checkHAISurveillance(tenantId: string): Promise<ComplianceResult> {
  try {
    const infectionTypes = ['CLABSI', 'CAUTI', 'VAP', 'SSI'];
    const haiCounts = await prisma.infectionSurveillance.groupBy({
      by: ['infectionType'],
      where: { tenantId, infectionType: { in: infectionTypes } },
      _count: true,
    });
    const trackedTypes = haiCounts.length;
    const score = trackedTypes >= 4 ? 100 : trackedTypes >= 2 ? 70 : trackedTypes >= 1 ? 40 : 0;
    return {
      standardId: 'IC.4',
      status: score >= 80 ? 'compliant' : score >= 40 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${trackedTypes} of 4 key HAI types tracked: ${haiCounts.map((h: any) => h.infectionType).join(', ') || 'none'}`],
      gaps: trackedTypes < 4 ? [`Missing HAI tracking for: ${infectionTypes.filter(t => !haiCounts.some((h: any) => h.infectionType === t)).join(', ')}`] : [],
      recommendations: trackedTypes < 4 ? ['Configure tracking for all 4 key HAI types (CLABSI, CAUTI, VAP, SSI)'] : [],
    };
  } catch {
    return fallbackResult('IC.4', 'Unable to query HAI surveillance data');
  }
}

async function checkIncidentReporting(tenantId: string): Promise<ComplianceResult> {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const incidentCount = await prisma.qualityIncident.count({
      where: { tenantId, createdAt: { gte: ninetyDaysAgo } },
    });
    const score = incidentCount >= 10 ? 100 : incidentCount >= 3 ? 70 : incidentCount >= 1 ? 40 : 0;
    return {
      standardId: 'QM.3',
      status: score >= 70 ? 'compliant' : score >= 40 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${incidentCount} incidents reported in last 90 days`],
      gaps: incidentCount < 3 ? ['Low incident reporting may indicate underreporting culture'] : [],
      recommendations: incidentCount < 3 ? ['Promote non-punitive incident reporting culture', 'Train staff on incident reporting process', 'Implement anonymous near-miss reporting'] : [],
    };
  } catch {
    return fallbackResult('QM.3', 'Unable to query incident reporting data');
  }
}

async function checkKPITracking(tenantId: string): Promise<ComplianceResult> {
  try {
    // Check if quality KPIs are being tracked — look for quality incidents with different statuses
    const openIncidents = await prisma.qualityIncident.count({
      where: { tenantId, status: 'OPEN' },
    });
    const closedIncidents = await prisma.qualityIncident.count({
      where: { tenantId, status: 'CLOSED' },
    });
    const totalIncidents = openIncidents + closedIncidents;
    // Having tracked incidents with proper lifecycle means some KPI tracking exists
    const score = closedIncidents > 0 && totalIncidents >= 5 ? 80 : totalIncidents >= 1 ? 50 : 0;
    return {
      standardId: 'QM.4',
      status: score >= 80 ? 'compliant' : score >= 40 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${totalIncidents} total incidents tracked, ${closedIncidents} closed (lifecycle active: ${closedIncidents > 0 ? 'Yes' : 'No'})`],
      gaps: score < 80 ? ['KPI tracking and incident lifecycle management needs improvement'] : [],
      recommendations: score < 80 ? ['Define clinical KPI dashboard', 'Report KPIs quarterly to leadership'] : [],
    };
  } catch {
    return fallbackResult('QM.4', 'Unable to query KPI tracking data');
  }
}

async function checkEquipmentManagement(tenantId: string): Promise<ComplianceResult> {
  try {
    const equipmentCount = await prisma.equipment.count({
      where: { tenantId },
    });
    const activeEquipment = await prisma.equipment.count({
      where: { tenantId, status: 'OPERATIONAL' },
    });
    const score = equipmentCount >= 20 ? 90 : equipmentCount >= 5 ? 60 : equipmentCount > 0 ? 30 : 0;
    return {
      standardId: 'FMS.3',
      status: score >= 80 ? 'compliant' : score >= 40 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${equipmentCount} equipment items in inventory, ${activeEquipment} active`],
      gaps: equipmentCount < 5 ? ['Equipment inventory may be incomplete'] : [],
      recommendations: equipmentCount < 20 ? ['Complete equipment inventory in the system', 'Set up preventive maintenance schedules'] : [],
    };
  } catch {
    return fallbackResult('FMS.3', 'Unable to query equipment data');
  }
}

async function checkMedicalRecordsCompleteness(tenantId: string): Promise<ComplianceResult> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const encounters = await prisma.encounterCore.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    });
    const withNotes = await prisma.clinicalNote.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    });
    const rate = encounters > 0 ? Math.min(100, (withNotes / encounters) * 100) : 0;
    const score = Math.round(rate);
    return {
      standardId: 'IM.1',
      status: score >= 90 ? 'compliant' : score >= 60 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${withNotes} notes for ${encounters} encounters in last 30 days (coverage: ${score}%)`],
      gaps: score < 90 ? [`Record completeness rate (${score}%) below 90% target`] : [],
      recommendations: score < 90 ? ['Implement documentation completion alerts', 'Require note completion before encounter closure'] : [],
    };
  } catch {
    return fallbackResult('IM.1', 'Unable to query medical records data');
  }
}

async function checkClinicalNotesCompleteness(tenantId: string): Promise<ComplianceResult> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEncounters = await prisma.encounterCore.count({
      where: { tenantId, createdAt: { gte: sevenDaysAgo } },
    });
    const recentNotes = await prisma.clinicalNote.count({
      where: { tenantId, createdAt: { gte: sevenDaysAgo } },
    });
    const rate = recentEncounters > 0 ? Math.min(100, (recentNotes / recentEncounters) * 100) : 0;
    const score = Math.round(rate);
    return {
      standardId: 'IM.3',
      status: score >= 90 ? 'compliant' : score >= 60 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${recentNotes} clinical notes for ${recentEncounters} encounters in last 7 days (${score}%)`],
      gaps: score < 90 ? [`Clinical note timeliness (${score}%) below 90% target`] : [],
      recommendations: score < 90 ? ['Set documentation deadline alerts', 'Implement charting completion reminders'] : [],
    };
  } catch {
    return fallbackResult('IM.3', 'Unable to query clinical notes data');
  }
}

async function checkConsentDocumentation(tenantId: string): Promise<ComplianceResult> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const consents = await prisma.clinicalConsent.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    });
    const encounters = await prisma.encounterCore.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    });
    const rate = encounters > 0 ? Math.min(100, (consents / encounters) * 100) : 0;
    const score = Math.round(rate);
    return {
      standardId: 'IM.5',
      status: score >= 85 ? 'compliant' : score >= 50 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${consents} consent forms for ${encounters} encounters in last 30 days (${score}%)`],
      gaps: score < 85 ? [`Consent documentation rate (${score}%) below 85% target`] : [],
      recommendations: score < 85 ? ['Add consent form requirement to clinical workflow', 'Implement consent status tracking'] : [],
    };
  } catch {
    return fallbackResult('IM.5', 'Unable to query consent documentation data');
  }
}

async function checkCredentialing(tenantId: string): Promise<ComplianceResult> {
  try {
    const providers = await prisma.clinicalInfraProvider.count({
      where: { tenantId, isArchived: false },
    });
    const withCredentials = await prisma.clinicalInfraProviderProfile.count({
      where: { tenantId, licenseNumber: { not: null } },
    });
    const rate = providers > 0 ? (withCredentials / providers) * 100 : 0;
    const score = Math.min(100, Math.round(rate));
    return {
      standardId: 'HR.1',
      status: score >= 100 ? 'compliant' : score >= 70 ? 'partial' : 'non_compliant',
      score,
      evidence: [`${withCredentials} of ${providers} clinical providers have license numbers recorded (${score}%)`],
      gaps: score < 100 ? [`${providers - withCredentials} providers missing license/credential records`] : [],
      recommendations: score < 100 ? ['Complete credentialing files for all providers', 'Set credential expiry alerts'] : [],
    };
  } catch {
    return fallbackResult('HR.1', 'Unable to query credentialing data');
  }
}

function fallbackResult(standardId: string, reason: string): ComplianceResult {
  return {
    standardId,
    status: 'not_applicable',
    score: 0,
    evidence: [],
    gaps: [reason],
    recommendations: ['Ensure the relevant module is configured and data is available'],
  };
}

// ---------------------------------------------------------------------------
// Domain-level Check Functions
// ---------------------------------------------------------------------------

export async function checkMedicationSafety(tenantId: string): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = [];
  const mmStandards = CBAHI_STANDARDS.filter(s => s.domain === 'MM');
  for (const std of mmStandards) {
    for (const me of std.measurableElements) {
      if (me.automatedCheck) {
        results.push(await me.automatedCheck(tenantId));
      }
    }
  }
  return results;
}

export async function checkInfectionControl(tenantId: string): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = [];
  const icStandards = CBAHI_STANDARDS.filter(s => s.domain === 'IC');
  for (const std of icStandards) {
    for (const me of std.measurableElements) {
      if (me.automatedCheck) {
        results.push(await me.automatedCheck(tenantId));
      }
    }
  }
  return results;
}

export async function checkPatientCare(tenantId: string): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = [];
  const pcStandards = CBAHI_STANDARDS.filter(s => s.domain === 'PC');
  for (const std of pcStandards) {
    for (const me of std.measurableElements) {
      if (me.automatedCheck) {
        results.push(await me.automatedCheck(tenantId));
      }
    }
  }
  return results;
}

export async function checkQualityManagement(tenantId: string): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = [];
  const qmStandards = CBAHI_STANDARDS.filter(s => s.domain === 'QM');
  for (const std of qmStandards) {
    for (const me of std.measurableElements) {
      if (me.automatedCheck) {
        results.push(await me.automatedCheck(tenantId));
      }
    }
  }
  return results;
}

export async function checkDocumentation(tenantId: string): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = [];
  const imStandards = CBAHI_STANDARDS.filter(s => s.domain === 'IM');
  for (const std of imStandards) {
    for (const me of std.measurableElements) {
      if (me.automatedCheck) {
        results.push(await me.automatedCheck(tenantId));
      }
    }
  }
  return results;
}

export async function checkPatientRights(tenantId: string): Promise<ComplianceResult[]> {
  // RI domain — no automated checks currently, return manual review needed
  return CBAHI_STANDARDS
    .filter(s => s.domain === 'RI')
    .map(s => ({
      standardId: s.id,
      status: 'not_applicable' as const,
      score: 0,
      evidence: [],
      gaps: ['Manual review required — automated checks not available for this standard'],
      recommendations: ['Upload evidence documents to demonstrate compliance'],
    }));
}

// ---------------------------------------------------------------------------
// Full Compliance Audit
// ---------------------------------------------------------------------------

export async function runFullComplianceAudit(tenantId: string): Promise<FullAuditResult> {
  const allResults: ComplianceResult[] = [];

  // Run all automated checks across every standard
  for (const standard of CBAHI_STANDARDS) {
    let standardChecked = false;
    for (const me of standard.measurableElements) {
      if (me.automatedCheck) {
        const result = await me.automatedCheck(tenantId);
        allResults.push(result);
        standardChecked = true;
      }
    }
    if (!standardChecked) {
      // Add a manual-review placeholder for standards without automated checks
      allResults.push({
        standardId: standard.id,
        status: 'not_applicable',
        score: 0,
        evidence: [],
        gaps: ['No automated check available — manual evidence review required'],
        recommendations: ['Upload evidence documents for this standard'],
      });
    }
  }

  // Calculate domain scores
  const domainScores: DomainScore[] = Object.entries(CBAHI_DOMAINS).map(([domain, info]) => {
    const domainStandards = CBAHI_STANDARDS.filter(s => s.domain === domain);
    const domainResults = allResults.filter(r => domainStandards.some(s => s.id === r.standardId));
    const assessedResults = domainResults.filter(r => r.status !== 'not_applicable');
    const compliantCount = domainResults.filter(r => r.status === 'compliant').length;
    const partialCount = domainResults.filter(r => r.status === 'partial').length;
    const nonCompliantCount = domainResults.filter(r => r.status === 'non_compliant').length;
    const notApplicableCount = domainResults.filter(r => r.status === 'not_applicable').length;
    const totalScore = assessedResults.reduce((sum, r) => sum + r.score, 0);
    const avgScore = assessedResults.length > 0 ? Math.round(totalScore / assessedResults.length) : 0;

    return {
      domain,
      domainName: info.name,
      domainNameAr: info.nameAr,
      totalStandards: domainStandards.length,
      assessedStandards: assessedResults.length,
      compliant: compliantCount,
      partial: partialCount,
      nonCompliant: nonCompliantCount,
      notApplicable: notApplicableCount,
      score: avgScore,
    };
  });

  // Overall score: weighted average of domain scores that have been assessed
  const assessedDomains = domainScores.filter(d => d.assessedStandards > 0);
  const overallScore = assessedDomains.length > 0
    ? Math.round(assessedDomains.reduce((sum, d) => sum + d.score, 0) / assessedDomains.length)
    : 0;

  return {
    overallScore,
    overallStatus: overallScore >= 80 ? 'ready' : overallScore >= 50 ? 'partial' : 'not_ready',
    domainScores,
    findings: allResults,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Utility — search / filter helpers
// ---------------------------------------------------------------------------

export function getStandardsByDomain(domain: string): CbahiStandard[] {
  return CBAHI_STANDARDS.filter(s => s.domain === domain.toUpperCase());
}

export function getStandardById(id: string): CbahiStandard | undefined {
  return CBAHI_STANDARDS.find(s => s.id === id);
}

export function searchStandards(query: string): CbahiStandard[] {
  const q = query.toLowerCase();
  return CBAHI_STANDARDS.filter(s =>
    s.id.toLowerCase().includes(q) ||
    s.title.toLowerCase().includes(q) ||
    s.titleAr.includes(query) ||
    s.description.toLowerCase().includes(q) ||
    s.descriptionAr.includes(query) ||
    s.domain.toLowerCase().includes(q)
  );
}
