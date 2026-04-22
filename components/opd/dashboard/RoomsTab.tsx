'use client';

import { useLang } from '@/hooks/use-lang';
import { useState, useMemo } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

interface RoomsTabProps {
  departments: any[];
}

type SortKey = 'roomName' | 'departmentName' | 'doctorName' | 'totalPatients' | 'utilization';

export default function RoomsTab({ departments }: RoomsTabProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [sortBy, setSortBy] = useState<SortKey>('totalPatients');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Build room list from departments' doctors
  const rooms = useMemo(() => {
    const roomList: any[] = [];
    for (const dept of departments) {
      for (const doc of (dept.doctors || [])) {
        // Each doctor record is effectively a room/clinic session
        roomList.push({
          id: `${dept.departmentId}_${doc.doctorId}`,
          roomName: doc.clinicsUsed > 0 ? `${tr('عيادة', 'Clinic')} ${doc.clinicsUsed}` : tr('غير محدد', 'N/A'),
          departmentName: dept.departmentName,
          doctorName: doc.doctorName,
          hoursAvailable: doc.hours || 0,
          totalPatients: doc.totalPatients || 0,
          utilization: doc.utilization || 0,
          patientsPerHour: doc.hours > 0 ? Math.round((doc.totalPatients / doc.hours) * 10) / 10 : 0,
        });
      }
    }
    return roomList;
  }, [departments, tr]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const sorted = useMemo(() => {
    return [...rooms].sort((a, b) => {
      if (sortBy === 'roomName' || sortBy === 'departmentName' || sortBy === 'doctorName') {
        const av = a[sortBy] || '';
        const bv = b[sortBy] || '';
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (a[sortBy] || 0) - (b[sortBy] || 0) : (b[sortBy] || 0) - (a[sortBy] || 0);
    });
  }, [rooms, sortBy, sortDir]);

  // Heatmap data (simple grid)
  const heatmapData = useMemo(() => {
    const timeSlots = ['7-8', '8-12', '12-16', '16-20'];
    return departments.map((dept) => ({
      name: dept.departmentName,
      slots: timeSlots.map((slot) => {
        // Estimate distribution from total patients
        const total = dept.totalPatients || 0;
        const distribution: Record<string, number> = { '7-8': 0.1, '8-12': 0.45, '12-16': 0.3, '16-20': 0.15 };
        return {
          slot,
          count: Math.round(total * (distribution[slot] || 0)),
        };
      }),
    }));
  }, [departments]);

  const maxHeat = useMemo(() => {
    let max = 1;
    for (const row of heatmapData) {
      for (const s of row.slots) {
        if (s.count > max) max = s.count;
      }
    }
    return max;
  }, [heatmapData]);

  return (
    <div className="space-y-5">
      {/* Room table */}
      <div className="bg-card rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              {[
                { key: 'departmentName' as SortKey, label: tr('التخصص', 'Specialty') },
                { key: 'doctorName' as SortKey, label: tr('الطبيب', 'Doctor') },
                { key: 'totalPatients' as SortKey, label: tr('المرضى', 'Patients') },
                { key: 'utilization' as SortKey, label: tr('الاستخدام %', 'Utilization') },
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
              <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left">{tr('ساعات', 'Hours')}</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left">{tr('مريض/ساعة', 'Pt/Hr')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{tr('لا توجد بيانات', 'No data')}</td></tr>
            )}
            {sorted.map((room) => (
              <tr key={room.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-3 text-sm text-slate-700">{room.departmentName}</td>
                <td className="px-3 py-3 text-sm font-medium text-slate-900">{room.doctorName}</td>
                <td className="px-3 py-3 text-sm font-bold text-indigo-600">{room.totalPatients}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${room.utilization >= 80 ? 'bg-emerald-500' : room.utilization >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(room.utilization, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold">{room.utilization}%</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-slate-600">{room.hoursAvailable}h</td>
                <td className="px-3 py-3 text-sm text-slate-600">{room.patientsPerHour}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Room heatmap */}
      {heatmapData.length > 0 && (
        <div className="bg-card rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3">{tr('خريطة حرارية — الأقسام × الفترات', 'Heatmap — Departments × Time Slots')}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1.5 text-left text-slate-500 font-medium">{tr('القسم', 'Dept')}</th>
                  <th className="px-2 py-1.5 text-center text-slate-500 font-medium">7-8</th>
                  <th className="px-2 py-1.5 text-center text-slate-500 font-medium">8-12</th>
                  <th className="px-2 py-1.5 text-center text-slate-500 font-medium">12-16</th>
                  <th className="px-2 py-1.5 text-center text-slate-500 font-medium">16-20</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.map((row) => (
                  <tr key={row.name}>
                    <td className="px-2 py-1.5 text-sm font-medium text-slate-700 whitespace-nowrap">{row.name}</td>
                    {row.slots.map((s) => {
                      const intensity = maxHeat > 0 ? s.count / maxHeat : 0;
                      const bg = intensity > 0.7 ? 'bg-red-400 text-white' : intensity > 0.4 ? 'bg-amber-300 text-amber-900' : intensity > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-300';
                      return (
                        <td key={s.slot} className="px-2 py-1.5 text-center">
                          <div className={`rounded px-2 py-1 font-bold ${bg}`}>{s.count}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-50 border border-slate-200" /> {tr('منخفض', 'Low')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100" /> {tr('متوسط', 'Medium')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300" /> {tr('مرتفع', 'High')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> {tr('مزدحم', 'Peak')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
