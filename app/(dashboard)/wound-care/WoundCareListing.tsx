'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { WoundAssessmentForm } from '@/components/nursing/WoundAssessmentForm';
import {
  Activity, Plus, AlertCircle, Filter, X, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WoundAssessment {
  id: string;
  patientMasterId: string;
  episodeId: string | null;
  woundType: string;
  woundLocation: string;
  stage: string | null;
  length: number | null;
  width: number | null;
  depth: number | null;
  healingTrajectory: string | null;
  assessmentDate: string;
  assessedBy: string;
  painScore: number | null;
  odor: string | null;
  notes: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WOUND_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  SURGICAL:  { ar: 'جراحي',         en: 'Surgical' },
  PRESSURE:  { ar: 'قرحة ضغط',      en: 'Pressure Ulcer' },
  DIABETIC:  { ar: 'سكري',           en: 'Diabetic' },
  VASCULAR:  { ar: 'وعائي',          en: 'Vascular' },
  TRAUMATIC: { ar: 'رضي',            en: 'Traumatic' },
  BURN:      { ar: 'حروق',           en: 'Burn' },
  OTHER:     { ar: 'أخرى',           en: 'Other' },
};

const TRAJECTORY_CONFIG: Record<string, { ar: string; en: string; color: string; dot: string }> = {
  IMPROVING:     { ar: 'يتحسن',  en: 'Improving',     color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  STATIC:        { ar: 'ثابت',   en: 'Static',        color: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  DETERIORATING: { ar: 'يتدهور', en: 'Deteriorating', color: 'bg-red-100 text-red-800',     dot: 'bg-red-500' },
};

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ─── Component ────────────────────────────────────────────────────────────────

export function WoundCareListing() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const [filterWoundType, setFilterWoundType] = useState('');
  const [filterTrajectory, setFilterTrajectory] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  // Build query
  const params = new URLSearchParams();
  if (filterWoundType) params.set('woundType', filterWoundType);
  if (filterTrajectory) params.set('healingTrajectory', filterTrajectory);

  const { data, isLoading, error, mutate } = useSWR<{ assessments: WoundAssessment[] }>(
    `/api/wound-care?${params.toString()}`,
    fetcher
  );

  const assessments = data?.assessments ?? [];

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
        <Activity className="w-4 h-4 animate-pulse text-rose-500" />
        {tr('جاري تحميل تقييمات الجروح...', 'Loading wound assessments...')}
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
          <h1 className="text-xl font-bold text-foreground">{tr('رعاية الجروح', 'Wound Care')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {assessments.length} {tr('تقييم', 'assessments')}
          </p>
        </div>
        <button
          onClick={() => { setShowNew(!showNew); setEditId(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showNew ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showNew ? tr('إلغاء', 'Cancel') : tr('تقييم جديد', 'New Assessment')}
        </button>
      </div>

      {/* New Assessment Form (inline) */}
      {showNew && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5">
          <h3 className="font-semibold text-rose-800 text-sm mb-4">{tr('تقييم جرح جديد', 'New Wound Assessment')}</h3>
          <WoundAssessmentForm
            patientMasterId=""
            onSuccess={handleNewSuccess}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-card border rounded-xl p-4">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div>
          <select
            value={filterWoundType}
            onChange={e => setFilterWoundType(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-foreground focus:ring-2 focus:ring-rose-500 focus:outline-none"
          >
            <option value="">{tr('كل الأنواع', 'All Types')}</option>
            {Object.entries(WOUND_TYPE_LABELS).map(([val, l]) => (
              <option key={val} value={val}>{language === 'ar' ? l.ar : l.en}</option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={filterTrajectory}
            onChange={e => setFilterTrajectory(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-foreground focus:ring-2 focus:ring-rose-500 focus:outline-none"
          >
            <option value="">{tr('كل المسارات', 'All Trajectories')}</option>
            {Object.entries(TRAJECTORY_CONFIG).map(([val, c]) => (
              <option key={val} value={val}>{language === 'ar' ? c.ar : c.en}</option>
            ))}
          </select>
        </div>
        {(filterWoundType || filterTrajectory) && (
          <button
            onClick={() => { setFilterWoundType(''); setFilterTrajectory(''); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
            {tr('مسح الفلاتر', 'Clear')}
          </button>
        )}
      </div>

      {/* Table */}
      {assessments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{tr('لا توجد تقييمات', 'No wound assessments found')}</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {[
                  tr('المريض', 'Patient'),
                  tr('نوع الجرح', 'Wound Type'),
                  tr('الموقع', 'Location'),
                  tr('المرحلة', 'Stage'),
                  tr('مسار الشفاء', 'Trajectory'),
                  tr('تاريخ التقييم', 'Date'),
                  '',
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assessments.map(a => {
                const typeLabel = WOUND_TYPE_LABELS[a.woundType] ?? { ar: a.woundType, en: a.woundType };
                const traj = a.healingTrajectory ? TRAJECTORY_CONFIG[a.healingTrajectory] : null;
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
                        <span className="font-medium text-foreground">
                          {language === 'ar' ? typeLabel.ar : typeLabel.en}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{a.woundLocation}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.stage ?? '—'}</td>
                      <td className="px-4 py-3">
                        {traj ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${traj.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${traj.dot}`} />
                            {language === 'ar' ? traj.ar : traj.en}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
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
                        <td colSpan={7} className="bg-rose-50 px-4 py-4 border-t border-rose-100">
                          {editId === a.id ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-rose-800">{tr('تعديل التقييم', 'Edit Assessment')}</p>
                                <button
                                  onClick={() => setEditId(null)}
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                  {tr('إلغاء', 'Cancel')}
                                </button>
                              </div>
                              <WoundAssessmentForm
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
                                <p className="text-muted-foreground">
                                  {tr('الأبعاد', 'Dimensions')}: {a.length ?? '?'} × {a.width ?? '?'} × {a.depth ?? '?'} cm
                                </p>
                              </div>
                              <div>
                                <p className="font-semibold text-foreground mb-2">{tr('التقييم', 'Assessment')}</p>
                                <p className="text-muted-foreground">{tr('الألم', 'Pain')}: {a.painScore ?? '—'}/10</p>
                                <p className="text-muted-foreground">{tr('الرائحة', 'Odor')}: {a.odor ?? '—'}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-foreground mb-2">{tr('ملاحظات', 'Notes')}</p>
                                <p className="text-muted-foreground">{a.notes || tr('لا توجد ملاحظات', 'No notes')}</p>
                              </div>
                              <div className="col-span-3 flex justify-end pt-2 border-t border-rose-200">
                                <button
                                  onClick={e => { e.stopPropagation(); setEditId(a.id); }}
                                  className="text-xs text-rose-700 font-medium hover:text-rose-900 border border-rose-300 px-3 py-1 rounded-lg"
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
