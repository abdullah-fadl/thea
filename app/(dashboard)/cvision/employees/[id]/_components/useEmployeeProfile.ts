'use client';

/**
 * Custom hook encapsulating ALL state, data-loading, and save logic
 * for the employee profile page.
 *
 * Extracted from page.tsx to reduce its size by ~900 lines.
 */

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { EMPLOYEE_STATUS_LABELS } from '@/lib/cvision/constants';
import { CVISION_ROLES } from '@/lib/cvision/roles';
import type { ProfileSectionKey } from '@/lib/cvision/types';
import type { ProfileResponse, ReferenceData } from './types';
import {
  saveSectionToApi,
  detectSectionChanges,
  hasAnyProfileChanges,
  calculateCompleteness,
  type CompletenessResult,
} from './profileSaveService';

// ── Helper: initialise edit data from a loaded profile ──

function buildInitialEditData(data: ProfileResponse): Record<string, Record<string, any>> {
  const initialEditData: Record<string, Record<string, any>> = {};
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  Object.keys(data.sections).forEach((key) => {
    const sectionKey = key as ProfileSectionKey;
    const section = data.sections[sectionKey];
    initialEditData[sectionKey] = { ...(section?.dataJson || {}) };

    // Clean invalid contractType values for CONTRACT section
    if (sectionKey === 'CONTRACT' && initialEditData[sectionKey].contractType) {
      const validContractTypes = ['PERMANENT', 'FIXED_TERM', 'LOCUM', 'PART_TIME', 'INTERN'];
      if (!validContractTypes.includes(initialEditData[sectionKey].contractType)) {
        console.warn('[Profile] Invalid contractType detected, clearing:', {
          employeeId: data.employee.id,
          invalidValue: initialEditData[sectionKey].contractType,
        });
        initialEditData[sectionKey].contractType = null;
      }
    }

    // Sync EMPLOYMENT section with root fields (canonical source of truth)
    if (sectionKey === 'EMPLOYMENT' && data.employee) {
      if (data.employee.departmentId) {
        initialEditData[sectionKey].departmentId = data.employee.departmentId;
      }
      if (data.employee.positionId !== undefined) {
        initialEditData[sectionKey].positionId = data.employee.positionId;
      }
      const sectionData = data.sections[sectionKey];
      if (!initialEditData[sectionKey].positionId && sectionData?.dataJson?.positionId) {
        initialEditData[sectionKey].positionId = sectionData.dataJson.positionId;
      }
      if (data.employee.jobTitleId) {
        initialEditData[sectionKey].jobTitleId = data.employee.jobTitleId;
      }
      if (initialEditData[sectionKey].jobTitle !== undefined) {
        delete initialEditData[sectionKey].jobTitle;
      }
      if ('managerEmployeeId' in data.employee && data.employee.managerEmployeeId !== undefined) {
        initialEditData[sectionKey].managerEmployeeId = data.employee.managerEmployeeId;
      }
      if (data.employee.hiredAt) {
        initialEditData[sectionKey].hiredAt = data.employee.hiredAt;
      }

      // Validate UUID fields
      const jobTitleId = initialEditData[sectionKey].jobTitleId;
      if (jobTitleId && typeof jobTitleId === 'string' && !uuidRegex.test(jobTitleId)) {
        console.warn('[Profile] Invalid jobTitleId detected (non-UUID):', { employeeId: data.employee.id, jobTitleId });
        initialEditData[sectionKey].jobTitleId = null;
      }

      const managerId = initialEditData[sectionKey].managerEmployeeId;
      if (managerId && typeof managerId === 'string' && managerId !== 'none' && !uuidRegex.test(managerId)) {
        console.warn('[Profile] Invalid managerEmployeeId detected (non-UUID):', { employeeId: data.employee.id, managerEmployeeId: managerId });
        initialEditData[sectionKey].managerEmployeeId = null;
      }

      const deptId = initialEditData[sectionKey].departmentId;
      if (deptId && typeof deptId === 'string' && !uuidRegex.test(deptId)) {
        console.warn('[Profile] Legacy departmentId detected (non-UUID):', { employeeId: data.employee.id, departmentId: deptId });
      }

      const posId = initialEditData[sectionKey].positionId;
      if (posId && typeof posId === 'string' && posId !== 'none' && !uuidRegex.test(posId)) {
        console.warn('[Profile] Legacy positionId detected (non-UUID):', { employeeId: data.employee.id, positionId: posId });
        initialEditData[sectionKey].positionId = null;
      }
    }
  });

  return initialEditData;
}

// ── The hook itself ──

export function useEmployeeProfile(employeeId: string) {
  const { toast } = useToast();

  // ── Core state ──
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [editingSection, setEditingSection] = useState<ProfileSectionKey | null>(null);
  const [editData, setEditData] = useState<Record<string, Record<string, any>>>({});
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [changeReason, setChangeReason] = useState<Record<string, string>>({});

  // ── Status change state ──
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusReason, setStatusReason] = useState<string>('');
  const [statusEffectiveDate, setStatusEffectiveDate] = useState<string>('');
  const [lastWorkingDay, setLastWorkingDay] = useState<string>('');

  // ── Role / permissions ──
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [fixingProfile, setFixingProfile] = useState(false);

  // ── Absher lookup state ──
  const [absherLookingUp, setAbsherLookingUp] = useState(false);
  const [absherLookupDone, setAbsherLookupDone] = useState(false);
  const [absherLookupError, setAbsherLookupError] = useState<string | null>(null);

  // ── Reference data state ──
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [positions, setPositions] = useState<Array<{ id: string; title?: string; positionCode: string; departmentId?: string }>>([]);
  const [jobTitles, setJobTitles] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [grades, setGrades] = useState<Array<{ id: string; name: string; code?: string; level?: number; minSalary?: number; maxSalary?: number }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [branchesList, setBranchesList] = useState<Array<{ id: string; name: string; isHeadquarters?: boolean }>>([]);

  // ── Derived values ──
  const selectedDepartmentId = editData.EMPLOYMENT?.departmentId || profile?.employee?.departmentId;
  const selectedUnitId = editData.EMPLOYMENT?.unitId || profile?.employee?.unitId;

  // ────────────────────────────────────────────────
  // DATA LOADING
  // ────────────────────────────────────────────────

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await fetch(`/api/cvision/employees/${employeeId}/profile`, { cache: 'no-store', credentials: 'include' });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Failed to load profile: ${res.status} ${res.statusText}`);
      }

      const data: ProfileResponse = await res.json();

      if (data.success) {
        setProfile(data);
        if (data._diagnostics?.roles) setUserRoles(data._diagnostics.roles);
        setEditData(buildInitialEditData(data));
      } else {
        const failData = data as ProfileResponse & { error?: string; message?: string };
        const errorMessage = failData.error || failData.message || 'Failed to load employee profile';
        console.error('[Profile] API returned success: false', { employeeId, error: errorMessage });
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        setProfile(null);
      }
    } catch (error: any) {
      console.error('[Profile] Failed to load profile:', { employeeId, error: error?.message });

      let errorMessage = error?.message || 'Failed to load employee profile';
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        errorMessage = 'Employee not found. The employee may have been deleted or the ID is invalid.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Access denied')) {
        errorMessage = 'Access denied. You do not have permission to view this employee profile.';
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Unauthorized. Please log in again.';
      }

      toast({ title: 'Error', description: errorMessage, variant: 'destructive', duration: 10000 });
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function fixProfile() {
    try {
      setFixingProfile(true);
      const res = await fetch(`/api/cvision/employees/${employeeId}/fix-profile`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || data.message || 'Failed to fix profile');
      toast({ title: 'Success', description: data.message || 'Profile sections created successfully' });
      await loadProfile();
    } catch (error: any) {
      console.error('[Profile] Failed to fix profile:', error);
      toast({ title: 'Error', description: error.message || 'Failed to fix profile', variant: 'destructive' });
    } finally {
      setFixingProfile(false);
    }
  }

  async function loadUserRoles() {
    try {
      if (profile?._diagnostics?.roles) { setUserRoles(profile._diagnostics.roles); return; }
      let res: Response;
      try {
        res = await fetch('/api/auth/me', { credentials: 'include' });
      } catch (error: any) {
        if (error.message?.includes('dev-override') || error.message?.includes('403')) {
          console.warn('[Profile] Dev endpoint failed (ignored):', error.message);
          return;
        }
        throw error;
      }
      if (res.ok) {
        const data = await res.json();
        const roles = data.user?.roles || (data.user?.role ? [data.user.role] : []);
        setUserRoles(roles);
      }
    } catch (error) {
      console.error('Failed to load user roles:', error);
    }
  }

  async function loadStatusHistory() {
    if (!profile) return;
    try {
      setLoadingHistory(true);
      const res = await fetch(`/api/cvision/employees/${employeeId}/status/history?limit=20`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setStatusHistory(data.history || []);
    } catch (error) {
      console.error('Failed to load status history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadReferenceData() {
    try {
      const gradeRes = await fetch('/api/cvision/grades?isActive=true', { credentials: 'include' }).catch(() => ({ ok: false }));
      const gradeData = gradeRes.ok ? await (gradeRes as Response).json().catch(() => ({ data: [] })) : { data: [] };
      setGrades(Array.isArray(gradeData.data || gradeData.items) ? (gradeData.data || gradeData.items) : []);
    } catch (error: any) {
      console.error('[Profile] Failed to load reference data:', error);
    }
  }

  // ── Initial load ──
  useEffect(() => {
    if (employeeId) {
      loadProfile().catch((error) => console.error('[Profile] Failed to load profile on mount:', error));
      loadUserRoles();
      loadStatusHistory();
    } else {
      console.error('[Profile] No employeeId provided');
      setLoading(false);
      toast({ title: 'Error', description: 'Employee ID is missing', variant: 'destructive' });
    }
  }, [employeeId]);

  // ── Reference data effects ──
  useEffect(() => {
    fetch('/api/cvision/org/departments', { cache: 'no-store', credentials: 'include' })
      .then(async r => {
        const d = await r.json();
        const depts = d.items ?? d.data ?? d ?? [];
        setDepartments(Array.isArray(depts) ? depts : []);
        if (process.env.NODE_ENV === 'development') {
          console.log('[Profile] Departments loaded:', { count: Array.isArray(depts) ? depts.length : 0 });
        }
      })
      .catch(err => { console.error('[Profile] Failed to load departments:', err); setDepartments([]); });
  }, []);

  useEffect(() => {
    fetch('/api/cvision/branches?action=list', { cache: 'no-store', credentials: 'include' })
      .then(async r => { const d = await r.json(); setBranchesList(d.data?.items || d.data || []); })
      .catch(() => setBranchesList([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedDepartmentId) params.set('departmentId', selectedDepartmentId);
    if (selectedUnitId) params.set('unitId', selectedUnitId);
    const qs = params.toString();
    fetch(`/api/cvision/job-titles${qs ? `?${qs}` : ''}`, { cache: 'no-store', credentials: 'include' })
      .then(r => r.json())
      .then(d => { const items = d.items || d.data?.items || d.data || []; setJobTitles(Array.isArray(items) ? items : []); })
      .catch(() => setJobTitles([]));
  }, [selectedDepartmentId, selectedUnitId]);

  useEffect(() => {
    const url = selectedDepartmentId
      ? `/api/cvision/employees?departmentId=${selectedDepartmentId}&statuses=ACTIVE,PROBATION&limit=200`
      : '/api/cvision/employees?statuses=ACTIVE,PROBATION&limit=200';
    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => { const items = d.data || d.items || []; setEmployees(Array.isArray(items) ? items : []); })
      .catch(() => setEmployees([]));
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (!selectedDepartmentId) { setUnits([]); return; }
    fetch(`/api/cvision/units?departmentId=${selectedDepartmentId}&isActive=true`, { cache: 'no-store', credentials: 'include' })
      .then(r => r.json())
      .then(d => { const items = d.data || d.items || []; setUnits(Array.isArray(items) ? items : []); })
      .catch(() => setUnits([]));
  }, [selectedDepartmentId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedDepartmentId) params.set('departmentId', selectedDepartmentId);
    if (selectedUnitId) params.set('unitId', selectedUnitId);
    const url = `/api/cvision/org/budgeted-positions${params.toString() ? '?' + params.toString() : ''}`;
    fetch(url, { cache: 'no-store', credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const items = d.items || d.positions || d.data?.items || d.data || [];
        const positionsList = Array.isArray(items) ? items.map((p: any) => ({
          id: p.id, title: p.title, positionCode: p.positionCode,
          displayName: p.displayName, jobTitleName: p.jobTitleName, departmentId: p.departmentId,
        })).filter((p: any) => p.id) : [];
        setPositions(positionsList);
      })
      .catch(() => setPositions([]));
  }, [selectedDepartmentId, selectedUnitId]);

  useEffect(() => {
    const jobTitleId = editData.EMPLOYMENT?.jobTitleId || profile?.employee.jobTitleId;
    if (!jobTitleId) {
      setGrades([]);
      if (editData.EMPLOYMENT) {
        setEditData(prev => ({ ...prev, EMPLOYMENT: { ...prev.EMPLOYMENT, gradeId: null } }));
      }
      return;
    }
    fetch(`/api/cvision/grades?jobTitleId=${jobTitleId}`, { cache: 'no-store', credentials: 'include' })
      .then(r => r.json())
      .then(d => { const items = d.data?.items || d.data || []; setGrades(Array.isArray(items) ? items : []); })
      .catch(err => { console.error('[Profile] Failed to load grades:', err); setGrades([]); });
  }, [editData.EMPLOYMENT?.jobTitleId, profile?.employee.jobTitleId]);

  useEffect(() => { if (profile) loadReferenceData(); }, [profile]);

  // ────────────────────────────────────────────────
  // SAVE LOGIC
  // ────────────────────────────────────────────────

  async function saveAllSections() {
    if (!profile) return;

    const sectionsToSave: ProfileSectionKey[] = ['PERSONAL', 'EMPLOYMENT', 'FINANCIAL', 'CONTRACT'];
    const results: Array<{ section: ProfileSectionKey; success: boolean; error?: string }> = [];

    try {
      const savingState: Record<string, boolean> = {};
      sectionsToSave.forEach(s => { savingState[s] = true; });
      setSaving(savingState);

      for (const sectionKey of sectionsToSave) {
        const section = profile.sections[sectionKey];
        if (!section || !section.canEdit) {
          results.push({ section: sectionKey, success: false, error: 'No permission to edit' });
          continue;
        }

        if (!detectSectionChanges(sectionKey, editData, profile)) {
          results.push({ section: sectionKey, success: true, error: 'No changes' });
          continue;
        }

        try {
          await saveSectionToApi({ employeeId, sectionKey, editData, changeReason });
          setChangeReason(prev => ({ ...prev, [sectionKey]: '' }));
          results.push({ section: sectionKey, success: true });
        } catch (error: any) {
          console.error(`[Save All] Failed to save ${sectionKey}:`, error);
          results.push({ section: sectionKey, success: false, error: error?.message || 'Failed to save' });
        }
      }

      await loadProfile();

      const employmentSaved = results.find(r => r.section === 'EMPLOYMENT' && r.success);
      if (employmentSaved && typeof window !== 'undefined') {
        setTimeout(() => window.dispatchEvent(new CustomEvent('cvision:refresh-dashboard')), 200);
      }

      const successCount = results.filter(r => r.success).length;
      const failedSections = results.filter(r => !r.success && r.error !== 'No changes' && r.error !== 'No permission to edit');

      if (failedSections.length === 0) {
        toast({ title: 'Success', description: `All sections saved successfully (${successCount} sections)` });
      } else {
        const failedDetails = failedSections.map(f => `${f.section}: ${f.error}`).join('; ');
        toast({
          title: 'Partial Success',
          description: `${successCount} sections saved, ${failedSections.length} failed. ${failedDetails}`,
          variant: 'destructive',
          duration: 10000,
        });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save all sections', variant: 'destructive' });
    } finally {
      setSaving({});
    }
  }

  async function saveSection(sectionKey: ProfileSectionKey) {
    if (!profile) return;
    try {
      setSaving(prev => ({ ...prev, [sectionKey]: true }));
      await saveSectionToApi({ employeeId, sectionKey, editData, changeReason });
      setChangeReason(prev => ({ ...prev, [sectionKey]: '' }));
      await loadProfile();
      toast({ title: 'Success', description: `${sectionKey} section saved successfully` });
    } catch (error: any) {
      console.error('Failed to save section:', error);
      toast({ title: 'Error', description: error.message || 'Failed to update section', variant: 'destructive' });
      throw error;
    } finally {
      setSaving(prev => ({ ...prev, [sectionKey]: false }));
    }
  }

  // ────────────────────────────────────────────────
  // STATUS CHANGE
  // ────────────────────────────────────────────────

  async function handleStatusChange() {
    if (!profile || !newStatus || !statusReason) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      setChangingStatus(true);
      const res = await fetch(`/api/cvision/employees/${employeeId}/status/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          toStatus: newStatus,
          reason: statusReason,
          effectiveAt: statusEffectiveDate ? new Date(statusEffectiveDate) : undefined,
          lastWorkingDay: lastWorkingDay ? new Date(lastWorkingDay) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorCode = data.code || 'UNKNOWN_ERROR';
        let errorMessage = data.error || 'Failed to change status';
        if (errorCode === 'INVALID_TRANSITION') errorMessage = `Invalid transition: ${data.message || errorMessage}`;
        else if (errorCode === 'FORBIDDEN' || errorCode === 'DEPARTMENT_MISMATCH') errorMessage = "You do not have permission to change this employee's status";
        else if (errorCode === 'EMPLOYEE_NO_TRANSITION') errorMessage = 'Employees cannot change status';
        toast({ title: 'Error', description: `${errorMessage} (${errorCode})`, variant: 'destructive' });
        return;
      }

      if (data.success) {
        toast({
          title: 'Success',
          description: data.idempotent
            ? 'Status already at requested state'
            : `Status changed to ${EMPLOYEE_STATUS_LABELS[newStatus] || newStatus}`,
        });
        setStatusChangeOpen(false);
        setNewStatus('');
        setStatusReason('');
        setStatusEffectiveDate('');
        setLastWorkingDay('');
        await loadProfile();
        await loadStatusHistory();
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to change status', variant: 'destructive' });
    } finally {
      setChangingStatus(false);
    }
  }

  // ── Absher / NIC Lookup ──

  async function handleAbsherLookup(sectionKey: string, fieldKey: string) {
    const id = (editData[sectionKey]?.[fieldKey] || '').replace(/\s+/g, '').trim();
    if (!id || !/^\d{10}$/.test(id)) {
      toast({ title: 'Invalid ID', description: 'National ID must be exactly 10 digits', variant: 'destructive' });
      return;
    }
    if (!id.startsWith('1') && !id.startsWith('2')) {
      toast({ title: 'Invalid ID', description: 'Must start with 1 (citizen) or 2 (resident)', variant: 'destructive' });
      return;
    }

    setAbsherLookingUp(true);
    setAbsherLookupError(null);
    setAbsherLookupDone(false);

    try {
      const res = await fetch('/api/cvision/absher/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nationalId: id }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setAbsherLookupError(json.error || 'Lookup failed');
        toast({ title: 'Lookup Failed', description: json.error || 'Could not verify this ID', variant: 'destructive' });
        return;
      }

      const d = json.data;
      setEditData(prev => ({
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          fullName: d.firstName && d.lastName ? `${d.firstName} ${d.lastName}` : prev[sectionKey]?.fullName,
          gender: d.gender === 'male' ? 'Male' : d.gender === 'female' ? 'Female' : prev[sectionKey]?.gender,
          dob: d.dateOfBirth || prev[sectionKey]?.dob,
          nationality: d.nationality || prev[sectionKey]?.nationality,
        },
      }));
      setAbsherLookupDone(true);
      toast({ title: 'ID Verified', description: `${d.firstName} ${d.lastName} — data auto-filled` });
    } catch (err: any) {
      setAbsherLookupError(err.message || 'Network error');
      toast({ title: 'Error', description: err.message || 'Network error', variant: 'destructive' });
    } finally {
      setAbsherLookingUp(false);
    }
  }

  // ────────────────────────────────────────────────
  // DERIVED / COMPUTED
  // ────────────────────────────────────────────────

  function canChangeStatus(): boolean {
    return userRoles.some(role =>
      role === CVISION_ROLES.OWNER ||
      role === CVISION_ROLES.CVISION_ADMIN ||
      role === CVISION_ROLES.HR_ADMIN ||
      role === CVISION_ROLES.HR_MANAGER,
    );
  }

  const referenceData: ReferenceData = useMemo(() => ({
    departments, jobTitles, positions, employees, units, grades, branches: branchesList,
  }), [departments, jobTitles, positions, employees, units, grades, branchesList]);

  const completeness: CompletenessResult = useMemo(() => {
    if (!profile) return { filled: 0, total: 0, percentage: 0 };
    return calculateCompleteness(profile, editData);
  }, [profile, editData]);

  const hasChanges = profile ? hasAnyProfileChanges(editData, profile) : false;

  // ────────────────────────────────────────────────
  // EDITING HELPERS
  // ────────────────────────────────────────────────

  function handleToggleEdit(sectionKey: ProfileSectionKey) {
    setEditingSection(prev => prev === sectionKey ? null : sectionKey);
  }

  function handleCancelEdit() {
    if (editingSection && profile) {
      const section = profile.sections[editingSection];
      const resetData = { ...(section?.dataJson || {}) };
      if (editingSection === 'EMPLOYMENT' && profile.employee) {
        if (profile.employee.departmentId) resetData.departmentId = profile.employee.departmentId;
        if (profile.employee.positionId !== undefined) resetData.positionId = profile.employee.positionId;
        if (profile.employee.jobTitleId) resetData.jobTitleId = profile.employee.jobTitleId;
        if ('managerEmployeeId' in profile.employee) resetData.managerEmployeeId = profile.employee.managerEmployeeId;
        if (profile.employee.branchId !== undefined) resetData.branchId = profile.employee.branchId;
        if (profile.employee.workLocation !== undefined) resetData.workLocation = profile.employee.workLocation;
        if (profile.employee.hiredAt) resetData.hiredAt = profile.employee.hiredAt;
      }
      setEditData(prev => ({ ...prev, [editingSection]: resetData }));
    }
    setEditingSection(null);
  }

  // ── Return everything the page needs ──
  return {
    // Core state
    profile,
    loading,
    saving,
    editingSection,
    editData,
    setEditData,
    historyOpen,
    setHistoryOpen,
    changeReason,
    setChangeReason,
    fixingProfile,

    // Reference data
    referenceData,
    departments,
    branchesList,

    // Status change
    statusChangeOpen,
    setStatusChangeOpen,
    statusHistory,
    loadingHistory,
    changingStatus,
    newStatus,
    setNewStatus,
    statusReason,
    setStatusReason,
    statusEffectiveDate,
    setStatusEffectiveDate,
    lastWorkingDay,
    setLastWorkingDay,

    // Absher
    absherLookingUp,
    absherLookupDone,
    absherLookupError,

    // Computed
    completeness,
    hasChanges,
    canChangeStatus: canChangeStatus(),

    // Actions
    loadProfile,
    fixProfile,
    loadStatusHistory,
    saveAllSections,
    saveSection,
    handleStatusChange,
    handleAbsherLookup,
    handleToggleEdit,
    handleCancelEdit,
  };
}
