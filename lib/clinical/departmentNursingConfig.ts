/**
 * Department-specific Nursing Configuration
 * Configures which nursing tools are visible and their defaults per department.
 * OPD, IPD, ER, ICU each have different nursing priorities and workflows.
 */

export type DepartmentType = 'OPD' | 'IPD' | 'ER' | 'ICU';

export interface NursingModuleConfig {
  vitals: boolean;
  painAssessment: boolean;
  intakeOutput: boolean;
  mews: boolean;
  fallRisk: boolean;
  braden: boolean;
  gcs: boolean;
  sbar: boolean;
  familyComm: boolean;
  procedures: boolean;
  carePlan: boolean;
  shiftHandover: boolean;
  taskTimeline: boolean;
  deterioration: boolean;
  sepsis: boolean;
  mar: boolean;
  vitalsTrend: boolean;
  visitHistory: boolean;
  workloadDashboard: boolean;
  // Department-specific
  ventilatorMonitor: boolean;    // ICU
  hemodynamicMonitor: boolean;   // ICU
  triageIntegration: boolean;    // ER
  bedManagement: boolean;        // IPD, ICU
  dischargeChecklist: boolean;   // IPD
  rapidAssessment: boolean;      // ER
}

export interface DepartmentNursingProfile {
  type: DepartmentType;
  labelAr: string;
  labelEn: string;
  icon: string;
  color: string;
  defaultVitalsInterval: string; // e.g., "Q4H", "Q1H", "Q15MIN"
  defaultAssessmentInterval: string;
  modules: NursingModuleConfig;
  quickActions: { id: string; labelAr: string; labelEn: string; icon: string }[];
}

export const DEPARTMENT_PROFILES: Record<DepartmentType, DepartmentNursingProfile> = {
  OPD: {
    type: 'OPD',
    labelAr: 'العيادات الخارجية',
    labelEn: 'Outpatient (OPD)',
    icon: 'hospital',
    color: 'blue',
    defaultVitalsInterval: 'ONCE',
    defaultAssessmentInterval: 'ONCE',
    modules: {
      vitals: true, painAssessment: true, intakeOutput: false, mews: true,
      fallRisk: true, braden: false, gcs: true, sbar: true, familyComm: true,
      procedures: true, carePlan: true, shiftHandover: false, taskTimeline: true,
      deterioration: true, sepsis: true, mar: true, vitalsTrend: true,
      visitHistory: true, workloadDashboard: true,
      ventilatorMonitor: false, hemodynamicMonitor: false, triageIntegration: false,
      bedManagement: false, dischargeChecklist: false, rapidAssessment: false,
    },
    quickActions: [
      { id: 'vitals', labelAr: 'علامات حيوية', labelEn: 'Take Vitals', icon: 'heart' },
      { id: 'pain', labelAr: 'تقييم ألم', labelEn: 'Pain Assessment', icon: 'activity' },
      { id: 'education', labelAr: 'تثقيف', labelEn: 'Education', icon: 'book-open' },
    ],
  },
  IPD: {
    type: 'IPD',
    labelAr: 'التنويم',
    labelEn: 'Inpatient (IPD)',
    icon: 'bed',
    color: 'purple',
    defaultVitalsInterval: 'Q4H',
    defaultAssessmentInterval: 'Q8H',
    modules: {
      vitals: true, painAssessment: true, intakeOutput: true, mews: true,
      fallRisk: true, braden: true, gcs: true, sbar: true, familyComm: true,
      procedures: true, carePlan: true, shiftHandover: true, taskTimeline: true,
      deterioration: true, sepsis: true, mar: true, vitalsTrend: true,
      visitHistory: true, workloadDashboard: true,
      ventilatorMonitor: false, hemodynamicMonitor: false, triageIntegration: false,
      bedManagement: true, dischargeChecklist: true, rapidAssessment: false,
    },
    quickActions: [
      { id: 'vitals', labelAr: 'علامات حيوية', labelEn: 'Vitals Round', icon: 'heart' },
      { id: 'io', labelAr: 'ميزان سوائل', labelEn: 'I&O Entry', icon: 'droplets' },
      { id: 'med', labelAr: 'إعطاء دواء', labelEn: 'Give Medication', icon: 'pill' },
      { id: 'turn', labelAr: 'تغيير وضعية', labelEn: 'Turn Patient', icon: 'refresh-ccw' },
      { id: 'handover', labelAr: 'تسليم وردية', labelEn: 'Shift Handover', icon: 'clipboard' },
    ],
  },
  ER: {
    type: 'ER',
    labelAr: 'الطوارئ',
    labelEn: 'Emergency (ER)',
    icon: 'siren',
    color: 'red',
    defaultVitalsInterval: 'Q1H',
    defaultAssessmentInterval: 'Q2H',
    modules: {
      vitals: true, painAssessment: true, intakeOutput: true, mews: true,
      fallRisk: true, braden: false, gcs: true, sbar: true, familyComm: true,
      procedures: true, carePlan: false, shiftHandover: true, taskTimeline: true,
      deterioration: true, sepsis: true, mar: true, vitalsTrend: true,
      visitHistory: true, workloadDashboard: true,
      ventilatorMonitor: false, hemodynamicMonitor: false, triageIntegration: true,
      bedManagement: true, dischargeChecklist: false, rapidAssessment: true,
    },
    quickActions: [
      { id: 'vitals', labelAr: 'علامات حيوية', labelEn: 'Quick Vitals', icon: 'heart' },
      { id: 'pain', labelAr: 'تقييم ألم', labelEn: 'Pain Score', icon: 'activity' },
      { id: 'sepsis', labelAr: 'فحص إنتان', labelEn: 'Sepsis Screen', icon: 'bug' },
      { id: 'sbar', labelAr: 'تصعيد SBAR', labelEn: 'SBAR Escalation', icon: 'phone' },
      { id: 'med', labelAr: 'دواء طوارئ', labelEn: 'STAT Med', icon: 'syringe' },
    ],
  },
  ICU: {
    type: 'ICU',
    labelAr: 'العناية المركزة',
    labelEn: 'Intensive Care (ICU)',
    icon: 'heart-pulse',
    color: 'rose',
    defaultVitalsInterval: 'Q15MIN',
    defaultAssessmentInterval: 'Q1H',
    modules: {
      vitals: true, painAssessment: true, intakeOutput: true, mews: true,
      fallRisk: true, braden: true, gcs: true, sbar: true, familyComm: true,
      procedures: true, carePlan: true, shiftHandover: true, taskTimeline: true,
      deterioration: true, sepsis: true, mar: true, vitalsTrend: true,
      visitHistory: true, workloadDashboard: true,
      ventilatorMonitor: true, hemodynamicMonitor: true, triageIntegration: false,
      bedManagement: true, dischargeChecklist: false, rapidAssessment: false,
    },
    quickActions: [
      { id: 'vitals', labelAr: 'علامات حيوية', labelEn: 'Vitals Check', icon: 'heart' },
      { id: 'io', labelAr: 'ميزان سوائل', labelEn: 'Hourly I&O', icon: 'droplets' },
      { id: 'gcs', labelAr: 'تقييم GCS', labelEn: 'GCS Check', icon: 'brain' },
      { id: 'vent', labelAr: 'إعدادات التنفس', labelEn: 'Vent Settings', icon: 'wind' },
      { id: 'med', labelAr: 'تسريب', labelEn: 'Infusion', icon: 'syringe' },
      { id: 'turn', labelAr: 'تغيير وضعية', labelEn: 'Reposition', icon: 'refresh-ccw' },
    ],
  },
};

export function getModulesForDepartment(dept: DepartmentType): NursingModuleConfig {
  return DEPARTMENT_PROFILES[dept].modules;
}
