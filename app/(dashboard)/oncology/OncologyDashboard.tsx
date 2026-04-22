"use client";
import { useLang } from "@/hooks/use-lang";
import useSWR from "swr";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  Users,
  Calendar,
  CheckCircle,
  FlaskConical,
  AlertTriangle,
  Target,
  Radiation,
  Beaker,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface OncologyPatient {
  id: string;
  patientMasterId: string;
  diagnosis: string;
  icdCode?: string;
  stage?: string;
  ecogStatus?: number;
  status: string;
}

interface TumorBoardCase {
  id: string;
  caseDate: string;
  presentedBy: string;
  clinicalSummary: string;
  recommendation: string;
}

export function OncologyDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');

  const { data: pData } = useSWR(`/api/oncology/patients?status=${statusFilter}`, fetcher);
  const { data: tbData } = useSWR('/api/oncology/tumor-board', fetcher);
  const { data: cyclesData } = useSWR('/api/oncology/cycles', fetcher);

  const patients: OncologyPatient[] = pData?.patients ?? [];
  const tbCases: TumorBoardCase[] = tbData?.cases ?? [];
  const allCycles = (cyclesData?.cycles ?? []) as { scheduledDate: string; administeredDate?: string; status: string }[];

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const cyclesThisMonth = allCycles.filter((c) => {
    const d = new Date(c.administeredDate || c.scheduledDate);
    return d >= startOfMonth && d <= now && (c.status === 'ADMINISTERED' || c.status === 'COMPLETED');
  }).length;
  const upcomingCycles = allCycles.filter((c) => new Date(c.scheduledDate) >= now && c.status === 'SCHEDULED').length;
  const completedProtocols = patients.filter((p) => p.status === 'REMISSION').length;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      REMISSION: 'bg-blue-100 text-blue-800',
      PALLIATIVE: 'bg-orange-100 text-orange-800',
      DECEASED: 'bg-muted text-foreground',
    };
    return map[s] ?? 'bg-muted text-muted-foreground';
  };

  const filtered = patients.filter((p) => !search || p.diagnosis?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-foreground">
        {tr('الأورام والعلاج الكيميائي', 'Oncology & Chemotherapy')}
      </h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {tr('مرضى نشطون', 'Active Patients')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{patients.filter((p) => p.status === 'ACTIVE').length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {tr('جلسات الشهر', 'Cycles This Month')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{cyclesThisMonth}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {tr('جلسات قادمة', 'Upcoming Cycles')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{upcomingCycles}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {tr('بروتوكولات مكتملة', 'Completed Protocols')}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{completedProtocols}</p></CardContent>
        </Card>
      </div>

      {/* ── Module Navigation Grid ────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{tr('الأقسام الفرعية', 'Modules')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {([
            { href: '/oncology/protocol-builder', icon: FlaskConical, labelAr: 'بناء البروتوكولات', labelEn: 'Protocol Builder', color: 'text-purple-600 bg-purple-50' },
            { href: '/oncology/ctcae-toxicity', icon: AlertTriangle, labelAr: 'تصنيف السمية CTCAE', labelEn: 'CTCAE Toxicity', color: 'text-red-600 bg-red-50' },
            { href: '/oncology/tnm-staging', icon: Target, labelAr: 'حاسبة TNM', labelEn: 'TNM Staging', color: 'text-blue-600 bg-blue-50' },
            { href: '/oncology/radiation-therapy', icon: Radiation, labelAr: 'العلاج الإشعاعي', labelEn: 'Radiation Therapy', color: 'text-amber-600 bg-amber-50' },
          ] as const).map((m) => (
            <Link key={m.href} href={m.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${m.color}`}>
                    <m.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">{tr(m.labelAr, m.labelEn)}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Tabs defaultValue="patients">
        <TabsList>
          <TabsTrigger value="patients">{tr('المرضى', 'Patients')}</TabsTrigger>
          <TabsTrigger value="tumorboard">{tr('مجلس الأورام', 'Tumor Board')}</TabsTrigger>
        </TabsList>
        <TabsContent value="patients" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Input placeholder={tr('بحث بالتشخيص...', 'Search by diagnosis...')} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">{tr('نشط', 'Active')}</SelectItem>
                <SelectItem value="REMISSION">{tr('هدأة', 'Remission')}</SelectItem>
                <SelectItem value="PALLIATIVE">{tr('تلطيفي', 'Palliative')}</SelectItem>
              </SelectContent>
            </Select>
            <Button className="ml-auto">{tr('+ مريض جديد', '+ New Patient')}</Button>
          </div>
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-start font-medium">{tr('المريض', 'Patient')}</th>
                  <th className="p-3 text-start font-medium">{tr('التشخيص', 'Diagnosis')}</th>
                  <th className="p-3 text-start font-medium">{tr('المرحلة', 'Stage')}</th>
                  <th className="p-3 text-start font-medium">{tr('الكود', 'ICD Code')}</th>
                  <th className="p-3 text-start font-medium">ECOG</th>
                  <th className="p-3 text-start font-medium">{tr('الحالة', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{tr('لا يوجد مرضى', 'No patients found')}</td></tr>
                ) : filtered.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-muted/30 cursor-pointer">
                    <td className="p-3 font-mono text-xs text-muted-foreground">{p.patientMasterId?.slice(-8)}</td>
                    <td className="p-3">{p.diagnosis}</td>
                    <td className="p-3">{p.stage ?? '—'}</td>
                    <td className="p-3 text-muted-foreground">{p.icdCode ?? '—'}</td>
                    <td className="p-3">{p.ecogStatus ?? '—'}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(p.status)}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="tumorboard">
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-start font-medium">{tr('التاريخ', 'Date')}</th>
                  <th className="p-3 text-start font-medium">{tr('مقدم الحالة', 'Presented By')}</th>
                  <th className="p-3 text-start font-medium">{tr('الملخص السريري', 'Clinical Summary')}</th>
                  <th className="p-3 text-start font-medium">{tr('التوصية', 'Recommendation')}</th>
                </tr>
              </thead>
              <tbody>
                {tbCases.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{tr('لا توجد حالات', 'No cases')}</td></tr>
                ) : tbCases.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 text-xs">{new Date(c.caseDate).toLocaleDateString()}</td>
                    <td className="p-3">{c.presentedBy}</td>
                    <td className="p-3 truncate max-w-xs">{c.clinicalSummary}</td>
                    <td className="p-3 truncate max-w-xs">{c.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
