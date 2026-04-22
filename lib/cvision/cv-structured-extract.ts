/**
 * CV Structured Data Extraction (Regex-based)
 *
 * Extracted from the cv-parse route so tests and other modules can import
 * without triggering Next.js "invalid route export" errors.
 */

/**
 * Structured data extracted from a CV using regex patterns.
 * All fields are nullable -- when a pattern is not found, the field is null.
 */
export interface CvStructuredData {
  email: string | null;
  phone: string | null;
  fullName: string | null;
  education: string[] | null;
  skills: string[] | null;
  yearsOfExperience: number | null;
  nationality: string | null;
  languages: string[] | null;
}

/**
 * Extract structured data from raw CV text using regex patterns.
 *
 * Handles both English and Arabic CVs. Every field returns null when no match
 * is found -- callers should treat null as "field not detected".
 *
 * This is Phase 2 extraction (regex only, no AI/NLP).
 */
export function extractStructuredData(rawText: string): CvStructuredData {
  const result: CvStructuredData = {
    email: null,
    phone: null,
    fullName: null,
    education: null,
    skills: null,
    yearsOfExperience: null,
    nationality: null,
    languages: null,
  };

  if (!rawText || rawText.trim().length === 0) {
    return result;
  }

  const text = rawText;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // ---------------------------------------------------------------------------
  // 1. Email
  // ---------------------------------------------------------------------------
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase();
  }

  // ---------------------------------------------------------------------------
  // 2. Phone numbers
  // ---------------------------------------------------------------------------
  const phoneRegex = /(?:\+?\d{1,4}[\s\-.]?)?\(?\d{1,4}\)?[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}[\s\-.]?\d{0,4}/g;
  const phoneMatches = text.match(phoneRegex);
  if (phoneMatches) {
    for (const candidate of phoneMatches) {
      const digits = candidate.replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15) {
        result.phone = candidate.trim();
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Full Name
  // ---------------------------------------------------------------------------
  const nameLabels = [
    /(?:full\s*name|name|الاسم\s*الكامل|الاسم)\s*[:：]\s*(.+)/i,
  ];
  for (const re of nameLabels) {
    const m = text.match(re);
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (candidate.length >= 2 && candidate.length <= 100) {
        result.fullName = candidate;
        break;
      }
    }
  }
  if (!result.fullName) {
    const sectionHeaders = /^(summary|objective|experience|education|skills|profile|contact|about|languages|references|projects|certifications|awards)/i;
    for (const line of lines.slice(0, 10)) {
      if (emailRegex.test(line)) continue;
      if (/https?:\/\/|www\./i.test(line)) continue;
      if (/^\+?\d/.test(line) && /\d{7,}/.test(line.replace(/\D/g, ''))) continue;
      if (sectionHeaders.test(line)) continue;
      if (line.length < 3 || line.length > 80) continue;
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 6 && !/\d/.test(line)) {
        result.fullName = line;
        break;
      }
      if (words.length >= 1 && words.length <= 6 && /[\u0600-\u06FF]/.test(line) && !/\d/.test(line)) {
        result.fullName = line;
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Education
  // ---------------------------------------------------------------------------
  const educationKeywords = /\b(bachelor'?s?|master'?s?|ph\.?d\.?|b\.?sc\.?|m\.?sc\.?|mba|diploma|associate'?s?|university|college|institute)\b|بكالوريوس|ماجستير|دكتوراه|دبلوم|الجامعة|كلية|معهد/i;
  const educationEntries: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (educationKeywords.test(lines[i])) {
      let entry = lines[i];
      if (i + 1 < lines.length && lines[i + 1].length < 80 && !/^(experience|skills|languages|projects)/i.test(lines[i + 1])) {
        const nextLine = lines[i + 1];
        if (/\d{4}|gpa|cgpa|grade|present|current|حالي/i.test(nextLine)) {
          entry += ' | ' + nextLine;
        }
      }
      const isDuplicate = educationEntries.some(
        existing => existing.toLowerCase().includes(entry.toLowerCase().slice(0, 30))
      );
      if (!isDuplicate) {
        educationEntries.push(entry);
      }
    }
  }
  if (educationEntries.length > 0) {
    result.education = educationEntries;
  }

  // ---------------------------------------------------------------------------
  // 5. Skills
  // ---------------------------------------------------------------------------
  const skillsSectionRegex = /^(?:skills|technical\s+skills|core\s+skills|key\s+skills|المهارات|المهارات\s+التقنية)\s*[:：]?\s*$/i;
  const skillsInlineRegex = /^(?:skills|technical\s+skills|core\s+skills|key\s+skills|المهارات|المهارات\s+التقنية)\s*[:：]\s*(.+)/i;

  let skillsList: string[] = [];

  for (const line of lines) {
    const inlineMatch = line.match(skillsInlineRegex);
    if (inlineMatch && inlineMatch[1]) {
      skillsList = inlineMatch[1]
        .split(/[,;،|•·\-]/)
        .map(s => s.trim())
        .filter(s => s.length >= 2 && s.length <= 60);
      break;
    }
  }

  if (skillsList.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (skillsSectionRegex.test(lines[i])) {
        const nextSectionRegex = /^(experience|education|languages|projects|certifications|references|awards|summary|objective|profile|contact|الخبرات|التعليم|اللغات|المشاريع|المراجع)/i;
        for (let j = i + 1; j < lines.length && j < i + 30; j++) {
          if (nextSectionRegex.test(lines[j])) break;
          if (lines[j].length < 2) continue;
          const items = lines[j]
            .split(/[,;،|•·]/)
            .map(s => s.replace(/^[\-\s*]+/, '').trim())
            .filter(s => s.length >= 2 && s.length <= 60);
          if (items.length > 0) {
            skillsList.push(...items);
          } else if (lines[j].length >= 2 && lines[j].length <= 60) {
            skillsList.push(lines[j].replace(/^[\-\s*]+/, '').trim());
          }
        }
        break;
      }
    }
  }

  if (skillsList.length > 0) {
    const seen = new Set<string>();
    result.skills = skillsList.filter(s => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Years of Experience
  // ---------------------------------------------------------------------------
  const yoePatterns = [
    /(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)?/i,
    /(?:over|more\s+than|أكثر\s+من)\s*(\d{1,2})\s*(?:years?|yrs?|سنوات|سنة)/i,
    /(\d{1,2})\s*(?:سنوات|سنة|سنين)\s*(?:خبرة|من\s+الخبرة)?/,
    /experience\s*[:：]\s*(\d{1,2})\s*(?:years?|yrs?|\+)/i,
    /(\d{1,2})\s*\+?\s*years?\s+(?:in|of|working)/i,
  ];
  for (const re of yoePatterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const num = parseInt(m[1], 10);
      if (num >= 1 && num <= 50) {
        result.yearsOfExperience = num;
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Nationality
  // ---------------------------------------------------------------------------
  const nationalityPatterns = [
    /(?:nationality|citizenship|جنسية|الجنسية)\s*[:：]\s*(.+)/i,
  ];
  for (const re of nationalityPatterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const val = m[1].trim().split(/[,\n]/)[0].trim();
      if (val.length >= 2 && val.length <= 50) {
        result.nationality = val;
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Languages
  // ---------------------------------------------------------------------------
  const commonLanguages = [
    'arabic', 'english', 'french', 'spanish', 'german', 'chinese', 'mandarin',
    'hindi', 'urdu', 'japanese', 'korean', 'portuguese', 'russian', 'italian',
    'turkish', 'persian', 'farsi', 'malay', 'indonesian', 'dutch', 'tagalog',
    'bengali', 'thai', 'vietnamese', 'swahili', 'hebrew', 'punjabi',
    'العربية', 'الإنجليزية', 'الفرنسية', 'الإسبانية', 'الألمانية',
    'الصينية', 'الهندية', 'الأردية', 'التركية', 'الفارسية',
  ];
  const langSectionRegex = /^(?:languages?|لغات|اللغات)\s*[:：]?\s*$/i;
  const langInlineRegex = /^(?:languages?|لغات|اللغات)\s*[:：]\s*(.+)/i;

  let langList: string[] = [];

  for (const line of lines) {
    const inlineMatch = line.match(langInlineRegex);
    if (inlineMatch && inlineMatch[1]) {
      langList = inlineMatch[1]
        .split(/[,;،|•·\-]/)
        .map(s => s.trim())
        .filter(s => s.length >= 2 && s.length <= 40);
      break;
    }
  }

  if (langList.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (langSectionRegex.test(lines[i])) {
        const nextSectionRegex = /^(experience|education|skills|projects|certifications|references|awards|summary|objective|profile|contact|الخبرات|التعليم|المهارات|المشاريع|المراجع)/i;
        for (let j = i + 1; j < lines.length && j < i + 15; j++) {
          if (nextSectionRegex.test(lines[j])) break;
          if (lines[j].length < 2) continue;
          const cleaned = lines[j]
            .replace(/[\-–—]\s*.*/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/[:：].*/g, '')
            .trim();
          if (cleaned.length >= 2 && cleaned.length <= 40) {
            langList.push(cleaned);
          }
        }
        break;
      }
    }
  }

  if (langList.length === 0) {
    const foundLangs = new Set<string>();
    const lowerText = text.toLowerCase();
    for (const lang of commonLanguages) {
      if (lowerText.includes(lang.toLowerCase())) {
        const displayName = lang.charAt(0).toUpperCase() + lang.slice(1);
        foundLangs.add(displayName);
      }
    }
    if (foundLangs.size > 0) {
      langList = Array.from(foundLangs);
    }
  }

  if (langList.length > 0) {
    const seen = new Set<string>();
    result.languages = langList.filter(l => {
      const key = l.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return result;
}
