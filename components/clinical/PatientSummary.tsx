'use client';

import { useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  AlertTriangle,
  Pill,
  FileText,
  Activity,
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Shield,
  FlaskConical,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface Props {
  patientId: string;
  encounterId?: string;
  compact?: boolean;
}

export function PatientSummary({ patientId, encounterId, compact = false }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['allergies', 'problems', 'medications'])
  );

  const { data: patientData } = useSWR(`/api/patients/${patientId}`, fetcher);
  const patient = patientData?.patient || patientData;

  const { data: allergiesData } = useSWR(`/api/patients/${patientId}/allergies`, fetcher);
  const { data: problemsData } = useSWR(`/api/patients/${patientId}/problems`, fetcher);
  const { data: medicationsData } = useSWR(`/api/clinical/home-medications/${patientId}`, fetcher);
  const { data: visitsData } = useSWR(`/api/patients/${patientId}/visits?limit=5`, fetcher);
  const { data: vitalsData } = useSWR(
    encounterId ? `/api/opd/encounters/${encounterId}/nursing` : null,
    fetcher
  );
  const { data: pendingResultsData } = useSWR(`/api/patients/${patientId}/pending-results`, fetcher);

  const allergies = allergiesData?.items || allergiesData?.allergies || [];
  const problems = problemsData?.items || problemsData?.problems || [];
  const medications = medicationsData?.items || medicationsData?.medications || [];
  const allVisits = visitsData?.items || visitsData?.visits || [];
  const visits = encounterId
    ? allVisits.filter((v: any) => String(v?.id || '') !== String(encounterId))
    : allVisits;
  const latestVitals = vitalsData?.items?.[0]?.vitals || {};
  const pendingResults = pendingResultsData?.items || [];

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) newExpanded.delete(section);
    else newExpanded.add(section);
    setExpandedSections(newExpanded);
  };

  const getAge = (dob?: string) => {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = getAge(patient?.dateOfBirth || patient?.dob);
  const hasCriticalAllergies = allergies.some(
    (a: any) => a.severity === 'SEVERE' || a.severity === 'HIGH'
  );

  return (
    <div className={`bg-card rounded-xl border border-slate-200 overflow-hidden ${compact ? '' : 'shadow-sm'}`}>
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold">
                {(patient?.fullName || patient?.firstNameAr || 'م')[0]}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {patient?.fullName ||
                  [patient?.firstNameAr, patient?.middleNameAr, patient?.lastNameAr]
                    .filter(Boolean)
                    .join(' ') ||
                  tr('مريض', 'Patient')}
              </h2>
              <div className="flex items-center gap-3 text-blue-100 text-sm mt-1">
                <span>MRN: {patient?.mrn || patient?.fileNumber || '—'}</span>
                {age !== null && (
                  <>
                    <span>•</span>
                    <span>{age} {tr('سنة', 'yr')}</span>
                  </>
                )}
                {patient?.gender && (
                  <>
                    <span>•</span>
                    <span>{patient.gender === 'MALE' ? tr('ذكر', 'M') : tr('أنثى', 'F')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {patient?.insuranceCompanyName && (
            <div className="bg-white/20 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>{patient.insuranceCompanyName}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {(hasCriticalAllergies || pendingResults.length > 0) && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <div className="flex items-center gap-4 text-sm">
            {hasCriticalAllergies && (
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">{tr('حساسية خطيرة!', 'Critical allergy!')}</span>
              </div>
            )}
            {pendingResults.length > 0 && (
              <div className="flex items-center gap-2 text-amber-700">
                <FlaskConical className="w-4 h-4" />
                <span>{pendingResults.length} {tr('نتيجة معلقة', 'pending result(s)')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!compact && (
        <div className="grid grid-cols-4 gap-px bg-slate-200">
          <div className="bg-card p-3 text-center">
            <div className="text-2xl font-bold text-slate-900">{visits.length}</div>
            <div className="text-xs text-slate-500">{tr('زيارات سابقة', 'Previous visits')}</div>
          </div>
          <div className="bg-card p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{allergies.length}</div>
            <div className="text-xs text-slate-500">{tr('حساسية', 'Allergies')}</div>
          </div>
          <div className="bg-card p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {problems.filter((p: any) => String(p.status || '').toUpperCase() === 'ACTIVE').length}
            </div>
            <div className="text-xs text-slate-500">{tr('مشاكل نشطة', 'Active problems')}</div>
          </div>
          <div className="bg-card p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{medications.length}</div>
            <div className="text-xs text-slate-500">{tr('أدوية حالية', 'Current medications')}</div>
          </div>
        </div>
      )}

      {encounterId && Object.keys(latestVitals).length > 0 && (
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            {tr('العلامات الحيوية الأخيرة', 'Latest vitals')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {latestVitals.bp && (
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500">BP</div>
                <div className="font-semibold text-slate-900">{latestVitals.bp}</div>
              </div>
            )}
            {latestVitals.hr && (
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500">HR</div>
                <div className="font-semibold text-slate-900">{latestVitals.hr}</div>
              </div>
            )}
            {latestVitals.temp && (
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500">Temp</div>
                <div className="font-semibold text-slate-900">{latestVitals.temp}°</div>
              </div>
            )}
            {latestVitals.rr && (
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500">RR</div>
                <div className="font-semibold text-slate-900">{latestVitals.rr}</div>
              </div>
            )}
            {latestVitals.spo2 && (
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500">SpO2</div>
                <div className="font-semibold text-slate-900">{latestVitals.spo2}%</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-200">
        <CollapsibleSection
          title={tr('الحساسية', 'Allergies')}
          icon={
            <AlertTriangle className={`w-4 h-4 ${allergies.length > 0 ? 'text-red-500' : 'text-slate-400'}`} />
          }
          count={allergies.length}
          countColor="red"
          expanded={expandedSections.has('allergies')}
          onToggle={() => toggleSection('allergies')}
        >
          {allergies.length === 0 ? (
            <div className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {tr('لا توجد حساسية مسجلة (NKDA)', 'No allergies recorded (NKDA)')}
            </div>
          ) : (
            <div className="space-y-2">
              {allergies.map((allergy: any, idx: number) => (
                <div
                  key={idx}
                  className={`text-sm p-2 rounded-lg ${
                    allergy.severity === 'SEVERE' || allergy.severity === 'HIGH'
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-amber-50 border border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{allergy.allergen || allergy.substance}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        allergy.severity === 'SEVERE' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                      }`}
                    >
                      {allergy.severity}
                    </span>
                  </div>
                  {allergy.reaction && (
                    <div className="text-xs text-slate-600 mt-1">{tr('رد الفعل', 'Reaction')}: {allergy.reaction}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title={tr('المشاكل النشطة', 'Active problems')}
          icon={<FileText className={`w-4 h-4 ${problems.length > 0 ? 'text-amber-500' : 'text-slate-400'}`} />}
          count={problems.filter((p: any) => String(p.status || '').toUpperCase() === 'ACTIVE').length}
          countColor="amber"
          expanded={expandedSections.has('problems')}
          onToggle={() => toggleSection('problems')}
        >
          {problems.filter((p: any) => String(p.status || '').toUpperCase() === 'ACTIVE').length === 0 ? (
            <div className="text-sm text-slate-500">{tr('لا توجد مشاكل نشطة', 'No active problems')}</div>
          ) : (
            <div className="space-y-2">
              {problems
                .filter((p: any) => String(p.status || '').toUpperCase() === 'ACTIVE')
                .map((problem: any, idx: number) => (
                  <div key={idx} className="text-sm p-2 bg-slate-50 rounded-lg">
                    <div className="font-medium text-slate-900">{problem.description || problem.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {problem.icdCode && <span>{problem.icdCode}</span>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title={tr('الأدوية الحالية', 'Current medications')}
          icon={<Pill className={`w-4 h-4 ${medications.length > 0 ? 'text-blue-500' : 'text-slate-400'}`} />}
          count={medications.length}
          countColor="blue"
          expanded={expandedSections.has('medications')}
          onToggle={() => toggleSection('medications')}
        >
          {medications.length === 0 ? (
            <div className="text-sm text-slate-500">{tr('لا توجد أدوية مسجلة', 'No medications recorded')}</div>
          ) : (
            <div className="space-y-2">
              {medications.slice(0, 5).map((med: any, idx: number) => (
                <div key={idx} className="text-sm p-2 bg-slate-50 rounded-lg">
                  <div className="font-medium text-slate-900">{med.drugName || med.name}</div>
                  <div className="text-xs text-slate-500">
                    {med.dose} {med.unit} - {med.frequency}
                  </div>
                </div>
              ))}
              {medications.length > 5 && (
                <div className="text-xs text-blue-600">+{medications.length - 5} {tr('أدوية أخرى', 'more')}</div>
              )}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title={tr('الزيارات السابقة', 'Previous visits')}
          icon={<Calendar className={`w-4 h-4 ${visits.length > 0 ? 'text-green-500' : 'text-slate-400'}`} />}
          count={visits.length}
          countColor="green"
          expanded={expandedSections.has('visits')}
          onToggle={() => toggleSection('visits')}
        >
          {visits.length === 0 ? (
            <div className="text-sm text-slate-500">{tr('لا توجد زيارات سابقة', 'No previous visits')}</div>
          ) : (
            <div className="space-y-2">
              {visits.slice(0, 3).map((visit: any, idx: number) => (
                <div key={idx} className="text-sm p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{visit.clinicName || visit.specialtyName || visit.department || tr('عيادة', 'Clinic')}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(visit.date || visit.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  count,
  countColor,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  count: number;
  countColor: 'red' | 'amber' | 'blue' | 'green';
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const colorClasses = {
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
  };

  return (
    <div>
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-slate-900">{title}</span>
          {count > 0 && <span className={`text-xs px-2 py-0.5 rounded-full ${colorClasses[countColor]}`}>{count}</span>}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {expanded && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}
