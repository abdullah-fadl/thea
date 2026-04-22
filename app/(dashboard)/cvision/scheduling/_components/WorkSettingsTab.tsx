'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useState } from 'react';
import {
  Settings,
  Loader2,
  Building2,
  RotateCcw,
  Save,
  Search,
  Users,
  ChevronDown,
  XCircle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

import type {
  Department,
  UnitOption,
  WorkSettingsData,
  DeptEmployee,
  EditingEmployeeWs,
  BulkWs,
} from './types';

// ─── Props ──────────────────────────────────────────────────────

interface WorkSettingsTabProps {
  departments: Department[];
  settingsDepartments: Department[];
  workSettings: WorkSettingsData;
  setWorkSettings: React.Dispatch<React.SetStateAction<WorkSettingsData>>;
  tenantDefaultWs: WorkSettingsData | null;
  wsLoading: boolean;
  setWsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  wsSaving: boolean;
  setWsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  settingsDeptScope: string | null;
  settingsUnitScope: string | null;
  settingsUnits: UnitOption[];
  deptOverrides: any[];
  setDeptOverrides: React.Dispatch<React.SetStateAction<any[]>>;
  deptEmployees: DeptEmployee[];
  employeesLoading: boolean;
  expandedEmployeeId: string | null;
  setExpandedEmployeeId: React.Dispatch<React.SetStateAction<string | null>>;
  editingEmployeeWs: EditingEmployeeWs | null;
  setEditingEmployeeWs: React.Dispatch<React.SetStateAction<EditingEmployeeWs | null>>;
  employeeSaving: boolean;
  selectedEmployeeIds: Set<string>;
  setSelectedEmployeeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  employeeSearchTerm: string;
  setEmployeeSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  bulkEditOpen: boolean;
  setBulkEditOpen: React.Dispatch<React.SetStateAction<boolean>>;
  bulkWs: BulkWs;
  setBulkWs: React.Dispatch<React.SetStateAction<BulkWs>>;
  bulkSaving: boolean;
  isAdminUser: boolean;
  // Callbacks
  loadDeptWorkSchedule: (departmentId: string | null) => void;
  fetchDeptEmployees: (departmentId: string, unitId?: string | null) => void;
  saveEmployeeWorkSettings: (employeeId: string, settings: any) => void;
  resetEmployeeWorkSettings: (employeeId: string) => void;
  saveBulkEmployeeSettings: (employeeIds: string[], settings: any) => void;
  fetchWorkSettings: () => void;
}

// ─── Component ──────────────────────────────────────────────────

export function WorkSettingsTab({
  departments,
  settingsDepartments,
  workSettings,
  setWorkSettings,
  tenantDefaultWs,
  wsLoading,
  setWsLoading,
  wsSaving,
  setWsSaving,
  settingsDeptScope,
  settingsUnitScope,
  settingsUnits,
  deptOverrides,
  setDeptOverrides,
  deptEmployees,
  employeesLoading,
  expandedEmployeeId,
  setExpandedEmployeeId,
  editingEmployeeWs,
  setEditingEmployeeWs,
  employeeSaving,
  selectedEmployeeIds,
  setSelectedEmployeeIds,
  employeeSearchTerm,
  setEmployeeSearchTerm,
  bulkEditOpen,
  setBulkEditOpen,
  bulkWs,
  setBulkWs,
  bulkSaving,
  isAdminUser,
  loadDeptWorkSchedule,
  fetchDeptEmployees,
  saveEmployeeWorkSettings,
  resetEmployeeWorkSettings,
  saveBulkEmployeeSettings,
  fetchWorkSettings,
}: WorkSettingsTabProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const handleSaveWorkSettings = async () => {
    setWsSaving(true);
    try {
      const actionName = settingsDeptScope ? 'update-department-work-settings' : 'update-work-settings';
      const payload: any = { action: actionName, ...workSettings };
      if (settingsDeptScope) payload.departmentId = settingsDeptScope;

      const res = await fetch('/api/cvision/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(settingsDeptScope ? tr('تم حفظ اعدادات القسم', 'Department work settings saved') : tr('تم حفظ اعدادات العمل', 'Work settings saved'));
        if (!settingsDeptScope && data.data?.workSchedule) {
          setWorkSettings({ ...data.data.workSchedule, splitShiftEnabled: data.data.workSchedule.splitShiftEnabled || false, splitShiftSegments: data.data.workSchedule.splitShiftSegments || [] });
        }
        fetchWorkSettings();
      } else {
        toast.error(data.error || tr('فشل الحفظ', 'Failed to save'));
      }
    } catch {
      toast.error(tr('فشل حفظ اعدادات العمل', 'Failed to save work settings'));
    } finally {
      setWsSaving(false);
    }
  };

  const handleDeleteDeptOverride = async () => {
    if (!settingsDeptScope) return;
    try {
      await fetch('/api/cvision/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'delete-department-work-settings', departmentId: settingsDeptScope }),
      });
      toast.success(tr('تم ازالة تجاوز القسم', 'Department override removed, reverted to organization default'));
      setDeptOverrides(prev => prev.filter((o: any) => o.departmentId !== settingsDeptScope));
      loadDeptWorkSchedule(null);
    } catch {
      toast.error(tr('فشل اعادة التعيين', 'Failed to reset'));
    }
  };

  return (
    <CVisionCard C={C}>
      <CVisionCardHeader C={C} style={{ paddingBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings style={{ height: 20, width: 20, color: C.blue }} />
          {tr('اعدادات جدول العمل', 'Work Schedule Settings')}
        </div>
      </CVisionCardHeader>
      <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Department Scope Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CVisionSelect
                C={C}
                value={settingsDeptScope || '__default__'}
                onChange={(v) => loadDeptWorkSchedule(v === '__default__' ? null : v)}
                placeholder={tr('كل الاقسام (الافتراضي)', 'All Departments (Default)')}
                options={[...(isAdminUser ? [
                { value: '__default__', label: tr('كل الاقسام (الافتراضي للمنظمة)', 'All Departments (Organization Default)') }
              ] : []), ...settingsDepartments.map((d) => (
                ({ value: d.id, label: `${d.name} ${deptOverrides.some((o: any) => o.departmentId === d.id) ? '(Custom)' : ''}` })
              ))]}
              />

          {/* Unit Selector (appears when department is selected) */}
          {settingsDeptScope && settingsUnits.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionSelect
                C={C}
                value={settingsUnitScope || '__all__'}
                onChange={(v) => {
                  const uid = v === '__all__' ? null : v;
                  setExpandedEmployeeId(null);
                  setEditingEmployeeWs(null);
                  setSelectedEmployeeIds(new Set());
                  if (settingsDeptScope) {
                    fetchDeptEmployees(settingsDeptScope, uid);
                  }
                }}
                placeholder={tr('كل الوحدات', 'All Units')}
                options={[{ value: '__all__', label: tr('كل الوحدات', 'All Units') }, ...settingsUnits.map((u) => (
                    ({ value: u.id, label: `${u.name} ${u.code ? `(${u.code})` : ''}` })
                  ))]}
              />
            </div>
          )}

          {settingsDeptScope && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CVisionBadge C={C} variant="outline" style={{ fontSize: 12, background: C.orangeDim, color: C.orange }}>
                <Building2 style={{ height: 12, width: 12, marginRight: 4 }} />
                {tr('تجاوز القسم:', 'Department Override:')} {departments.find(d => d.id === settingsDeptScope)?.name || 'Unknown'}
              </CVisionBadge>
              <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ fontSize: 12, color: C.red }} onClick={handleDeleteDeptOverride}>
                <RotateCcw style={{ height: 12, width: 12, marginRight: 4 }} /> {tr('اعادة للافتراضي', 'Reset to Default')}
              </CVisionButton>
            </div>
          )}
        </div>

        <hr className="border-muted" />

        {wsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 48, paddingBottom: 48 }}>
            <Loader2 style={{ height: 24, width: 24, animation: 'spin 1s linear infinite', color: C.textMuted }} />
          </div>
        ) : (
          <>
            {/* Working Days */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionLabel C={C} style={{ fontWeight: 500, fontSize: 14 }}>{tr('ايام العمل', 'Working Days')}</CVisionLabel>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('حدد الايام التي يعمل فيها الموظفون. باقي الايام تصبح ايام راحة.', 'Select the days employees are expected to work. All other days become rest days.')}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, idx) => {
                  const isWork = workSettings.workDays.includes(idx);
                  return (
                    <label key={name} className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 cursor-pointer transition-colors min-w-[60px] ${isWork ? 'bg-green-50 border-green-400 shadow-sm' : 'bg-red-50/30 border-red-200 hover:bg-red-50'}`}>
                      <Checkbox checked={isWork} onCheckedChange={(v) => {
                        setWorkSettings(prev => {
                          const newWorkDays = v
                            ? [...prev.workDays, idx].sort()
                            : prev.workDays.filter(d => d !== idx);
                          const newRestDays = [0,1,2,3,4,5,6].filter(d => !newWorkDays.includes(d));
                          return { ...prev, workDays: newWorkDays, restDays: newRestDays };
                        });
                      }} />
                      <span className={`text-sm font-medium ${isWork ? 'text-green-800' : 'text-red-600'}`}>{name}</span>
                      <span className={`text-[10px] ${isWork ? 'text-green-600' : 'text-red-400'}`}>{isWork ? tr('عمل', 'Work') : tr('راحة', 'Rest')}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Default Work Hours */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('وقت البداية الافتراضي', 'Default Start Time')}</CVisionLabel>
                <CVisionInput C={C} type="time" value={workSettings.defaultStartTime}
                  onChange={e => setWorkSettings(prev => ({ ...prev, defaultStartTime: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('وقت النهاية الافتراضي', 'Default End Time')}</CVisionLabel>
                <CVisionInput C={C} type="time" value={workSettings.defaultEndTime}
                  onChange={e => setWorkSettings(prev => ({ ...prev, defaultEndTime: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('ساعات العمل / اليوم', 'Working Hours / Day')}</CVisionLabel>
                <CVisionInput C={C} type="number" min={1} max={12} value={workSettings.defaultWorkingHours}
                  onChange={e => setWorkSettings(prev => ({ ...prev, defaultWorkingHours: parseInt(e.target.value) || 8 }))} />
              </div>
            </div>

            {/* Break & Grace */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('مدة الاستراحة (دقائق)', 'Break Duration (minutes)')}</CVisionLabel>
                <CVisionInput C={C} type="number" min={0} max={120} value={workSettings.breakDurationMinutes}
                  onChange={e => setWorkSettings(prev => ({ ...prev, breakDurationMinutes: parseInt(e.target.value) || 0 }))} />
                <p style={{ fontSize: 12, color: C.textMuted }}>{tr('استراحة الغداء/الصلاة مخصومة من ساعات العمل', 'Lunch/prayer break deducted from working hours')}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('فترة السماح (دقائق)', 'Grace Period (minutes)')}</CVisionLabel>
                <CVisionInput C={C} type="number" min={0} max={60} value={workSettings.graceMinutes}
                  onChange={e => setWorkSettings(prev => ({ ...prev, graceMinutes: parseInt(e.target.value) || 0 }))} />
                <p style={{ fontSize: 12, color: C.textMuted }}>{tr('الدقائق المسموحة للتاخير قبل تسجيل تاخير', 'Minutes allowed for late arrivals before marking as late')}</p>
              </div>
            </div>

            {/* Split Shift Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, background: C.purpleDim }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <CVisionLabel C={C} style={{ fontWeight: 500, fontSize: 14 }}>{tr('فترات العمل المقسمة', 'Split Shifts')}</CVisionLabel>
                  <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{tr('السماح للموظفين بالعمل فترات متعددة في يوم واحد', 'Allow employees to work multiple separate shifts in a single day (e.g., morning + evening)')}</p>
                </div>
                <input type="checkbox"
                  checked={workSettings.splitShiftEnabled}
                  onChange={(e) => { const v = e.target.checked; setWorkSettings(prev => ({
                    ...prev,
                    splitShiftEnabled: v,
                    splitShiftSegments: v && prev.splitShiftSegments.length === 0
                      ? [{ label: tr('صباحي', 'Morning'), startTime: '07:00', endTime: '11:00' }, { label: tr('مسائي', 'Evening'), startTime: '16:00', endTime: '20:00' }]
                      : prev.splitShiftSegments,
                  })); }}
                />
              </div>

              {workSettings.splitShiftEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {workSettings.splitShiftSegments.map((seg, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 8, border: `1px solid ${C.border}`, padding: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.purple }}>{idx + 1}.</span>
                      <CVisionInput C={C}
                        style={{ width: 112 }}
                        placeholder="Label"
                        value={seg.label}
                        onChange={e => {
                          setWorkSettings(prev => {
                            const segs = [...prev.splitShiftSegments];
                            segs[idx] = { ...segs[idx], label: e.target.value };
                            return { ...prev, splitShiftSegments: segs };
                          });
                        }}
                      />
                      <CVisionInput C={C}
                        type="time"
                        style={{ width: 128 }}
                        value={seg.startTime}
                        onChange={e => {
                          setWorkSettings(prev => {
                            const segs = [...prev.splitShiftSegments];
                            segs[idx] = { ...segs[idx], startTime: e.target.value };
                            return { ...prev, splitShiftSegments: segs };
                          });
                        }}
                      />
                      <span style={{ color: C.textMuted }}>{tr('الى', 'to')}</span>
                      <CVisionInput C={C}
                        type="time"
                        style={{ width: 128 }}
                        value={seg.endTime}
                        onChange={e => {
                          setWorkSettings(prev => {
                            const segs = [...prev.splitShiftSegments];
                            segs[idx] = { ...segs[idx], endTime: e.target.value };
                            return { ...prev, splitShiftSegments: segs };
                          });
                        }}
                      />
                      {workSettings.splitShiftSegments.length > 2 && (
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ color: C.red, paddingLeft: 8, paddingRight: 8 }} onClick={() => {
                          setWorkSettings(prev => ({
                            ...prev,
                            splitShiftSegments: prev.splitShiftSegments.filter((_, i) => i !== idx),
                          }));
                        }}>
                          <XCircle style={{ height: 16, width: 16 }} />
                        </CVisionButton>
                      )}
                    </div>
                  ))}
                  {workSettings.splitShiftSegments.length < 4 && (
                    <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => {
                      setWorkSettings(prev => ({
                        ...prev,
                        splitShiftSegments: [...prev.splitShiftSegments, { label: `Segment ${prev.splitShiftSegments.length + 1}`, startTime: '12:00', endTime: '16:00' }],
                      }));
                    }}>
                      + {tr('اضافة فترة', 'Add Segment')}
                    </CVisionButton>
                  )}
                </div>
              )}
            </div>

            {/* Summary */}
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.blueDim, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.blue, marginBottom: 8 }}>
                {tr('الاعداد الحالي', 'Current Configuration')} {settingsDeptScope ? `(${departments.find(d => d.id === settingsDeptScope)?.name || tr('قسم', 'Department')})` : `(${tr('الافتراضي للمنظمة', 'Organization Default')})`}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 13, color: C.blue }}>
                <p>{tr('ايام العمل:', 'Work days:')} <span style={{ fontWeight: 500 }}>{workSettings.workDays.length} {tr('يوم/اسبوع', 'days/week')}</span></p>
                <p>{tr('ايام الراحة:', 'Rest days:')} <span style={{ fontWeight: 500 }}>{workSettings.restDays.length > 0 ? (() => {
                  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  return workSettings.restDays.map(d => names[d]).join(', ');
                })() : tr('لا يوجد', 'None')}</span></p>
                <p>{tr('الساعات:', 'Hours:')} <span style={{ fontWeight: 500 }}>{workSettings.defaultStartTime} – {workSettings.defaultEndTime}</span></p>
                <p>{tr('ساعات اسبوعية:', 'Weekly hours:')} <span style={{ fontWeight: 500 }}>{workSettings.workDays.length * workSettings.defaultWorkingHours}h</span></p>
                {workSettings.splitShiftEnabled && (
                  <p className="col-span-2">{tr('فترات مقسمة:', 'Split shifts:')} <span style={{ fontWeight: 500 }}>{workSettings.splitShiftSegments.map(s => `${s.label} (${s.startTime}-${s.endTime})`).join(' + ')}</span></p>
                )}
              </div>
            </div>

            {/* Department overrides summary (only on default scope) */}
            {!settingsDeptScope && deptOverrides.length > 0 && (
              <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.orangeDim, padding: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.orange, marginBottom: 8 }}>{tr('تجاوزات الاقسام', 'Department Overrides')} ({deptOverrides.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {deptOverrides.map((o: any) => {
                    const dept = departments.find(d => d.id === o.departmentId);
                    return (
                      <div key={o.departmentId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: C.orange }}>
                        <span style={{ fontWeight: 500 }}>{dept?.name || o.departmentId}</span>
                        <span>
                          {o.defaultWorkingHours ? `${o.defaultWorkingHours}h` : ''}
                          {o.splitShiftEnabled ? ' | Split Shifts' : ''}
                          {o.defaultStartTime ? ` | ${o.defaultStartTime}-${o.defaultEndTime}` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} onClick={handleSaveWorkSettings} disabled={wsSaving} style={{ background: C.blueDim }}>
                {wsSaving ? <Loader2 style={{ height: 16, width: 16, marginRight: 4, animation: 'spin 1s linear infinite' }} /> : <Save style={{ height: 16, width: 16, marginRight: 4 }} />}
                {settingsDeptScope ? tr('حفظ اعدادات القسم', 'Save Department Settings') : tr('حفظ اعدادات العمل', 'Save Work Settings')}
              </CVisionButton>
            </div>

            {/* ── Employee Schedule Overrides (only when department is selected) ── */}
            {settingsDeptScope && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <hr className="border-muted" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <CVisionLabel C={C} style={{ fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users style={{ height: 16, width: 16 }} />
                      {tr('تجاوزات جدول الموظفين', 'Employee Schedule Overrides')}
                    </CVisionLabel>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                      {tr('تخصيص جداول العمل للموظفين. الموظفون بدون اعدادات مخصصة يرثون الافتراضي.', 'Customize work schedules for individual employees. Employees without custom settings inherit the department default above.')}
                    </p>
                  </div>
                  <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12 }}>
                    {deptEmployees.length} {tr('موظف', 'employees')}
                  </CVisionBadge>
                </div>

                {/* Search + Bulk Actions Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
                    <CVisionInput C={C}
                      placeholder={tr('بحث عن موظفين...', 'Search employees...')}
                      value={employeeSearchTerm}
                      onChange={e => setEmployeeSearchTerm(e.target.value)}
                      style={{ paddingLeft: 36 }}
                    />
                  </div>
                  {selectedEmployeeIds.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CVisionBadge C={C} className="bg-violet-100 text-violet-700 border-violet-300">
                        {selectedEmployeeIds.size} {tr('محدد', 'selected')}
                      </CVisionBadge>
                      <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => setSelectedEmployeeIds(new Set())}>
                        {tr('مسح', 'Clear')}
                      </CVisionButton>
                      <CVisionButton C={C} isDark={isDark} size="sm" className="bg-violet-600 hover:bg-violet-700" onClick={() => {
                        setBulkWs({
                          workDays: workSettings.workDays,
                          restDays: workSettings.restDays,
                          startTime: workSettings.defaultStartTime,
                          endTime: workSettings.defaultEndTime,
                          workingHours: workSettings.defaultWorkingHours,
                          breakDurationMinutes: workSettings.breakDurationMinutes,
                          graceMinutes: workSettings.graceMinutes,
                          splitShiftEnabled: workSettings.splitShiftEnabled,
                          splitShiftSegments: workSettings.splitShiftSegments,
                        });
                        setBulkEditOpen(true);
                      }}>
                        {tr('تطبيق على المحددين', 'Apply to Selected')}
                      </CVisionButton>
                    </div>
                  )}
                </div>

                {/* Employee List */}
                {employeesLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 32, paddingBottom: 32 }}>
                    <Loader2 style={{ height: 20, width: 20, animation: 'spin 1s linear infinite', color: C.textMuted }} />
                  </div>
                ) : deptEmployees.length === 0 ? (
                  <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: C.textMuted, fontSize: 13 }}>
                    {tr('لا يوجد موظفون في هذا القسم', 'No employees found in this department')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 4 }}>
                    {/* Select All */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }}>
                      <Checkbox
                        checked={selectedEmployeeIds.size === deptEmployees.length && deptEmployees.length > 0}
                        onCheckedChange={(v) => {
                          if (v) {
                            setSelectedEmployeeIds(new Set(deptEmployees.map(e => e.id)));
                          } else {
                            setSelectedEmployeeIds(new Set());
                          }
                        }}
                      />
                      <span style={{ fontSize: 12, color: C.textMuted }}>{tr('تحديد الكل', 'Select All')}</span>
                    </div>

                    {deptEmployees
                      .filter(emp => {
                        if (!employeeSearchTerm) return true;
                        const term = employeeSearchTerm.toLowerCase();
                        return (
                          emp.fullName?.toLowerCase().includes(term) ||
                          emp.firstName?.toLowerCase().includes(term) ||
                          emp.lastName?.toLowerCase().includes(term) ||
                          emp.firstNameAr?.toLowerCase().includes(term) ||
                          emp.lastNameAr?.toLowerCase().includes(term) ||
                          emp.employeeNo?.toLowerCase().includes(term)
                        );
                      })
                      .map(emp => {
                        const isExpanded = expandedEmployeeId === emp.id;
                        return (
                          <div key={emp.id} className={`rounded-lg border transition-colors ${isExpanded ? 'border-violet-300 bg-violet-50/30' : 'hover:bg-muted/50'}`}>
                            {/* Employee Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
                              <Checkbox
                                checked={selectedEmployeeIds.has(emp.id)}
                                onCheckedChange={(v) => {
                                  setSelectedEmployeeIds(prev => {
                                    const next = new Set(prev);
                                    v ? next.add(emp.id) : next.delete(emp.id);
                                    return next;
                                  });
                                }}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, width: 32, borderRadius: '50%', fontSize: 12, fontWeight: 500 }}>
                                {emp.firstName?.[0]}{emp.lastName?.[0]}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.fullName || `${emp.firstName} ${emp.lastName}`}</span>
                                  {emp.firstNameAr && (
                                    <span style={{ fontSize: 12, color: C.textMuted }} dir="rtl">{emp.firstNameAr} {emp.lastNameAr}</span>
                                  )}
                                </div>
                                <span style={{ fontSize: 12, color: C.textMuted }}>{emp.employeeNo}</span>
                              </div>
                              <CVisionBadge C={C} variant={emp.hasCustomSchedule ? 'default' : 'secondary'} className={`text-xs ${emp.hasCustomSchedule ? 'bg-violet-600' : ''}`}>
                                {emp.hasCustomSchedule ? tr('مخصص', 'Custom') : tr('افتراضي', 'Default')}
                              </CVisionBadge>
                              <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ paddingLeft: 8, paddingRight: 8 }} onClick={() => {
                                if (isExpanded) {
                                  setExpandedEmployeeId(null);
                                  setEditingEmployeeWs(null);
                                } else {
                                  setExpandedEmployeeId(emp.id);
                                  const ws = emp.workSchedule;
                                  setEditingEmployeeWs({
                                    workDays: ws?.workDays ?? workSettings.workDays,
                                    restDays: ws?.restDays ?? workSettings.restDays,
                                    startTime: ws?.startTime ?? workSettings.defaultStartTime,
                                    endTime: ws?.endTime ?? workSettings.defaultEndTime,
                                    workingHours: ws?.workingHours ?? workSettings.defaultWorkingHours,
                                    breakDurationMinutes: ws?.breakDurationMinutes ?? workSettings.breakDurationMinutes,
                                    graceMinutes: ws?.graceMinutes ?? workSettings.graceMinutes,
                                    splitShiftEnabled: ws?.splitShiftEnabled ?? workSettings.splitShiftEnabled,
                                    splitShiftSegments: ws?.splitShiftSegments ?? workSettings.splitShiftSegments,
                                  });
                                }
                              }}>
                                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </CVisionButton>
                            </div>

                            {/* Expanded Employee Settings */}
                            {isExpanded && editingEmployeeWs && (
                              <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 16, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                                {/* Inheritance Info */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted, background: C.blueDim, borderRadius: 6, padding: 8 }}>
                                  <Info style={{ height: 14, width: 14 }} />
                                  <span>
                                    {tr('يرث من:', 'Inheriting from:')} <strong>{tr('افتراضي القسم', 'Department Default')}</strong>
                                    {emp.hasCustomSchedule && tr(' (مع تجاوزات الموظف)', ' (with employee overrides)')}
                                  </span>
                                </div>

                                {/* Working Days */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <CVisionLabel C={C} style={{ fontSize: 13, fontWeight: 500 }}>{tr('ايام العمل', 'Working Days')}</CVisionLabel>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, idx) => {
                                      const isWork = editingEmployeeWs.workDays.includes(idx);
                                      return (
                                        <label key={name} className={`flex flex-col items-center gap-1 rounded-md border p-2 cursor-pointer transition-colors min-w-[48px] text-xs ${isWork ? 'bg-green-50 border-green-400' : 'bg-red-50/30 border-red-200 hover:bg-red-50'}`}>
                                          <Checkbox checked={isWork} onCheckedChange={(v) => {
                                            setEditingEmployeeWs(prev => {
                                              if (!prev) return prev;
                                              const newWorkDays = v
                                                ? [...prev.workDays, idx].sort()
                                                : prev.workDays.filter(d => d !== idx);
                                              const newRestDays = [0,1,2,3,4,5,6].filter(d => !newWorkDays.includes(d));
                                              return { ...prev, workDays: newWorkDays, restDays: newRestDays };
                                            });
                                          }} />
                                          <span className={`font-medium ${isWork ? 'text-green-800' : 'text-red-600'}`}>{name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Times & Hours */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('وقت البداية', 'Start Time')}</CVisionLabel>
                                    <CVisionInput C={C} type="time" value={editingEmployeeWs.startTime}
                                      onChange={e => setEditingEmployeeWs(prev => prev ? { ...prev, startTime: e.target.value } : prev)} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('وقت النهاية', 'End Time')}</CVisionLabel>
                                    <CVisionInput C={C} type="time" value={editingEmployeeWs.endTime}
                                      onChange={e => setEditingEmployeeWs(prev => prev ? { ...prev, endTime: e.target.value } : prev)} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('ساعات/يوم', 'Hours/Day')}</CVisionLabel>
                                    <CVisionInput C={C} type="number" min={1} max={12} value={editingEmployeeWs.workingHours}
                                      onChange={e => setEditingEmployeeWs(prev => prev ? { ...prev, workingHours: parseInt(e.target.value) || 8 } : prev)} />
                                  </div>
                                </div>

                                {/* Break & Grace */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('استراحة (دقيقة)', 'Break (min)')}</CVisionLabel>
                                    <CVisionInput C={C} type="number" min={0} max={120} value={editingEmployeeWs.breakDurationMinutes}
                                      onChange={e => setEditingEmployeeWs(prev => prev ? { ...prev, breakDurationMinutes: parseInt(e.target.value) || 0 } : prev)} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('سماح (دقيقة)', 'Grace (min)')}</CVisionLabel>
                                    <CVisionInput C={C} type="number" min={0} max={60} value={editingEmployeeWs.graceMinutes}
                                      onChange={e => setEditingEmployeeWs(prev => prev ? { ...prev, graceMinutes: parseInt(e.target.value) || 0 } : prev)} />
                                  </div>
                                </div>

                                {/* Split Shift Toggle */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('فترات مقسمة', 'Split Shifts')}</CVisionLabel>
                                  <input type="checkbox"
                                    checked={editingEmployeeWs.splitShiftEnabled}
                                    onChange={(e) => { const v = e.target.checked; setEditingEmployeeWs(prev => prev ? {
                                      ...prev,
                                      splitShiftEnabled: v,
                                      splitShiftSegments: v && prev.splitShiftSegments.length === 0
                                        ? [{ label: tr('صباحي', 'Morning'), startTime: '07:00', endTime: '11:00' }, { label: tr('مسائي', 'Evening'), startTime: '16:00', endTime: '20:00' }]
                                        : prev.splitShiftSegments,
                                    } : prev); }}
                                  />
                                </div>

                                {editingEmployeeWs.splitShiftEnabled && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {editingEmployeeWs.splitShiftSegments.map((seg, idx) => (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                        <CVisionInput C={C} style={{ width: 96 }} placeholder="Label" value={seg.label}
                                          onChange={e => setEditingEmployeeWs(prev => {
                                            if (!prev) return prev;
                                            const segs = [...prev.splitShiftSegments];
                                            segs[idx] = { ...segs[idx], label: e.target.value };
                                            return { ...prev, splitShiftSegments: segs };
                                          })} />
                                        <CVisionInput C={C} type="time" style={{ width: 112 }} value={seg.startTime}
                                          onChange={e => setEditingEmployeeWs(prev => {
                                            if (!prev) return prev;
                                            const segs = [...prev.splitShiftSegments];
                                            segs[idx] = { ...segs[idx], startTime: e.target.value };
                                            return { ...prev, splitShiftSegments: segs };
                                          })} />
                                        <span style={{ color: C.textMuted }}>{tr('الى', 'to')}</span>
                                        <CVisionInput C={C} type="time" style={{ width: 112 }} value={seg.endTime}
                                          onChange={e => setEditingEmployeeWs(prev => {
                                            if (!prev) return prev;
                                            const segs = [...prev.splitShiftSegments];
                                            segs[idx] = { ...segs[idx], endTime: e.target.value };
                                            return { ...prev, splitShiftSegments: segs };
                                          })} />
                                        {editingEmployeeWs.splitShiftSegments.length > 2 && (
                                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ color: C.red, paddingLeft: 4, paddingRight: 4 }} onClick={() => {
                                            setEditingEmployeeWs(prev => prev ? {
                                              ...prev,
                                              splitShiftSegments: prev.splitShiftSegments.filter((_, i) => i !== idx),
                                            } : prev);
                                          }}>
                                            <XCircle style={{ height: 14, width: 14 }} />
                                          </CVisionButton>
                                        )}
                                      </div>
                                    ))}
                                    {editingEmployeeWs.splitShiftSegments.length < 4 && (
                                      <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ fontSize: 12 }} onClick={() => {
                                        setEditingEmployeeWs(prev => prev ? {
                                          ...prev,
                                          splitShiftSegments: [...prev.splitShiftSegments, { label: `Segment ${prev.splitShiftSegments.length + 1}`, startTime: '12:00', endTime: '16:00' }],
                                        } : prev);
                                      }}>
                                        + {tr('اضافة فترة', 'Add Segment')}
                                      </CVisionButton>
                                    )}
                                  </div>
                                )}

                                {/* Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
                                  {emp.hasCustomSchedule && (
                                    <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ fontSize: 12, color: C.red }} onClick={() => resetEmployeeWorkSettings(emp.id)}>
                                      <RotateCcw style={{ height: 12, width: 12, marginRight: 4 }} /> {tr('اعادة للافتراضي', 'Reset to Default')}
                                    </CVisionButton>
                                  )}
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => { setExpandedEmployeeId(null); setEditingEmployeeWs(null); }}>
                                      {tr('الغاء', 'Cancel')}
                                    </CVisionButton>
                                    <CVisionButton C={C} isDark={isDark} size="sm" className="bg-violet-600 hover:bg-violet-700" disabled={employeeSaving}
                                      onClick={() => saveEmployeeWorkSettings(emp.id, editingEmployeeWs)}>
                                      {employeeSaving ? <Loader2 style={{ height: 14, width: 14, marginRight: 4, animation: 'spin 1s linear infinite' }} /> : <Save style={{ height: 14, width: 14, marginRight: 4 }} />}
                                      {tr('حفظ', 'Save')}
                                    </CVisionButton>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* ── Bulk Edit Dialog ── */}
            <CVisionDialog C={C} open={bulkEditOpen} onClose={() => setBulkEditOpen(false)} title={tr('تعديل جماعي', 'Bulk Edit')} isDark={isDark}>                  
                  <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('هذه الاعدادات ستتجاوز الافتراضي للموظفين المحددين.', 'These settings will override the department default for the selected employees.')}</p>                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', paddingTop: 8, paddingBottom: 8 }}>
                  {/* Working Days */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C} style={{ fontSize: 13, fontWeight: 500 }}>{tr('ايام العمل', 'Working Days')}</CVisionLabel>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, idx) => {
                        const isWork = bulkWs.workDays.includes(idx);
                        return (
                          <label key={name} className={`flex flex-col items-center gap-1 rounded-md border p-2 cursor-pointer transition-colors min-w-[48px] text-xs ${isWork ? 'bg-green-50 border-green-400' : 'bg-red-50/30 border-red-200'}`}>
                            <Checkbox checked={isWork} onCheckedChange={(v) => {
                              setBulkWs(prev => {
                                const newWorkDays = v ? [...prev.workDays, idx].sort() : prev.workDays.filter(d => d !== idx);
                                return { ...prev, workDays: newWorkDays, restDays: [0,1,2,3,4,5,6].filter(d => !newWorkDays.includes(d)) };
                              });
                            }} />
                            <span className={`font-medium ${isWork ? 'text-green-800' : 'text-red-600'}`}>{name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {/* Times */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('وقت البداية', 'Start Time')}</CVisionLabel>
                      <CVisionInput C={C} type="time" value={bulkWs.startTime} onChange={e => setBulkWs(prev => ({ ...prev, startTime: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('وقت النهاية', 'End Time')}</CVisionLabel>
                      <CVisionInput C={C} type="time" value={bulkWs.endTime} onChange={e => setBulkWs(prev => ({ ...prev, endTime: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('ساعات/يوم', 'Hours/Day')}</CVisionLabel>
                      <CVisionInput C={C} type="number" min={1} max={12} value={bulkWs.workingHours} onChange={e => setBulkWs(prev => ({ ...prev, workingHours: parseInt(e.target.value) || 8 }))} />
                    </div>
                  </div>
                  {/* Break & Grace */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('استراحة (دقيقة)', 'Break (min)')}</CVisionLabel>
                      <CVisionInput C={C} type="number" min={0} max={120} value={bulkWs.breakDurationMinutes} onChange={e => setBulkWs(prev => ({ ...prev, breakDurationMinutes: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('سماح (دقيقة)', 'Grace (min)')}</CVisionLabel>
                      <CVisionInput C={C} type="number" min={0} max={60} value={bulkWs.graceMinutes} onChange={e => setBulkWs(prev => ({ ...prev, graceMinutes: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                </div>
                <CVisionDialogFooter C={C}>
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setBulkEditOpen(false)}>{tr('الغاء', 'Cancel')}</CVisionButton>
                  <CVisionButton C={C} isDark={isDark} className="bg-violet-600 hover:bg-violet-700" disabled={bulkSaving} onClick={() => {
                    saveBulkEmployeeSettings(Array.from(selectedEmployeeIds), bulkWs);
                  }}>
                    {bulkSaving ? <Loader2 style={{ height: 16, width: 16, marginRight: 4, animation: 'spin 1s linear infinite' }} /> : <Save style={{ height: 16, width: 16, marginRight: 4 }} />}
                    {tr('تطبيق على', 'Apply to')} {selectedEmployeeIds.size} {tr('موظف', 'Employees')}
                  </CVisionButton>
                </CVisionDialogFooter>
            </CVisionDialog>
          </>
        )}
      </CVisionCardBody>
    </CVisionCard>
  );
}
