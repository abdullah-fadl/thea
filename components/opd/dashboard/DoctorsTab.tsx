'use client';

import { useLang } from '@/hooks/use-lang';
import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown, Search, Trophy, AlertTriangle, Clock } from 'lucide-react';

interface DoctorsTabProps {
  departments: any[];
  analytics: any;
}

type SortKey = 'name' | 'patientsCount' | 'avgVisitMinutes' | 'avgWaitMinutes' | 'utilization' | 'specialty';

export default function DoctorsTab({ departments, analytics }: DoctorsTabProps) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [sortBy, setSortBy] = useState<SortKey>('patientsCount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all');

  // Build combined doctor list from departments + analytics
  const allDoctors = useMemo(() => {
    const doctorMap = new Map<string, any>();

    // From department stats
    for (const dept of departments) {
      for (const doc of (dept.doctors || [])) {
        const existing = doctorMap.get(doc.doctorId) || {};
        doctorMap.set(doc.doctorId, {
          ...existing,
          doctorId: doc.doctorId,
          name: doc.doctorName || existing.name || doc.doctorId,
          specialty: dept.departmentName || existing.specialty || '',
          totalPatients: doc.totalPatients || existing.totalPatients || 0,
          booked: doc.booked || existing.booked || 0,
          walkIn: doc.waiting || existing.walkIn || 0,
          noShow: doc.noShow || existing.noShow || 0,
          hours: doc.hours || existing.hours || 0,
          target: doc.target || existing.target || 0,
          utilization: doc.utilization || existing.utilization || 0,
          procedures: doc.procedures || existing.procedures || 0,
        });
      }
    }

    // Enrich from analytics providerPerformance
    for (const p of (analytics?.providerPerformance || [])) {
      const existing = doctorMap.get(p.resourceId) || {};
      doctorMap.set(p.resourceId, {
        ...existing,
        doctorId: p.resourceId,
        name: p.name || existing.name || p.resourceId,
        specialty: p.specialty || existing.specialty || '',
        patientsCount: p.patientsCount,
        avgVisitMinutes: p.avgVisitMinutes || 0,
        avgWaitMinutes: p.avgWaitMinutes || 0,
        totalPatients: existing.totalPatients || p.patientsCount || 0,
      });
    }

    return Array.from(doctorMap.values());
  }, [departments, analytics]);

  // Unique specialties for filter
  const specialties = useMemo(() => {
    const set = new Set(allDoctors.map((d) => d.specialty).filter(Boolean));
    return Array.from(set).sort();
  }, [allDoctors]);

  const filtered = useMemo(() => {
    let list = [...allDoctors];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => (d.name || '').toLowerCase().includes(q) || (d.specialty || '').toLowerCase().includes(q));
    }
    if (filterSpecialty !== 'all') {
      list = list.filter((d) => d.specialty === filterSpecialty);
    }
    list.sort((a, b) => {
      if (sortBy === 'name' || sortBy === 'specialty') {
        const av = a[sortBy] || '';
        const bv = b[sortBy] || '';
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const av = a[sortBy] || 0;
      const bv = b[sortBy] || 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [allDoctors, sortBy, sortDir, searchQuery, filterSpecialty]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  // Spotlight cards
  const topPerformer = allDoctors.reduce<any | null>((best: any, doc: any) => (doc.totalPatients > (best?.totalPatients || 0) ? doc : best), null);
  const mostOverloaded = allDoctors.reduce<any | null>((worst: any, doc: any) => ((doc.utilization || 0) > (worst?.utilization || 0) ? doc : worst), null);
  const highestNoShow = allDoctors.reduce<any | null>((worst: any, doc: any) => ((doc.noShow || 0) > (worst?.noShow || 0) ? doc : worst), null);

  return (
    <div className="space-y-4">
      {/* Spotlight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {topPerformer && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-emerald-500 uppercase">{tr('الأعلى أداءً', 'Top Performer')}</div>
              <div className="text-sm font-bold text-emerald-800">{topPerformer.name}</div>
              <div className="text-[10px] text-emerald-600">{topPerformer.totalPatients} {tr('مريض', 'patients')}</div>
            </div>
          </div>
        )}
        {mostOverloaded && (mostOverloaded.utilization || 0) > 80 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-amber-500 uppercase">{tr('الأكثر عبئًا', 'Most Overloaded')}</div>
              <div className="text-sm font-bold text-amber-800">{mostOverloaded.name}</div>
              <div className="text-[10px] text-amber-600">{mostOverloaded.utilization}% {tr('استخدام', 'utilization')}</div>
            </div>
          </div>
        )}
        {highestNoShow && (highestNoShow.noShow || 0) > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-red-500 uppercase">{tr('أعلى عدم حضور', 'Highest No-Show')}</div>
              <div className="text-sm font-bold text-red-800">{highestNoShow.name}</div>
              <div className="text-[10px] text-red-600">{highestNoShow.noShow} {tr('لم يحضروا', 'no-shows')}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" style={{ [isRTL ? 'right' : 'left']: 12 }} />
          <input
            type="text"
            placeholder={tr('بحث عن طبيب...', 'Search doctor...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-slate-200 rounded-lg py-2 text-sm bg-card focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none"
            style={{ [isRTL ? 'paddingRight' : 'paddingLeft']: 36, [isRTL ? 'paddingLeft' : 'paddingRight']: 12 }}
          />
        </div>
        <select
          value={filterSpecialty}
          onChange={(e) => setFilterSpecialty(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-card"
        >
          <option value="all">{tr('جميع التخصصات', 'All Specialties')}</option>
          {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              {[
                { key: 'name' as SortKey, label: tr('الطبيب', 'Doctor') },
                { key: 'specialty' as SortKey, label: tr('التخصص', 'Specialty') },
                { key: 'patientsCount' as SortKey, label: tr('المرضى', 'Patients') },
                { key: 'utilization' as SortKey, label: tr('الاستخدام %', 'Utilization') },
                { key: 'avgVisitMinutes' as SortKey, label: tr('متوسط الاستشارة', 'Avg Consult') },
                { key: 'avgWaitMinutes' as SortKey, label: tr('متوسط الانتظار', 'Avg Wait') },
              ].map(({ key, label }) => (
                <th key={key} className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left">
                  <button onClick={() => handleSort(key)} className="flex items-center gap-1 hover:text-slate-700">
                    {label}
                    {sortBy === key ? (
                      sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {tr('لا توجد بيانات', 'No data')}
                </td>
              </tr>
            )}
            {filtered.map((doc) => {
              const achievement = doc.target > 0 ? Math.round((doc.totalPatients / doc.target) * 100) : 0;
              const rowBg = achievement < 50 ? 'bg-red-50/20' : achievement > 100 ? 'bg-emerald-50/20' : '';
              return (
                <tr key={doc.doctorId} className={`hover:bg-slate-50/50 transition-colors ${rowBg}`}>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{doc.name}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">{doc.specialty || '-'}</td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-indigo-600">{doc.totalPatients || doc.patientsCount || 0}</div>
                    {doc.target > 0 && (
                      <div className="text-[10px] text-slate-400">{tr('هدف', 'target')}: {doc.target}</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${(doc.utilization || 0) >= 80 ? 'bg-emerald-500' : (doc.utilization || 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(doc.utilization || 0, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold">{doc.utilization || 0}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-700">{doc.avgVisitMinutes || 0} {tr('دقيقة', 'min')}</td>
                  <td className="px-3 py-3 text-sm text-slate-700">{doc.avgWaitMinutes || 0} {tr('دقيقة', 'min')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
