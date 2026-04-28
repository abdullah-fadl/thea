'use client';

import { useLang } from '@/hooks/use-lang';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import {
  AlertTriangle, ShieldAlert, ShieldCheck, Info,
  Brain, TrendingUp, TrendingDown, Minus, Zap,
  FileText, Loader2, Target, AlertCircle,
} from 'lucide-react';
import RecommendationCard from './RecommendationCard';

interface StrategicTabProps {
  analytics: any;
  departments: any[];
}

const DOCTOR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#06B6D4'];

const RISK_CONFIG: Record<string, { color: string; bg: string; border: string; icon: any; labelAr: string; labelEn: string }> = {
  CRITICAL: { color: 'text-red-800', bg: 'bg-red-50', border: 'border-red-300', icon: ShieldAlert, labelAr: 'حرج', labelEn: 'Critical' },
  HIGH: { color: 'text-orange-800', bg: 'bg-orange-50', border: 'border-orange-300', icon: AlertTriangle, labelAr: 'مرتفع', labelEn: 'High' },
  MODERATE: { color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-300', icon: Info, labelAr: 'متوسط', labelEn: 'Moderate' },
  LOW: { color: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-300', icon: ShieldCheck, labelAr: 'منخفض', labelEn: 'Low' },
};

type SubTab = 'overview' | 'recommendations' | 'forecasts' | 'report';

export default function StrategicTab({ analytics, departments }: StrategicTabProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [whatIfDoctor, setWhatIfDoctor] = useState<string>('');
  const [whatIfDuration, setWhatIfDuration] = useState<'1day' | '1week' | '1month'>('1week');

  // Intelligence data
  const [intelligence, setIntelligence] = useState<any>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const contributions = analytics?.doctorContributions || [];
  const risks = analytics?.departmentRisks || [];

  // ── Fetch intelligence data ──
  const fetchIntelligence = useCallback(async () => {
    setIntelLoading(true);
    try {
      const res = await fetch('/api/opd/dashboard/intelligence?section=all', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setIntelligence(data);
      }
    } catch (err) {
      console.error('Intelligence fetch error:', err);
    } finally {
      setIntelLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntelligence();
  }, [fetchIntelligence]);

  // ── Fetch meeting report ──
  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const res = await fetch('/api/opd/dashboard/intelligence/report', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setReportLoading(false);
    }
  }, []);

  // ── Recommendation actions ──
  const handleAcknowledge = useCallback(async (id: string) => {
    try {
      await fetch(`/api/opd/dashboard/intelligence/recommendations/${id}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge' }),
      });
      // Refresh
      fetchIntelligence();
    } catch (err) {
      console.error('Acknowledge error:', err);
    }
  }, [fetchIntelligence]);

  const handleDismiss = useCallback(async (id: string, reason: string) => {
    try {
      await fetch(`/api/opd/dashboard/intelligence/recommendations/${id}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', reason }),
      });
      fetchIntelligence();
    } catch (err) {
      console.error('Dismiss error:', err);
    }
  }, [fetchIntelligence]);

  // ── Existing data ──
  const allDoctors = useMemo(() => {
    const docs: any[] = [];
    for (const dept of contributions) {
      for (const doc of (dept.doctors || [])) {
        docs.push({ ...doc, department: dept.departmentName });
      }
    }
    return docs;
  }, [contributions]);

  const whatIfResult = useMemo(() => {
    if (!whatIfDoctor) return null;
    const doc = allDoctors.find((d) => d.doctorId === whatIfDoctor);
    if (!doc) return null;
    const multiplier = whatIfDuration === '1day' ? 1 : whatIfDuration === '1week' ? 5 : 22;
    return {
      name: doc.doctorName,
      department: doc.department,
      patientsAffected: doc.visits * multiplier,
      share: doc.share,
    };
  }, [whatIfDoctor, whatIfDuration, allDoctors]);

  const alerts = useMemo(() => {
    const a: { severity: 'critical' | 'high' | 'medium'; type: string; messageAr: string; messageEn: string; actionAr: string; actionEn: string }[] = [];
    for (const risk of risks) {
      if (risk.riskLevel === 'CRITICAL') {
        a.push({
          severity: 'critical', type: 'dependency',
          messageAr: `${risk.highestDoctor.name} يمثل ${risk.highestDoctor.share}% من ${risk.departmentName}`,
          messageEn: `${risk.highestDoctor.name} represents ${risk.highestDoctor.share}% of ${risk.departmentName}`,
          actionAr: 'تعيين طبيب إضافي أو توزيع الحمل', actionEn: 'Assign additional doctor or redistribute load',
        });
      }
    }
    for (const dept of departments) {
      if ((dept.utilization || 0) > 90) {
        a.push({
          severity: 'high', type: 'capacity',
          messageAr: `${dept.departmentName} وصلت ${dept.utilization}% — لا يوجد مرونة`,
          messageEn: `${dept.departmentName} at ${dept.utilization}% — no flexibility`,
          actionAr: 'إضافة ساعات عمل أو عيادات إضافية', actionEn: 'Add work hours or additional clinics',
        });
      }
    }
    for (const dept of departments) {
      const noShowRate = dept.booked > 0 ? Math.round(((dept.noShow || 0) / dept.booked) * 100) : 0;
      if (noShowRate > 20) {
        a.push({
          severity: 'medium', type: 'no-show',
          messageAr: `نسبة عدم الحضور بـ${dept.departmentName}: ${noShowRate}%`,
          messageEn: `No-show rate at ${dept.departmentName}: ${noShowRate}%`,
          actionAr: 'تفعيل تذكيرات المواعيد والحجز الزائد', actionEn: 'Enable appointment reminders and overbooking',
        });
      }
    }
    return a.sort((x, y) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2 };
      return (order[x.severity] ?? 2) - (order[y.severity] ?? 2);
    });
  }, [risks, departments]);

  const chartData = useMemo(() => {
    return contributions.map((dept: any) => {
      const entry: any = { department: dept.departmentName };
      for (const doc of (dept.doctors || [])) entry[doc.doctorName] = doc.share;
      return entry;
    });
  }, [contributions]);

  const allDoctorNames = useMemo(() => {
    const names = new Set<string>();
    for (const dept of contributions) {
      for (const doc of (dept.doctors || [])) names.add(doc.doctorName);
    }
    return Array.from(names);
  }, [contributions]);

  // Intelligence derived data
  const recommendations = intelligence?.recommendations || [];
  const forecasts = intelligence?.forecasts || null;
  const anomalies = intelligence?.anomalies || [];
  const accuracy = intelligence?.accuracy || null;

  // ── Sub-tab definitions ──
  const SUB_TABS: { key: SubTab; labelAr: string; labelEn: string; icon: any }[] = [
    { key: 'overview', labelAr: 'نظرة عامة', labelEn: 'Overview', icon: Brain },
    { key: 'recommendations', labelAr: 'التوصيات', labelEn: 'Recommendations', icon: Zap },
    { key: 'forecasts', labelAr: 'التنبؤات', labelEn: 'Forecasts', icon: TrendingUp },
    { key: 'report', labelAr: 'تقرير الاجتماع', labelEn: 'Meeting Report', icon: FileText },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 bg-card rounded-xl border border-slate-200 p-1">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setSubTab(tab.key);
                if (tab.key === 'report' && !report) fetchReport();
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                isActive ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tr(tab.labelAr, tab.labelEn)}
              {tab.key === 'recommendations' && recommendations.length > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {recommendations.filter((r: any) => !r.acknowledged).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading overlay */}
      {intelLoading && !intelligence && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span className="text-sm text-slate-500 ms-2">{tr('جاري تحميل الذكاء...', 'Loading intelligence...')}</span>
        </div>
      )}

      {/* ═══ OVERVIEW SUB-TAB ═══ */}
      {subTab === 'overview' && (
        <div className="space-y-5">
          {/* Anomaly alerts */}
          {anomalies.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <AlertCircle className="w-4 h-4 text-red-500" />
                {tr('شذوذ مكتشف', 'Detected Anomalies')}
              </div>
              {anomalies.slice(0, 5).map((anom: any, idx: number) => {
                const severityColors: Record<string, string> = {
                  critical: 'bg-red-50 border-red-200 text-red-800',
                  high: 'bg-orange-50 border-orange-200 text-orange-800',
                  medium: 'bg-amber-50 border-amber-200 text-amber-800',
                };
                return (
                  <div key={idx} className={`border rounded-lg p-3 ${severityColors[anom.severity] || severityColors.medium}`}>
                    <div className="text-sm font-medium">
                      {language === 'ar' ? anom.titleAr : anom.titleEn}
                    </div>
                    <div className="text-xs opacity-75 mt-1">
                      {language === 'ar' ? anom.descriptionAr : anom.descriptionEn}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Smart Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-800">{tr('تنبيهات ذكية', 'Smart Alerts')}</div>
              {alerts.map((alert, idx) => {
                const severityConfig = {
                  critical: { bg: 'bg-red-50', border: 'border-red-200', Icon: AlertCircle, iconColor: 'text-red-500', textColor: 'text-red-800' },
                  high: { bg: 'bg-orange-50', border: 'border-orange-200', Icon: AlertTriangle, iconColor: 'text-orange-500', textColor: 'text-orange-800' },
                  medium: { bg: 'bg-amber-50', border: 'border-amber-200', Icon: AlertCircle, iconColor: 'text-yellow-500', textColor: 'text-amber-800' },
                }[alert.severity];
                const SeverityIcon = severityConfig.Icon;
                return (
                  <div key={idx} className={`${severityConfig.bg} border ${severityConfig.border} rounded-lg p-3`}>
                    <div className={`text-sm font-medium ${severityConfig.textColor} flex items-center gap-1.5`}>
                      <SeverityIcon className={`w-4 h-4 ${severityConfig.iconColor} shrink-0`} /> {language === 'ar' ? alert.messageAr : alert.messageEn}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {tr('إجراء مقترح', 'Suggested action')}: {language === 'ar' ? alert.actionAr : alert.actionEn}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Accuracy summary */}
          {accuracy && accuracy.totalTracked > 0 && (
            <div className="bg-card rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
                <Target className="w-4 h-4 text-indigo-500" />
                {tr('دقة التوصيات', 'Recommendation Accuracy')}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{accuracy.accuracyRate}%</div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">{tr('الدقة', 'Accuracy')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{accuracy.actedUponRate}%</div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">{tr('تم التطبيق', 'Acted Upon')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{accuracy.improvementRate}%</div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">{tr('تحسّن بعد التطبيق', 'Improved After')}</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 text-center mt-2">
                {tr(`بناءً على ${accuracy.totalTracked} توصية`, `Based on ${accuracy.totalTracked} recommendations`)}
              </div>
            </div>
          )}

          {/* Doctor Contribution Chart */}
          {chartData.length > 0 && (
            <div className="bg-card rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-800 mb-3">
                {tr('حصة مساهمة الأطباء حسب القسم', 'Doctor Contribution Share by Department')}
              </div>
              <ResponsiveContainer width="100%" height={Math.max(200, contributions.length * 50)}>
                <BarChart layout="vertical" data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <YAxis dataKey="department" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={120} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {allDoctorNames.map((name, idx) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={DOCTOR_COLORS[idx % DOCTOR_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Dependency Risk Cards */}
          {risks.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-800">{tr('تحليل خطر التبعية', 'Dependency Risk Analysis')}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {risks
                  .filter((r: any) => r.riskLevel !== 'LOW')
                  .map((risk: any) => {
                    const riskConfig = RISK_CONFIG[risk.riskLevel] || RISK_CONFIG.LOW;
                    const IconComp = riskConfig.icon;
                    return (
                      <div key={risk.departmentId} className={`border-2 ${riskConfig.border} ${riskConfig.bg} rounded-xl p-4`}>
                        <div className={`flex items-center gap-2 text-sm font-bold ${riskConfig.color}`}>
                          <IconComp className="w-4 h-4" />
                          {risk.departmentName} — {tr(riskConfig.labelAr, riskConfig.labelEn)}
                        </div>
                        <div className={`text-xs ${riskConfig.color} mt-1 opacity-80`}>
                          {risk.highestDoctor.name} {tr('يمثل', 'represents')} {risk.highestDoctor.share}% {tr('من مرضى القسم', 'of dept patients')}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* What-If Calculator */}
          <div className="bg-card rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-800 mb-3">
              {tr('محاكاة "ماذا لو" — غياب طبيب', 'What-If Simulation — Doctor Absence')}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={whatIfDoctor}
                onChange={(e) => setWhatIfDoctor(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-card min-w-[200px]"
              >
                <option value="">{tr('اختر طبيب...', 'Select doctor...')}</option>
                {allDoctors.map((doc) => (
                  <option key={doc.doctorId} value={doc.doctorId}>{doc.doctorName} ({doc.department})</option>
                ))}
              </select>
              <select
                value={whatIfDuration}
                onChange={(e) => setWhatIfDuration(e.target.value as '1day' | '1week' | '1month')}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-card"
              >
                <option value="1day">{tr('يوم واحد', '1 Day')}</option>
                <option value="1week">{tr('أسبوع', '1 Week')}</option>
                <option value="1month">{tr('شهر', '1 Month')}</option>
              </select>
            </div>
            {whatIfResult && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm font-medium text-red-800">
                  {tr('لو غاب', 'If absent')}: {whatIfResult.name}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <div className="text-[10px] text-red-500 uppercase font-semibold">{tr('المرضى المتأثرين', 'Patients Affected')}</div>
                    <div className="text-xl font-bold text-red-700">{whatIfResult.patientsAffected}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-red-500 uppercase font-semibold">{tr('حصة القسم', 'Dept Share')}</div>
                    <div className="text-xl font-bold text-red-700">{whatIfResult.share}%</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ RECOMMENDATIONS SUB-TAB ═══ */}
      {subTab === 'recommendations' && (
        <div className="space-y-3">
          {recommendations.length === 0 && !intelLoading && (
            <div className="bg-card rounded-xl border border-slate-200 p-8 text-center">
              <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="text-sm text-slate-500">{tr('لا توجد توصيات حالياً', 'No recommendations at this time')}</div>
              <div className="text-xs text-slate-400 mt-1">{tr('سيتم توليد توصيات عند توفر بيانات كافية', 'Recommendations will be generated when sufficient data is available')}</div>
            </div>
          )}
          {recommendations.map((rec: any) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onAcknowledge={handleAcknowledge}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}

      {/* ═══ FORECASTS SUB-TAB ═══ */}
      {subTab === 'forecasts' && (
        <div className="space-y-5">
          {/* Weekly forecast chart */}
          {forecasts?.weeklyForecasts && forecasts.weeklyForecasts.length > 0 && (
            <div className="bg-card rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-800 mb-3">
                {tr('التنبؤ الأسبوعي بالطلب', 'Weekly Demand Forecast')}
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={forecasts.weeklyForecasts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="departmentName" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <Bar dataKey="predictedPatients" fill="#6366F1" radius={[4, 4, 0, 0]} name={tr('متوقع', 'Predicted')} />
                </BarChart>
              </ResponsiveContainer>
              {/* Trend indicators */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                {forecasts.weeklyForecasts.map((wf: any) => {
                  const TrendIcon = wf.trend === 'increasing' ? TrendingUp : wf.trend === 'decreasing' ? TrendingDown : Minus;
                  const trendColor = wf.trend === 'increasing' ? 'text-emerald-600' : wf.trend === 'decreasing' ? 'text-red-600' : 'text-slate-500';
                  return (
                    <div key={`${wf.departmentId}_${wf.weekStart}`} className="bg-slate-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500 truncate">{wf.departmentName}</div>
                      <div className="text-lg font-bold text-slate-800">{wf.predictedPatients}</div>
                      <div className={`flex items-center justify-center gap-1 text-[10px] ${trendColor}`}>
                        <TrendIcon className="w-3 h-3" />
                        {wf.trendPercent}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily forecast timeline */}
          {forecasts?.dailyForecasts && forecasts.dailyForecasts.length > 0 && (
            <div className="bg-card rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-800 mb-3">
                {tr('التنبؤ اليومي', 'Daily Forecast')}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-2 py-1.5 text-left text-slate-500 font-medium">{tr('القسم', 'Dept')}</th>
                      <th className="px-2 py-1.5 text-left text-slate-500 font-medium">{tr('التاريخ', 'Date')}</th>
                      <th className="px-2 py-1.5 text-left text-slate-500 font-medium">{tr('اليوم', 'Day')}</th>
                      <th className="px-2 py-1.5 text-center text-slate-500 font-medium">{tr('متوقع', 'Predicted')}</th>
                      <th className="px-2 py-1.5 text-center text-slate-500 font-medium">{tr('النطاق', 'Range')}</th>
                      <th className="px-2 py-1.5 text-center text-slate-500 font-medium">{tr('الثقة', 'Confidence')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {forecasts.dailyForecasts.slice(0, 20).map((df: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-2 py-1.5 text-slate-700 font-medium whitespace-nowrap">{df.departmentName}</td>
                        <td className="px-2 py-1.5 text-slate-600">{df.date}</td>
                        <td className="px-2 py-1.5 text-slate-600">{df.dayName}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-indigo-600">{df.predictedPatients}</td>
                        <td className="px-2 py-1.5 text-center text-slate-400">{df.lowerBound}–{df.upperBound}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                            df.confidence >= 70 ? 'bg-emerald-100 text-emerald-700' :
                            df.confidence >= 50 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {df.confidence}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Staffing gaps */}
          {forecasts?.staffingGaps && forecasts.staffingGaps.length > 0 && (
            <div className="bg-card rounded-xl border border-red-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-800 mb-3">
                <AlertTriangle className="w-4 h-4" />
                {tr('فجوات التوظيف المتوقعة', 'Predicted Staffing Gaps')}
              </div>
              <div className="space-y-2">
                {forecasts.staffingGaps.slice(0, 10).map((gap: any, idx: number) => (
                  <div key={idx} className="bg-red-50/50 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-800">
                        {gap.departmentName} — {gap.dayName} ({gap.date})
                      </span>
                      <span className="text-xs font-bold text-red-600">+{gap.gap} {tr('مريض', 'pts')}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {language === 'ar' ? gap.recommendationAr : gap.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!forecasts || !forecasts.weeklyForecasts?.length) && !intelLoading && (
            <div className="bg-card rounded-xl border border-slate-200 p-8 text-center">
              <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="text-sm text-slate-500">{tr('لا توجد تنبؤات حالياً', 'No forecasts available')}</div>
              <div className="text-xs text-slate-400 mt-1">{tr('يتطلب بيانات 4 أسابيع على الأقل', 'Requires at least 4 weeks of data')}</div>
            </div>
          )}
        </div>
      )}

      {/* ═══ MEETING REPORT SUB-TAB ═══ */}
      {subTab === 'report' && (
        <div className="space-y-4">
          {reportLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span className="text-sm text-slate-500 ms-2">{tr('جاري توليد التقرير...', 'Generating report...')}</span>
            </div>
          )}

          {report && !reportLoading && (
            <>
              {/* Report header */}
              <div className="bg-card rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-slate-800">
                      {language === 'ar' ? report.titleAr : report.titleEn}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {tr('الفترة', 'Period')}: {report.periodStart} → {report.periodEnd}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[9px] font-semibold px-2 py-1 rounded-full ${
                      report.method === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {report.method === 'ai' ? 'AI Generated' : 'Template'}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {new Date(report.generatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Summary KPI row */}
                {report.rawDataSummary && (
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3 pt-3 border-t border-slate-100">
                    {[
                      { label: tr('الزيارات', 'Visits'), value: report.rawDataSummary.totalVisits },
                      { label: tr('الأقسام', 'Depts'), value: report.rawDataSummary.totalDepartments },
                      { label: tr('الأطباء', 'Doctors'), value: report.rawDataSummary.totalDoctors },
                      { label: tr('الاستخدام', 'Util'), value: `${report.rawDataSummary.avgUtilization}%` },
                      { label: tr('عدم حضور', 'No-show'), value: `${report.rawDataSummary.avgNoShowRate}%` },
                      { label: tr('التوصيات', 'Recs'), value: report.rawDataSummary.recommendations },
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <div className="text-lg font-bold text-slate-800">{item.value}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-semibold">{item.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Report sections */}
              {report.sections?.map((section: any, idx: number) => (
                <div key={idx} className="bg-card rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-800 mb-2">
                    {language === 'ar' ? section.titleAr : section.titleEn}
                  </div>
                  <div className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                    {language === 'ar' ? section.contentAr : section.contentEn}
                  </div>
                </div>
              ))}

              {/* Regenerate button */}
              <div className="text-center">
                <button
                  onClick={fetchReport}
                  disabled={reportLoading}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {tr('إعادة توليد التقرير', 'Regenerate Report')}
                </button>
              </div>
            </>
          )}

          {!report && !reportLoading && (
            <div className="bg-card rounded-xl border border-slate-200 p-8 text-center">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="text-sm text-slate-500">{tr('لم يتم توليد تقرير بعد', 'No report generated yet')}</div>
              <button
                onClick={fetchReport}
                className="mt-3 px-4 py-2 text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
              >
                {tr('توليد تقرير الاجتماع', 'Generate Meeting Report')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
