'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard , CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState } from 'react';

import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';

import {
  Building2, Layers, Briefcase, GraduationCap, Target, Users,
  Plus, MoreVertical, Archive, ChevronDown, ChevronRight,
} from 'lucide-react';
import { getDeptBorderColor } from '@/lib/cvision/department-colors';

import AddUnitDialog from './AddUnitDialog';
import AddJobTitleDialog from './AddJobTitleDialog';
import AddGradeDialog from './AddGradeDialog';
import AddPositionDialog from './AddPositionDialog';

import type {
  Department, Unit, JobTitle, Grade, Position, EmployeeOption,
  UnitFormData, JobTitleFormData, GradeFormData, PositionFormData,
} from './types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface DepartmentCardProps {
  department: Department;
  units: Unit[];
  jobTitles: JobTitle[];
  unassignedJobTitles: JobTitle[];
  grades: Grade[];
  positions: Position[];
  employees: EmployeeOption[];
  allEmployees: EmployeeOption[];
  showArchived: boolean;
  saving: boolean;
  onCreateUnit: (departmentId: string, form: UnitFormData) => Promise<void>;
  onArchiveUnit: (unitId: string) => Promise<void>;
  onCreateJobTitle: (departmentId: string, unitId: string | undefined, form: JobTitleFormData) => Promise<void>;
  onCreateOrLinkGrade: (jobTitleId: string, gradeForm: GradeFormData, existingGradeId: string) => Promise<void>;
  onCreatePosition: (jobTitleId: string, departmentId: string, unitId: string | null | undefined, form: PositionFormData) => Promise<void>;
  onLoadEmployees: (departmentId: string) => void;
}

export default function DepartmentCard({
  department, units, jobTitles, unassignedJobTitles, grades, positions,
  employees, allEmployees, showArchived, saving,
  onCreateUnit, onArchiveUnit, onCreateJobTitle, onCreateOrLinkGrade, onCreatePosition,
  onLoadEmployees,
}: DepartmentCardProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const dept = department;

  // UI state
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedJobTitles, setExpandedJobTitles] = useState<Set<string>>(new Set());

  // Dialog states
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [jtDialogContext, setJtDialogContext] = useState<{ open: boolean; unitId?: string; unitName?: string }>({ open: false });
  const [gradeDialogContext, setGradeDialogContext] = useState<{ open: boolean; jobTitleId: string; jobTitleName: string }>({ open: false, jobTitleId: '', jobTitleName: '' });
  const [positionDialogContext, setPositionDialogContext] = useState<{ open: boolean; jobTitleId: string; unitId?: string | null }>({ open: false, jobTitleId: '' });

  // Helpers
  function getGradesForJobTitle(jtId: string) {
    return grades.filter(g => {
      if (g.isArchived && !showArchived) return false;
      if (g.jobTitleId === jtId) return true;
      if (g.jobTitleIds && g.jobTitleIds.includes(jtId)) return true;
      return false;
    });
  }

  function getPositionsForJobTitle(jtId: string) {
    return positions.filter(p => p.jobTitleId === jtId && (showArchived || p.isActive));
  }

  function getJobTitlesForUnit(unitId: string) {
    return jobTitles.filter(jt => {
      if (jt.isArchived && !showArchived) return false;
      return jt.departmentId === dept.id && jt.unitId === unitId;
    });
  }

  function getExistingGradesForDialog(jobTitleId: string) {
    return grades.filter(g =>
      !g.isArchived &&
      !(g.jobTitleId === jobTitleId || (g.jobTitleIds && g.jobTitleIds.includes(jobTitleId)))
    );
  }

  // Manager resolution
  const managerName = (() => {
    if (!dept.managerId) return null;
    const mgr = allEmployees.find(e => e.id === dept.managerId)
      || employees.find(e => e.id === dept.managerId);
    return mgr ? `${mgr.firstName} ${mgr.lastName}` : null;
  })();

  const totalPositions = positions
    .filter(p => p.isActive && jobTitles.some(jt => jt.id === p.jobTitleId))
    .reduce((sum, p) => sum + (p.budgetedHeadcount || 0), 0);

  // Toggle helpers
  const toggleUnit = (unitId: string, open: boolean) => {
    const newSet = new Set(expandedUnits);
    if (open) newSet.add(unitId); else newSet.delete(unitId);
    setExpandedUnits(newSet);
  };

  const toggleJobTitle = (jtId: string, open: boolean) => {
    const newSet = new Set(expandedJobTitles);
    if (open) newSet.add(jtId); else newSet.delete(jtId);
    setExpandedJobTitles(newSet);
  };

  // ── Render a single Job Title collapsible ──
  function renderJobTitle(jobTitle: JobTitle, unitId?: string | null) {
    const jtGrades = getGradesForJobTitle(jobTitle.id);
    const jtPositions = getPositionsForJobTitle(jobTitle.id);
    const isExpanded = expandedJobTitles.has(jobTitle.id);

    return (
      <Collapsible
        key={jobTitle.id}
        open={isExpanded}
        onOpenChange={(open) => toggleJobTitle(jobTitle.id, open)}
      >
        <CollapsibleTrigger asChild>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', transition: 'color 0.2s, background 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Briefcase style={{ height: 16, width: 16, color: C.purple }} />
              <div>
                <div style={{ fontWeight: 500 }}>
                  {jobTitle.name}
                  <span style={{ color: C.textMuted, marginLeft: 8 }}>({jobTitle.code})</span>
                </div>
              </div>
              {jobTitle.isArchived && <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12 }}>{tr('مؤرشف', 'Archived')}</CVisionBadge>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{jtGrades.length} {tr('درجات', 'grades')}</CVisionBadge>
              <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{jtPositions.length} {tr('وظائف', 'positions')}</CVisionBadge>
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div style={{ paddingLeft: 32, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Positions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h5 style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Target style={{ height: 16, width: 16 }} />
                  {tr('الوظائف', 'Positions')} ({jtPositions.length})
                </h5>
                <CVisionButton C={C} isDark={isDark}
                  size="sm"
                  variant="outline"
                  onClick={() => setPositionDialogContext({ open: true, jobTitleId: jobTitle.id, unitId })}
                >
                  <Plus style={{ height: 16, width: 16, marginRight: 8 }} />{tr('إضافة وظيفة', 'Add Position')}
                </CVisionButton>
              </div>
              {jtPositions.length > 0 && (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                      <CVisionTh C={C}>{tr('رمز الوظيفة', 'Position Code')}</CVisionTh>
                      <CVisionTh C={C} align="right">{tr('مخطط', 'Budgeted')}</CVisionTh>
                      <CVisionTh C={C} align="right">{tr('مشغول', 'Occupied')}</CVisionTh>
                      <CVisionTh C={C} align="right">{tr('متاح', 'Available')}</CVisionTh>
                      <CVisionTh C={C} align="center">{tr('نسبة الشغل', 'Fill Rate')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {jtPositions.map((pos) => {
                      const occupied = pos.occupiedHeadcount || 0;
                      const budgeted = pos.budgetedHeadcount || 1;
                      const fillRate = Math.min(100, Math.round((occupied / budgeted) * 100));
                      return (
                        <CVisionTr C={C} key={pos.id}>
                          <CVisionTd style={{ fontWeight: 500 }}>
                            {pos.positionCode}
                            {pos.title && <span style={{ color: C.textMuted, marginLeft: 8 }}>({pos.title})</span>}
                          </CVisionTd>
                          <CVisionTd align="right">{budgeted}</CVisionTd>
                          <CVisionTd align="right">{occupied}</CVisionTd>
                          <CVisionTd align="right">
                            <span className={pos.availableSlots === 0 ? 'text-red-600 font-medium' : ''}>{pos.availableSlots || 0}</span>
                          </CVisionTd>
                          <CVisionTd className="min-w-[100px]">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${fillRate}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>
                              <p style={{ fontSize: 12, color: C.textMuted, textAlign: 'center' }}>{fillRate}%</p>
                            </div>
                          </CVisionTd>
                          <CVisionTd>
                            <CVisionBadge C={C} variant={pos.isActive ? 'default' : 'secondary'}>{pos.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</CVisionBadge>
                          </CVisionTd>
                        </CVisionTr>
                      );
                    })}
                  </CVisionTableBody>
                </CVisionTable>
              )}
            </div>

            {/* Grades */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h5 style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GraduationCap style={{ height: 16, width: 16 }} />
                  {tr('الدرجات', 'Grades')} ({jtGrades.length})
                </h5>
                <CVisionButton C={C} isDark={isDark}
                  size="sm"
                  variant="outline"
                  onClick={() => setGradeDialogContext({ open: true, jobTitleId: jobTitle.id, jobTitleName: jobTitle.name })}
                >
                  <Plus style={{ height: 16, width: 16, marginRight: 8 }} />{tr('إضافة درجة', 'Add Grade')}
                </CVisionButton>
              </div>
              {jtGrades.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {jtGrades.map((grade) => (
                    <div key={grade.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <GraduationCap style={{ height: 16, width: 16, color: C.green }} />
                        <div>
                          <div style={{ fontWeight: 500 }}>{grade.name} <span style={{ color: C.textMuted, marginLeft: 8 }}>({grade.code})</span></div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>{tr('المستوى', 'Level')} {grade.level}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <>
      <CVisionCard C={C} className={`border-l-4 ${getDeptBorderColor(dept.id)} rounded-xl shadow-sm hover:shadow-md transition-shadow`}>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Building2 style={{ height: 20, width: 20, color: C.blue, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {dept.name}
                  <span style={{ color: C.textMuted, marginLeft: 8, fontSize: 13 }}>({dept.code})</span>
                </div>
                {managerName && (
                  <CVisionBadge C={C} variant="outline" style={{ fontSize: 12, marginTop: 4 }}>
                    <Users style={{ height: 12, width: 12, marginRight: 4 }} /> {managerName}
                  </CVisionBadge>
                )}
              </div>
            </div>
            {dept.isArchived && <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12 }}>{tr('مؤرشف', 'Archived')}</CVisionBadge>}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <CVisionBadge C={C} variant="outline" style={{ fontSize: 12, gap: 4 }}>
              <Layers style={{ height: 12, width: 12 }} /> {units.length} {tr('وحدات', 'units')}
            </CVisionBadge>
            <CVisionBadge C={C} variant="outline" style={{ fontSize: 12, gap: 4 }}>
              <Briefcase style={{ height: 12, width: 12 }} /> {jobTitles.length} {tr('مسميات وظيفية', 'job titles')}
            </CVisionBadge>
            <CVisionBadge C={C} variant="outline" style={{ fontSize: 12, gap: 4 }}>
              <Target style={{ height: 12, width: 12 }} /> {totalPositions} {tr('وظائف', 'positions')}
            </CVisionBadge>
          </div>

          {/* Units section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers style={{ height: 16, width: 16 }} />
                {tr('الوحدات', 'Units')} ({units.length})
              </h4>
              <CVisionButton C={C} isDark={isDark}
                size="sm"
                variant="outline"
                style={{ height: 28, fontSize: 12 }}
                onClick={() => {
                  onLoadEmployees(dept.id);
                  setUnitDialogOpen(true);
                }}
              >
                <Plus style={{ height: 12, width: 12, marginRight: 4 }} />{tr('إضافة وحدة', 'Add Unit')}
              </CVisionButton>
            </div>

            {units.length === 0 ? (
              <p style={{ fontSize: 13, color: C.textMuted, paddingTop: 8, paddingBottom: 8 }}>{tr('لا توجد وحدات بعد.', 'No units yet.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {units.map((unit) => {
                  const unitJTs = getJobTitlesForUnit(unit.id);
                  const isExpanded = expandedUnits.has(unit.id);

                  return (
                    <Collapsible
                      key={unit.id}
                      open={isExpanded}
                      onOpenChange={(open) => toggleUnit(unit.id, open)}
                    >
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12 }}>
                        <CollapsibleTrigger asChild>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, cursor: 'pointer', transition: 'color 0.2s, background 0.2s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <Layers style={{ height: 16, width: 16 }} />
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 13 }}>
                                  {unit.name}
                                  <span style={{ color: C.textMuted, marginLeft: 8 }}>({unit.code})</span>
                                </div>
                                {unit.managerId && (() => {
                                  const mgr = employees.find(e => e.id === unit.managerId);
                                  return mgr ? (
                                    <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                      <Users style={{ height: 12, width: 12 }} /> {mgr.firstName} {mgr.lastName}
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                              {unit.isArchived && <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12 }}>{tr('مؤرشف', 'Archived')}</CVisionBadge>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{unitJTs.length} {tr('مسميات وظيفية', 'job titles')}</CVisionBadge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 32, width: 32, padding: 0 }} onClick={(e) => e.stopPropagation()}>
                                    <MoreVertical style={{ height: 16, width: 16 }} />
                                  </CVisionButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => onArchiveUnit(unit.id)} className="text-destructive">
                                    <Archive style={{ height: 16, width: 16, marginRight: 8 }} />
                                    {tr('أرشفة', 'Archive')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 12, paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${C.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <CVisionButton C={C} isDark={isDark}
                                size="sm"
                                variant="outline"
                                style={{ height: 28, fontSize: 12 }}
                                onClick={() => setJtDialogContext({ open: true, unitId: unit.id, unitName: unit.name })}
                              >
                                <Plus style={{ height: 12, width: 12, marginRight: 4 }} />{tr('إضافة مسمى وظيفي', 'Add Job Title')}
                              </CVisionButton>
                            </div>
                            {unitJTs.length === 0 ? (
                              <p style={{ fontSize: 13, color: C.textMuted, paddingTop: 8, paddingBottom: 8 }}>{tr('لا توجد مسميات وظيفية بعد في هذه الوحدة.', 'No job titles yet in this unit.')}</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {unitJTs.map((jt) => renderJobTitle(jt, unit.id))}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </div>

          {/* Department-level Job Titles (no unit) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Briefcase style={{ height: 16, width: 16 }} />
                {tr('المسميات الوظيفية للقسم', 'Department Job Titles')} ({unassignedJobTitles.length})
              </h4>
              <CVisionButton C={C} isDark={isDark}
                size="sm"
                variant="outline"
                style={{ height: 28, fontSize: 12 }}
                onClick={() => setJtDialogContext({ open: true })}
              >
                <Plus style={{ height: 12, width: 12, marginRight: 4 }} />{tr('إضافة مسمى وظيفي', 'Add Job Title')}
              </CVisionButton>
            </div>
            {unassignedJobTitles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {unassignedJobTitles.map((jt) => renderJobTitle(jt))}
              </div>
            )}
          </div>
        </div>
      </CVisionCard>

      {/* Dialogs */}
      <AddUnitDialog
        open={unitDialogOpen}
        onOpenChange={setUnitDialogOpen}
        departmentId={dept.id}
        departmentName={dept.name}
        saving={saving}
        employees={employees}
        onLoadEmployees={() => onLoadEmployees(dept.id)}
        onSubmit={onCreateUnit}
      />

      <AddJobTitleDialog
        open={jtDialogContext.open}
        onOpenChange={(open) => setJtDialogContext(prev => ({ ...prev, open }))}
        departmentId={dept.id}
        departmentName={dept.name}
        unitId={jtDialogContext.unitId}
        unitName={jtDialogContext.unitName}
        saving={saving}
        onSubmit={onCreateJobTitle}
      />

      <AddGradeDialog
        open={gradeDialogContext.open}
        onOpenChange={(open) => setGradeDialogContext(prev => ({ ...prev, open }))}
        jobTitleId={gradeDialogContext.jobTitleId}
        jobTitleName={gradeDialogContext.jobTitleName}
        existingGrades={getExistingGradesForDialog(gradeDialogContext.jobTitleId)}
        saving={saving}
        onSubmit={onCreateOrLinkGrade}
      />

      <AddPositionDialog
        open={positionDialogContext.open}
        onOpenChange={(open) => setPositionDialogContext(prev => ({ ...prev, open }))}
        jobTitleId={positionDialogContext.jobTitleId}
        departmentId={dept.id}
        unitId={positionDialogContext.unitId}
        grades={grades.filter(g => !g.isArchived)}
        saving={saving}
        onSubmit={onCreatePosition}
      />
    </>
  );
}
