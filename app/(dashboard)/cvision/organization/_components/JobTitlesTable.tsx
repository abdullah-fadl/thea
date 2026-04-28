'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionInput, CVisionSelect , CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useMemo } from 'react';

import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Search, Plus, ChevronDown, ChevronRight, Briefcase, GraduationCap, Target, ArrowUpDown,
} from 'lucide-react';

import AddJobTitleDialog from './AddJobTitleDialog';
import AddGradeDialog from './AddGradeDialog';
import AddPositionDialog from './AddPositionDialog';

import type {
  Department, JobTitle, Grade, Position,
  JobTitleFormData, GradeFormData, PositionFormData,
} from './types';

interface JobTitlesTableProps {
  jobTitles: JobTitle[];
  grades: Grade[];
  positions: Position[];
  departments: Department[];
  showArchived: boolean;
  saving: boolean;
  onCreateJobTitle: (departmentId: string, unitId: string | undefined, form: JobTitleFormData) => Promise<void>;
  onCreateOrLinkGrade: (jobTitleId: string, gradeForm: GradeFormData, existingGradeId: string) => Promise<void>;
  onCreatePosition: (jobTitleId: string, departmentId: string, unitId: string | null | undefined, form: PositionFormData) => Promise<void>;
}

type SortCol = 'name' | 'code' | 'department' | 'positions' | 'grades';

export default function JobTitlesTable({
  jobTitles, grades, positions, departments, showArchived, saving,
  onCreateJobTitle, onCreateOrLinkGrade, onCreatePosition,
}: JobTitlesTableProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterDeptId, setFilterDeptId] = useState('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Dialog states
  const [addJtOpen, setAddJtOpen] = useState(false);
  const [addJtDeptId, setAddJtDeptId] = useState('');
  const [gradeDialogCtx, setGradeDialogCtx] = useState<{ open: boolean; jobTitleId: string; jobTitleName: string }>({ open: false, jobTitleId: '', jobTitleName: '' });
  const [posDialogCtx, setPosDialogCtx] = useState<{ open: boolean; jobTitleId: string; deptId: string; unitId?: string | null }>({ open: false, jobTitleId: '', deptId: '' });

  // Helpers
  function getDeptName(deptId?: string | null) {
    if (!deptId) return '—';
    const dept = departments.find(d => d.id === deptId);
    return dept ? dept.name : '—';
  }

  function getGradesForJT(jtId: string) {
    return grades.filter(g => {
      if (g.isArchived && !showArchived) return false;
      return g.jobTitleId === jtId || (g.jobTitleIds && g.jobTitleIds.includes(jtId));
    });
  }

  function getPositionsForJT(jtId: string) {
    return positions.filter(p => p.jobTitleId === jtId && (showArchived || p.isActive));
  }

  function getExistingGradesForDialog(jobTitleId: string) {
    return grades.filter(g =>
      !g.isArchived &&
      !(g.jobTitleId === jobTitleId || (g.jobTitleIds && g.jobTitleIds.includes(jobTitleId)))
    );
  }

  function getGradeRange(jtId: string): string {
    const jtGrades = getGradesForJT(jtId);
    if (jtGrades.length === 0) return '—';
    if (jtGrades.length === 1) return jtGrades[0].code;
    const sorted = [...jtGrades].sort((a, b) => a.level - b.level);
    return `${sorted[0].code}–${sorted[sorted.length - 1].code}`;
  }

  // Filtered & sorted job titles
  const filteredJTs = useMemo(() => {
    let list = jobTitles.filter(jt => showArchived || !jt.isArchived);

    if (filterDeptId && filterDeptId !== 'all') {
      list = list.filter(jt => jt.departmentId === filterDeptId);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(jt =>
        jt.name.toLowerCase().includes(q) ||
        jt.code.toLowerCase().includes(q) ||
        (jt.nameAr && jt.nameAr.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'code': cmp = a.code.localeCompare(b.code); break;
        case 'department': cmp = getDeptName(a.departmentId).localeCompare(getDeptName(b.departmentId)); break;
        case 'positions': cmp = getPositionsForJT(a.id).length - getPositionsForJT(b.id).length; break;
        case 'grades': cmp = getGradesForJT(a.id).length - getGradesForJT(b.id).length; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [jobTitles, showArchived, filterDeptId, searchTerm, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ col, label }: { col: SortCol; label: string }) => (
    <CVisionTh C={C} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleSort(col)}>
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortCol === col ? 'text-foreground' : 'text-muted-foreground/50'}`} />
      </div>
    </CVisionTh>
  );

  const activeDepts = departments.filter(d => !d.isArchived);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
          <CVisionInput C={C}
            placeholder={tr('بحث المسميات الوظيفية...', 'Search job titles...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 40, borderRadius: '50%' }}
          />
        </div>
        <CVisionSelect
                C={C}
                value={filterDeptId}
                onChange={setFilterDeptId}
                placeholder={tr('جميع الأقسام', 'All Departments')}
                options={[
                  { value: 'all', label: tr('جميع الأقسام', 'All Departments') },
                  ...activeDepts.map(d => (
              ({ value: d.id, label: d.name })
            )),
                ]}
              />
        <CVisionButton C={C} isDark={isDark}
          onClick={() => {
            setAddJtDeptId(filterDeptId !== 'all' ? filterDeptId : (activeDepts[0]?.id || ''));
            setAddJtOpen(true);
          }}
          disabled={activeDepts.length === 0}
        >
          <Plus style={{ height: 16, width: 16, marginRight: 8 }} />{tr('إضافة مسمى وظيفي', 'Add Job Title')}
        </CVisionButton>
      </div>

      {/* Table */}
      {filteredJTs.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
          <Briefcase style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontWeight: 500 }}>{tr('لا توجد مسميات وظيفية', 'No job titles found')}</p>
          <p style={{ fontSize: 13 }}>
            {searchTerm || filterDeptId !== 'all' ? tr('حاول تعديل البحث أو الفلاتر.', 'Try adjusting your search or filters.') : tr('أنشئ أول مسمى وظيفي للبدء.', 'Create your first job title to get started.')}
          </p>
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
                <CVisionTh C={C} style={{ width: 32 }} />
                <SortHeader col="name" label={tr('المسمى الوظيفي', 'Job Title')} />
                <SortHeader col="code" label={tr('الرمز', 'Code')} />
                <SortHeader col="department" label={tr('القسم', 'Department')} />
                <SortHeader col="positions" label={tr('الوظائف', 'Positions')} />
                <SortHeader col="grades" label={tr('الدرجات', 'Grades')} />
            </CVisionTableHead>
            <CVisionTableBody>
              {filteredJTs.map((jt) => {
                const jtGrades = getGradesForJT(jt.id);
                const jtPositions = getPositionsForJT(jt.id);
                const isExpanded = expandedRowId === jt.id;

                return (
                  <Collapsible key={jt.id} open={isExpanded} onOpenChange={(open) => setExpandedRowId(open ? jt.id : null)} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <CVisionTr C={C} style={{ cursor: 'pointer', transition: 'color 0.2s, background 0.2s' }}>
                          <CVisionTd>
                            {isExpanded ? <ChevronDown style={{ height: 16, width: 16 }} /> : <ChevronRight style={{ height: 16, width: 16 }} />}
                          </CVisionTd>
                          <CVisionTd>
                            <div>
                              <span style={{ fontWeight: 500 }}>{jt.name}</span>
                              {jt.isArchived && <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{tr('مؤرشف', 'Archived')}</CVisionBadge>}
                            </div>
                          </CVisionTd>
                          <CVisionTd style={{ color: C.textMuted }}>{jt.code}</CVisionTd>
                          <CVisionTd>
                            <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{getDeptName(jt.departmentId)}</CVisionBadge>
                          </CVisionTd>
                          <CVisionTd>{jtPositions.length}</CVisionTd>
                          <CVisionTd>{getGradeRange(jt.id)}</CVisionTd>
                        </CVisionTr>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <div style={{ paddingLeft: 32, paddingRight: 32, paddingTop: 16, paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 16, borderTop: `1px solid ${C.border}` }}>
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
                                    onClick={() => setPosDialogCtx({ open: true, jobTitleId: jt.id, deptId: jt.departmentId || '', unitId: jt.unitId })}
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
                                    onClick={() => setGradeDialogCtx({ open: true, jobTitleId: jt.id, jobTitleName: jt.name })}
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
                                            <div style={{ fontWeight: 500, fontSize: 13 }}>
                                              {grade.name} <span style={{ color: C.textMuted, marginLeft: 4 }}>({grade.code})</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: C.textMuted }}>
                                              {tr('المستوى', 'Level')} {grade.level}
                                              {(grade.minSalary || grade.maxSalary) && (
                                                <span style={{ marginLeft: 8 }}>
                                                  | {grade.minSalary?.toLocaleString() || '—'} – {grade.maxSalary?.toLocaleString() || '—'} SAR
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </CVisionTableBody>
          </CVisionTable>
        </div>
      )}

      {/* Dialogs */}
      <AddJobTitleDialog
        open={addJtOpen}
        onOpenChange={setAddJtOpen}
        departmentId={addJtDeptId}
        departmentName={getDeptName(addJtDeptId)}
        saving={saving}
        onSubmit={onCreateJobTitle}
      />

      <AddGradeDialog
        open={gradeDialogCtx.open}
        onOpenChange={(open) => setGradeDialogCtx(prev => ({ ...prev, open }))}
        jobTitleId={gradeDialogCtx.jobTitleId}
        jobTitleName={gradeDialogCtx.jobTitleName}
        existingGrades={getExistingGradesForDialog(gradeDialogCtx.jobTitleId)}
        saving={saving}
        onSubmit={onCreateOrLinkGrade}
      />

      <AddPositionDialog
        open={posDialogCtx.open}
        onOpenChange={(open) => setPosDialogCtx(prev => ({ ...prev, open }))}
        jobTitleId={posDialogCtx.jobTitleId}
        departmentId={posDialogCtx.deptId}
        unitId={posDialogCtx.unitId}
        grades={grades.filter(g => !g.isArchived)}
        saving={saving}
        onSubmit={onCreatePosition}
      />
    </div>
  );
}
