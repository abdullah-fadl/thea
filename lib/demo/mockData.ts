/**
 * Static mock data for the interactive demo.
 * No API calls needed — everything is client-side.
 */

export const DEMO_KPIS = {
  totalVisits: 247,
  activePatients: 42,
  bedOccupancy: 85,
  avgWaitTime: 12,
  orOperations: 8,
  labTests: 34,
  prescriptions: 89,
  erVisits: 18,
};

export const DEMO_CHART_VISITS = [
  { name: 'Sat', value: 45 },
  { name: 'Sun', value: 62 },
  { name: 'Mon', value: 58 },
  { name: 'Tue', value: 71 },
  { name: 'Wed', value: 65 },
  { name: 'Thu', value: 80 },
  { name: 'Fri', value: 42 },
];

export const DEMO_CHART_REVENUE = [
  { name: 'Jan', value: 120 },
  { name: 'Feb', value: 145 },
  { name: 'Mar', value: 165 },
  { name: 'Apr', value: 190 },
  { name: 'May', value: 210 },
  { name: 'Jun', value: 235 },
];

export interface DemoPatient {
  id: string;
  nameAr: string;
  nameEn: string;
  mrn: string;
  age: number;
  gender: 'M' | 'F';
  status: string;
  visitType: 'new' | 'fu' | 'urg';
  waitMinutes: number;
  departmentAr: string;
  departmentEn: string;
  doctorAr: string;
  doctorEn: string;
}

export const DEMO_PATIENTS: DemoPatient[] = [
  { id: '1', nameAr: 'محمد أحمد الشمري', nameEn: 'Mohammed A. Al-Shamri', mrn: 'MRN-001', age: 34, gender: 'M', status: 'WAITING_DOCTOR', visitType: 'fu', waitMinutes: 8, departmentAr: 'أمراض القلب', departmentEn: 'Cardiology', doctorAr: 'د. خالد العتيبي', doctorEn: 'Dr. Khalid Al-Otaibi' },
  { id: '2', nameAr: 'فاطمة عبدالله', nameEn: 'Fatima Abdullah', mrn: 'MRN-002', age: 28, gender: 'F', status: 'IN_NURSING', visitType: 'new', waitMinutes: 3, departmentAr: 'النساء والولادة', departmentEn: 'OB/GYN', doctorAr: 'د. نورة الفيصل', doctorEn: 'Dr. Noura Al-Faisal' },
  { id: '3', nameAr: 'عبدالرحمن السعيد', nameEn: 'Abdulrahman Al-Saeed', mrn: 'MRN-003', age: 55, gender: 'M', status: 'IN_DOCTOR', visitType: 'fu', waitMinutes: 0, departmentAr: 'الباطنية', departmentEn: 'Internal Medicine', doctorAr: 'د. سعد المالكي', doctorEn: 'Dr. Saad Al-Malki' },
  { id: '4', nameAr: 'سارة القحطاني', nameEn: 'Sara Al-Qahtani', mrn: 'MRN-004', age: 42, gender: 'F', status: 'READY_FOR_DOCTOR', visitType: 'urg', waitMinutes: 15, departmentAr: 'الجراحة', departmentEn: 'Surgery', doctorAr: 'د. أحمد الحربي', doctorEn: 'Dr. Ahmed Al-Harbi' },
  { id: '5', nameAr: 'يوسف البكر', nameEn: 'Yousef Al-Baker', mrn: 'MRN-005', age: 7, gender: 'M', status: 'COMPLETED', visitType: 'new', waitMinutes: 0, departmentAr: 'الأطفال', departmentEn: 'Pediatrics', doctorAr: 'د. هند الزهراني', doctorEn: 'Dr. Hind Al-Zahrani' },
  { id: '6', nameAr: 'نوف العنزي', nameEn: 'Nouf Al-Enezi', mrn: 'MRN-006', age: 63, gender: 'F', status: 'WAITING_NURSE', visitType: 'fu', waitMinutes: 22, departmentAr: 'العظام', departmentEn: 'Orthopedics', doctorAr: 'د. فهد الدوسري', doctorEn: 'Dr. Fahad Al-Dosari' },
];

export interface DemoOrder {
  id: string;
  typeAr: string;
  typeEn: string;
  descriptionAr: string;
  descriptionEn: string;
  statusAr: string;
  statusEn: string;
  statusColor: string;
  priority: 'routine' | 'urgent' | 'stat';
}

export const DEMO_ORDERS: DemoOrder[] = [
  { id: 'ORD-001', typeAr: 'مختبر', typeEn: 'Lab', descriptionAr: 'تحليل دم شامل CBC', descriptionEn: 'Complete Blood Count (CBC)', statusAr: 'مكتمل', statusEn: 'Completed', statusColor: '#059669', priority: 'routine' },
  { id: 'ORD-002', typeAr: 'أشعة', typeEn: 'Radiology', descriptionAr: 'أشعة سينية للصدر', descriptionEn: 'Chest X-Ray', statusAr: 'قيد التنفيذ', statusEn: 'In Progress', statusColor: '#1D4ED8', priority: 'routine' },
  { id: 'ORD-003', typeAr: 'دواء', typeEn: 'Medication', descriptionAr: 'أموكسيسيلين 500mg', descriptionEn: 'Amoxicillin 500mg', statusAr: 'تم الصرف', statusEn: 'Dispensed', statusColor: '#059669', priority: 'routine' },
  { id: 'ORD-004', typeAr: 'مختبر', typeEn: 'Lab', descriptionAr: 'وظائف الكلى', descriptionEn: 'Renal Function Test', statusAr: 'بانتظار العينة', statusEn: 'Pending Collection', statusColor: '#D97706', priority: 'urgent' },
  { id: 'ORD-005', typeAr: 'استشارة', typeEn: 'Consult', descriptionAr: 'استشارة قلب', descriptionEn: 'Cardiology Consult', statusAr: 'مطلوب', statusEn: 'Requested', statusColor: '#D97706', priority: 'routine' },
];

export interface DemoLabResult {
  id: string;
  testAr: string;
  testEn: string;
  value: string;
  unit: string;
  refRange: string;
  status: 'normal' | 'high' | 'low' | 'critical';
  sparkData: number[];
}

export const DEMO_LAB_RESULTS: DemoLabResult[] = [
  { id: 'LR-1', testAr: 'الهيموغلوبين', testEn: 'Hemoglobin', value: '14.2', unit: 'g/dL', refRange: '12-17', status: 'normal', sparkData: [13.8, 14.0, 13.5, 14.1, 14.2] },
  { id: 'LR-2', testAr: 'كريات الدم البيضاء', testEn: 'WBC', value: '11.8', unit: 'x10³/µL', refRange: '4.5-11', status: 'high', sparkData: [8.2, 9.1, 10.5, 11.2, 11.8] },
  { id: 'LR-3', testAr: 'الصفائح الدموية', testEn: 'Platelets', value: '245', unit: 'x10³/µL', refRange: '150-400', status: 'normal', sparkData: [220, 235, 250, 240, 245] },
  { id: 'LR-4', testAr: 'السكر الصائم', testEn: 'Fasting Glucose', value: '126', unit: 'mg/dL', refRange: '70-100', status: 'high', sparkData: [95, 102, 110, 118, 126] },
  { id: 'LR-5', testAr: 'الكرياتينين', testEn: 'Creatinine', value: '0.9', unit: 'mg/dL', refRange: '0.6-1.2', status: 'normal', sparkData: [0.8, 0.9, 0.85, 0.88, 0.9] },
];

export interface DemoBillingItem {
  id: string;
  descAr: string;
  descEn: string;
  qty: number;
  unitPrice: number;
  total: number;
  categoryAr: string;
  categoryEn: string;
}

export const DEMO_BILLING: DemoBillingItem[] = [
  { id: 'B-1', descAr: 'استشارة طبية', descEn: 'Medical Consultation', qty: 1, unitPrice: 200, total: 200, categoryAr: 'استشارات', categoryEn: 'Consultations' },
  { id: 'B-2', descAr: 'تحليل دم شامل', descEn: 'CBC Test', qty: 1, unitPrice: 80, total: 80, categoryAr: 'مختبر', categoryEn: 'Laboratory' },
  { id: 'B-3', descAr: 'أشعة سينية', descEn: 'X-Ray', qty: 1, unitPrice: 150, total: 150, categoryAr: 'أشعة', categoryEn: 'Radiology' },
  { id: 'B-4', descAr: 'أموكسيسيلين 500mg', descEn: 'Amoxicillin 500mg', qty: 21, unitPrice: 2, total: 42, categoryAr: 'صيدلية', categoryEn: 'Pharmacy' },
  { id: 'B-5', descAr: 'وظائف الكلى', descEn: 'Renal Function Test', qty: 1, unitPrice: 120, total: 120, categoryAr: 'مختبر', categoryEn: 'Laboratory' },
];

export const DEMO_PATIENT_DETAIL = {
  nameAr: 'محمد أحمد الشمري',
  nameEn: 'Mohammed A. Al-Shamri',
  mrn: 'MRN-001',
  age: 34,
  gender: 'M' as const,
  dobAr: '1991/05/15',
  dobEn: '1991/05/15',
  phoneAr: '٠٥٥١٢٣٤٥٦٧',
  phoneEn: '0551234567',
  bloodType: 'A+',
  allergies: [
    { ar: 'بنسلين', en: 'Penicillin' },
  ],
  vitals: {
    bp: '128/82',
    hr: 78,
    temp: 36.8,
    spo2: 98,
    rr: 16,
    weight: 82,
    height: 175,
  },
  diagnosesAr: ['ارتفاع ضغط الدم', 'داء السكري النوع الثاني'],
  diagnosesEn: ['Hypertension', 'Type 2 Diabetes Mellitus'],
};

/* ──────────────────────── ER ──────────────────────── */

export interface DemoERPatient {
  id: string;
  nameAr: string;
  nameEn: string;
  mrn: string;
  age: number;
  gender: 'M' | 'F';
  triageLevel: 1 | 2 | 3 | 4 | 5;
  chiefComplaintAr: string;
  chiefComplaintEn: string;
  statusAr: string;
  statusEn: string;
  statusColor: string;
  arrivalTime: string;
  bedId: string;
}

export const DEMO_ER_PATIENTS: DemoERPatient[] = [
  { id: 'ER-1', nameAr: 'عبدالله المطيري', nameEn: 'Abdullah Al-Mutairi', mrn: 'MRN-101', age: 45, gender: 'M', triageLevel: 2, chiefComplaintAr: 'ألم شديد في الصدر', chiefComplaintEn: 'Severe chest pain', statusAr: 'في الكشف', statusEn: 'In Exam', statusColor: '#1D4ED8', arrivalTime: '08:15', bedId: 'ER-B1' },
  { id: 'ER-2', nameAr: 'مريم الحربي', nameEn: 'Maryam Al-Harbi', mrn: 'MRN-102', age: 32, gender: 'F', triageLevel: 3, chiefComplaintAr: 'صعوبة في التنفس', chiefComplaintEn: 'Difficulty breathing', statusAr: 'بانتظار النتائج', statusEn: 'Awaiting Results', statusColor: '#D97706', arrivalTime: '09:30', bedId: 'ER-B3' },
  { id: 'ER-3', nameAr: 'سلطان العنزي', nameEn: 'Sultan Al-Enezi', mrn: 'MRN-103', age: 28, gender: 'M', triageLevel: 4, chiefComplaintAr: 'جرح في اليد', chiefComplaintEn: 'Hand laceration', statusAr: 'في الفرز', statusEn: 'In Triage', statusColor: '#059669', arrivalTime: '10:05', bedId: 'ER-B5' },
  { id: 'ER-4', nameAr: 'هدى الزهراني', nameEn: 'Huda Al-Zahrani', mrn: 'MRN-104', age: 67, gender: 'F', triageLevel: 1, chiefComplaintAr: 'فقدان وعي', chiefComplaintEn: 'Loss of consciousness', statusAr: 'إنعاش', statusEn: 'Resuscitation', statusColor: '#DC2626', arrivalTime: '10:22', bedId: 'ER-R1' },
  { id: 'ER-5', nameAr: 'فيصل القحطاني', nameEn: 'Faisal Al-Qahtani', mrn: 'MRN-105', age: 12, gender: 'M', triageLevel: 3, chiefComplaintAr: 'حمّى وقيء', chiefComplaintEn: 'Fever and vomiting', statusAr: 'بانتظار السرير', statusEn: 'Waiting for Bed', statusColor: '#D97706', arrivalTime: '10:40', bedId: '—' },
];

export const DEMO_ER_METRICS = {
  totalToday: 18,
  waitingTriage: 3,
  inTreatment: 8,
  pendingAdmit: 2,
  discharged: 5,
  avgDoorToDoc: 14,
  bedUtilization: 78,
  criticalAlerts: 1,
};

/* ──────────────────────── IPD ──────────────────────── */

export interface DemoIPDEpisode {
  id: string;
  nameAr: string;
  nameEn: string;
  mrn: string;
  age: number;
  gender: 'M' | 'F';
  wardAr: string;
  wardEn: string;
  bed: string;
  admitDate: string;
  diagnosisAr: string;
  diagnosisEn: string;
  attendingAr: string;
  attendingEn: string;
  statusAr: string;
  statusEn: string;
  statusColor: string;
}

export const DEMO_IPD_EPISODES: DemoIPDEpisode[] = [
  { id: 'IPD-1', nameAr: 'خالد الشهري', nameEn: 'Khalid Al-Shahri', mrn: 'MRN-201', age: 58, gender: 'M', wardAr: 'الباطنية', wardEn: 'Medical Ward', bed: '3A-12', admitDate: '2026-03-06', diagnosisAr: 'التهاب رئوي', diagnosisEn: 'Pneumonia', attendingAr: 'د. سعد المالكي', attendingEn: 'Dr. Saad Al-Malki', statusAr: 'نشط', statusEn: 'Active', statusColor: '#059669' },
  { id: 'IPD-2', nameAr: 'منى السبيعي', nameEn: 'Mona Al-Subaie', mrn: 'MRN-202', age: 42, gender: 'F', wardAr: 'الجراحة', wardEn: 'Surgical Ward', bed: '4B-05', admitDate: '2026-03-07', diagnosisAr: 'استئصال المرارة', diagnosisEn: 'Cholecystectomy', attendingAr: 'د. أحمد الحربي', attendingEn: 'Dr. Ahmed Al-Harbi', statusAr: 'ما بعد العملية', statusEn: 'Post-Op', statusColor: '#D97706' },
  { id: 'IPD-3', nameAr: 'عادل الغامدي', nameEn: 'Adel Al-Ghamdi', mrn: 'MRN-203', age: 71, gender: 'M', wardAr: 'العناية المركزة', wardEn: 'ICU', bed: 'ICU-02', admitDate: '2026-03-05', diagnosisAr: 'احتشاء عضلة القلب', diagnosisEn: 'Myocardial Infarction', attendingAr: 'د. خالد العتيبي', attendingEn: 'Dr. Khalid Al-Otaibi', statusAr: 'حرج', statusEn: 'Critical', statusColor: '#DC2626' },
  { id: 'IPD-4', nameAr: 'ريم الدوسري', nameEn: 'Reem Al-Dosari', mrn: 'MRN-204', age: 29, gender: 'F', wardAr: 'النساء والولادة', wardEn: 'Maternity', bed: '5A-03', admitDate: '2026-03-08', diagnosisAr: 'ولادة طبيعية', diagnosisEn: 'Normal Delivery', attendingAr: 'د. نورة الفيصل', attendingEn: 'Dr. Noura Al-Faisal', statusAr: 'خطة خروج', statusEn: 'Discharge Plan', statusColor: '#2563EB' },
];

export const DEMO_IPD_METRICS = {
  totalAdmitted: 48,
  bedsOccupied: 42,
  totalBeds: 56,
  dischargeToday: 5,
  pendingAdmit: 3,
  avgLOS: 4.2,
};

/* ──────────────────────── Pharmacy ──────────────────────── */

export interface DemoPrescription {
  id: string;
  patientAr: string;
  patientEn: string;
  mrn: string;
  medicationAr: string;
  medicationEn: string;
  dose: string;
  frequencyAr: string;
  frequencyEn: string;
  route: string;
  qty: number;
  statusAr: string;
  statusEn: string;
  statusColor: string;
}

export const DEMO_PRESCRIPTIONS: DemoPrescription[] = [
  { id: 'RX-001', patientAr: 'محمد الشمري', patientEn: 'Mohammed Al-Shamri', mrn: 'MRN-001', medicationAr: 'أموكسيسيلين', medicationEn: 'Amoxicillin', dose: '500mg', frequencyAr: 'كل 8 ساعات', frequencyEn: 'Every 8 hours', route: 'PO', qty: 21, statusAr: 'تم الصرف', statusEn: 'Dispensed', statusColor: '#059669' },
  { id: 'RX-002', patientAr: 'فاطمة عبدالله', patientEn: 'Fatima Abdullah', mrn: 'MRN-002', medicationAr: 'ميتفورمين', medicationEn: 'Metformin', dose: '850mg', frequencyAr: 'مرتين يومياً', frequencyEn: 'Twice daily', route: 'PO', qty: 60, statusAr: 'جاهز للصرف', statusEn: 'Ready to Dispense', statusColor: '#D97706' },
  { id: 'RX-003', patientAr: 'سارة القحطاني', patientEn: 'Sara Al-Qahtani', mrn: 'MRN-004', medicationAr: 'كيتورولاك', medicationEn: 'Ketorolac', dose: '30mg', frequencyAr: 'كل 6 ساعات', frequencyEn: 'Every 6 hours', route: 'IV', qty: 4, statusAr: 'قيد المراجعة', statusEn: 'Under Review', statusColor: '#7C3AED' },
  { id: 'RX-004', patientAr: 'عبدالرحمن السعيد', patientEn: 'Abdulrahman Al-Saeed', mrn: 'MRN-003', medicationAr: 'أملوديبين', medicationEn: 'Amlodipine', dose: '5mg', frequencyAr: 'مرة يومياً', frequencyEn: 'Once daily', route: 'PO', qty: 30, statusAr: 'تم الصرف', statusEn: 'Dispensed', statusColor: '#059669' },
  { id: 'RX-005', patientAr: 'خالد الشهري', patientEn: 'Khalid Al-Shahri', mrn: 'MRN-201', medicationAr: 'سيفترياكسون', medicationEn: 'Ceftriaxone', dose: '1g', frequencyAr: 'كل 12 ساعة', frequencyEn: 'Every 12 hours', route: 'IV', qty: 14, statusAr: 'قيد التحضير', statusEn: 'Preparing', statusColor: '#1D4ED8' },
];

export const DEMO_PHARMACY_METRICS = {
  pendingOrders: 12,
  dispensedToday: 67,
  underReview: 4,
  lowStockAlerts: 3,
};

/* ──────────────────────── Radiology ──────────────────────── */

export interface DemoRadStudy {
  id: string;
  patientAr: string;
  patientEn: string;
  mrn: string;
  modalityAr: string;
  modalityEn: string;
  bodyPartAr: string;
  bodyPartEn: string;
  priorityAr: string;
  priorityEn: string;
  priorityColor: string;
  statusAr: string;
  statusEn: string;
  statusColor: string;
  requestedTime: string;
}

export const DEMO_RAD_STUDIES: DemoRadStudy[] = [
  { id: 'RAD-001', patientAr: 'محمد الشمري', patientEn: 'Mohammed Al-Shamri', mrn: 'MRN-001', modalityAr: 'أشعة سينية', modalityEn: 'X-Ray', bodyPartAr: 'الصدر', bodyPartEn: 'Chest', priorityAr: 'عادي', priorityEn: 'Routine', priorityColor: '#059669', statusAr: 'مكتمل', statusEn: 'Completed', statusColor: '#059669', requestedTime: '08:30' },
  { id: 'RAD-002', patientAr: 'عبدالله المطيري', patientEn: 'Abdullah Al-Mutairi', mrn: 'MRN-101', modalityAr: 'أشعة مقطعية', modalityEn: 'CT Scan', bodyPartAr: 'الصدر', bodyPartEn: 'Chest', priorityAr: 'عاجل', priorityEn: 'Urgent', priorityColor: '#EF4444', statusAr: 'قيد التنفيذ', statusEn: 'In Progress', statusColor: '#1D4ED8', requestedTime: '09:15' },
  { id: 'RAD-003', patientAr: 'نوف العنزي', patientEn: 'Nouf Al-Enezi', mrn: 'MRN-006', modalityAr: 'رنين مغناطيسي', modalityEn: 'MRI', bodyPartAr: 'الركبة', bodyPartEn: 'Knee', priorityAr: 'عادي', priorityEn: 'Routine', priorityColor: '#059669', statusAr: 'مجدول', statusEn: 'Scheduled', statusColor: '#D97706', requestedTime: '11:00' },
  { id: 'RAD-004', patientAr: 'سارة القحطاني', patientEn: 'Sara Al-Qahtani', mrn: 'MRN-004', modalityAr: 'تصوير بالموجات', modalityEn: 'Ultrasound', bodyPartAr: 'البطن', bodyPartEn: 'Abdomen', priorityAr: 'عادي', priorityEn: 'Routine', priorityColor: '#059669', statusAr: 'بانتظار التقرير', statusEn: 'Awaiting Report', statusColor: '#7C3AED', requestedTime: '10:20' },
];

/* ──────────────────────── Scheduling ──────────────────────── */

export interface DemoAppointment {
  id: string;
  patientAr: string;
  patientEn: string;
  doctorAr: string;
  doctorEn: string;
  departmentAr: string;
  departmentEn: string;
  time: string;
  typeAr: string;
  typeEn: string;
  statusAr: string;
  statusEn: string;
  statusColor: string;
}

export const DEMO_APPOINTMENTS: DemoAppointment[] = [
  { id: 'APT-1', patientAr: 'أحمد العتيبي', patientEn: 'Ahmed Al-Otaibi', doctorAr: 'د. خالد العتيبي', doctorEn: 'Dr. Khalid Al-Otaibi', departmentAr: 'أمراض القلب', departmentEn: 'Cardiology', time: '09:00', typeAr: 'مراجعة', typeEn: 'Follow-up', statusAr: 'مؤكد', statusEn: 'Confirmed', statusColor: '#059669' },
  { id: 'APT-2', patientAr: 'لمى السالم', patientEn: 'Lama Al-Salem', doctorAr: 'د. نورة الفيصل', doctorEn: 'Dr. Noura Al-Faisal', departmentAr: 'النساء والولادة', departmentEn: 'OB/GYN', time: '09:30', typeAr: 'جديد', typeEn: 'New', statusAr: 'مؤكد', statusEn: 'Confirmed', statusColor: '#059669' },
  { id: 'APT-3', patientAr: 'عمر الحربي', patientEn: 'Omar Al-Harbi', doctorAr: 'د. سعد المالكي', doctorEn: 'Dr. Saad Al-Malki', departmentAr: 'الباطنية', departmentEn: 'Internal Medicine', time: '10:00', typeAr: 'مراجعة', typeEn: 'Follow-up', statusAr: 'وصل', statusEn: 'Arrived', statusColor: '#1D4ED8' },
  { id: 'APT-4', patientAr: 'نورة البكر', patientEn: 'Noura Al-Baker', doctorAr: 'د. فهد الدوسري', doctorEn: 'Dr. Fahad Al-Dosari', departmentAr: 'العظام', departmentEn: 'Orthopedics', time: '10:30', typeAr: 'جديد', typeEn: 'New', statusAr: 'بانتظار', statusEn: 'Waiting', statusColor: '#D97706' },
  { id: 'APT-5', patientAr: 'سعود الدوسري', patientEn: 'Saud Al-Dosari', doctorAr: 'د. هند الزهراني', doctorEn: 'Dr. Hind Al-Zahrani', departmentAr: 'الأطفال', departmentEn: 'Pediatrics', time: '11:00', typeAr: 'طارئ', typeEn: 'Urgent', statusAr: 'لم يحضر', statusEn: 'No Show', statusColor: '#EF4444' },
  { id: 'APT-6', patientAr: 'هيا المالكي', patientEn: 'Haya Al-Malki', doctorAr: 'د. خالد العتيبي', doctorEn: 'Dr. Khalid Al-Otaibi', departmentAr: 'أمراض القلب', departmentEn: 'Cardiology', time: '11:30', typeAr: 'مراجعة', typeEn: 'Follow-up', statusAr: 'مؤكد', statusEn: 'Confirmed', statusColor: '#059669' },
];

export const DEMO_SCHEDULING_METRICS = {
  totalToday: 32,
  confirmed: 24,
  arrived: 5,
  noShow: 3,
  utilization: 82,
};

/* ──────────────────────── Nursing ──────────────────────── */

export interface DemoNursingTask {
  id: string;
  patientAr: string;
  patientEn: string;
  bed: string;
  taskAr: string;
  taskEn: string;
  dueTime: string;
  priorityAr: string;
  priorityEn: string;
  priorityColor: string;
  statusAr: string;
  statusEn: string;
  statusColor: string;
}

export const DEMO_NURSING_TASKS: DemoNursingTask[] = [
  { id: 'NT-1', patientAr: 'خالد الشهري', patientEn: 'Khalid Al-Shahri', bed: '3A-12', taskAr: 'قياس العلامات الحيوية', taskEn: 'Vital Signs Check', dueTime: '10:00', priorityAr: 'عادي', priorityEn: 'Routine', priorityColor: '#059669', statusAr: 'مكتمل', statusEn: 'Done', statusColor: '#059669' },
  { id: 'NT-2', patientAr: 'عادل الغامدي', patientEn: 'Adel Al-Ghamdi', bed: 'ICU-02', taskAr: 'إعطاء دواء وريدي', taskEn: 'IV Medication Admin', dueTime: '10:30', priorityAr: 'عاجل', priorityEn: 'Urgent', priorityColor: '#EF4444', statusAr: 'قيد التنفيذ', statusEn: 'In Progress', statusColor: '#1D4ED8' },
  { id: 'NT-3', patientAr: 'منى السبيعي', patientEn: 'Mona Al-Subaie', bed: '4B-05', taskAr: 'تغيير الضماد', taskEn: 'Wound Dressing Change', dueTime: '11:00', priorityAr: 'عادي', priorityEn: 'Routine', priorityColor: '#059669', statusAr: 'معلق', statusEn: 'Pending', statusColor: '#D97706' },
  { id: 'NT-4', patientAr: 'ريم الدوسري', patientEn: 'Reem Al-Dosari', bed: '5A-03', taskAr: 'تقييم ما بعد الولادة', taskEn: 'Postpartum Assessment', dueTime: '11:30', priorityAr: 'عادي', priorityEn: 'Routine', priorityColor: '#059669', statusAr: 'معلق', statusEn: 'Pending', statusColor: '#D97706' },
  { id: 'NT-5', patientAr: 'عادل الغامدي', patientEn: 'Adel Al-Ghamdi', bed: 'ICU-02', taskAr: 'تقييم مستوى الألم', taskEn: 'Pain Assessment', dueTime: '12:00', priorityAr: 'عاجل', priorityEn: 'Urgent', priorityColor: '#EF4444', statusAr: 'معلق', statusEn: 'Pending', statusColor: '#D97706' },
];

/* ──────────────────────── OR (Operating Room) ──────────────────────── */

export interface DemoORCase {
  id: string;
  patientAr: string;
  patientEn: string;
  mrn: string;
  procedureAr: string;
  procedureEn: string;
  surgeonAr: string;
  surgeonEn: string;
  room: string;
  scheduledTime: string;
  durationMin: number;
  statusAr: string;
  statusEn: string;
  statusColor: string;
}

export const DEMO_OR_CASES: DemoORCase[] = [
  { id: 'OR-1', patientAr: 'منى السبيعي', patientEn: 'Mona Al-Subaie', mrn: 'MRN-202', procedureAr: 'استئصال المرارة بالمنظار', procedureEn: 'Laparoscopic Cholecystectomy', surgeonAr: 'د. أحمد الحربي', surgeonEn: 'Dr. Ahmed Al-Harbi', room: 'OR-1', scheduledTime: '07:30', durationMin: 90, statusAr: 'مكتمل', statusEn: 'Completed', statusColor: '#059669' },
  { id: 'OR-2', patientAr: 'سلطان المطيري', patientEn: 'Sultan Al-Mutairi', mrn: 'MRN-301', procedureAr: 'تثبيت كسر الفخذ', procedureEn: 'Femur Fracture Fixation', surgeonAr: 'د. فهد الدوسري', surgeonEn: 'Dr. Fahad Al-Dosari', room: 'OR-2', scheduledTime: '09:00', durationMin: 120, statusAr: 'قيد التنفيذ', statusEn: 'In Progress', statusColor: '#1D4ED8' },
  { id: 'OR-3', patientAr: 'نايف السالم', patientEn: 'Nayef Al-Salem', mrn: 'MRN-302', procedureAr: 'إصلاح فتق إربي', procedureEn: 'Inguinal Hernia Repair', surgeonAr: 'د. أحمد الحربي', surgeonEn: 'Dr. Ahmed Al-Harbi', room: 'OR-1', scheduledTime: '11:00', durationMin: 60, statusAr: 'مجدول', statusEn: 'Scheduled', statusColor: '#D97706' },
  { id: 'OR-4', patientAr: 'لمى الحربي', patientEn: 'Lama Al-Harbi', mrn: 'MRN-303', procedureAr: 'عملية قيصرية', procedureEn: 'Cesarean Section', surgeonAr: 'د. نورة الفيصل', surgeonEn: 'Dr. Noura Al-Faisal', room: 'OR-3', scheduledTime: '13:00', durationMin: 75, statusAr: 'مجدول', statusEn: 'Scheduled', statusColor: '#D97706' },
];

/* ──────────────────────── Dental ──────────────────────── */

export interface DemoDentalPatient {
  id: string;
  nameAr: string;
  nameEn: string;
  mrn: string;
  age: number;
  procedureAr: string;
  procedureEn: string;
  toothNumbers: string;
  dentistAr: string;
  dentistEn: string;
  statusAr: string;
  statusEn: string;
  statusColor: string;
}

export const DEMO_DENTAL_PATIENTS: DemoDentalPatient[] = [
  { id: 'DN-1', nameAr: 'بدر السهلي', nameEn: 'Badr Al-Sahli', mrn: 'MRN-401', age: 35, procedureAr: 'حشوة مركبة', procedureEn: 'Composite Filling', toothNumbers: '#14, #15', dentistAr: 'د. سلمان العمري', dentistEn: 'Dr. Salman Al-Amri', statusAr: 'في العلاج', statusEn: 'In Treatment', statusColor: '#1D4ED8' },
  { id: 'DN-2', nameAr: 'عبير العتيبي', nameEn: 'Abeer Al-Otaibi', mrn: 'MRN-402', age: 28, procedureAr: 'تنظيف وتلميع', procedureEn: 'Scaling & Polishing', toothNumbers: 'Full', dentistAr: 'د. مها الخالدي', dentistEn: 'Dr. Maha Al-Khalidi', statusAr: 'مكتمل', statusEn: 'Completed', statusColor: '#059669' },
  { id: 'DN-3', nameAr: 'تركي الشمري', nameEn: 'Turki Al-Shamri', mrn: 'MRN-403', age: 50, procedureAr: 'خلع ضرس العقل', procedureEn: 'Wisdom Tooth Extraction', toothNumbers: '#48', dentistAr: 'د. سلمان العمري', dentistEn: 'Dr. Salman Al-Amri', statusAr: 'بانتظار', statusEn: 'Waiting', statusColor: '#D97706' },
  { id: 'DN-4', nameAr: 'دلال الراشد', nameEn: 'Dalal Al-Rashid', mrn: 'MRN-404', age: 22, procedureAr: 'تركيب تقويم', procedureEn: 'Orthodontic Fitting', toothNumbers: 'Full Arch', dentistAr: 'د. مها الخالدي', dentistEn: 'Dr. Maha Al-Khalidi', statusAr: 'مجدول', statusEn: 'Scheduled', statusColor: '#7C3AED' },
];

/* ──────────────────────── OB/GYN ──────────────────────── */

export interface DemoObgynPatient {
  id: string;
  nameAr: string;
  nameEn: string;
  mrn: string;
  age: number;
  gestationalWeeks: number | null;
  typeAr: string;
  typeEn: string;
  doctorAr: string;
  doctorEn: string;
  statusAr: string;
  statusEn: string;
  statusColor: string;
  riskLevel: 'low' | 'moderate' | 'high';
}

export const DEMO_OBGYN_PATIENTS: DemoObgynPatient[] = [
  { id: 'OB-1', nameAr: 'ريم الدوسري', nameEn: 'Reem Al-Dosari', mrn: 'MRN-204', age: 29, gestationalWeeks: 38, typeAr: 'متابعة حمل', typeEn: 'Antenatal', doctorAr: 'د. نورة الفيصل', doctorEn: 'Dr. Noura Al-Faisal', statusAr: 'في الولادة', statusEn: 'In Labor', statusColor: '#DC2626', riskLevel: 'low' },
  { id: 'OB-2', nameAr: 'هيفاء العنزي', nameEn: 'Haifa Al-Enezi', mrn: 'MRN-501', age: 34, gestationalWeeks: 28, typeAr: 'متابعة حمل', typeEn: 'Antenatal', doctorAr: 'د. نورة الفيصل', doctorEn: 'Dr. Noura Al-Faisal', statusAr: 'متابعة منتظمة', statusEn: 'Routine Follow-up', statusColor: '#059669', riskLevel: 'moderate' },
  { id: 'OB-3', nameAr: 'جواهر القحطاني', nameEn: 'Jawaher Al-Qahtani', mrn: 'MRN-502', age: 26, gestationalWeeks: null, typeAr: 'نسائية', typeEn: 'Gynecology', doctorAr: 'د. سارة المحمد', doctorEn: 'Dr. Sara Al-Mohammed', statusAr: 'بانتظار الفحص', statusEn: 'Awaiting Exam', statusColor: '#D97706', riskLevel: 'low' },
  { id: 'OB-4', nameAr: 'لمى السالم', nameEn: 'Lama Al-Salem', mrn: 'MRN-503', age: 31, gestationalWeeks: 12, typeAr: 'متابعة حمل', typeEn: 'Antenatal', doctorAr: 'د. نورة الفيصل', doctorEn: 'Dr. Noura Al-Faisal', statusAr: 'حمل عالي الخطورة', statusEn: 'High-Risk Pregnancy', statusColor: '#EF4444', riskLevel: 'high' },
];

/* ──────────────────────── Quality ──────────────────────── */

export interface DemoIncident {
  id: string;
  titleAr: string;
  titleEn: string;
  categoryAr: string;
  categoryEn: string;
  severityAr: string;
  severityEn: string;
  severityColor: string;
  reportedDate: string;
  departmentAr: string;
  departmentEn: string;
  statusAr: string;
  statusEn: string;
  statusColor: string;
}

export const DEMO_INCIDENTS: DemoIncident[] = [
  { id: 'INC-001', titleAr: 'خطأ في صرف الدواء', titleEn: 'Medication Dispensing Error', categoryAr: 'سلامة الأدوية', categoryEn: 'Medication Safety', severityAr: 'متوسط', severityEn: 'Moderate', severityColor: '#D97706', reportedDate: '2026-03-08', departmentAr: 'الصيدلية', departmentEn: 'Pharmacy', statusAr: 'قيد التحقيق', statusEn: 'Investigating', statusColor: '#1D4ED8' },
  { id: 'INC-002', titleAr: 'سقوط مريض', titleEn: 'Patient Fall', categoryAr: 'سلامة المريض', categoryEn: 'Patient Safety', severityAr: 'خطير', severityEn: 'Serious', severityColor: '#DC2626', reportedDate: '2026-03-07', departmentAr: 'التنويم', departmentEn: 'Inpatient Ward', statusAr: 'تحليل السبب الجذري', statusEn: 'Root Cause Analysis', statusColor: '#7C3AED' },
  { id: 'INC-003', titleAr: 'تأخير نتائج المختبر', titleEn: 'Lab Results Delay', categoryAr: 'جودة الخدمة', categoryEn: 'Service Quality', severityAr: 'بسيط', severityEn: 'Minor', severityColor: '#059669', reportedDate: '2026-03-06', departmentAr: 'المختبر', departmentEn: 'Laboratory', statusAr: 'مغلق', statusEn: 'Closed', statusColor: '#94A3B8' },
  { id: 'INC-004', titleAr: 'عدم تطابق هوية المريض', titleEn: 'Patient ID Mismatch', categoryAr: 'التعريف', categoryEn: 'Identification', severityAr: 'متوسط', severityEn: 'Moderate', severityColor: '#D97706', reportedDate: '2026-03-09', departmentAr: 'الطوارئ', departmentEn: 'Emergency', statusAr: 'جديد', statusEn: 'New', statusColor: '#EF4444' },
];

export const DEMO_QUALITY_KPIS = {
  totalIncidents: 23,
  openIncidents: 8,
  avgResolutionDays: 5.2,
  patientSatisfaction: 92,
  handhygieneCompliance: 95,
  readmissionRate: 3.1,
};

/* ──────────────────────── Registration ──────────────────────── */

export const DEMO_REGISTRATION_STATS = {
  registeredToday: 34,
  newPatients: 12,
  returningPatients: 22,
  pendingInsurance: 5,
  avgRegistrationTime: 4.5,
};

/* ──────────────────────── SAM (Policy Management) ──────────────────────── */

export interface DemoPolicy {
  id: string;
  titleAr: string;
  titleEn: string;
  categoryAr: string;
  categoryEn: string;
  versionAr: string;
  versionEn: string;
  statusAr: string;
  statusEn: string;
  statusColor: string;
  lastReview: string;
  nextReview: string;
}

export const DEMO_POLICIES: DemoPolicy[] = [
  { id: 'POL-001', titleAr: 'سياسة مكافحة العدوى', titleEn: 'Infection Control Policy', categoryAr: 'سلامة المريض', categoryEn: 'Patient Safety', versionAr: 'الإصدار 3.2', versionEn: 'v3.2', statusAr: 'نشط', statusEn: 'Active', statusColor: '#059669', lastReview: '2026-01-15', nextReview: '2026-07-15' },
  { id: 'POL-002', titleAr: 'سياسة صرف الأدوية', titleEn: 'Medication Dispensing Policy', categoryAr: 'الصيدلة', categoryEn: 'Pharmacy', versionAr: 'الإصدار 2.1', versionEn: 'v2.1', statusAr: 'قيد المراجعة', statusEn: 'Under Review', statusColor: '#D97706', lastReview: '2025-11-20', nextReview: '2026-05-20' },
  { id: 'POL-003', titleAr: 'سياسة الموافقة المستنيرة', titleEn: 'Informed Consent Policy', categoryAr: 'حقوق المريض', categoryEn: 'Patient Rights', versionAr: 'الإصدار 4.0', versionEn: 'v4.0', statusAr: 'نشط', statusEn: 'Active', statusColor: '#059669', lastReview: '2026-02-01', nextReview: '2026-08-01' },
  { id: 'POL-004', titleAr: 'سياسة التوثيق الطبي', titleEn: 'Medical Documentation Policy', categoryAr: 'التوثيق', categoryEn: 'Documentation', versionAr: 'الإصدار 1.5', versionEn: 'v1.5', statusAr: 'مسودة', statusEn: 'Draft', statusColor: '#7C3AED', lastReview: '2026-03-01', nextReview: '2026-09-01' },
  { id: 'POL-005', titleAr: 'بروتوكول الكود الأزرق', titleEn: 'Code Blue Protocol', categoryAr: 'حالات الطوارئ', categoryEn: 'Emergency', versionAr: 'الإصدار 5.0', versionEn: 'v5.0', statusAr: 'نشط', statusEn: 'Active', statusColor: '#059669', lastReview: '2026-01-10', nextReview: '2026-04-10' },
];
