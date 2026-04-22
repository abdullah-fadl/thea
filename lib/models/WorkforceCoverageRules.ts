export interface CoverageRule {
  doctorCoverageRatio: number; // e.g., 1 nurse per 2 doctors = 0.5, 1 nurse per doctor = 1
  vsCoverageRatio: number; // e.g., 1 nurse per VS room = 1
  procedureCoverageRatio: number; // e.g., 1 nurse per procedure room = 1
  procedureAssistantRequired: boolean; // Additional assistant for procedures
  leadershipRequired: {
    chargeNurse: number; // Usually 1
    teamLeader: number; // Usually 1
  };
  floatAllowance: {
    type: 'fixed' | 'percentage';
    value: number; // If fixed: number of nurses, if percentage: e.g., 0.1 for 10%
  };
}

export interface WorkforceCoverageRules {
  id: string;
  departmentId: string;
  hospitalId?: string;
  rules: CoverageRule;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
