// Shared types for unified Recruitment page

export interface Candidate {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  status: 'applied' | 'new' | 'screening' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected';
  source: string;
  departmentId?: string;
  departmentName?: string;
  jobTitleId?: string;
  jobTitleName?: string;
  requisitionId?: string;
  employeeId?: string;
  notes?: string;
  screeningScore?: number;
  screenedBy?: string;
  screenedAt?: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
  // Offer fields
  offerAmount?: number;
  offerCurrency?: string;
  offerExtendedAt?: string;
  offer?: {
    id: string;
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    otherAllowances: number;
    totalSalary: number;
    currency: string;
    startDate: string;
    contractType: string;
    probationPeriod: number;
    benefits: string[];
    expiryDate: string;
    notes?: string;
    status: string;
    sentAt?: string;
    candidateResponse?: string | null;
    candidateResponseAt?: string | null;
    candidateResponseNotes?: string | null;
    hrApprovalStatus?: string;
  };
}

export interface Department {
  id: string;
  name: string;
  code?: string;
}

export interface JobTitle {
  id: string;
  name: string;
  departmentId?: string;
}

export interface Requisition {
  id: string;
  tenantId: string;
  requisitionNumber: string;
  title: string;
  departmentId?: string;
  departmentName?: string;
  jobTitleId?: string;
  jobTitleName?: string;
  headcountRequested: number;
  headcountFilled?: number;
  reason?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'open' | 'on_hold' | 'closed' | 'cancelled';
  skills?: string[];
  preferredSkills?: string[];
  requirements?: {
    minExperience?: number;
    education?: string;
  };
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  description?: string;
  location?: string;
  employmentType?: string;
  createdAt: string;
  updatedAt?: string;
  candidateCount?: number;
}

export interface MatchResult {
  jobId: string;
  jobTitle: string;
  department?: string;
  candidateId: string;
  candidateName: string;
  overallScore: number;
  breakdown: {
    skillMatch: number;
    experienceMatch: number;
    educationMatch: number;
    salaryFit: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  missingPreferredSkills?: string[];
  recommendation: 'STRONG_MATCH' | 'GOOD_MATCH' | 'PARTIAL_MATCH' | 'WEAK_MATCH';
  reasoning: string;
  reasoningAr: string;
  strengthPoints?: string[];
  gaps?: string[];
  source?: 'ai' | 'cv_inbox' | 'deterministic';
}

export interface CandidateOption {
  id: string;
  fullName: string;
  email?: string;
  status: string;
  screeningScore?: number;
}

export interface JobOption {
  id: string;
  title: string;
  departmentId: string;
  departmentName?: string;
  requisitionNumber: string;
  status: string;
  headcount: number;
}

// Status configuration — ordered recruitment pipeline
export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  applied: { label: 'New', color: 'bg-blue-100 text-blue-800', icon: 'UserPlus' },
  new: { label: 'New', color: 'bg-blue-100 text-blue-800', icon: 'UserPlus' },
  screening: { label: 'Screening', color: 'bg-purple-100 text-purple-800', icon: 'FileText' },
  shortlisted: { label: 'Shortlisted', color: 'bg-indigo-100 text-indigo-800', icon: 'FileText' },
  interview: { label: 'Interview', color: 'bg-yellow-100 text-yellow-800', icon: 'Clock' },
  offer: { label: 'Offer', color: 'bg-orange-100 text-orange-800', icon: 'ArrowRight' },
  hired: { label: 'Hired', color: 'bg-green-100 text-green-800', icon: 'CheckCircle' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: 'XCircle' },
};

// Pipeline: new → screening → shortlisted → interview → offer → hired
export const STATUS_FLOW = ['applied', 'screening', 'shortlisted', 'interview', 'offer', 'hired'];

export const REQ_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  open: { label: 'Open', color: 'bg-green-100 text-green-800' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-800' },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};
