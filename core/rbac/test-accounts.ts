// core/rbac/test-accounts.ts — IMDAD Test Accounts for RBAC Validation

import type { ImdadRole } from './roles';

export type SupplyDomain =
  | 'MEDICAL_CONSUMABLES'
  | 'MEDICAL_DEVICES'
  | 'NON_MEDICAL_CONSUMABLES'
  | 'NON_MEDICAL_DEVICES'
  | 'FURNITURE'
  | 'OFFICE_EQUIPMENT'
  | 'IT_SYSTEMS'
  | 'DENTAL';

export interface TestAccount {
  email: string;
  password: string;
  role: string;
  name: string;
  nameAr: string;
  assignedHospitalId?: string;
  assignedHospitalName?: string;
  assignedDepartment?: string;
  assignedDomains?: SupplyDomain[];
  scope: 'GROUP' | 'MULTI_HOSPITAL' | 'SINGLE_HOSPITAL' | 'DEPARTMENT';
  description: string;
  descriptionAr: string;
}

const ALL_SUPPLY_DOMAINS: SupplyDomain[] = [
  'MEDICAL_CONSUMABLES',
  'MEDICAL_DEVICES',
  'NON_MEDICAL_CONSUMABLES',
  'NON_MEDICAL_DEVICES',
  'FURNITURE',
  'OFFICE_EQUIPMENT',
  'IT_SYSTEMS',
  'DENTAL',
];

export const TEST_ACCOUNTS: TestAccount[] = [
  // ---------------------------------------------------------------------------
  // GROUP LEVEL
  // ---------------------------------------------------------------------------

  {
    email: 'ceo@imdad.com',
    password: '123456',
    role: 'CEO',
    name: 'Sultan Al-Faisal',
    nameAr: 'سلطان الفيصل',
    scope: 'GROUP',
    description: 'Group-wide strategic control',
    descriptionAr: 'السيطرة الاستراتيجية على مستوى المجموعة',
  },
  {
    email: 'coo@imdad.com',
    password: '123456',
    role: 'COO_GROUP',
    name: 'Mansour Al-Turki',
    nameAr: 'منصور التركي',
    scope: 'MULTI_HOSPITAL',
    description: 'Multi-hospital operations oversight',
    descriptionAr: 'الإشراف التشغيلي على المستشفيات المتعددة',
  },
  {
    email: 'cfo@imdad.com',
    password: '123456',
    role: 'CFO_GROUP',
    name: 'Saud Al-Mutairi',
    nameAr: 'سعود المطيري',
    scope: 'GROUP',
    description: 'Group financial oversight',
    descriptionAr: 'الإشراف المالي على مستوى المجموعة',
  },
  {
    email: 'cmo@imdad.com',
    password: '123456',
    role: 'CMO_GROUP',
    name: 'Dr. Ahmad Al-Jaber',
    nameAr: 'د. أحمد الجابر',
    scope: 'GROUP',
    description: 'Clinical domains oversight',
    descriptionAr: 'الإشراف على المجالات السريرية',
  },
  {
    email: 'vpsc@imdad.com',
    password: '123456',
    role: 'VP_SUPPLY_CHAIN',
    name: 'Bandar Al-Subaie',
    nameAr: 'بندر السبيعي',
    scope: 'GROUP',
    description: 'Supply chain governance',
    descriptionAr: 'حوكمة سلسلة الإمداد',
  },

  // ---------------------------------------------------------------------------
  // SUBSIDIARIES
  // ---------------------------------------------------------------------------

  {
    email: 'thea-solutions@imdad.com',
    password: '123456',
    role: 'THEA_SOLUTIONS_CEO',
    name: 'Faisal Al-Dosari',
    nameAr: 'فيصل الدوسري',
    assignedDomains: ['IT_SYSTEMS', 'OFFICE_EQUIPMENT'],
    scope: 'GROUP',
    description: 'Thea Solutions subsidiary CEO — IT systems and office equipment',
    descriptionAr: 'الرئيس التنفيذي لثيا للحلول — أنظمة تقنية المعلومات والمعدات المكتبية',
  },
  {
    email: 'thea-medical@imdad.com',
    password: '123456',
    role: 'THEA_MEDICAL_CEO',
    name: 'Dr. Nawaf Al-Shammari',
    nameAr: 'د. نواف الشمري',
    assignedDomains: ['MEDICAL_DEVICES'],
    scope: 'GROUP',
    description: 'Thea Medical subsidiary CEO — medical devices',
    descriptionAr: 'الرئيس التنفيذي لثيا الطبية — الأجهزة الطبية',
  },
  {
    email: 'thea-lab@imdad.com',
    password: '123456',
    role: 'THEA_LAB_CEO',
    name: 'Dr. Saleh Al-Dosari',
    nameAr: 'د. صالح الدوسري',
    assignedDomains: ['MEDICAL_CONSUMABLES'],
    scope: 'GROUP',
    description: 'Thea Lab subsidiary CEO — medical consumables',
    descriptionAr: 'الرئيس التنفيذي لثيا للمختبرات — المستهلكات الطبية',
  },
  {
    email: 'thea-pharmacy@imdad.com',
    password: '123456',
    role: 'THEA_PHARMACY_CEO',
    name: 'Dr. Rakan Al-Otaibi',
    nameAr: 'د. راكان العتيبي',
    assignedDomains: ['MEDICAL_CONSUMABLES'],
    scope: 'GROUP',
    description: 'Thea Pharmacy subsidiary CEO — medical consumables',
    descriptionAr: 'الرئيس التنفيذي لثيا للصيدلة — المستهلكات الطبية',
  },
  {
    email: 'dental@imdad.com',
    password: '123456',
    role: 'DAHNAA_DENTAL_CEO',
    name: 'Dr. Reem Al-Dosari',
    nameAr: 'د. ريم الدوسري',
    assignedDomains: ['DENTAL'],
    scope: 'GROUP',
    description: 'Dahnaa Dental subsidiary CEO — dental supplies',
    descriptionAr: 'الرئيس التنفيذي لدهناء لطب الأسنان — مستلزمات طب الأسنان',
  },

  // ---------------------------------------------------------------------------
  // HOSPITAL LEVEL (assigned to RYD-CTR)
  // ---------------------------------------------------------------------------

  {
    email: 'gd@imdad.com',
    password: '123456',
    role: 'GENERAL_DIRECTOR',
    name: 'Abdullah Al-Rashidi',
    nameAr: 'عبدالله الرشيدي',
    assignedHospitalId: 'RYD-CTR',
    assignedHospitalName: 'Thea Central Hospital',
    scope: 'SINGLE_HOSPITAL',
    description: 'Full hospital operations',
    descriptionAr: 'العمليات الكاملة للمستشفى',
  },
  {
    email: 'md@imdad.com',
    password: '123456',
    role: 'MEDICAL_DIRECTOR',
    name: 'Dr. Fahad Al-Otaibi',
    nameAr: 'د. فهد العتيبي',
    assignedHospitalId: 'RYD-CTR',
    assignedHospitalName: 'Thea Central Hospital',
    assignedDomains: ['MEDICAL_DEVICES', 'MEDICAL_CONSUMABLES', 'DENTAL'],
    scope: 'SINGLE_HOSPITAL',
    description: 'Clinical domains in hospital',
    descriptionAr: 'المجالات السريرية في المستشفى',
  },
  {
    email: 'don@imdad.com',
    password: '123456',
    role: 'NURSING_DIRECTOR',
    name: 'Noura Al-Shehri',
    nameAr: 'نورة الشهري',
    assignedHospitalId: 'RYD-CTR',
    assignedHospitalName: 'Thea Central Hospital',
    assignedDomains: ['MEDICAL_CONSUMABLES', 'MEDICAL_DEVICES'],
    scope: 'SINGLE_HOSPITAL',
    description: 'Nursing operations',
    descriptionAr: 'عمليات التمريض',
  },
  {
    email: 'ed@imdad.com',
    password: '123456',
    role: 'EXECUTIVE_DIRECTOR',
    name: 'Khalid Al-Ghamdi',
    nameAr: 'خالد الغامدي',
    assignedHospitalId: 'RYD-CTR',
    assignedHospitalName: 'Thea Central Hospital',
    assignedDomains: [
      'NON_MEDICAL_CONSUMABLES',
      'NON_MEDICAL_DEVICES',
      'FURNITURE',
      'OFFICE_EQUIPMENT',
      'IT_SYSTEMS',
    ],
    scope: 'SINGLE_HOSPITAL',
    description: 'Admin and support operations',
    descriptionAr: 'العمليات الإدارية والدعم',
  },

  // ---------------------------------------------------------------------------
  // DEPARTMENT LEVEL (assigned to RYD-CTR)
  // ---------------------------------------------------------------------------

  {
    email: 'hod@imdad.com',
    password: '123456',
    role: 'HEAD_OF_DEPARTMENT',
    name: 'Ali Al-Malki',
    nameAr: 'علي المالكي',
    assignedHospitalId: 'RYD-CTR',
    assignedHospitalName: 'Thea Central Hospital',
    assignedDepartment: 'ICU',
    assignedDomains: ['MEDICAL_DEVICES', 'MEDICAL_CONSUMABLES'],
    scope: 'DEPARTMENT',
    description: 'ICU department head',
    descriptionAr: 'رئيس قسم العناية المركزة',
  },
  {
    email: 'hn@imdad.com',
    password: '123456',
    role: 'HEAD_NURSE',
    name: 'Fatimah Al-Zahrani',
    nameAr: 'فاطمة الزهراني',
    assignedHospitalId: 'RYD-CTR',
    assignedHospitalName: 'Thea Central Hospital',
    assignedDepartment: 'ICU',
    assignedDomains: ['MEDICAL_CONSUMABLES', 'MEDICAL_DEVICES'],
    scope: 'DEPARTMENT',
    description: 'ICU head nurse',
    descriptionAr: 'رئيسة تمريض العناية المركزة',
  },
  {
    email: 'pc@imdad.com',
    password: '123456',
    role: 'PROPERTY_CONTROL',
    name: 'Turki Al-Qahtani',
    nameAr: 'تركي القحطاني',
    assignedHospitalId: 'RYD-CTR',
    assignedHospitalName: 'Thea Central Hospital',
    assignedDomains: [...ALL_SUPPLY_DOMAINS],
    scope: 'SINGLE_HOSPITAL',
    description: 'Property control and asset management',
    descriptionAr: 'مراقبة الممتلكات وإدارة الأصول',
  },
  {
    email: 'wh@imdad.com',
    password: '123456',
    role: 'WAREHOUSE_SUPERVISOR',
    name: 'Saeed Al-Harbi',
    nameAr: 'سعيد الحربي',
    assignedHospitalId: 'RYD-CTR',
    assignedHospitalName: 'Thea Central Hospital',
    scope: 'SINGLE_HOSPITAL',
    description: 'Warehouse and stock operations',
    descriptionAr: 'عمليات المستودعات والمخزون',
  },
  {
    email: 'scm@imdad.com',
    password: '123456',
    role: 'SUPPLY_CHAIN_MANAGER',
    name: 'Omar Al-Harbi',
    nameAr: 'عمر الحربي',
    assignedHospitalId: 'RYD-CTR',
    assignedHospitalName: 'Thea Central Hospital',
    scope: 'SINGLE_HOSPITAL',
    description: 'Hospital supply chain',
    descriptionAr: 'سلسلة إمداد المستشفى',
  },
  {
    email: 'sup@imdad.com',
    password: '123456',
    role: 'SUPERVISOR',
    name: 'Nasser Al-Tamimi',
    nameAr: 'ناصر التميمي',
    assignedHospitalId: 'RYD-CTR',
    assignedHospitalName: 'Thea Central Hospital',
    assignedDepartment: 'Emergency',
    assignedDomains: ['MEDICAL_CONSUMABLES'],
    scope: 'DEPARTMENT',
    description: 'Emergency department supervisor',
    descriptionAr: 'مشرف قسم الطوارئ',
  },
];
