export type ModuleKey =
  | 'opd' | 'er' | 'ipd' | 'icu' | 'or' | 'obgyn'
  | 'radiology' | 'dental' | 'lab' | 'pharmacy'
  | 'billing' | 'scheduling' | 'portal'
  | 'cross' | 'resilience' | 'notifications'
  | 'cvision';

export interface TenantConfig {
  tenantId: string;
  users: {
    receptionist: { email: string; password: string };
    nurse: { email: string; password: string };
    doctor: { email: string; password: string };
    staff: { email: string; password: string };
    portal: { email: string; password: string };
    cvisionAdmin: { email: string; password: string };
    cvisionHR: { email: string; password: string };
    cvisionHRManager: { email: string; password: string };
    cvisionManager: { email: string; password: string };
    cvisionEmployee: { email: string; password: string };
    cvisionPayroll: { email: string; password: string };
  };
}

export interface SimulationConfig {
  baseUrl: string;
  speed: number;
  concurrency: number;
  duration: number; // minutes, 0 = single pass
  modules: ModuleKey[];
  seed: boolean;
  validateAfterEach: boolean;
  stopOnFailure: boolean;
  reportPath: string;
  tenants: {
    primary: TenantConfig;
    secondary: TenantConfig;
  };
}

const DEFAULT_PASSWORD = process.env.THEA_SIM_PASSWORD || 'password123';

export const DEFAULT_CONFIG: SimulationConfig = {
  baseUrl: process.env.THEA_SIM_URL || 'http://localhost:3000',
  speed: 60,
  concurrency: 3,
  duration: 0,
  modules: [],  // empty = all modules
  seed: true,
  validateAfterEach: true,
  stopOnFailure: false,
  reportPath: 'test-results/simulator-report.md',
  tenants: {
    primary: {
      tenantId: process.env.THEA_SIM_TENANT || 'test-tenant-a',
      users: {
        receptionist: { email: process.env.THEA_SIM_RECEPTIONIST || 'sim-receptionist@test.thea.com', password: DEFAULT_PASSWORD },
        nurse: { email: process.env.THEA_SIM_NURSE || 'sim-nurse@test.thea.com', password: DEFAULT_PASSWORD },
        doctor: { email: process.env.THEA_SIM_DOCTOR || 'sim-doctor@test.thea.com', password: DEFAULT_PASSWORD },
        staff: { email: process.env.THEA_SIM_STAFF || 'sim-staff@test.thea.com', password: DEFAULT_PASSWORD },
        portal: { email: process.env.THEA_SIM_PORTAL || 'sim-portal@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionAdmin: { email: process.env.THEA_SIM_CV_ADMIN || 'sim-cv-admin@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionHR: { email: process.env.THEA_SIM_CV_HR || 'sim-cv-hr@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionHRManager: { email: process.env.THEA_SIM_CV_HR_MGR || 'sim-cv-hr-mgr@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionManager: { email: process.env.THEA_SIM_CV_MGR || 'sim-cv-mgr@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionEmployee: { email: process.env.THEA_SIM_CV_EMP || 'sim-cv-emp@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionPayroll: { email: process.env.THEA_SIM_CV_PAYROLL || 'sim-cv-payroll@test.thea.com', password: DEFAULT_PASSWORD },
      },
    },
    secondary: {
      tenantId: process.env.THEA_SIM_TENANT_B || 'test-tenant-b',
      users: {
        receptionist: { email: 'sim-receptionist-b@test.thea.com', password: DEFAULT_PASSWORD },
        nurse: { email: 'sim-nurse-b@test.thea.com', password: DEFAULT_PASSWORD },
        doctor: { email: 'sim-doctor-b@test.thea.com', password: DEFAULT_PASSWORD },
        staff: { email: 'sim-staff-b@test.thea.com', password: DEFAULT_PASSWORD },
        portal: { email: 'sim-portal-b@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionAdmin: { email: 'sim-cv-admin-b@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionHR: { email: 'sim-cv-hr-b@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionHRManager: { email: 'sim-cv-hr-mgr-b@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionManager: { email: 'sim-cv-mgr-b@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionEmployee: { email: 'sim-cv-emp-b@test.thea.com', password: DEFAULT_PASSWORD },
        cvisionPayroll: { email: 'sim-cv-payroll-b@test.thea.com', password: DEFAULT_PASSWORD },
      },
    },
  },
};

export interface ConfigProfile {
  speed: number;
  concurrency: number;
  duration: number;
  modules: ModuleKey[];
  stopOnFailure: boolean;
}

export const PROFILES: Record<string, ConfigProfile> = {
  smoke: {
    speed: 1000,
    concurrency: 1,
    duration: 0,
    modules: ['opd'],
    stopOnFailure: true,
  },
  regression: {
    speed: 100,
    concurrency: 3,
    duration: 0,
    modules: [],  // all
    stopOnFailure: false,
  },
  stress: {
    speed: 1000,
    concurrency: 10,
    duration: 30,
    modules: ['opd', 'er', 'ipd', 'lab', 'pharmacy', 'billing'],
    stopOnFailure: false,
  },
  continuous: {
    speed: 60,
    concurrency: 5,
    duration: 1440,
    modules: [],  // all
    stopOnFailure: false,
  },
};
