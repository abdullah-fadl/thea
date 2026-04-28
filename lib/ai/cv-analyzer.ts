/**
 * CV Analyzer — Heuristic CV text parser
 *
 * Extracts skills, experience, education, and contact info from CV text.
 * Uses pattern-matching heuristics (no external AI dependency).
 */

export interface CVAnalysis {
  skills: string[];
  experience: { title: string; years: number; company?: string; duration?: string; [key: string]: any }[];
  education: { degree: string; field: string; institution?: string; year?: string | number; [key: string]: any }[];
  summary: string;
  fullName?: string;
  email?: string;
  phone?: string;
  languages?: string[];
  certifications?: string[];
  [key: string]: any;
}

// ─── Common skill keywords (healthcare + IT + general) ───────────────
const SKILL_KEYWORDS = [
  // Healthcare
  'nursing', 'patient care', 'clinical', 'ehr', 'emr', 'bls', 'acls', 'cpr',
  'pharmacology', 'radiology', 'laboratory', 'triage', 'infection control',
  'wound care', 'ventilator', 'icu', 'nicu', 'or', 'emergency medicine',
  'surgery', 'pediatrics', 'obstetrics', 'cardiology', 'oncology',
  'anesthesia', 'physical therapy', 'occupational therapy', 'respiratory therapy',
  'medical coding', 'medical billing', 'hipaa', 'cbahi', 'jci',
  // IT / Tech
  'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'sql', 'nosql',
  'react', 'angular', 'vue', 'node.js', 'express', 'next.js', 'django', 'flask',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'ci/cd', 'devops', 'git',
  'machine learning', 'artificial intelligence', 'data analysis', 'data science',
  'project management', 'agile', 'scrum', 'pmp',
  // General
  'leadership', 'communication', 'team management', 'budgeting', 'strategic planning',
  'human resources', 'recruitment', 'payroll', 'compliance', 'audit',
  'microsoft office', 'excel', 'powerpoint', 'sap', 'oracle',
  'arabic', 'english', 'french', 'spanish',
];

const DEGREE_PATTERNS = [
  /\b(ph\.?d|doctorate|دكتوراه)\b/i,
  /\b(master'?s?|m\.?s\.?c?|m\.?a\.?|m\.?b\.?a\.?|ماجستير)\b/i,
  /\b(bachelor'?s?|b\.?s\.?c?|b\.?a\.?|b\.?eng|بكالوريوس)\b/i,
  /\b(diploma|دبلوم)\b/i,
  /\b(certificate|شهادة)\b/i,
  /\b(associate'?s?)\b/i,
];

const DEGREE_LABELS = ['PhD', 'Masters', 'Bachelors', 'Diploma', 'Certificate', 'Associates'];

const JOB_TITLE_PATTERNS = [
  /\b(chief|head|director|vp|vice president|ceo|cto|cfo|coo|cio)\b/i,
  /\b(senior|sr\.?|lead|principal|staff)\b/i,
  /\b(manager|supervisor|coordinator|administrator|specialist)\b/i,
  /\b(engineer|developer|analyst|consultant|architect|designer)\b/i,
  /\b(nurse|physician|doctor|surgeon|pharmacist|therapist|technician|technologist)\b/i,
  /\b(accountant|auditor|officer|assistant|clerk|secretary|receptionist)\b/i,
];

/**
 * Extract email addresses
 */
function extractEmail(text: string): string | undefined {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : undefined;
}

/**
 * Extract phone numbers (international + Saudi format)
 */
function extractPhone(text: string): string | undefined {
  const match = text.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}/);
  return match ? match[0].trim() : undefined;
}

/**
 * Extract the likely full name (first non-empty line that looks like a name)
 */
function extractFullName(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    // Skip lines that are headers, emails, phones, or very long
    if (line.length > 60 || line.length < 3) continue;
    if (line.includes('@') || /^\d/.test(line)) continue;
    if (/^(curriculum|resume|cv|profile|summary|objective|experience|education)/i.test(line)) continue;
    // Likely a name: 2-4 words, mostly letters
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && words.every(w => /^[\p{L}.''-]+$/u.test(w))) {
      return line;
    }
  }
  return undefined;
}

/**
 * Extract skills by matching known keywords against text
 */
function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const skill of SKILL_KEYWORDS) {
    if (lower.includes(skill.toLowerCase())) {
      found.push(skill.charAt(0).toUpperCase() + skill.slice(1));
    }
  }

  // Also extract items from bullet lists in a "Skills" section
  const skillSection = text.match(/(?:skills|مهارات|competencies|technical skills)[:\s]*\n([\s\S]*?)(?:\n\s*\n|\n(?:[A-Z]|$))/i);
  if (skillSection) {
    const items = skillSection[1].split(/[,\n•\-|]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 60);
    for (const item of items) {
      if (!found.some(f => f.toLowerCase() === item.toLowerCase())) {
        found.push(item);
      }
    }
  }

  return [...new Set(found)].slice(0, 30);
}

/**
 * Extract experience entries
 */
function extractExperience(text: string): CVAnalysis['experience'] {
  const entries: CVAnalysis['experience'] = [];
  const lines = text.split('\n');

  // Look for patterns: "Title at Company (2019 - 2022)" or "Company | Title | 2019 - Present"
  const dateRange = /(\d{4})\s*[-–—to]+\s*(\d{4}|present|current|الحاضر|حالياً)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const dateMatch = line.match(dateRange);
    if (!dateMatch) continue;

    const startYear = parseInt(dateMatch[1]);
    const endYear = dateMatch[2].match(/\d{4}/) ? parseInt(dateMatch[2]) : new Date().getFullYear();
    const years = Math.max(0, endYear - startYear);

    // Extract title and company from the same or adjacent lines
    let title = '';
    let company = '';

    // Clean line of the date portion
    const cleaned = line.replace(dateRange, '').replace(/[•\-|,]/g, ' ').trim();
    const parts = cleaned.split(/\s+(?:at|@|in|–|—|-|,|\|)\s+/i).map(p => p.trim()).filter(Boolean);

    if (parts.length >= 2) {
      title = parts[0];
      company = parts[1];
    } else if (parts.length === 1) {
      // Check if this is a job title
      const isTitle = JOB_TITLE_PATTERNS.some(p => p.test(parts[0]));
      if (isTitle) {
        title = parts[0];
        // Look at next/previous line for company
        if (i + 1 < lines.length) company = lines[i + 1].trim().replace(/[•\-|]/g, '').trim();
      } else {
        company = parts[0];
        if (i > 0) title = lines[i - 1].trim().replace(/[•\-|]/g, '').trim();
      }
    }

    if (title || company) {
      entries.push({
        title: title || 'Unknown Position',
        years,
        company: company || undefined,
        duration: `${startYear} - ${dateMatch[2]}`,
      });
    }
  }

  return entries.slice(0, 15);
}

/**
 * Extract education entries
 */
function extractEducation(text: string): CVAnalysis['education'] {
  const entries: CVAnalysis['education'] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let d = 0; d < DEGREE_PATTERNS.length; d++) {
      if (!DEGREE_PATTERNS[d].test(line)) continue;
      const yearMatch = line.match(/\b(19|20)\d{2}\b/);
      const degree = DEGREE_LABELS[d];

      // Try to extract field of study
      const fieldMatch = line.match(/(?:in|of|–|—|-)\s+([A-Za-z\s]+?)(?:\s*[,\-–—|]|\s*\d|\s*$)/i);
      const field = fieldMatch ? fieldMatch[1].trim() : '';

      // Look for institution name
      let institution = '';
      const instLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      if (instLine && !DEGREE_PATTERNS.some(p => p.test(instLine)) && instLine.length > 3 && instLine.length < 100) {
        institution = instLine.replace(/[•\-|]/g, '').trim();
      }
      // Or on the same line after comma
      const instMatch = line.match(/,\s+([A-Z][\w\s]+(?:University|College|Institute|Academy|School))/i);
      if (instMatch) institution = instMatch[1].trim();

      entries.push({
        degree,
        field: field || 'General',
        institution: institution || undefined,
        year: yearMatch ? parseInt(yearMatch[0]) : undefined,
      });
      break; // Only match one degree per line
    }
  }

  return entries.slice(0, 10);
}

/**
 * Extract certifications
 */
function extractCertifications(text: string): string[] {
  const certs: string[] = [];
  const certSection = text.match(/(?:certifications?|licenses?|credentials?|accreditations?|شهادات)[:\s]*\n([\s\S]*?)(?:\n\s*\n|\n(?:[A-Z]|$))/i);
  if (certSection) {
    const items = certSection[1].split('\n').map(s => s.replace(/^[•\-\*]\s*/, '').trim()).filter(s => s.length > 3 && s.length < 100);
    certs.push(...items);
  }
  // Also detect inline certifications
  const knownCerts = ['PMP', 'SHRM', 'PHR', 'SPHR', 'CPA', 'CFA', 'AWS Certified', 'Azure Certified', 'CISSP', 'CCNA', 'BLS', 'ACLS', 'PALS', 'TNCC', 'HAAD', 'DHA', 'SCFHS', 'CBAHI'];
  for (const cert of knownCerts) {
    if (text.toUpperCase().includes(cert.toUpperCase()) && !certs.some(c => c.toUpperCase().includes(cert.toUpperCase()))) {
      certs.push(cert);
    }
  }
  return [...new Set(certs)].slice(0, 15);
}

/**
 * Generate a brief summary
 */
function generateSummary(analysis: Partial<CVAnalysis>): string {
  const parts: string[] = [];
  const totalYears = analysis.experience?.reduce((sum, e) => sum + e.years, 0) || 0;

  if (totalYears > 0) {
    parts.push(`${totalYears} years of professional experience`);
  }
  if (analysis.education?.length) {
    const highest = analysis.education[0];
    parts.push(`${highest.degree} in ${highest.field}`);
  }
  if (analysis.skills?.length) {
    parts.push(`${analysis.skills.length} identified skills`);
  }
  if (analysis.certifications?.length) {
    parts.push(`${analysis.certifications.length} certifications`);
  }

  return parts.length > 0
    ? `Candidate with ${parts.join(', ')}.`
    : 'CV parsed — limited structured data found.';
}

/**
 * Analyze CV text and extract structured data
 */
export async function analyzeCV(cvText: string, _filename?: string): Promise<CVAnalysis> {
  if (!cvText || cvText.trim().length < 20) {
    return {
      skills: [],
      experience: [],
      education: [],
      summary: 'Insufficient CV text provided for analysis.',
    };
  }

  const skills = extractSkills(cvText);
  const experience = extractExperience(cvText);
  const education = extractEducation(cvText);
  const certifications = extractCertifications(cvText);
  const fullName = extractFullName(cvText);
  const email = extractEmail(cvText);
  const phone = extractPhone(cvText);

  const analysis: CVAnalysis = {
    skills,
    experience,
    education,
    certifications,
    fullName,
    email,
    phone,
    summary: '',
  };

  analysis.summary = generateSummary(analysis);

  return analysis;
}

/**
 * Match a CV analysis against open positions
 */
export async function matchToPositions(
  cvAnalysis: CVAnalysis,
  positions: any[],
  _jobTitles?: any[]
): Promise<{ positionId: string; score: number; matchScore?: number; reasons: string[]; [key: string]: any }[]> {
  if (!positions.length || !cvAnalysis.skills.length) return [];

  const candidateSkills = new Set(cvAnalysis.skills.map(s => s.toLowerCase()));
  const totalExperienceYears = cvAnalysis.experience.reduce((s, e) => s + e.years, 0);

  return positions.map(pos => {
    const reasons: string[] = [];
    let score = 0;

    // Skill matching
    const requiredSkills: string[] = pos.requiredSkills || pos.skills || [];
    const matchedSkills = requiredSkills.filter((s: string) => candidateSkills.has(s.toLowerCase()));
    if (requiredSkills.length > 0) {
      const skillScore = (matchedSkills.length / requiredSkills.length) * 50;
      score += skillScore;
      if (matchedSkills.length > 0) reasons.push(`${matchedSkills.length}/${requiredSkills.length} required skills matched`);
    } else {
      score += 25; // No specific requirements = neutral
    }

    // Experience matching
    const minExp = pos.minExperience || pos.experienceRequired || 0;
    if (minExp > 0 && totalExperienceYears >= minExp) {
      score += 30;
      reasons.push(`Meets experience requirement (${totalExperienceYears}y >= ${minExp}y)`);
    } else if (minExp > 0) {
      const ratio = Math.min(1, totalExperienceYears / minExp);
      score += ratio * 15;
      reasons.push(`Partial experience match (${totalExperienceYears}y / ${minExp}y required)`);
    } else {
      score += 15;
    }

    // Education matching
    const reqDegree = (pos.requiredDegree || pos.education || '').toLowerCase();
    if (reqDegree && cvAnalysis.education.some(e => e.degree.toLowerCase().includes(reqDegree))) {
      score += 20;
      reasons.push(`Education requirement met (${reqDegree})`);
    } else if (!reqDegree) {
      score += 10;
    }

    return {
      positionId: pos.id || pos._id?.toString(),
      score: Math.round(Math.min(100, score)),
      matchScore: Math.round(Math.min(100, score)),
      reasons,
    };
  }).sort((a, b) => b.score - a.score);
}
