'use client';

import { ReactNode } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { useMe } from '@/lib/hooks/useMe';
import { useLang } from '@/hooks/use-lang';
import { Clipboard, FileText, BookOpen, Stethoscope, FlaskConical, Pill, BarChart3, CreditCard, CheckCircle2, RefreshCw, DoorOpen, HeartPulse } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const ALL_TABS: { id: string; labelAr: string; labelEn: string; icon: ReactNode; perms: string[] }[] = [
  { id: 'overview',      labelAr: 'ملخص',      labelEn: 'Overview',      icon: <Clipboard className="h-4 w-4" />, perms: ['opd.visit.view'] },
  { id: 'soap',          labelAr: 'SOAP',       labelEn: 'SOAP',          icon: <FileText className="h-4 w-4" />, perms: ['opd.doctor.encounter.view'] },
  { id: 'history',       labelAr: 'السوابق',    labelEn: 'History',       icon: <BookOpen className="h-4 w-4" />, perms: ['opd.visit.view'] },
  { id: 'physical-exam', labelAr: 'الفحص',      labelEn: 'Exam',          icon: <Stethoscope className="h-4 w-4" />, perms: ['opd.nursing.view', 'opd.doctor.encounter.view'] },
  { id: 'orders',        labelAr: 'الطلبات',    labelEn: 'Orders',        icon: <FlaskConical className="h-4 w-4" />, perms: ['opd.doctor.encounter.view'] },
  { id: 'prescription',  labelAr: 'الوصفة',     labelEn: 'Prescription',  icon: <Pill className="h-4 w-4" />, perms: ['opd.doctor.encounter.view'] },
  { id: 'results',       labelAr: 'النتائج',    labelEn: 'Results',       icon: <BarChart3 className="h-4 w-4" />, perms: ['opd.doctor.encounter.view', 'opd.nursing.view'] },
  { id: 'billing',       labelAr: 'الفوترة',    labelEn: 'Billing',       icon: <CreditCard className="h-4 w-4" />, perms: ['billing.view'] },
  { id: 'tasks',         labelAr: 'المهام',     labelEn: 'Tasks',         icon: <CheckCircle2 className="h-4 w-4" />, perms: ['opd.visit.view'] },
  { id: 'diagnosis',     labelAr: 'التشخيص',    labelEn: 'Diagnosis',     icon: <HeartPulse className="h-4 w-4" />, perms: ['opd.doctor.encounter.view'] },
  { id: 'handover',      labelAr: 'التسليم',    labelEn: 'Handover',      icon: <RefreshCw className="h-4 w-4" />, perms: ['opd.nursing.view', 'opd.doctor.encounter.view'] },
  { id: 'discharge',     labelAr: 'الخروج',     labelEn: 'Discharge',     icon: <DoorOpen className="h-4 w-4" />, perms: ['opd.doctor.encounter.view'] },
];

export default function VisitLayout({ children }: { children: React.ReactNode }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const params = useParams();
  const pathname = usePathname();
  const visitId = params.visitId as string;
  const { me } = useMe();

  const { data } = useSWR(`/api/opd/encounters/${visitId}/summary`, fetcher);

  const patient = data?.patient;
  const visit = data?.visit;
  const currentTab = pathname.split('/').pop() || 'overview';

  const userPerms = new Set(me?.user?.permissions || []);
  const isAdmin = me?.user?.role === 'admin';

  const visibleTabs = isAdmin
    ? ALL_TABS
    : ALL_TABS.filter(tab => tab.perms.some(p => userPerms.has(p)));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-card border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700">
              {patient?.fullName?.charAt(0) || '?'}
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-slate-900">{patient?.fullName || tr('جاري التحميل...', 'Loading...')}</h1>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>{tr('رقم الملف:', 'MRN:')} {patient?.mrn || '—'}</span>
                <span>•</span>
                <span>{patient?.age || '—'} {tr('سنة', 'yrs')}</span>
                <span>•</span>
                <span>{patient?.gender || '—'}</span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  visit?.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {visit?.status || tr('نشط', 'Active')}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {visibleTabs.map((tab) => (
              <Link
                key={tab.id}
                href={`/opd/visit/${visitId}/${tab.id}`}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  currentTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tr(tab.labelAr, tab.labelEn)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
