/**
 * OPD Intelligence — Meeting Report Generator
 *
 * Generates a structured management meeting report using:
 * 1. OpenAI gpt-4o-mini (primary) — for narrative generation
 * 2. Template-based fallback — when API key unavailable or fails
 *
 * Report sections: executive summary, KPIs, department analysis,
 * doctor performance, recommendations, action items.
 */

import { logger } from '@/lib/monitoring/logger';
import { getOpenAI } from '@/lib/openai/server';
import {
  getDeptWeeklyStats,
  getNoShowPatterns,
  getDoctorMonthlyPerf,
  getMonthlyTotals,
  type DeptWeeklyStats,
  type NoShowPattern,
  type DoctorPerf,
} from './dataQueries';
import { generateRecommendations, type OPDRecommendation } from './recommendations';

// ── Types ──

export interface MeetingReportSection {
  titleAr: string;
  titleEn: string;
  contentAr: string;
  contentEn: string;
}

export interface MeetingReport {
  id: string;
  titleAr: string;
  titleEn: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  method: 'ai' | 'template';
  sections: MeetingReportSection[];
  rawDataSummary: {
    totalVisits: number;
    totalDepartments: number;
    totalDoctors: number;
    avgUtilization: number;
    avgNoShowRate: number;
    recommendations: number;
  };
}

// ── Helpers ──

function uuid(): string {
  return 'rpt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + '-01');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

// ── Data Collection ──

interface ReportData {
  weeklyStats: DeptWeeklyStats[];
  noShowPatterns: NoShowPattern[];
  doctorPerf: DoctorPerf[];
  monthlyTotals: { month: string; totalVisits: number; noShow: number; booked: number; procedures: number }[];
  recommendations: OPDRecommendation[];
}

async function collectReportData(_db: any, tenantId: string): Promise<ReportData> {
  const [weeklyStats, noShowPatterns, doctorPerf, monthlyTotals, recommendations] = await Promise.all([
    getDeptWeeklyStats(null, tenantId, 8),
    getNoShowPatterns(null, tenantId, 3),
    getDoctorMonthlyPerf(null, tenantId, 3),
    getMonthlyTotals(null, tenantId, 2),
    generateRecommendations(null, tenantId),
  ]);

  return { weeklyStats, noShowPatterns, doctorPerf, monthlyTotals, recommendations };
}

// ── Template-Based Report (Fallback) ──

function generateTemplateReport(data: ReportData): MeetingReportSection[] {
  const sections: MeetingReportSection[] = [];

  // 1. Executive Summary
  const latestMonth = data.monthlyTotals[data.monthlyTotals.length - 1];
  const prevMonth = data.monthlyTotals.length > 1 ? data.monthlyTotals[data.monthlyTotals.length - 2] : null;
  const totalVisits = latestMonth?.totalVisits || 0;
  const visitChange = prevMonth && prevMonth.totalVisits > 0
    ? Math.round(((totalVisits - prevMonth.totalVisits) / prevMonth.totalVisits) * 100)
    : 0;
  const changeDir = visitChange > 0 ? 'increase' : visitChange < 0 ? 'decrease' : 'no change';
  const changeDirAr = visitChange > 0 ? 'ارتفاع' : visitChange < 0 ? 'انخفاض' : 'استقرار';

  // Unique departments
  const deptSet = new Set(data.weeklyStats.map((w) => w.departmentId));
  const docSet = new Set(data.doctorPerf.map((d) => d.doctorId));

  // Average utilization
  const recentWeeks = data.weeklyStats
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, deptSet.size);
  const avgUtil = recentWeeks.length > 0
    ? Math.round(recentWeeks.reduce((s, w) => s + w.avgUtilization, 0) / recentWeeks.length)
    : 0;

  // Average no-show
  const avgNoShow = data.noShowPatterns.length > 0
    ? Math.round(data.noShowPatterns.reduce((s, p) => s + p.noShowRate, 0) / data.noShowPatterns.length)
    : 0;

  sections.push({
    titleAr: 'الملخص التنفيذي',
    titleEn: 'Executive Summary',
    contentAr: `خلال الفترة الأخيرة، سجّلت العيادات الخارجية ${totalVisits} زيارة (${changeDirAr} ${Math.abs(visitChange)}% عن الشهر السابق). يعمل ${deptSet.size} قسم بمتوسط استخدام ${avgUtil}% مع ${docSet.size} طبيب. نسبة عدم الحضور المتوسطة: ${avgNoShow}%. تم توليد ${data.recommendations.length} توصية ذكية تتطلب اتخاذ إجراء.`,
    contentEn: `During the recent period, OPD recorded ${totalVisits} visits (${changeDir} of ${Math.abs(visitChange)}% from previous month). ${deptSet.size} departments operate at ${avgUtil}% average utilization with ${docSet.size} doctors. Average no-show rate: ${avgNoShow}%. ${data.recommendations.length} smart recommendations generated requiring action.`,
  });

  // 2. KPI Dashboard
  const procedures = latestMonth?.procedures || 0;
  sections.push({
    titleAr: 'مؤشرات الأداء الرئيسية',
    titleEn: 'Key Performance Indicators',
    contentAr: `• إجمالي الزيارات: ${totalVisits}\n• متوسط الاستخدام: ${avgUtil}%\n• نسبة عدم الحضور: ${avgNoShow}%\n• الإجراءات: ${procedures}\n• عدد الأقسام: ${deptSet.size}\n• عدد الأطباء: ${docSet.size}`,
    contentEn: `• Total Visits: ${totalVisits}\n• Average Utilization: ${avgUtil}%\n• No-Show Rate: ${avgNoShow}%\n• Procedures: ${procedures}\n• Departments: ${deptSet.size}\n• Doctors: ${docSet.size}`,
  });

  // 3. Department Analysis
  const topDepts = [...data.noShowPatterns]
    .sort((a, b) => b.noShowRate - a.noShowRate)
    .slice(0, 5);
  const deptLinesAr = topDepts.map((d) =>
    `• ${d.departmentName}: نسبة عدم الحضور ${d.noShowRate}% (${d.totalNoShow} من ${d.totalBooked})`,
  ).join('\n');
  const deptLinesEn = topDepts.map((d) =>
    `• ${d.departmentName}: No-show rate ${d.noShowRate}% (${d.totalNoShow} of ${d.totalBooked})`,
  ).join('\n');

  sections.push({
    titleAr: 'تحليل الأقسام — الأعلى في عدم الحضور',
    titleEn: 'Department Analysis — Highest No-Show',
    contentAr: deptLinesAr || 'لا توجد بيانات كافية',
    contentEn: deptLinesEn || 'Insufficient data',
  });

  // 4. Doctor Performance
  const latestDocPerf = data.doctorPerf
    .sort((a, b) => b.month.localeCompare(a.month))
    .filter((d, i, arr) => i === arr.findIndex((x) => x.doctorId === d.doctorId));
  const topPerformers = [...latestDocPerf].sort((a, b) => b.achievement - a.achievement).slice(0, 5);
  const overloaded = latestDocPerf.filter((d) => d.achievement > 120);

  const docLinesAr = topPerformers.map((d) =>
    `• د. ${d.doctorName}: ${d.totalPatients} مريض، تحقيق ${d.achievement}%`,
  ).join('\n');
  const docLinesEn = topPerformers.map((d) =>
    `• Dr. ${d.doctorName}: ${d.totalPatients} patients, ${d.achievement}% achievement`,
  ).join('\n');

  sections.push({
    titleAr: 'أداء الأطباء',
    titleEn: 'Doctor Performance',
    contentAr: `أفضل الأطباء أداءً:\n${docLinesAr}\n\n${overloaded.length > 0 ? `[WARN] ${overloaded.length} طبيب يعمل فوق الطاقة (>120%)` : '[OK] لا يوجد إرهاق مسجّل'}`,
    contentEn: `Top performers:\n${docLinesEn}\n\n${overloaded.length > 0 ? `[WARN] ${overloaded.length} doctor(s) overloaded (>120%)` : '[OK] No burnout detected'}`,
  });

  // 5. Recommendations Summary
  const bySeverity: Record<string, OPDRecommendation[]> = {};
  for (const r of data.recommendations) {
    if (!bySeverity[r.severity]) bySeverity[r.severity] = [];
    bySeverity[r.severity].push(r);
  }

  const recLinesAr = data.recommendations.slice(0, 7).map((r) =>
    `• [${r.severity.toUpperCase()}] ${r.titleAr}: ${r.actionAr}`,
  ).join('\n');
  const recLinesEn = data.recommendations.slice(0, 7).map((r) =>
    `• [${r.severity.toUpperCase()}] ${r.titleEn}: ${r.actionEn}`,
  ).join('\n');

  sections.push({
    titleAr: 'التوصيات الذكية',
    titleEn: 'Smart Recommendations',
    contentAr: recLinesAr || 'لا توجد توصيات حالياً',
    contentEn: recLinesEn || 'No recommendations at this time',
  });

  // 6. Action Items
  const actionItemsAr = data.recommendations
    .filter((r) => r.severity === 'critical' || r.severity === 'high')
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${r.actionAr} — ${r.departmentName || r.doctorName || 'عام'}`)
    .join('\n');
  const actionItemsEn = data.recommendations
    .filter((r) => r.severity === 'critical' || r.severity === 'high')
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${r.actionEn} — ${r.departmentName || r.doctorName || 'General'}`)
    .join('\n');

  sections.push({
    titleAr: 'بنود العمل المطلوبة',
    titleEn: 'Action Items',
    contentAr: actionItemsAr || 'لا توجد بنود عاجلة',
    contentEn: actionItemsEn || 'No urgent items',
  });

  return sections;
}

// ── OpenAI-Based Report ──

async function generateAIReport(data: ReportData): Promise<MeetingReportSection[] | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  // Prepare compact data summary for the prompt
  const summary = {
    monthlyTotals: data.monthlyTotals,
    departmentNoShow: data.noShowPatterns.map((p) => ({
      dept: p.departmentName,
      rate: p.noShowRate,
      total: p.totalBooked,
    })),
    topDoctors: data.doctorPerf
      .sort((a, b) => b.month.localeCompare(a.month))
      .filter((d, i, arr) => i === arr.findIndex((x) => x.doctorId === d.doctorId))
      .slice(0, 10)
      .map((d) => ({
        name: d.doctorName,
        patients: d.totalPatients,
        achievement: d.achievement,
      })),
    recommendations: data.recommendations.slice(0, 10).map((r) => ({
      type: r.type,
      severity: r.severity,
      titleEn: r.titleEn,
      actionEn: r.actionEn,
    })),
    avgUtil: data.weeklyStats.length > 0
      ? Math.round(data.weeklyStats.reduce((s, w) => s + w.avgUtilization, 0) / data.weeklyStats.length)
      : 0,
  };

  const prompt = `You are a hospital OPD management consultant. Generate a meeting report in JSON format.

DATA:
${JSON.stringify(summary, null, 2)}

Return EXACTLY this JSON structure (no markdown, no code fences):
{
  "sections": [
    {
      "titleAr": "Arabic section title",
      "titleEn": "English section title",
      "contentAr": "Arabic content with bullet points using •",
      "contentEn": "English content with bullet points using •"
    }
  ]
}

Include these 6 sections:
1. Executive Summary — 3-4 sentence overview with key numbers
2. Key Performance Indicators — bullet list of 6 KPIs
3. Department Analysis — focus on problem areas (high no-show, low utilization)
4. Doctor Performance — top performers and overloaded doctors
5. Smart Recommendations — top 5 actionable recommendations
6. Action Items — numbered list of 3-5 urgent next steps

Rules:
- Arabic content must be professional medical Arabic
- Use specific numbers from the data
- Keep each section concise (3-8 lines)
- Focus on actionable insights, not raw data`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (parsed.sections && Array.isArray(parsed.sections)) {
      return parsed.sections as MeetingReportSection[];
    }
    return null;
  } catch (err) {
    logger.error('OpenAI report generation failed', { category: 'opd', error: err });
    return null;
  }
}

// ── Main Entry Point ──

export async function generateMeetingReport(
  _db: any,
  tenantId: string,
): Promise<MeetingReport> {
  const data = await collectReportData(null, tenantId);

  // Try AI first, fallback to template
  let sections = await generateAIReport(data);
  let method: 'ai' | 'template' = 'ai';

  if (!sections || sections.length === 0) {
    sections = generateTemplateReport(data);
    method = 'template';
  }

  // Compute raw data summary
  const deptSet = new Set(data.weeklyStats.map((w) => w.departmentId));
  const docSet = new Set(data.doctorPerf.map((d) => d.doctorId));
  const recentWeeks = data.weeklyStats
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, deptSet.size);
  const avgUtil = recentWeeks.length > 0
    ? Math.round(recentWeeks.reduce((s, w) => s + w.avgUtilization, 0) / recentWeeks.length)
    : 0;
  const avgNoShow = data.noShowPatterns.length > 0
    ? Math.round(data.noShowPatterns.reduce((s, p) => s + p.noShowRate, 0) / data.noShowPatterns.length)
    : 0;
  const latestMonth = data.monthlyTotals[data.monthlyTotals.length - 1];

  // Period dates
  const sortedWeeks = data.weeklyStats.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const periodStart = sortedWeeks[0]?.weekStart || new Date().toISOString().split('T')[0];
  const periodEnd = sortedWeeks[sortedWeeks.length - 1]?.weekStart || periodStart;

  return {
    id: uuid(),
    titleAr: 'تقرير اجتماع العيادات الخارجية',
    titleEn: 'OPD Management Meeting Report',
    generatedAt: new Date().toISOString(),
    periodStart,
    periodEnd,
    method,
    sections,
    rawDataSummary: {
      totalVisits: latestMonth?.totalVisits || 0,
      totalDepartments: deptSet.size,
      totalDoctors: docSet.size,
      avgUtilization: avgUtil,
      avgNoShowRate: avgNoShow,
      recommendations: data.recommendations.length,
    },
  };
}
