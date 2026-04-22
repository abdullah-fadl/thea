/**
 * Role-based skill mappings for job titles.
 *
 * Used to:
 * 1. Auto-suggest skills when creating a new requisition
 * 2. Correct mismatched skills on existing requisitions
 * 3. Infer candidate skills from their current title
 *
 * Each entry maps a lowercase title keyword → array of expected skills.
 */

export const ROLE_SKILL_MAP: Record<string, string[]> = {
  // ─── Healthcare / Medical ──────────────────────────────────────────────────
  nurse: [
    'Patient Care', 'Clinical Assessment', 'CPR/BLS Certification',
  ],
  'registered nurse': [
    'Patient Care', 'Clinical Assessment', 'CPR/BLS Certification',
  ],
  'charge nurse': [
    'Patient Care', 'Clinical Leadership', 'Staff Coordination',
    'Medication Administration', 'Clinical Assessment',
    'Emergency Response', 'EHR', 'Quality Improvement',
  ],
  'nurse manager': [
    'Nursing Leadership', 'Staff Management', 'Patient Care Standards',
    'Budget Management', 'Quality Improvement', 'Regulatory Compliance',
    'Training & Development', 'Clinical Assessment',
  ],
  'nursing director': [
    'Nursing Leadership', 'Department Management', 'Strategic Planning',
    'Staff Development', 'Quality Improvement', 'Patient Safety',
    'Budget Management', 'Regulatory Compliance', 'Policy Development',
    'Performance Management',
  ],
  'assistant nursing director': [
    'Nursing Leadership', 'Department Management', 'Staff Scheduling',
    'Quality Improvement', 'Patient Safety', 'Policy Implementation',
    'Staff Development', 'Performance Management', 'Regulatory Compliance',
    'Clinical Operations',
  ],
  'director of nursing': [
    'Nursing Leadership', 'Department Management', 'Strategic Planning',
    'Staff Development', 'Quality Improvement', 'Patient Safety',
    'Budget Management', 'Regulatory Compliance', 'Policy Development',
    'Performance Management',
  ],
  'head nurse': [
    'Nursing Leadership', 'Staff Coordination', 'Patient Care Standards',
    'Quality Improvement', 'Clinical Assessment', 'Emergency Response',
    'Staff Scheduling', 'Training & Mentoring',
  ],
  'staff nurse': [
    'Patient Care', 'Clinical Assessment', 'Medication Administration',
    'Vital Signs Monitoring', 'CPR/BLS Certification',
    'Infection Control', 'Patient Education', 'EHR Documentation',
  ],
  doctor: [
    'Patient Diagnosis', 'Clinical Decision Making', 'Medical Procedures',
    'Patient Management', 'Medical Records', 'Emergency Medicine',
    'Evidence-Based Medicine', 'Patient Communication',
  ],
  physician: [
    'Patient Diagnosis', 'Clinical Decision Making', 'Medical Procedures',
    'Patient Management', 'Medical Records', 'Emergency Medicine',
  ],
  pharmacist: [
    'Pharmaceutical Knowledge', 'Drug Interaction Analysis',
    'Prescription Management', 'Patient Counseling',
    'Inventory Management', 'Regulatory Compliance',
    'Clinical Pharmacy', 'Medication Safety',
  ],
  'lab technician': [
    'Laboratory Testing', 'Sample Collection', 'Quality Control',
    'Lab Equipment Operation', 'Data Recording', 'Safety Protocols',
  ],
  'medical receptionist': [
    'Patient Scheduling', 'Medical Terminology', 'Insurance Verification',
    'EHR Systems', 'Customer Service', 'Communication', 'MS Office',
  ],
  radiologist: [
    'Diagnostic Imaging', 'Image Interpretation', 'Patient Care',
    'Radiation Safety', 'Medical Reporting', 'PACS Systems',
  ],
  therapist: [
    'Patient Assessment', 'Treatment Planning', 'Rehabilitation',
    'Patient Education', 'Documentation', 'Communication',
  ],

  // ─── IT / Software Engineering ─────────────────────────────────────────────
  'software engineer': [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Git',
    'SQL', 'REST APIs', 'Agile/Scrum', 'Problem Solving', 'System Design',
  ],
  'senior software engineer': [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Git',
    'SQL', 'REST APIs', 'System Design', 'Code Review',
    'Technical Leadership', 'AWS', 'Docker',
  ],
  developer: [
    'JavaScript', 'TypeScript', 'React', 'Git', 'SQL',
    'REST APIs', 'HTML/CSS', 'Problem Solving',
  ],
  'frontend developer': [
    'JavaScript', 'TypeScript', 'React', 'HTML/CSS', 'Git',
    'Responsive Design', 'UI/UX Principles', 'Testing',
  ],
  'backend developer': [
    'Node.js', 'Python', 'SQL', 'REST APIs', 'Git',
    'Database Design', 'Docker', 'System Design',
  ],
  'full stack developer': [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL',
    'Git', 'REST APIs', 'Docker', 'HTML/CSS',
  ],
  devops: [
    'Docker', 'Kubernetes', 'CI/CD', 'AWS', 'Linux',
    'Terraform', 'Monitoring', 'Scripting', 'Git',
  ],
  'it manager': [
    'IT Infrastructure', 'Team Management', 'Project Management',
    'Network Administration', 'Cybersecurity', 'Budget Management',
    'Vendor Management', 'Strategic Planning',
  ],
  'it support': [
    'Technical Support', 'Troubleshooting', 'Windows/Mac',
    'Network Basics', 'Active Directory', 'Ticketing Systems',
    'Customer Service', 'Hardware Maintenance',
  ],
  'system administrator': [
    'Linux', 'Windows Server', 'Network Administration',
    'Backup & Recovery', 'Security', 'Scripting',
    'Virtualization', 'Cloud Services',
  ],
  'network engineer': [
    'Network Design', 'Cisco', 'Firewall Management',
    'TCP/IP', 'VPN', 'Network Monitoring', 'Troubleshooting',
  ],
  'cybersecurity': [
    'Information Security', 'Penetration Testing', 'SIEM',
    'Incident Response', 'Network Security', 'Compliance',
    'Risk Assessment', 'Firewall Management',
  ],

  // ─── Data / Analytics ──────────────────────────────────────────────────────
  'data analyst': [
    'SQL', 'Python', 'Excel', 'Data Visualization', 'Tableau',
    'Power BI', 'Statistical Analysis', 'Data Cleaning',
    'Report Writing', 'Business Intelligence',
  ],
  'data scientist': [
    'Python', 'Machine Learning', 'SQL', 'Statistical Analysis',
    'Data Visualization', 'TensorFlow', 'R', 'Deep Learning',
    'Feature Engineering', 'Experiment Design',
  ],
  'data engineer': [
    'SQL', 'Python', 'ETL', 'Data Warehousing', 'Apache Spark',
    'Cloud Platforms', 'Data Modeling', 'Airflow',
  ],
  'business analyst': [
    'Requirements Gathering', 'Data Analysis', 'SQL', 'Excel',
    'Process Mapping', 'Stakeholder Management',
    'Report Writing', 'Agile/Scrum',
  ],
  'business intelligence': [
    'Power BI', 'Tableau', 'SQL', 'Data Modeling',
    'Report Development', 'ETL', 'Excel', 'DAX',
  ],

  // ─── HR / People ───────────────────────────────────────────────────────────
  'hr manager': [
    'HR Management', 'Recruitment', 'Employee Relations',
    'Performance Management', 'Labor Law',
    'Compensation & Benefits', 'Training & Development', 'HRIS Systems',
  ],
  'hr specialist': [
    'HR Administration', 'Recruitment', 'Onboarding',
    'Employee Relations', 'HR Policies',
    'Payroll Coordination', 'Benefits Administration',
  ],
  'hr coordinator': [
    'HR Administration', 'Recruitment Support', 'Onboarding',
    'Employee Records', 'MS Office', 'Communication',
    'Scheduling', 'Data Entry',
  ],
  recruiter: [
    'Talent Acquisition', 'Interviewing', 'Sourcing',
    'ATS Systems', 'Employer Branding', 'Negotiation',
    'Candidate Assessment', 'LinkedIn Recruiting',
  ],
  'training manager': [
    'Training Design', 'Curriculum Development', 'LMS',
    'Facilitation', 'Needs Assessment', 'Performance Analysis',
    'E-Learning', 'Team Leadership',
  ],

  // ─── Finance / Accounting ──────────────────────────────────────────────────
  accountant: [
    'Accounting', 'Financial Reporting', 'Tax Preparation',
    'Bookkeeping', 'Excel', 'ERP Systems', 'Auditing',
    'Budget Management', 'IFRS/GAAP',
  ],
  'finance manager': [
    'Financial Planning', 'Budget Management', 'Financial Analysis',
    'Risk Management', 'Strategic Planning', 'Team Leadership',
    'Regulatory Compliance', 'ERP Systems',
  ],
  'financial analyst': [
    'Financial Modeling', 'Excel', 'Financial Analysis',
    'Forecasting', 'Budgeting', 'Presentation Skills',
    'ERP Systems', 'Data Analysis',
  ],
  auditor: [
    'Auditing', 'Risk Assessment', 'Internal Controls',
    'Financial Reporting', 'Compliance', 'Excel',
    'Attention to Detail', 'Report Writing',
  ],

  // ─── Management / Operations ───────────────────────────────────────────────
  'project manager': [
    'Project Management', 'Agile/Scrum', 'Stakeholder Management',
    'Risk Management', 'Budget Management', 'Team Leadership',
    'Communication', 'MS Project/Jira',
  ],
  'operations manager': [
    'Operations Management', 'Process Improvement', 'Team Leadership',
    'KPI Management', 'Supply Chain', 'Quality Assurance',
    'Budget Management', 'Strategic Planning',
  ],
  'general manager': [
    'Strategic Planning', 'Team Leadership', 'P&L Management',
    'Business Development', 'Operations Management',
    'Stakeholder Management', 'Decision Making',
  ],
  'department head': [
    'Leadership', 'Strategic Planning', 'Team Management',
    'Budget Management', 'Performance Management',
    'Stakeholder Communication', 'Decision Making',
  ],

  // ─── Marketing / Communications ────────────────────────────────────────────
  'marketing manager': [
    'Marketing Strategy', 'Digital Marketing', 'Content Marketing',
    'Brand Management', 'Analytics', 'Campaign Management',
    'Budget Management', 'Team Leadership',
  ],
  'marketing specialist': [
    'Digital Marketing', 'Social Media', 'Content Creation',
    'SEO/SEM', 'Email Marketing', 'Analytics',
    'Graphic Design', 'Copywriting',
  ],
  'content writer': [
    'Content Writing', 'SEO', 'Copywriting', 'Research',
    'Social Media', 'CMS', 'Editing', 'Storytelling',
  ],

  // ─── Sales ─────────────────────────────────────────────────────────────────
  'sales manager': [
    'Sales Strategy', 'Team Leadership', 'CRM',
    'Negotiation', 'Client Relationship Management',
    'Revenue Forecasting', 'KPI Management',
  ],
  'sales representative': [
    'Sales', 'Customer Service', 'CRM', 'Negotiation',
    'Product Knowledge', 'Presentation Skills', 'Communication',
  ],

  // ─── Admin / Support ───────────────────────────────────────────────────────
  receptionist: [
    'Customer Service', 'Communication', 'Microsoft Office',
    'Scheduling', 'Data Entry', 'Multitasking',
    'Phone Etiquette', 'Organization',
  ],
  secretary: [
    'Administrative Support', 'Microsoft Office', 'Scheduling',
    'Communication', 'Filing', 'Data Entry', 'Organization',
  ],
  'office manager': [
    'Office Administration', 'Team Coordination', 'Scheduling',
    'Budget Tracking', 'Vendor Management',
    'Microsoft Office', 'Communication',
  ],
  'executive assistant': [
    'Calendar Management', 'Communication', 'Microsoft Office',
    'Travel Coordination', 'Confidentiality',
    'Project Coordination', 'Report Preparation',
  ],

  // ─── Engineering (non-software) ────────────────────────────────────────────
  'mechanical engineer': [
    'CAD/CAM', 'SolidWorks', 'AutoCAD', 'Thermodynamics',
    'Manufacturing Processes', 'Project Management',
    'Problem Solving', 'Technical Documentation',
  ],
  'electrical engineer': [
    'Circuit Design', 'PLC Programming', 'AutoCAD',
    'Power Systems', 'Electronics', 'Troubleshooting',
    'Safety Standards', 'Technical Documentation',
  ],
  'biomedical engineer': [
    'Medical Devices', 'Regulatory Compliance', 'Quality Assurance',
    'Biomedical Systems', 'Troubleshooting', 'Documentation',
  ],

  // ─── Supply Chain / Procurement ────────────────────────────────────────────
  'procurement': [
    'Purchasing', 'Vendor Management', 'Negotiation',
    'Contract Management', 'Supply Chain', 'ERP Systems',
    'Cost Analysis', 'Inventory Management',
  ],
  'supply chain manager': [
    'Supply Chain Management', 'Logistics', 'Inventory Management',
    'Vendor Management', 'ERP Systems', 'Forecasting',
    'Team Leadership', 'Cost Optimization',
  ],
  'warehouse': [
    'Inventory Management', 'Warehouse Operations',
    'Logistics', 'Safety Protocols', 'Forklift Operation',
    'ERP Systems', 'Team Coordination',
  ],

  // ─── Quality ───────────────────────────────────────────────────────────────
  'quality': [
    'Quality Assurance', 'ISO Standards', 'Auditing',
    'Process Improvement', 'Root Cause Analysis',
    'Documentation', 'Statistical Analysis', 'Compliance',
  ],

  // ─── Legal ─────────────────────────────────────────────────────────────────
  'legal': [
    'Legal Research', 'Contract Review', 'Compliance',
    'Regulatory Affairs', 'Corporate Law', 'Negotiation',
    'Risk Assessment', 'Legal Documentation',
  ],

  // ─── Fallback ──────────────────────────────────────────────────────────────
  default: [
    'Communication', 'Teamwork', 'Problem Solving',
    'Time Management', 'Microsoft Office',
  ],
};

/**
 * Find the best matching skill set for a given job title.
 *
 * Matching priority:
 * 1. Exact match (lowercase)
 * 2. Substring match (title contains key or key contains title)
 * 3. Keyword-based fallback (nursing, data, software, etc.)
 * 4. Default generic skills
 */
export function getSkillsForJobTitle(jobTitle: string): string[] {
  if (!jobTitle) return ROLE_SKILL_MAP.default;
  const t = jobTitle.toLowerCase().trim();

  // 1. Exact match
  if (ROLE_SKILL_MAP[t]) return ROLE_SKILL_MAP[t];

  // 2. Substring match — longest key wins
  let bestMatch: string[] | null = null;
  let bestLen = 0;
  for (const [key, skills] of Object.entries(ROLE_SKILL_MAP)) {
    if (key === 'default') continue;
    if ((t.includes(key) || key.includes(t)) && key.length > bestLen) {
      bestMatch = skills;
      bestLen = key.length;
    }
  }
  if (bestMatch) return bestMatch;

  // 3. Keyword fallback — check leadership/director/manager BEFORE generic roles
  if (/\bnurs(e|ing|es)\b/.test(t) || t.includes('rn') || t.includes('lpn') || t.includes('bsn')) {
    // Nursing leadership roles get management skills, not basic nurse skills
    if (/\bdirector\b/.test(t)) return ROLE_SKILL_MAP['nursing director'];
    if (/\bassistant.*(director|manager)\b/.test(t)) return ROLE_SKILL_MAP['assistant nursing director'];
    if (/\bmanager\b/.test(t)) return ROLE_SKILL_MAP['nurse manager'];
    if (/\bhead\b/.test(t) || /\bcharge\b/.test(t) || /\blead\b/.test(t) || /\bsupervisor\b/.test(t))
      return ROLE_SKILL_MAP['charge nurse'];
    return ROLE_SKILL_MAP.nurse;
  }
  if (/\bdata\b/.test(t) && /\banalys/.test(t))
    return ROLE_SKILL_MAP['data analyst'];
  if (/\bdata\b/.test(t) && /\bscien/.test(t))
    return ROLE_SKILL_MAP['data scientist'];
  if (/\bdata\b/.test(t) && /\bengineer/.test(t))
    return ROLE_SKILL_MAP['data engineer'];
  if (/\bsoftware|developer|programmer|coder\b/.test(t))
    return ROLE_SKILL_MAP['software engineer'];
  if (/\bfrontend|front.end\b/.test(t))
    return ROLE_SKILL_MAP['frontend developer'];
  if (/\bbackend|back.end\b/.test(t))
    return ROLE_SKILL_MAP['backend developer'];
  if (/\bfull.?stack\b/.test(t))
    return ROLE_SKILL_MAP['full stack developer'];
  if (/\bdevops|sre|site.reliability\b/.test(t))
    return ROLE_SKILL_MAP.devops;
  if (/\bcyber|security.analyst|infosec\b/.test(t))
    return ROLE_SKILL_MAP.cybersecurity;
  if (/\bhr\b|human.resource/.test(t)) {
    if (/\bmanager|director|head\b/.test(t)) return ROLE_SKILL_MAP['hr manager'];
    if (/\brecruit/.test(t)) return ROLE_SKILL_MAP.recruiter;
    return ROLE_SKILL_MAP['hr specialist'];
  }
  if (/\baccountan/.test(t))
    return ROLE_SKILL_MAP.accountant;
  if (/\bfinance|financial\b/.test(t))
    return t.includes('manager') ? ROLE_SKILL_MAP['finance manager'] : ROLE_SKILL_MAP['financial analyst'];
  if (/\bpharma/.test(t))
    return ROLE_SKILL_MAP.pharmacist;
  if (/\bdoctor|physician|md\b/.test(t))
    return ROLE_SKILL_MAP.doctor;
  if (/\bproject.manager|pm\b/.test(t))
    return ROLE_SKILL_MAP['project manager'];
  if (/\boperation/.test(t))
    return ROLE_SKILL_MAP['operations manager'];
  if (/\bmarket/.test(t))
    return t.includes('manager') ? ROLE_SKILL_MAP['marketing manager'] : ROLE_SKILL_MAP['marketing specialist'];
  if (/\bsales\b/.test(t))
    return t.includes('manager') ? ROLE_SKILL_MAP['sales manager'] : ROLE_SKILL_MAP['sales representative'];
  if (/\blegal|lawyer|counsel\b/.test(t))
    return ROLE_SKILL_MAP.legal;
  if (/\bquality|qa\b/.test(t))
    return ROLE_SKILL_MAP.quality;
  if (/\bprocure|purchas\b/.test(t))
    return ROLE_SKILL_MAP.procurement;
  if (/\bwarehouse|logistics\b/.test(t))
    return ROLE_SKILL_MAP.warehouse;
  if (/\breception/.test(t))
    return ROLE_SKILL_MAP.receptionist;
  if (/\bsecretary|admin.assist|executive.assist\b/.test(t))
    return ROLE_SKILL_MAP.secretary;
  if (/\bmanager|director|head|lead\b/.test(t))
    return ROLE_SKILL_MAP['department head'];

  return ROLE_SKILL_MAP.default;
}

/**
 * Detects obviously mismatched skills (e.g., a nurse job requiring JavaScript).
 * Returns true if the job's skills seem wrong for its title.
 */
export function hasSkillMismatch(jobTitle: string, currentSkills: string[]): boolean {
  if (!jobTitle || !currentSkills || currentSkills.length === 0) return false;

  const expected = getSkillsForJobTitle(jobTitle);
  if (expected === ROLE_SKILL_MAP.default) return false;

  const expectedNorm = new Set(expected.map(s => s.toLowerCase()));
  const currentNorm = currentSkills.map(s => s.toLowerCase());

  // Count how many current skills match expected skills
  let matchCount = 0;
  for (const skill of currentNorm) {
    for (const exp of expectedNorm) {
      if (skill.includes(exp) || exp.includes(skill)) {
        matchCount++;
        break;
      }
    }
  }

  // If less than 20% of current skills match expected, it's a mismatch
  const matchRate = matchCount / currentSkills.length;
  return matchRate < 0.2;
}

/**
 * Preferred (nice-to-have) skills by role.
 * These don't penalize the match score when missing.
 */
export const ROLE_PREFERRED_SKILL_MAP: Record<string, string[]> = {
  nurse: ['Medication Administration', 'Vital Signs Monitoring', 'Infection Control', 'Electronic Health Records (EHR)'],
  'registered nurse': ['Medication Administration', 'Vital Signs Monitoring', 'Infection Control', 'Electronic Health Records (EHR)'],
  'charge nurse': ['Electronic Health Records (EHR)', 'Quality Improvement', 'Patient Education'],
  'nurse manager': ['Budget Management', 'Training & Development'],
  'licensed practical nurse': ['Vital Signs Monitoring', 'Wound Care', 'Infection Control'],
  doctor: ['Emergency Medicine', 'Patient Communication'],
  physician: ['Emergency Medicine', 'Patient Communication'],
  pharmacist: ['Clinical Pharmacy', 'Medication Safety'],
  'software engineer': ['SQL', 'REST APIs', 'Agile/Scrum'],
  'data analyst': ['Power BI', 'Statistical Analysis', 'Data Cleaning'],
  'hr coordinator': ['Scheduling', 'Data Entry'],
};

/**
 * Returns preferred (nice-to-have) skills for a job title.
 */
export function getPreferredSkillsForJobTitle(jobTitle: string): string[] {
  if (!jobTitle) return [];
  const t = jobTitle.toLowerCase().trim();

  if (ROLE_PREFERRED_SKILL_MAP[t]) return ROLE_PREFERRED_SKILL_MAP[t];

  for (const [key, skills] of Object.entries(ROLE_PREFERRED_SKILL_MAP)) {
    if (t.includes(key) || key.includes(t)) return skills;
  }

  if (/\bnurs(e|ing|es)\b/.test(t) || t.includes('rn') || t.includes('lpn') || t.includes('bsn'))
    return ROLE_PREFERRED_SKILL_MAP.nurse;

  return [];
}
