/**
 * Antibiogram Generation Engine — Annual organism × antibiotic susceptibility matrix.
 * Reads from InfectionSurveillance.sensitivityProfile JSON field.
 * Expected format: { "Ciprofloxacin": "S", "Meropenem": "R", ... }
 */

import { prisma, prismaModel } from '@/lib/db/prisma';

// ── Common Organisms (top 15 hospital pathogens) ───────────────────────────
export const COMMON_ORGANISMS = [
  { code: 'E_COLI',        en: 'Escherichia coli',            ar: 'الإشريكية القولونية' },
  { code: 'KLEBSIELLA',    en: 'Klebsiella pneumoniae',       ar: 'الكليبسيلا الرئوية' },
  { code: 'PSEUDOMONAS',   en: 'Pseudomonas aeruginosa',      ar: 'الزائفة الزنجارية' },
  { code: 'STAPH_AUREUS',  en: 'Staphylococcus aureus',       ar: 'المكورات العنقودية الذهبية' },
  { code: 'MRSA',          en: 'MRSA',                        ar: 'مرسا' },
  { code: 'ENTEROCOCCUS',  en: 'Enterococcus spp.',           ar: 'المكورات المعوية' },
  { code: 'ACINETOBACTER', en: 'Acinetobacter baumannii',     ar: 'الراكدة البومانية' },
  { code: 'ENTEROBACTER',  en: 'Enterobacter spp.',           ar: 'الأمعائية' },
  { code: 'PROTEUS',       en: 'Proteus mirabilis',           ar: 'المتقلبة الرائعة' },
  { code: 'SERRATIA',      en: 'Serratia marcescens',         ar: 'السيراتيا' },
  { code: 'STREP_PNEUMO',  en: 'Streptococcus pneumoniae',    ar: 'العقدية الرئوية' },
  { code: 'CANDIDA',       en: 'Candida spp.',                ar: 'المبيضات' },
  { code: 'STENOTROPHOMONAS', en: 'Stenotrophomonas maltophilia', ar: 'ستينوتروفوموناس' },
  { code: 'CITROBACTER',   en: 'Citrobacter spp.',            ar: 'السيتروباكتر' },
  { code: 'BURKHOLDERIA',  en: 'Burkholderia cepacia',        ar: 'بوركهولدريا' },
];

// ── Common Antibiotics (columns in the antibiogram) ────────────────────────
export const COMMON_ANTIBIOTICS = [
  { code: 'AMC',  en: 'Amoxicillin-Clavulanate', ar: 'أموكسيسيلين-كلافولانات' },
  { code: 'AMP',  en: 'Ampicillin',              ar: 'أمبيسيلين' },
  { code: 'CRO',  en: 'Ceftriaxone',             ar: 'سيفترياكسون' },
  { code: 'FEP',  en: 'Cefepime',                ar: 'سيفيبيم' },
  { code: 'TZP',  en: 'Piperacillin-Tazobactam', ar: 'بيبراسيلين-تازوباكتام' },
  { code: 'MEM',  en: 'Meropenem',               ar: 'ميروبينيم' },
  { code: 'IPM',  en: 'Imipenem',                ar: 'إيميبينيم' },
  { code: 'CIP',  en: 'Ciprofloxacin',           ar: 'سيبروفلوكساسين' },
  { code: 'LVX',  en: 'Levofloxacin',            ar: 'ليفوفلوكساسين' },
  { code: 'GEN',  en: 'Gentamicin',              ar: 'جنتاميسين' },
  { code: 'AMK',  en: 'Amikacin',                ar: 'أميكاسين' },
  { code: 'VAN',  en: 'Vancomycin',              ar: 'فانكومايسين' },
  { code: 'LNZ',  en: 'Linezolid',               ar: 'لينزوليد' },
  { code: 'SXT',  en: 'TMP-Sulfamethoxazole',    ar: 'تريميثوبريم-سلفاميثوكسازول' },
  { code: 'NIT',  en: 'Nitrofurantoin',           ar: 'نيتروفورانتوين' },
  { code: 'COL',  en: 'Colistin',                ar: 'كوليستين' },
  { code: 'TGC',  en: 'Tigecycline',             ar: 'تايجيسيكلين' },
];

// ── Fuzzy matcher: normalize antibiotic names from sensitivity profiles ─────
const ANTIBIOTIC_ALIASES: Record<string, string> = {};
for (const ab of COMMON_ANTIBIOTICS) {
  ANTIBIOTIC_ALIASES[ab.code.toLowerCase()] = ab.code;
  ANTIBIOTIC_ALIASES[ab.en.toLowerCase()] = ab.code;
  ANTIBIOTIC_ALIASES[ab.ar] = ab.code;
}
// Additional common aliases
const EXTRA_ALIASES: Record<string, string> = {
  'amoxicillin/clavulanate': 'AMC', 'augmentin': 'AMC', 'amox-clav': 'AMC',
  'pip-tazo': 'TZP', 'tazocin': 'TZP', 'zosyn': 'TZP',
  'meropenem': 'MEM', 'imipenem': 'IPM', 'ertapenem': 'MEM',
  'cipro': 'CIP', 'levo': 'LVX', 'gent': 'GEN',
  'vanco': 'VAN', 'bactrim': 'SXT', 'tmp-smx': 'SXT',
  'cotrimoxazole': 'SXT', 'trimethoprim': 'SXT',
};
for (const [k, v] of Object.entries(EXTRA_ALIASES)) ANTIBIOTIC_ALIASES[k] = v;

function resolveAntibioticCode(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  return ANTIBIOTIC_ALIASES[normalized] || null;
}

export interface AntibiogramCell {
  susceptible: number;
  intermediate: number;
  resistant: number;
  total: number;
  percentage: number; // susceptibility %
}

export interface AntibiogramResult {
  year: number;
  organisms: { name: string; nameAr: string; totalIsolates: number }[];
  antibiotics: { code: string; name: string; nameAr: string }[];
  matrix: Record<string, Record<string, AntibiogramCell>>; // organism → antibiotic → cell
}

/**
 * Generate annual antibiogram from InfectionSurveillance.sensitivityProfile data.
 * Organisms with <30 isolates excluded per CLSI M39 guidelines.
 */
export async function generateAntibiogram(
  tenantId: string,
  year: number,
  minIsolates: number = 30
): Promise<AntibiogramResult> {
  const startDate = new Date(`${year}-01-01T00:00:00Z`);
  const endDate = new Date(`${year}-12-31T23:59:59Z`);

  // Fetch all records with sensitivity data
  const records = await prismaModel('infectionSurveillance')?.findMany?.({
    where: {
      tenantId,
      reportDate: { gte: startDate, lte: endDate },
      sensitivityProfile: { not: null },
    },
    select: {
      organism: true,
      sensitivityProfile: true,
    },
  }).catch(() => []) || [];

  // Aggregate: organism → antibiotic → { S, I, R counts }
  const raw: Record<string, Record<string, { s: number; i: number; r: number }>> = {};
  const organismCounts: Record<string, number> = {};

  for (const rec of records) {
    const org = (rec.organism || '').trim();
    if (!org) continue;

    organismCounts[org] = (organismCounts[org] || 0) + 1;

    const profile = rec.sensitivityProfile;
    if (!profile || typeof profile !== 'object') continue;

    if (!raw[org]) raw[org] = {};

    for (const [abName, result] of Object.entries(profile as Record<string, string>)) {
      const code = resolveAntibioticCode(abName) || abName.toUpperCase();
      if (!raw[org][code]) raw[org][code] = { s: 0, i: 0, r: 0 };

      const r = String(result).toUpperCase().trim();
      if (r === 'S' || r === 'SUSCEPTIBLE') raw[org][code].s++;
      else if (r === 'I' || r === 'INTERMEDIATE') raw[org][code].i++;
      else if (r === 'R' || r === 'RESISTANT') raw[org][code].r++;
    }
  }

  // Build matrix (filter organisms with >= minIsolates)
  const matrix: Record<string, Record<string, AntibiogramCell>> = {};
  const organismList: { name: string; nameAr: string; totalIsolates: number }[] = [];

  // Sort organisms by count descending
  const sortedOrganisms = Object.entries(organismCounts)
    .sort(([, a], [, b]) => b - a);

  for (const [org, count] of sortedOrganisms) {
    if (count < minIsolates) continue;

    const known = COMMON_ORGANISMS.find(
      (o) => o.en.toLowerCase() === org.toLowerCase() || o.code === org || o.ar === org
    );
    organismList.push({
      name: known?.en || org,
      nameAr: known?.ar || org,
      totalIsolates: count,
    });

    matrix[known?.en || org] = {};
    const orgData = raw[org] || {};

    for (const ab of COMMON_ANTIBIOTICS) {
      const cell = orgData[ab.code];
      if (cell) {
        const total = cell.s + cell.i + cell.r;
        matrix[known?.en || org][ab.code] = {
          susceptible: cell.s,
          intermediate: cell.i,
          resistant: cell.r,
          total,
          percentage: total > 0 ? Math.round((cell.s / total) * 100) : 0,
        };
      }
    }
  }

  // Determine which antibiotics actually have data
  const usedAntibiotics = COMMON_ANTIBIOTICS.filter((ab) =>
    organismList.some((org) => matrix[org.name]?.[ab.code]?.total > 0)
  );

  return {
    year,
    organisms: organismList,
    antibiotics: usedAntibiotics.map((ab) => ({ code: ab.code, name: ab.en, nameAr: ab.ar })),
    matrix,
  };
}
