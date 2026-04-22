'use client';

import { useState } from 'react';
import { Building2, Layers, Users, Target } from 'lucide-react';
import { getDeptBgLight, getDeptBorderColor, getDeptTextColor, getDeptColor } from '@/lib/cvision/department-colors';
import { useLang } from '@/hooks/use-lang';
import type { Department, Unit, JobTitle, Position, EmployeeOption } from './types';

interface OrgChartProps {
  departments: Department[];
  units: Unit[];
  jobTitles: JobTitle[];
  positions: Position[];
  allEmployees: EmployeeOption[];
  deptEmployees: Record<string, EmployeeOption[]>;
  showArchived: boolean;
}

export default function OrgChart({
  departments, units, jobTitles, positions, allEmployees, deptEmployees, showArchived,
}: OrgChartProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeDepts = departments.filter(d => showArchived || !d.isArchived);

  function getUnitsForDept(deptId: string) {
    return units.filter(u => u.departmentId === deptId && (showArchived || !u.isArchived));
  }

  function getPositionCount(deptId: string) {
    const deptJTs = jobTitles.filter(jt => jt.departmentId === deptId);
    const jtIds = new Set(deptJTs.map(jt => jt.id));
    return positions
      .filter(p => p.isActive && jtIds.has(p.jobTitleId))
      .reduce((sum, p) => sum + (p.budgetedHeadcount || 0), 0);
  }

  function getManagerName(managerId?: string | null, deptId?: string) {
    if (!managerId) return null;
    const emp = allEmployees.find(e => e.id === managerId)
      || (deptId ? (deptEmployees[deptId] || []).find(e => e.id === managerId) : null);
    return emp ? `${emp.firstName} ${emp.lastName}` : null;
  }

  if (activeDepts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Building2 className="h-12 w-12 mb-3 opacity-40" />
        <p className="font-medium">{tr('لا توجد أقسام للعرض', 'No departments to display')}</p>
        <p className="text-sm">{tr('أنشئ أقساماً لرؤية الهيكل التنظيمي.', 'Create departments to see the org chart.')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex flex-col items-center min-w-fit">
        {/* Root node */}
        <div
          className={`px-6 py-3 bg-card border-2 border-primary rounded-xl shadow-sm cursor-pointer transition-all ${
            selectedId === 'root' ? 'ring-2 ring-primary/30' : ''
          }`}
          onClick={() => setSelectedId(selectedId === 'root' ? null : 'root')}
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">{tr('المنظمة', 'Organization')}</span>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">
            {activeDepts.length} {tr('أقسام', 'departments')}
          </p>
        </div>

        {/* Vertical connector from root */}
        <div className="w-px h-8 bg-border" />

        {/* Horizontal connector line */}
        {activeDepts.length > 1 && (
          <div
            className="h-px bg-border"
            style={{ width: `${Math.max(activeDepts.length * 220, 220)}px` }}
          />
        )}

        {/* Department nodes */}
        <div className="flex gap-4 justify-center">
          {activeDepts.map((dept) => {
            const deptUnits = getUnitsForDept(dept.id);
            const posCount = getPositionCount(dept.id);
            const mgrName = getManagerName(dept.managerId, dept.id);
            const isSelected = selectedId === dept.id;

            return (
              <div key={dept.id} className="flex flex-col items-center">
                {/* Vertical connector from horizontal line */}
                {activeDepts.length > 1 && <div className="w-px h-4 bg-border" />}

                {/* Department node */}
                <div
                  className={`w-[200px] px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                    getDeptBgLight(dept.id)
                  } ${getDeptBorderColor(dept.id)} ${
                    isSelected ? 'ring-2 ring-offset-1 ring-primary/30 shadow-md' : 'shadow-sm hover:shadow-md'
                  }`}
                  onClick={() => setSelectedId(isSelected ? null : dept.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className={`h-4 w-4 ${getDeptTextColor(dept.id)}`} />
                    <span className={`font-bold text-sm truncate ${getDeptTextColor(dept.id)}`}>
                      {dept.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" /> {posCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" /> {deptUnits.length}
                    </span>
                  </div>
                  {mgrName && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span className="truncate">{mgrName}</span>
                    </div>
                  )}
                </div>

                {/* Units under department */}
                {deptUnits.length > 0 && (
                  <>
                    <div className="w-px h-4 bg-border" />
                    {deptUnits.length > 1 && (
                      <div
                        className="h-px bg-border"
                        style={{ width: `${Math.max(deptUnits.length * 180, 180)}px` }}
                      />
                    )}
                    <div className="flex gap-3 justify-center">
                      {deptUnits.map((unit) => {
                        const unitMgr = getManagerName(unit.managerId, dept.id);
                        const unitJTs = jobTitles.filter(jt => jt.unitId === unit.id && jt.departmentId === dept.id);
                        const isUnitSelected = selectedId === unit.id;

                        return (
                          <div key={unit.id} className="flex flex-col items-center">
                            {deptUnits.length > 1 && <div className="w-px h-3 bg-border" />}
                            <div
                              className={`w-[170px] px-3 py-2 rounded-lg border bg-card cursor-pointer transition-all ${
                                isUnitSelected ? 'ring-2 ring-primary/30 shadow-md' : 'shadow-sm hover:shadow-md'
                              }`}
                              onClick={() => setSelectedId(isUnitSelected ? null : unit.id)}
                            >
                              <div className="flex items-center gap-2 mb-0.5">
                                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                                <span className="font-medium text-xs truncate">{unit.name}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {unitJTs.length} {tr('مسميات وظيفية', 'job titles')}
                              </p>
                              {unitMgr && (
                                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                  <Users className="h-2.5 w-2.5 inline mr-0.5" /> {unitMgr}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
