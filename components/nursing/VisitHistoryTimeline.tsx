'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  History, ChevronDown, ChevronUp, Activity, Stethoscope, Heart,
  Calendar, Clock, MapPin, AlertTriangle, Brain, Shield, FileText,
  Loader2,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

interface VisitHistoryTimelineProps {
  patientId: string;
  currentEncounterId?: string;
}

interface VisitItem {
  id: string;
  encounterType: string;
  status: string;
  date: string;
  clinicName?: string;
  providerName?: string;
  specialtyCode?: string;
  nurseName?: string;
  doctorEntryBy?: string;
  vitals?: {
    bp?: string;
    hr?: number;
    temp?: number;
    spo2?: number;
    rr?: number;
    weight?: number;
    height?: number;
  };
  mewsScore?: number;
  mewsRiskLevel?: string;
  gcsScore?: number;
  gcsCategory?: string;
  fallRiskLevel?: string;
  chiefComplaint?: string;
  diagnosis?: string;
  disposition?: string;
}

export function VisitHistoryTimeline({ patientId, currentEncounterId }: VisitHistoryTimelineProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [expanded, setExpanded] = useState(false);
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);

  const { data, isLoading } = useSWR(
    patientId ? `/api/patients/${patientId}/visits?limit=20` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const visits: VisitItem[] = (data?.items || []).filter(
    (v: any) => v.id !== currentEncounterId
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 size={14} className="animate-spin" />
        {tr('جاري تحميل سجل الزيارات...', 'Loading visit history...')}
      </div>
    );
  }

  if (!visits.length) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-all"
      >
        <div className="flex items-center gap-2">
          <History size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {tr('سجل الزيارات', 'Visit History')}
          </span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            {visits.length}
          </span>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="relative pl-4 space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[18px] top-2 bottom-2 w-[2px] bg-border" />

          {visits.map((visit, idx) => {
            const isOpen = expandedVisit === visit.id;
            const visitDate = visit.date ? new Date(visit.date) : null;
            const isToday = visitDate && isSameDay(visitDate, new Date());
            const statusColor = getStatusColor(visit.status);
            const typeLabel = getTypeLabel(visit.encounterType, language);

            return (
              <div key={visit.id} className="relative">
                {/* Timeline dot */}
                <div className={`absolute left-0 top-3 w-[10px] h-[10px] rounded-full border-2 z-10 ${
                  idx === 0 ? 'bg-primary border-primary' : `bg-white dark:bg-card ${statusColor.border}`
                }`} />

                <div className="ml-5">
                  <button
                    onClick={() => setExpandedVisit(isOpen ? null : visit.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all mb-1 ${
                      isOpen ? 'border-primary/30 bg-primary/5 shadow-sm' : 'border-border hover:border-muted-foreground/30 bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusColor.bg} ${statusColor.text}`}>
                          {typeLabel}
                        </span>
                        {visit.clinicName && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin size={10} />
                            {visit.clinicName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {visitDate && (
                          <span className={`text-[11px] ${isToday ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                            <Calendar size={10} className="inline mr-1" />
                            {formatVisitDate(visitDate, language)}
                          </span>
                        )}
                        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </div>
                    </div>

                    {/* Summary row */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {visit.providerName && (
                        <span className="flex items-center gap-1 text-xs text-foreground">
                          <Stethoscope size={10} className="text-muted-foreground" />
                          {visit.providerName}
                        </span>
                      )}
                      {visit.nurseName && (
                        <span className="flex items-center gap-1 text-xs text-foreground">
                          <Heart size={10} className="text-pink-400" />
                          {visit.nurseName}
                        </span>
                      )}
                      {visit.chiefComplaint && (
                        <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                          &quot;{visit.chiefComplaint}&quot;
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="p-3 rounded-xl border border-border bg-muted/10 mb-2 space-y-3">
                      {/* Vitals */}
                      {visit.vitals && hasVitals(visit.vitals) && (
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                            <Heart size={11} />
                            {tr('العلامات الحيوية', 'Vitals')}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {visit.vitals.bp && <VitalChip label="BP" value={visit.vitals.bp} />}
                            {visit.vitals.hr && <VitalChip label="HR" value={`${visit.vitals.hr}`} unit="bpm" />}
                            {visit.vitals.temp && <VitalChip label="T" value={`${visit.vitals.temp}`} unit="°C" />}
                            {visit.vitals.rr && <VitalChip label="RR" value={`${visit.vitals.rr}`} unit="/min" />}
                            {visit.vitals.spo2 && <VitalChip label="SpO2" value={`${visit.vitals.spo2}`} unit="%" />}
                          </div>
                        </div>
                      )}

                      {/* Clinical scores */}
                      {(visit.mewsScore != null || visit.gcsScore != null || visit.fallRiskLevel) && (
                        <div className="flex flex-wrap gap-2">
                          {visit.mewsScore != null && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${getMewsColor(visit.mewsRiskLevel)}`}>
                              <Activity size={10} />
                              NEWS2: {visit.mewsScore}
                            </span>
                          )}
                          {visit.gcsScore != null && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${getGcsColor(visit.gcsCategory)}`}>
                              <Brain size={10} />
                              GCS: {visit.gcsScore}/15
                            </span>
                          )}
                          {visit.fallRiskLevel && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${getFallRiskColor(visit.fallRiskLevel)}`}>
                              <Shield size={10} />
                              Fall: {visit.fallRiskLevel}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Diagnosis / Disposition */}
                      {(visit.diagnosis || visit.disposition) && (
                        <div className="space-y-1">
                          {visit.diagnosis && (
                            <div className="flex items-start gap-1.5 text-xs">
                              <FileText size={11} className="text-muted-foreground mt-0.5" />
                              <span><strong>{tr('التشخيص', 'Dx')}:</strong> {visit.diagnosis}</span>
                            </div>
                          )}
                          {visit.disposition && (
                            <div className="flex items-start gap-1.5 text-xs">
                              <AlertTriangle size={11} className="text-muted-foreground mt-0.5" />
                              <span><strong>{tr('مآل', 'Disposition')}:</strong> {visit.disposition}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {!hasVitals(visit.vitals || {}) && !visit.mewsScore && !visit.gcsScore && !visit.diagnosis && (
                        <div className="text-xs text-muted-foreground italic">
                          {tr('لا تفاصيل إضافية', 'No additional details')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VitalChip({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50 text-xs">
      <span className="text-muted-foreground font-medium">{label}:</span>
      <span className="font-semibold text-foreground">{value}</span>
      {unit && <span className="text-muted-foreground text-[10px]">{unit}</span>}
    </span>
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatVisitDate(date: Date, lang: 'ar' | 'en'): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) return lang === 'ar' ? 'اليوم' : 'Today';
  if (days === 1) return lang === 'ar' ? 'أمس' : 'Yesterday';
  if (days < 7) return lang === 'ar' ? `قبل ${days} أيام` : `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return lang === 'ar' ? `قبل ${weeks} ${weeks === 1 ? 'أسبوع' : 'أسابيع'}` : `${weeks}w ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return lang === 'ar' ? `قبل ${months} ${months === 1 ? 'شهر' : 'أشهر'}` : `${months}mo ago`;
  }
  return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getStatusColor(status: string) {
  switch (status?.toUpperCase()) {
    case 'OPEN': case 'ACTIVE': return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-400' };
    case 'CLOSED': case 'COMPLETED': return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' };
    case 'CANCELLED': return { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300' };
    default: return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300' };
  }
}

function getTypeLabel(type: string, lang: 'ar' | 'en'): string {
  const map: Record<string, { ar: string; en: string }> = {
    OPD: { ar: 'عيادات', en: 'OPD' },
    ER: { ar: 'طوارئ', en: 'ER' },
    IPD: { ar: 'تنويم', en: 'IPD' },
  };
  return (map[type])?.[lang] || type;
}

function getMewsColor(risk?: string): string {
  switch (risk) {
    case 'HIGH': return 'bg-red-100 text-red-700';
    case 'MEDIUM': return 'bg-orange-100 text-orange-700';
    case 'LOW_MEDIUM': return 'bg-amber-100 text-amber-700';
    default: return 'bg-emerald-100 text-emerald-700';
  }
}

function getGcsColor(cat?: string): string {
  switch (cat) {
    case 'SEVERE': return 'bg-red-100 text-red-700';
    case 'MODERATE': return 'bg-amber-100 text-amber-700';
    default: return 'bg-emerald-100 text-emerald-700';
  }
}

function getFallRiskColor(level?: string): string {
  switch (level?.toUpperCase()) {
    case 'HIGH': return 'bg-red-100 text-red-700';
    case 'MODERATE': return 'bg-amber-100 text-amber-700';
    default: return 'bg-emerald-100 text-emerald-700';
  }
}

function hasVitals(v: Record<string, any>): boolean {
  return Boolean(v?.bp || v?.hr || v?.temp || v?.spo2 || v?.rr);
}
