'use client';

import { useLang } from '@/hooks/use-lang';
import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, ArrowUpDown } from 'lucide-react';

interface DepartmentsTabProps {
  departments: any[];
  analytics: any;
}

type SortKey = 'departmentName' | 'totalPatients' | 'booked' | 'waiting' | 'noShow' | 'procedures' | 'utilization';

export default function DepartmentsTab({ departments, analytics }: DepartmentsTabProps) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [sortBy, setSortBy] = useState<SortKey>('totalPatients');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let list = [...departments];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => (d.departmentName || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let av: any, bv: any;
      if (sortBy === 'departmentName') {
        av = a.departmentName || '';
        bv = b.departmentName || '';
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      av = a[sortBy] || 0;
      bv = b[sortBy] || 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [departments, sortBy, sortDir, searchQuery]);

  const columns: { key: SortKey; label: string; width?: string }[] = [
    { key: 'departmentName', label: tr('التخصص', 'Specialty') },
    { key: 'totalPatients', label: tr('الزيارات', 'Visits'), width: 'w-20' },
    { key: 'booked', label: tr('محجوز', 'Booked'), width: 'w-16' },
    { key: 'waiting', label: tr('انتظار', 'Walk-in'), width: 'w-16' },
    { key: 'noShow', label: tr('لم يحضر', 'No-Show'), width: 'w-16' },
    { key: 'procedures', label: tr('إجراءات', 'Procedures'), width: 'w-20' },
    { key: 'utilization', label: tr('الاستخدام %', 'Utilization %'), width: 'w-24' },
  ];

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" style={{ [isRTL ? 'right' : 'left']: 12 }} />
        <input
          type="text"
          placeholder={tr('بحث عن قسم...', 'Search department...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-slate-200 rounded-lg py-2 text-sm bg-card focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none"
          style={{ [isRTL ? 'paddingRight' : 'paddingLeft']: 36, [isRTL ? 'paddingLeft' : 'paddingRight']: 12 }}
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_repeat(6,auto)] gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          {columns.map((col) => (
            <button
              key={col.key}
              onClick={() => handleSort(col.key)}
              className={`flex items-center gap-1 hover:text-slate-700 transition-colors ${col.width || ''} ${col.key === 'departmentName' ? '' : 'justify-center'}`}
            >
              {col.label}
              {sortBy === col.key ? (
                sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
              ) : (
                <ArrowUpDown className="w-3 h-3 opacity-30" />
              )}
            </button>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              {tr('لا توجد أقسام', 'No departments found')}
            </div>
          )}
          {filtered.map((dept) => {
            const isExpanded = expandedDept === dept.departmentId;
            const utilColor = (dept.utilization || 0) >= 80 ? 'text-emerald-600' : (dept.utilization || 0) >= 50 ? 'text-amber-600' : 'text-red-500';
            const rowBg = (dept.utilization || 0) < 30 ? 'bg-red-50/30' : (dept.utilization || 0) >= 80 ? 'bg-emerald-50/30' : '';

            return (
              <div key={dept.departmentId}>
                <button
                  onClick={() => setExpandedDept(isExpanded ? null : dept.departmentId)}
                  className={`w-full grid grid-cols-[1fr_repeat(6,auto)] gap-2 px-4 py-3 hover:bg-slate-50/80 transition-colors items-center ${rowBg}`}
                >
                  <div className="flex items-center gap-2 text-left">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                      {String(dept.departmentName || '').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{dept.departmentName}</div>
                      <div className="text-[10px] text-slate-400">
                        {(dept.doctors || []).length} {tr('طبيب', 'doctors')}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                  </div>
                  <div className="w-20 text-center text-sm font-bold text-slate-800">{dept.totalPatients}</div>
                  <div className="w-16 text-center text-sm text-slate-600">{dept.booked || 0}</div>
                  <div className="w-16 text-center text-sm text-slate-600">{dept.waiting || 0}</div>
                  <div className="w-16 text-center text-sm text-red-500 font-medium">{dept.noShow || 0}</div>
                  <div className="w-20 text-center text-sm text-purple-600">{dept.procedures || 0}</div>
                  <div className="w-24">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (dept.utilization || 0) >= 80 ? 'bg-emerald-500' : (dept.utilization || 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(dept.utilization || 0, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${utilColor}`}>{dept.utilization || 0}%</span>
                    </div>
                  </div>
                </button>

                {/* Expanded doctor breakdown */}
                {isExpanded && dept.doctors?.length > 0 && (
                  <div className="bg-slate-50/80 border-t border-slate-100">
                    <div className="px-8 py-2 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 text-[10px] font-semibold text-slate-400 uppercase">
                      <span>{tr('الطبيب', 'Doctor')}</span>
                      <span className="w-16 text-center">{tr('مرضى', 'Patients')}</span>
                      <span className="w-16 text-center">{tr('ساعات', 'Hours')}</span>
                      <span className="w-16 text-center">{tr('هدف', 'Target')}</span>
                      <span className="w-20 text-center">{tr('استخدام', 'Utilization')}</span>
                    </div>
                    {dept.doctors.map((doc: any) => (
                      <div
                        key={doc.doctorId}
                        className="px-8 py-2 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center border-t border-slate-100/50"
                      >
                        <div className="text-sm text-slate-700">{doc.doctorName}</div>
                        <div className="w-16 text-center text-sm font-medium text-slate-800">{doc.totalPatients}</div>
                        <div className="w-16 text-center text-xs text-slate-500">{doc.hours || 0}h</div>
                        <div className="w-16 text-center text-xs text-slate-500">{doc.target || 0}</div>
                        <div className="w-20 text-center text-xs font-bold" style={{ color: (doc.utilization || 0) >= 80 ? '#059669' : (doc.utilization || 0) >= 50 ? '#D97706' : '#EF4444' }}>
                          {doc.utilization || 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
