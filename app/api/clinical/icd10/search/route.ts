import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { searchWHOIcd, isWHOApiConfigured } from '@/lib/clinical/whoIcdApi';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ── Fallback: in-memory JSON data (loaded once) ───────────────────
// Used when Icd10Code table is not yet seeded
let jsonFallback: any[] | null = null;

async function getJsonFallback() {
  if (jsonFallback) return jsonFallback;
  try {
    const data = await import('@/data/icd10-comprehensive.json');
    jsonFallback = Array.isArray(data.default) ? data.default : (data as any);
    return jsonFallback;
  } catch {
    try {
      const data = await import('@/data/icd10-codes.json');
      jsonFallback = Array.isArray(data.default) ? data.default : (data as any);
      return jsonFallback;
    } catch {
      return [];
    }
  }
}

// ── Synonym map for common search terms ───────────────────────────
const SYNONYMS: Record<string, string[]> = {
  'J06.9': ['urti', 'cold', 'flu', 'upper respiratory', 'برد', 'انفلونزا', 'رشح', 'زكام'],
  'J00': ['cold', 'nasopharyngitis', 'برد', 'زكام', 'رشح'],
  'J02.9': ['sore throat', 'pharyngitis', 'التهاب حلق', 'حلق'],
  'J03.90': ['tonsillitis', 'tonsils', 'لوز', 'لوزتين'],
  'J20.9': ['bronchitis', 'cough', 'سعال', 'كحة'],
  'J45.20': ['asthma', 'wheezing', 'ربو'],
  'J44.9': ['copd', 'emphysema', 'انسداد رئوي'],
  'I10': ['hypertension', 'htn', 'high blood pressure', 'bp', 'ضغط', 'ضغط الدم'],
  'E11.9': ['diabetes', 'dm', 'dm2', 'sugar', 'سكري', 'سكر'],
  'E10.9': ['diabetes', 'dm', 'dm1', 'type 1', 'سكري'],
  'E78.5': ['cholesterol', 'lipids', 'hyperlipidemia', 'كوليسترول', 'دهون'],
  'E03.9': ['hypothyroid', 'thyroid', 'درقية', 'غدة درقية'],
  'E66.9': ['obesity', 'overweight', 'bmi', 'سمنة', 'وزن'],
  'E55.9': ['vitamin d', 'vit d', 'فيتامين د'],
  'K21.9': ['gerd', 'reflux', 'heartburn', 'acid', 'حموضة', 'ارتجاع'],
  'K29.70': ['gastritis', 'stomach inflammation', 'التهاب المعدة', 'معدة'],
  'K30': ['dyspepsia', 'indigestion', 'عسر هضم'],
  'K58.9': ['ibs', 'irritable bowel', 'قولون عصبي', 'قولون'],
  'K59.0': ['constipation', 'إمساك'],
  'M54.5': ['backache', 'lbp', 'low back', 'ظهر', 'الم الظهر'],
  'M54.2': ['neck pain', 'cervical', 'ألم رقبة', 'رقبة'],
  'M25.50': ['joint pain', 'arthralgia', 'ألم مفصل', 'مفصل'],
  'M17.9': ['knee', 'oa knee', 'osteoarthritis', 'ركبة', 'خشونة'],
  'G43.909': ['migraine', 'headache', 'صداع نصفي', 'شقيقة'],
  'G47.00': ['insomnia', 'sleep', 'أرق', 'نوم'],
  'N39.0': ['uti', 'urinary infection', 'التهاب بول', 'مسالك'],
  'N20.0': ['kidney stone', 'renal stone', 'حصاة كلية', 'حصوة'],
  'F41.1': ['anxiety', 'gad', 'قلق'],
  'F32.9': ['depression', 'depressed', 'اكتئاب'],
  'R50.9': ['fever', 'temperature', 'حمى', 'حرارة'],
  'R05.9': ['cough', 'سعال', 'كحة'],
  'R06.02': ['dyspnea', 'sob', 'breathless', 'ضيق تنفس'],
  'R07.9': ['chest pain', 'ألم صدري', 'صدر'],
  'R10.9': ['abdominal pain', 'belly pain', 'ألم بطن', 'بطن', 'مغص'],
  'R11.2': ['nausea', 'vomiting', 'غثيان', 'قيء', 'استفراغ'],
  'R51.9': ['headache', 'صداع'],
  'R42': ['dizziness', 'vertigo', 'دوخة', 'دوار'],
  'R53.83': ['fatigue', 'tired', 'إرهاق', 'تعب'],
  'L50.9': ['urticaria', 'hives', 'rash', 'شرى', 'حساسية جلدية'],
  'L70.0': ['acne', 'pimples', 'حب شباب'],
  'I50.9': ['heart failure', 'chf', 'فشل قلبي'],
  'I48.91': ['afib', 'atrial fibrillation', 'رجفان أذيني'],
  'K80.20': ['gallstones', 'cholelithiasis', 'حصاة مرارة'],
  'H25.9': ['cataract', 'ساد', 'ماء أبيض', 'كتاراكت'],
  'H40.9': ['glaucoma', 'جلوكوما', 'ماء أزرق', 'زرق'],
  'S72.009A': ['femur fracture', 'hip fracture', 'كسر فخذ'],
  'S52.509A': ['forearm fracture', 'radius fracture', 'كسر ساعد'],
  'S42.009A': ['shoulder fracture', 'clavicle fracture', 'كسر كتف'],
  'C34.90': ['lung cancer', 'سرطان رئة'],
  'C50.919': ['breast cancer', 'سرطان ثدي'],
  'O80': ['normal delivery', 'ولادة طبيعية', 'توليد'],
  'O82': ['cesarean', 'c-section', 'قيصرية'],
  'Z00.00': ['general exam', 'checkup', 'فحص شامل', 'كشف'],
};

// ── Search: DB-first → JSON fallback → WHO API ────────────────────

interface ScoredItem {
  code: string;
  shortDesc: string;
  shortDescAr?: string;
  category?: string;
  chapter?: string;
  isCommon: boolean;
  score: number;
  source: 'db' | 'local' | 'who' | 'tenant';
}

/**
 * Search local DB (Icd10Code table). Returns scored results.
 */
async function searchDatabase(query: string, limit: number): Promise<ScoredItem[]> {
  try {
    const results = await (prisma as any).icd10Code.findMany({
      where: {
        OR: [
          { code: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { descriptionAr: { contains: query, mode: 'insensitive' } },
          { synonyms: { hasSome: [query] } },
        ],
      },
      orderBy: [{ isCommon: 'desc' }, { code: 'asc' }],
      take: limit * 2, // Fetch extra for scoring
    });

    return results.map((r: any) => {
      const code = String(r.code).toLowerCase();
      let score = 0;
      if (code === query.toLowerCase()) score += 100;
      else if (code.startsWith(query.toLowerCase())) score += 50;
      else if (code.includes(query.toLowerCase())) score += 30;
      if (r.isCommon) score += 20;
      if (String(r.description || '').toLowerCase().includes(query.toLowerCase())) score += 10;
      if (String(r.descriptionAr || '').toLowerCase().includes(query.toLowerCase())) score += 10;

      return {
        code: r.code,
        shortDesc: r.description,
        shortDescAr: r.descriptionAr,
        category: r.category,
        chapter: r.chapter,
        isCommon: r.isCommon,
        score,
        source: 'db' as const,
      };
    });
  } catch {
    // Table might not exist yet — fall through to JSON
    return [];
  }
}

/**
 * Search tenant-specific DiagnosisCatalog.
 */
async function searchTenantCatalog(query: string, tenantId: string, limit: number): Promise<ScoredItem[]> {
  try {
    const results = await prisma.diagnosisCatalog.findMany({
      where: {
        tenantId,
        OR: [
          { code: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { icd10: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });

    return results.map((r) => ({
      code: r.icd10 || r.code,
      shortDesc: r.name,
      shortDescAr: undefined,
      category: r.category || 'Custom',
      chapter: undefined,
      isCommon: false,
      score: 15, // Tenant codes get moderate priority
      source: 'tenant' as const,
    }));
  } catch {
    return [];
  }
}

/**
 * Search in-memory JSON fallback (when DB table is empty).
 */
async function searchJsonFallback(query: string, limit: number): Promise<ScoredItem[]> {
  const data = await getJsonFallback();
  if (!data || data.length === 0) return [];

  const q = query.toLowerCase();
  const scored: ScoredItem[] = [];

  for (const item of data) {
    const code = String(item.code || '').toLowerCase();
    const desc = String(item.description || '').toLowerCase();
    const descAr = String(item.descriptionAr || '').toLowerCase();
    const synonyms = SYNONYMS[item.code] || [];

    const codeMatch = code.includes(q);
    const descMatch = desc.includes(q);
    const descArMatch = descAr.includes(q);
    const synonymMatch = synonyms.some((s) => s.toLowerCase().includes(q));

    if (!codeMatch && !descMatch && !descArMatch && !synonymMatch) continue;

    let score = 0;
    if (code === q) score += 100;
    else if (code.startsWith(q)) score += 50;
    else if (codeMatch) score += 30;
    if (item.isCommon) score += 20;
    if (descMatch || descArMatch) score += 10;
    if (synonymMatch) score += 5;

    scored.push({
      code: item.code,
      shortDesc: item.description,
      shortDescAr: item.descriptionAr,
      category: item.category,
      chapter: item.chapter,
      isCommon: !!item.isCommon,
      score,
      source: 'local',
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ── Main route handler ─────────────────────────────────────────────

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const query = req.nextUrl.searchParams.get('q')?.trim() || '';
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 25, 1), 100);
    const includeWho = req.nextUrl.searchParams.get('who') !== 'false';

    if (query.length < 2) {
      return NextResponse.json({ items: [], source: 'none' });
    }

    // 1. Search local DB (Icd10Code table)
    let dbResults = await searchDatabase(query, limit);

    // 2. Search tenant-specific DiagnosisCatalog
    const tenantResults = await searchTenantCatalog(query, tenantId, 10);

    // 3. If DB has few results, supplement with JSON fallback
    let jsonResults: ScoredItem[] = [];
    if (dbResults.length < limit / 2) {
      jsonResults = await searchJsonFallback(query, limit);
    }

    // Merge & deduplicate (DB > tenant > JSON)
    const seen = new Set<string>();
    const merged: ScoredItem[] = [];

    for (const item of [...dbResults, ...tenantResults, ...jsonResults]) {
      const key = item.code.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    // Sort by score
    merged.sort((a, b) => b.score - a.score);
    let items = merged.slice(0, limit);

    // 4. If still not enough results and WHO API is configured, call it
    let whoUsed = false;
    if (items.length < 5 && includeWho && isWHOApiConfigured()) {
      try {
        const whoResults = await searchWHOIcd(query, { limit: limit - items.length });
        for (const w of whoResults) {
          const key = w.code.toUpperCase();
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({
            code: w.code,
            shortDesc: w.description,
            shortDescAr: w.descriptionAr,
            category: w.category || 'WHO',
            chapter: w.chapter,
            isCommon: false,
            score: 1,
            source: 'who',
          });
        }
        whoUsed = whoResults.length > 0;
      } catch (error) {
        logger.error('WHO ICD fallback failed', { category: 'clinical', query, error });
      }
    }

    // Format response
    const responseItems = items.map((item) => ({
      code: item.code,
      shortDesc: item.shortDesc,
      shortDescAr: item.shortDescAr,
      category: item.category,
      chapter: item.chapter,
      isCommon: item.isCommon,
      source: item.source,
    }));

    return NextResponse.json({
      items: responseItems,
      total: responseItems.length,
      sources: {
        db: dbResults.length,
        tenant: tenantResults.length,
        json: jsonResults.length,
        who: whoUsed,
        whoConfigured: isWHOApiConfigured(),
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.view' }
);
