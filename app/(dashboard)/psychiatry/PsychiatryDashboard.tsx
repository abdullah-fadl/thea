"use client";
import { useLang } from "@/hooks/use-lang";
import useSWR from "swr";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Brain,
  AlertTriangle,
  Calendar,
  Users,
  ClipboardList,
  FileText,
  BarChart3,
  Shield,
  UsersRound,
  ShieldAlert,
  Stethoscope,
  Lock,
} from "lucide-react";

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface Assessment {
  id: string;
  assessmentDate: string;
  chiefComplaint: string;
  diagnosis?: string;
  disposition?: string;
  riskAssessment?: { suicidal?: { ideation?: string } };
}

const MODULE_LINKS = [
  { href: '/psychiatry/risk-assessment', iconName: 'ShieldAlert', labelAr: 'تقييم الخطر', labelEn: 'Risk Assessment', color: 'text-red-600 bg-red-50' },
  { href: '/psychiatry/mse', iconName: 'Stethoscope', labelAr: 'الفحص العقلي', labelEn: 'Mental Status Exam', color: 'text-blue-600 bg-blue-50' },
  { href: '/psychiatry/restraints', iconName: 'Shield', labelAr: 'سجل التقييد', labelEn: 'Restraint Log', color: 'text-orange-600 bg-orange-50' },
  { href: '/psychiatry/treatment-plans', iconName: 'ClipboardList', labelAr: 'خطط العلاج', labelEn: 'Treatment Plans', color: 'text-green-600 bg-green-50' },
  { href: '/psychiatry/progress-notes', iconName: 'FileText', labelAr: 'ملاحظات التقدم', labelEn: 'Progress Notes', color: 'text-purple-600 bg-purple-50' },
  { href: '/psychiatry/scales', iconName: 'BarChart3', labelAr: 'المقاييس النفسية', labelEn: 'Psychometric Scales', color: 'text-indigo-600 bg-indigo-50' },
  { href: '/psychiatry/holds', iconName: 'Lock', labelAr: 'الاحتجاز القسري', labelEn: 'Involuntary Holds', color: 'text-amber-600 bg-amber-50' },
  { href: '/psychiatry/groups', iconName: 'UsersRound', labelAr: 'العلاج الجماعي', labelEn: 'Group Therapy', color: 'text-teal-600 bg-teal-50' },
] as const;

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldAlert,
  Stethoscope,
  Shield,
  ClipboardList,
  FileText,
  BarChart3,
  Lock,
  UsersRound,
};

export function PsychiatryDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [search, setSearch] = useState('');

  const { data } = useSWR('/api/psychiatry/assessments', fetcher);
  const assessments: Assessment[] = data?.assessments ?? [];

  const riskBadge = (a: Assessment) => {
    const ideation = a.riskAssessment?.suicidal?.ideation;
    if (!ideation || ideation === 'NONE') return 'bg-green-100 text-green-800';
    return 'bg-red-100 text-red-800';
  };

  const filtered = assessments.filter(
    (a) => !search || a.chiefComplaint?.toLowerCase().includes(search.toLowerCase()) || a.diagnosis?.toLowerCase().includes(search.toLowerCase()),
  );

  const highRisk = assessments.filter(
    (a) => a.riskAssessment?.suicidal?.ideation && a.riskAssessment.suicidal.ideation !== 'NONE'
  ).length;

  const thisMonth = assessments.filter(
    (a) => new Date(a.assessmentDate).getMonth() === new Date().getMonth()
  ).length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysFollowUps = assessments.filter(
    (a) => a.disposition === 'FOLLOW_UP' && a.assessmentDate?.slice(0, 10) === todayStr
  ).length;

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-foreground">
        {tr('الطب النفسي', 'Psychiatry')}
      </h1>

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {tr('إجمالي التقييمات', 'Total Assessments')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{assessments.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              {tr('خطر مرتفع', 'High Risk')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-red-600">{highRisk}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {tr('متابعة اليوم', "Today's Follow-ups")}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{todaysFollowUps}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" />
              {tr('التقييمات هذا الشهر', 'This Month')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{thisMonth}</p></CardContent>
        </Card>
      </div>

      {/* ── Module Navigation Grid ────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{tr('الأقسام الفرعية', 'Modules')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MODULE_LINKS.map((m) => {
            const Icon = ICON_MAP[m.iconName];
            return (
              <Link key={m.href} href={m.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${m.color}`}>
                      {Icon && <Icon className="h-5 w-5" />}
                    </div>
                    <span className="text-sm font-medium">{tr(m.labelAr, m.labelEn)}</span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Recent Assessments Table ──────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{tr('التقييمات الأخيرة', 'Recent Assessments')}</h2>
        <div className="flex gap-3 mb-3">
          <Input placeholder={tr('بحث...', 'Search...')} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        </div>
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-start font-medium">{tr('التاريخ', 'Date')}</th>
                <th className="p-3 text-start font-medium">{tr('الشكوى الرئيسية', 'Chief Complaint')}</th>
                <th className="p-3 text-start font-medium">{tr('التشخيص', 'Diagnosis')}</th>
                <th className="p-3 text-start font-medium">{tr('مستوى الخطر', 'Risk Level')}</th>
                <th className="p-3 text-start font-medium">{tr('التصرف', 'Disposition')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{tr('لا توجد تقييمات', 'No assessments found')}</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className="border-t hover:bg-muted/30 cursor-pointer">
                  <td className="p-3 text-xs">{new Date(a.assessmentDate).toLocaleDateString()}</td>
                  <td className="p-3">{a.chiefComplaint}</td>
                  <td className="p-3">{a.diagnosis ?? '—'}</td>
                  <td className="p-3">
                    <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + riskBadge(a)}>
                      {a.riskAssessment?.suicidal?.ideation ?? tr('منخفض', 'Low')}
                    </span>
                  </td>
                  <td className="p-3">{a.disposition ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
