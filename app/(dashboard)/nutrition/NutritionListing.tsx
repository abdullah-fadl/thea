'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { NutritionalAssessmentForm } from '@/components/nursing/NutritionalAssessmentForm';
import {
  Utensils, Plus, AlertCircle, X, ChevronDown, ChevronUp, Calendar, Users,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NutritionalAssessment {
  id: string;
  patientMasterId: string;
  episodeId: string | null;
  mustScore: number | null;
  mnaScore: number | null;
  bmi: number | null;
  height: number | null;
  weight: number | null;
  route: string | null;
  caloricNeed: number | null;
  proteinNeed: number | null;
  fluidNeed: number | null;
  appetiteStatus: string | null;
  swallowingStatus: string | null;
  recommendations: string | null;
  followUpDate: string | null;
  assessmentDate: string;
  assessedBy: string;
}

interface KPIs {
  total: number;
  atRisk: number;
  malnourished: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, { ar: string; en: string }> = {
  ORAL:       { ar: 'فموي',              en: 'Oral' },
  NGT:        { ar: 'أنبوب أنفي معدي',   en: 'NG Tube' },
  PEG:        { ar: 'أنبوب معدي جلدي',   en: 'PEG Tube' },
  TPN:        { ar: 'تغذية وريدية كاملة', en: 'TPN' },
  SUPPLEMENT: { ar: 'مكملات غذائية',     en: 'Supplement' },
};

function getMustColor(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score === 0) return 'bg-green-100 text-green-800';
  if (score === 1) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function getMustLabel(score: number | null, language: string): string {
  if (score === null) return language === 'ar' ? 'غير محدد' : 'N/A';
  if (score === 0) return language === 'ar' ? 'خطر منخفض' : 'Low Risk';
  if (score === 1) return language === 'ar' ? 'خطر متوسط' : 'Medium Risk';
  return language === 'ar' ? 'خطر مرتفع' : 'High Risk';
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ─── Component ────────────────────────────────────────────────────────────────

export function NutritionListing() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const { data, isLoading, error, mutate } = useSWR<{
    assessments: NutritionalAssessment[];
    kpis: KPIs;
  }>('/api/nutrition', fetcher);

  const assessments = data?.assessments ?? [];
  const kpis = data?.kpis ?? { total: 0, atRisk: 0, malnourished: 0 };

  const handleNewSuccess = () => {
    setShowNew(false);
    mutate();
  };

  const handleEditSuccess = (id: string) => {
    setEditId(null);
    setExpandedId(id);
    mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-8" dir={dir}>
        <Utensils className="w-4 h-4 animate-pulse text-emerald-500" />
        {tr('جاري تحميل تقييمات التغذية...', 'Loading nutritional assessments...')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 p-8" dir={dir}>
        <AlertCircle className="w-4 h-4" />
        {tr('خطأ في تحميل البيانات', 'Error loading data')}
      </div>
    );
  }

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{tr('تقييمات التغذية', 'Nutritional Assessments')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('مراقبة الحالة التغذوية للمرضى', 'Patient nutritional status monitoring')}
          </p>
        </div>
        <button
          onClick={() => { setShowNew(!showNew); setEditId(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showNew ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showNew ? tr('إلغاء', 'Cancel') : tr('تقييم جديد', 'New Assessment')}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label={tr('إجمالي التقييمات', 'Total Assessments')}
          value={kpis.total}
          color="text-foreground"
          bg="bg-muted/50 border-border"
          icon={<Users className="w-5 h-5 text-muted-foreground" />}
        />
        <KpiCard
          label={tr('في خطر (MUST ≥ 2)', 'At Risk (MUST ≥ 2)')}
          value={kpis.atRisk}
          color="text-amber-800"
          bg="bg-amber-50 border-amber-200"
          icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
        />
        <KpiCard
          label={tr('سوء تغذية (MUST ≥ 3)', 'Malnourished (MUST ≥ 3)')}
          value={kpis.malnourished}
          color="text-red-800"
          bg="bg-red-50 border-red-200"
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
        />
      </div>

      {/* New Assessment Form (inline) */}
      {showNew && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <h3 className="font-semibold text-emerald-800 text-sm mb-4">{tr('تقييم تغذوي جديد', 'New Nutritional Assessment')}</h3>
          <NutritionalAssessmentForm
            patientMasterId=""
            onSuccess={handleNewSuccess}
          />
        </div>
      )}

      {/* Table */}
      {assessments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Utensils className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{tr('لا توجد تقييمات تغذية', 'No nutritional assessments found')}</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {[
                  tr('المريض', 'Patient'),
                  tr('درجة MUST', 'MUST Score'),
                  tr('مؤشر كتلة الجسم', 'BMI'),
                  tr('طريق التغذية', 'Route'),
                  tr('السعرات (kcal/يوم)', 'Calories/day'),
                  tr('تاريخ التقييم', 'Date'),
                  '',
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assessments.map(a => {
                const routeLabel = a.route ? (ROUTE_LABELS[a.route] ?? { ar: a.route, en: a.route }) : null;
                const isExpanded = expandedId === a.id;

                return (
                  <>
                    <tr
                      key={a.id}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {a.patientMasterId.slice(-8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${getMustColor(a.mustScore)}`}>
                          {a.mustScore ?? '—'}
                          <span className="font-normal text-[10px]">— {getMustLabel(a.mustScore, language)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {a.bmi ? (
                          <span className={`text-sm font-medium ${
                            a.bmi < 18.5 ? 'text-red-600' : a.bmi < 25 ? 'text-green-700' : 'text-amber-700'
                          }`}>
                            {a.bmi}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {routeLabel ? (language === 'ar' ? routeLabel.ar : routeLabel.en) : '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {a.caloricNeed ? `${a.caloricNeed.toLocaleString()} kcal` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(a.assessmentDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-muted-foreground hover:text-muted-foreground">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <tr key={`${a.id}-detail`}>
                        <td colSpan={7} className="bg-emerald-50 px-4 py-4 border-t border-emerald-100">
                          {editId === a.id ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-emerald-800">{tr('تعديل التقييم', 'Edit Assessment')}</p>
                                <button
                                  onClick={() => setEditId(null)}
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                  {tr('إلغاء', 'Cancel')}
                                </button>
                              </div>
                              <NutritionalAssessmentForm
                                patientMasterId={a.patientMasterId}
                                episodeId={a.episodeId ?? undefined}
                                existingId={a.id}
                                onSuccess={() => handleEditSuccess(a.id)}
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <p className="font-semibold text-foreground mb-2">{tr('القياسات', 'Measurements')}</p>
                                <p className="text-muted-foreground">{tr('الطول:', 'Height:')} {a.height ? `${a.height} cm` : '—'}</p>
                                <p className="text-muted-foreground">{tr('الوزن:', 'Weight:')} {a.weight ? `${a.weight} kg` : '—'}</p>
                                <p className="text-muted-foreground">BMI: {a.bmi ?? '—'}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-foreground mb-2">{tr('الاحتياجات', 'Requirements')}</p>
                                <p className="text-muted-foreground">{tr('السعرات:', 'Calories:')} {a.caloricNeed ? `${a.caloricNeed} kcal` : '—'}</p>
                                <p className="text-muted-foreground">{tr('البروتين:', 'Protein:')} {a.proteinNeed ? `${a.proteinNeed} g` : '—'}</p>
                                <p className="text-muted-foreground">{tr('السوائل:', 'Fluids:')} {a.fluidNeed ? `${a.fluidNeed} mL` : '—'}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-foreground mb-2">{tr('التوصيات', 'Recommendations')}</p>
                                <p className="text-muted-foreground leading-relaxed">{a.recommendations || tr('لا توجد توصيات', 'No recommendations')}</p>
                                {a.followUpDate && (
                                  <p className="text-emerald-600 mt-2">
                                    {tr('متابعة:', 'Follow-up:')} {new Date(a.followUpDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB')}
                                  </p>
                                )}
                              </div>
                              <div className="col-span-3 flex justify-end pt-2 border-t border-emerald-200">
                                <button
                                  onClick={e => { e.stopPropagation(); setEditId(a.id); }}
                                  className="text-xs text-emerald-700 font-medium hover:text-emerald-900 border border-emerald-300 px-3 py-1 rounded-lg"
                                >
                                  {tr('تعديل', 'Edit')}
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, color, bg, icon,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`border rounded-xl p-4 ${bg}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
