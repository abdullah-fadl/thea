'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionTextarea, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';

import { toast } from 'sonner';
import {
  Plus, Search, RefreshCw, MoreHorizontal, Briefcase, Users, Eye,
  Edit, PlayCircle, PauseCircle, XCircle, CheckCircle, Filter, Sparkles,
} from 'lucide-react';
import type { Requisition, Department, JobTitle } from './types';
import { REQ_STATUS_CONFIG, STATUS_CONFIG } from './types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface JobOpeningsTabProps {
  onRunMatching?: (jobId: string) => void;
}

export default function JobOpeningsTab({ onRunMatching }: JobOpeningsTabProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<Requisition | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    departmentId: '',
    headcountRequested: '1',
    reason: 'new_role',
    skills: '',
    preferredSkills: '',
    minExperience: '',
    education: '',
    salaryMin: '',
    salaryMax: '',
    description: '',
    location: '',
    employmentType: 'full_time',
  });

  // Detail view
  const [detailReq, setDetailReq] = useState<Requisition | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCandidates, setDetailCandidates] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    loadAll(ac.signal);
    return () => ac.abort();
  }, []);

  async function loadAll(signal?: AbortSignal) {
    setLoading(true);
    await Promise.all([loadRequisitions(signal), loadDepartments(signal)]);
    setLoading(false);
  }

  async function loadRequisitions(signal?: AbortSignal) {
    try {
      const res = await fetch('/api/cvision/recruitment/requisitions?limit=200', { credentials: 'include', signal });
      const data = await res.json();
      if (data.success) {
        setRequisitions(data.data?.items || data.data || []);
      }
    } catch (error) {
      console.error('Failed to load requisitions:', error);
    }
  }

  async function loadDepartments(signal?: AbortSignal) {
    try {
      const res = await fetch('/api/cvision/org/departments?limit=100', { credentials: 'include', signal });
      const data = await res.json();
      setDepartments(data.items || data.data?.items || data.data || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  }

  async function loadJobTitles(departmentId: string) {
    try {
      const res = await fetch(`/api/cvision/job-titles?departmentId=${departmentId}&limit=100`, { credentials: 'include' });
      const data = await res.json();
      setJobTitles(data.data || data.items || []);
    } catch (error) {
      console.error('Failed to load job titles:', error);
    }
  }

  // Open create dialog
  function openCreateDialog() {
    setEditingReq(null);
    setFormData({
      title: '',
      departmentId: '',
      headcountRequested: '1',
      reason: 'new_role',
      skills: '',
      preferredSkills: '',
      minExperience: '',
      education: '',
      salaryMin: '',
      salaryMax: '',
      description: '',
      location: '',
      employmentType: 'full_time',
    });
    setDialogOpen(true);
  }

  // Open edit dialog
  function openEditDialog(req: Requisition) {
    setEditingReq(req);
    setFormData({
      title: req.title || '',
      departmentId: req.departmentId || '',
      headcountRequested: (req.headcountRequested || 1).toString(),
      reason: req.reason || 'new_role',
      skills: (req.skills || []).join(', '),
      preferredSkills: (req.preferredSkills || []).join(', '),
      minExperience: req.requirements?.minExperience?.toString() || '',
      education: req.requirements?.education || '',
      salaryMin: req.salaryRange?.min?.toString() || '',
      salaryMax: req.salaryRange?.max?.toString() || '',
      description: req.description || '',
      location: req.location || '',
      employmentType: req.employmentType || 'full_time',
    });
    if (req.departmentId) loadJobTitles(req.departmentId);
    setDialogOpen(true);
  }

  // Open detail view
  async function openDetail(req: Requisition) {
    setDetailReq(req);
    setDetailOpen(true);
    setDetailCandidates([]);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/cvision/recruitment/requisitions/${req.id}/candidates?limit=50`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setDetailCandidates(data.data?.items || data.data || []);
      }
    } catch (error) {
      console.error('Failed to load requisition candidates:', error);
    } finally {
      setLoadingDetail(false);
    }
  }

  // Save requisition (create or update)
  async function handleSave(openAfterSave = false) {
    if (!formData.title.trim()) {
      toast.error(tr('العنوان مطلوب', 'Title is required'));
      return;
    }

    try {
      setSaving(true);
      const skillsArr = formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
      const prefSkillsArr = formData.preferredSkills ? formData.preferredSkills.split(',').map(s => s.trim()).filter(Boolean) : [];

      const body: any = {
        title: formData.title.trim(),
        departmentId: formData.departmentId || undefined,
        headcountRequested: parseInt(formData.headcountRequested) || 1,
        reason: formData.reason,
        skills: skillsArr,
        preferredSkills: prefSkillsArr,
        requirements: {
          minExperience: formData.minExperience ? parseInt(formData.minExperience) : undefined,
          education: formData.education || undefined,
        },
        salaryRange: (formData.salaryMin || formData.salaryMax) ? {
          min: formData.salaryMin ? parseFloat(formData.salaryMin) : undefined,
          max: formData.salaryMax ? parseFloat(formData.salaryMax) : undefined,
          currency: 'SAR',
        } : undefined,
        description: formData.description || undefined,
        location: formData.location || undefined,
        employmentType: formData.employmentType,
      };

      if (openAfterSave && !editingReq) {
        body.status = 'open';
      }

      const url = editingReq
        ? `/api/cvision/recruitment/requisitions/${editingReq.id}`
        : '/api/cvision/recruitment/requisitions';

      const res = await fetch(url, {
        method: editingReq ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingReq ? 'Requisition updated' : `Requisition created${openAfterSave ? ' and opened' : ' as draft'}`);
        setDialogOpen(false);
        await loadRequisitions();
      } else {
        toast.error(data.error || 'Failed to save requisition');
      }
    } catch (error) {
      toast.error(tr('فشل الحفظ', 'Failed to save requisition'));
    } finally {
      setSaving(false);
    }
  }

  // Change requisition status
  async function changeStatus(reqId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/cvision/recruitment/requisitions/${reqId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Requisition ${newStatus === 'open' ? 'opened' : newStatus === 'closed' ? 'closed' : newStatus === 'on_hold' ? 'put on hold' : newStatus === 'cancelled' ? 'cancelled' : 'updated'}`);
        await loadRequisitions();
        if (detailReq?.id === reqId) {
          setDetailReq({ ...detailReq, status: newStatus as Requisition['status'] });
        }
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      toast.error(tr('فشل التحديث', 'Failed to update status'));
    }
  }

  // Filter requisitions
  const filtered = requisitions.filter(r => {
    const matchesSearch = !searchQuery ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.requisitionNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: requisitions.length,
    open: requisitions.filter(r => r.status === 'open').length,
    draft: requisitions.filter(r => r.status === 'draft').length,
    closed: requisitions.filter(r => r.status === 'closed').length,
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <RefreshCw style={{ height: 32, width: 32, animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.blueDim, borderRadius: 12 }}><Briefcase style={{ height: 16, width: 16, color: C.blue }} /></div>
              <div>
                <p style={{ fontSize: 12, color: C.textMuted }}>Total</p>
                <p style={{ fontSize: 18, fontWeight: 700 }}>{stats.total}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.greenDim, borderRadius: 12 }}><CheckCircle style={{ height: 16, width: 16, color: C.green }} /></div>
              <div>
                <p style={{ fontSize: 12, color: C.textMuted }}>Open</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{stats.open}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, borderRadius: 12 }}><Edit style={{ height: 16, width: 16 }} /></div>
              <div>
                <p style={{ fontSize: 12, color: C.textMuted }}>Draft</p>
                <p style={{ fontSize: 18, fontWeight: 700 }}>{stats.draft}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.blueDim, borderRadius: 12 }}><Users style={{ height: 16, width: 16, color: C.blue }} /></div>
              <div>
                <p style={{ fontSize: 12, color: C.textMuted }}>Closed</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.blue }}>{stats.closed}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Filters + Actions */}
      <CVisionCard C={C}>
        <CVisionCardBody style={{ paddingTop: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
                <CVisionInput C={C}
                  placeholder="Search by title or req #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>
            <CVisionSelect
                C={C}
                value={statusFilter || 'all'}
                placeholder="Status"
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'open', label: 'Open' },
                  { value: 'on_hold', label: 'On Hold' },
                  { value: 'closed', label: 'Closed' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
            <CVisionButton C={C} isDark={isDark} variant="outline" size="icon" onClick={() => loadRequisitions()}>
              <RefreshCw style={{ height: 16, width: 16 }} />
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={openCreateDialog}>
              <Plus style={{ height: 16, width: 16, marginRight: 8 }} />
              New Requisition
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Requisitions Table */}
      <CVisionCard C={C}>
        <CVisionCardBody style={{ paddingTop: 16 }}>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
                <CVisionTh C={C}>Req #</CVisionTh>
                <CVisionTh C={C}>{tr('العنوان', 'Title')}</CVisionTh>
                <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                <CVisionTh C={C}>{tr('عدد الموظفين', 'Headcount')}</CVisionTh>
                <CVisionTh C={C}>{tr('المرشحين', 'Candidates')}</CVisionTh>
                <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                <CVisionTh C={C}>Created</CVisionTh>
                <CVisionTh C={C} style={{ width: 80 }}>{tr('الإجراءات', 'Actions')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {filtered.length === 0 ? (
                <CVisionTr C={C}>
                  <CVisionTd align="center" colSpan={8} style={{ paddingTop: 32, paddingBottom: 32 }}>
                    <Briefcase style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 8 }} />
                    <p style={{ color: C.textMuted }}>No requisitions found</p>
                  </CVisionTd>
                </CVisionTr>
              ) : (
                filtered.map((req) => {
                  const statusCfg = REQ_STATUS_CONFIG[req.status] || { label: req.status, color: 'bg-gray-100 text-gray-800' };
                  return (
                    <CVisionTr C={C} key={req.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(req)}>
                      <CVisionTd style={{ fontFamily: 'monospace', fontSize: 13 }}>{req.requisitionNumber || '-'}</CVisionTd>
                      <CVisionTd style={{ fontWeight: 500 }}>{req.title}</CVisionTd>
                      <CVisionTd>{req.departmentName || '-'}</CVisionTd>
                      <CVisionTd>
                        <span style={{ fontWeight: 500 }}>{req.headcountFilled || 0}</span>
                        <span style={{ color: C.textMuted }}>/{req.headcountRequested || 1}</span>
                      </CVisionTd>
                      <CVisionTd>
                        <CVisionBadge C={C} variant="secondary">{req.candidateCount || 0}</CVisionBadge>
                      </CVisionTd>
                      <CVisionTd>
                        <CVisionBadge C={C} className={statusCfg.color}>{statusCfg.label}</CVisionBadge>
                      </CVisionTd>
                      <CVisionTd style={{ fontSize: 13, color: C.textMuted }}>
                        {new Date(req.createdAt).toLocaleDateString()}
                      </CVisionTd>
                      <CVisionTd>
                        <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" style={{ height: 32, width: 32 }}>
                              <MoreHorizontal style={{ height: 16, width: 16 }} />
                            </CVisionButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(req)}>
                              <Eye style={{ height: 16, width: 16, marginRight: 8 }} /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(req)}>
                              <Edit style={{ height: 16, width: 16, marginRight: 8 }} /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {req.status === 'draft' && (
                              <DropdownMenuItem onClick={() => changeStatus(req.id, 'open')} style={{ color: C.green }}>
                                <PlayCircle style={{ height: 16, width: 16, marginRight: 8 }} /> Open Requisition
                              </DropdownMenuItem>
                            )}
                            {req.status === 'open' && (
                              <>
                                <DropdownMenuItem onClick={() => changeStatus(req.id, 'on_hold')} style={{ color: C.orange }}>
                                  <PauseCircle style={{ height: 16, width: 16, marginRight: 8 }} /> Put On Hold
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => changeStatus(req.id, 'closed')} style={{ color: C.blue }}>
                                  <CheckCircle style={{ height: 16, width: 16, marginRight: 8 }} /> Close Requisition
                                </DropdownMenuItem>
                              </>
                            )}
                            {req.status === 'on_hold' && (
                              <DropdownMenuItem onClick={() => changeStatus(req.id, 'open')} style={{ color: C.green }}>
                                <PlayCircle style={{ height: 16, width: 16, marginRight: 8 }} /> Reopen
                              </DropdownMenuItem>
                            )}
                            {(req.status === 'open' || req.status === 'draft') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => changeStatus(req.id, 'cancelled')} style={{ color: C.red }}>
                                  <XCircle style={{ height: 16, width: 16, marginRight: 8 }} /> Cancel
                                </DropdownMenuItem>
                              </>
                            )}
                            {(req.status === 'open' || req.status === 'draft') && onRunMatching && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onRunMatching(req.id)} style={{ color: C.purple }}>
                                  <Sparkles style={{ height: 16, width: 16, marginRight: 8 }} /> Run AI Matching
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                      </CVisionTd>
                    </CVisionTr>
                  );
                })
              )}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>

      {/* Create/Edit Requisition Dialog */}
      <CVisionDialog C={C} open={dialogOpen} onClose={() => setDialogOpen(false)} title="Details" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {editingReq ? 'Update requisition details' : 'Create a new job requisition'}
            </p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Title *</CVisionLabel>
              <CVisionInput C={C}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Senior Software Engineer"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>{tr('القسم', 'Department')}</CVisionLabel>
                <CVisionSelect
                C={C}
                value={formData.departmentId || 'none'}
                placeholder="Select"
                options={[
                  { value: 'none', label: 'Select...' },
                  ...departments.map((d) => (
                      ({ value: d.id, label: d.name })
                    )),
                ]}
              />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>{tr('نوع التوظيف', 'Employment Type')}</CVisionLabel>
                <CVisionSelect
                C={C}
                value={formData.employmentType}
                options={[
                  { value: 'full_time', label: 'Full Time' },
                  { value: 'part_time', label: 'Part Time' },
                  { value: 'contract', label: 'Contract' },
                  { value: 'internship', label: 'Internship' },
                ]}
              />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>{tr('عدد الموظفين', 'Headcount')}</CVisionLabel>
                <CVisionInput C={C}
                  type="number" min="1"
                  value={formData.headcountRequested}
                  onChange={(e) => setFormData({ ...formData, headcountRequested: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>{tr('السبب', 'Reason')}</CVisionLabel>
                <CVisionSelect
                C={C}
                value={formData.reason}
                options={[
                  { value: 'new_role', label: 'New Role' },
                  { value: 'replacement', label: 'Replacement' },
                  { value: 'expansion', label: 'Expansion' },
                  { value: 'restructuring', label: 'Restructuring' },
                ]}
              />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Required Skills (comma separated)</CVisionLabel>
              <CVisionInput C={C}
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                placeholder="JavaScript, React, TypeScript..."
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Preferred Skills (comma separated)</CVisionLabel>
              <CVisionInput C={C}
                value={formData.preferredSkills}
                onChange={(e) => setFormData({ ...formData, preferredSkills: e.target.value })}
                placeholder="AWS, Docker, GraphQL..."
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>Min Experience (years)</CVisionLabel>
                <CVisionInput C={C}
                  type="number" min="0"
                  value={formData.minExperience}
                  onChange={(e) => setFormData({ ...formData, minExperience: e.target.value })}
                  placeholder="2"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>Education Level</CVisionLabel>
                <CVisionSelect
                C={C}
                value={formData.education || 'none'}
                placeholder="Select"
                options={[
                  { value: 'none', label: 'Any' },
                  { value: 'high_school', label: 'High School' },
                  { value: 'diploma', label: 'Diploma' },
                  { value: 'bachelor', label: 'Bachelor' },
                  { value: 'master', label: 'Master' },
                  { value: 'phd', label: 'PhD' },
                ]}
              />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>Salary Min (SAR)</CVisionLabel>
                <CVisionInput C={C}
                  type="number" min="0"
                  value={formData.salaryMin}
                  onChange={(e) => setFormData({ ...formData, salaryMin: e.target.value })}
                  placeholder="5000"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>Salary Max (SAR)</CVisionLabel>
                <CVisionInput C={C}
                  type="number" min="0"
                  value={formData.salaryMax}
                  onChange={(e) => setFormData({ ...formData, salaryMax: e.target.value })}
                  placeholder="15000"
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{tr('الموقع', 'Location')}</CVisionLabel>
              <CVisionInput C={C}
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Riyadh, Saudi Arabia"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{tr('الوصف', 'Description')}</CVisionLabel>
              <CVisionTextarea C={C}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Job description, responsibilities, etc."
                rows={4}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
              {!editingReq && (
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                  {saving && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                  Save as Draft
                </CVisionButton>
              )}
              <CVisionButton C={C} isDark={isDark} onClick={() => handleSave(editingReq ? false : true)} disabled={saving}>
                {saving && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                {editingReq ? 'Update' : 'Save & Open'}
              </CVisionButton>
            </div>
          </div>
      </CVisionDialog>

      {/* Requisition Detail Dialog */}
      <CVisionDialog C={C} open={detailOpen} onClose={() => setDetailOpen(false)} title="Details" isDark={isDark}>                      {detailReq && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
              {/* Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13 }}>
                <div><span style={{ color: C.textMuted }}>Requisition #:</span> <span style={{ fontWeight: 500 }}>{detailReq.requisitionNumber}</span></div>
                <div><span style={{ color: C.textMuted }}>Status:</span> <CVisionBadge C={C} className={REQ_STATUS_CONFIG[detailReq.status]?.color || 'bg-gray-100'}>{REQ_STATUS_CONFIG[detailReq.status]?.label || detailReq.status}</CVisionBadge></div>
                <div><span style={{ color: C.textMuted }}>Department:</span> <span style={{ fontWeight: 500 }}>{detailReq.departmentName || '-'}</span></div>
                <div><span style={{ color: C.textMuted }}>Employment:</span> <span style={{ fontWeight: 500 }}>{detailReq.employmentType?.replace('_', ' ') || '-'}</span></div>
                <div><span style={{ color: C.textMuted }}>Headcount:</span> <span style={{ fontWeight: 500 }}>{detailReq.headcountFilled || 0}/{detailReq.headcountRequested || 1}</span></div>
                <div><span style={{ color: C.textMuted }}>Location:</span> <span style={{ fontWeight: 500 }}>{detailReq.location || '-'}</span></div>
                {detailReq.requirements?.minExperience != null && (
                  <div><span style={{ color: C.textMuted }}>Min Experience:</span> <span style={{ fontWeight: 500 }}>{detailReq.requirements.minExperience} years</span></div>
                )}
                {detailReq.requirements?.education && (
                  <div><span style={{ color: C.textMuted }}>Education:</span> <span style={{ fontWeight: 500 }}>{detailReq.requirements.education}</span></div>
                )}
                {detailReq.salaryRange && (
                  <div className="col-span-2"><span style={{ color: C.textMuted }}>Salary Range:</span> <span style={{ fontWeight: 500 }}>{detailReq.salaryRange.min?.toLocaleString()} - {detailReq.salaryRange.max?.toLocaleString()} {detailReq.salaryRange.currency || 'SAR'}</span></div>
                )}
              </div>

              {/* Skills */}
              {detailReq.skills && detailReq.skills.length > 0 && (
                <div>
                  <span style={{ fontSize: 13, color: C.textMuted }}>Required Skills:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {detailReq.skills.map((s) => (
                      <CVisionBadge C={C} key={s} variant="secondary" style={{ fontSize: 12 }}>{s}</CVisionBadge>
                    ))}
                  </div>
                </div>
              )}

              {detailReq.preferredSkills && detailReq.preferredSkills.length > 0 && (
                <div>
                  <span style={{ fontSize: 13, color: C.textMuted }}>Preferred Skills:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {detailReq.preferredSkills.map((s) => (
                      <CVisionBadge C={C} key={s} variant="outline" style={{ fontSize: 12 }}>{s}</CVisionBadge>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {detailReq.description && (
                <div>
                  <span style={{ fontSize: 13, color: C.textMuted }}>Description:</span>
                  <p style={{ fontSize: 13, marginTop: 4 }}>{detailReq.description}</p>
                </div>
              )}

              {/* Candidates Section */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h4 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users style={{ height: 16, width: 16 }} />
                    Candidates ({detailCandidates.length})
                  </h4>
                  {onRunMatching && (
                    <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => { setDetailOpen(false); onRunMatching(detailReq.id); }} style={{ color: C.purple }}>
                      <Sparkles style={{ height: 16, width: 16, marginRight: 4 }} /> Run AI Matching
                    </CVisionButton>
                  )}
                </div>
                {loadingDetail ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 16, paddingBottom: 16 }}>
                    <RefreshCw style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 8 }} />
                    <span style={{ fontSize: 13, color: C.textMuted }}>Loading candidates...</span>
                  </div>
                ) : detailCandidates.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingTop: 16, paddingBottom: 16 }}>No candidates for this requisition</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                    {detailCandidates.map((c: any) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13 }}>
                        <div>
                          <span style={{ fontWeight: 500 }}>{c.fullName}</span>
                          {c.email && <span style={{ color: C.textMuted, marginLeft: 8 }}>{c.email}</span>}
                        </div>
                        <CVisionBadge C={C} className={STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-100'}>
                          {STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG]?.label || c.status}
                        </CVisionBadge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => openEditDialog(detailReq)}>
                  <Edit style={{ height: 16, width: 16, marginRight: 8 }} /> Edit
                </CVisionButton>
                {detailReq.status === 'draft' && (
                  <CVisionButton C={C} isDark={isDark} onClick={() => { changeStatus(detailReq.id, 'open'); }} style={{ background: C.greenDim }}>
                    <PlayCircle style={{ height: 16, width: 16, marginRight: 8 }} /> Open Requisition
                  </CVisionButton>
                )}
                {detailReq.status === 'open' && (
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => changeStatus(detailReq.id, 'closed')}>
                    <CheckCircle style={{ height: 16, width: 16, marginRight: 8 }} /> Close
                  </CVisionButton>
                )}
              </div>
            </div>
          )}
      </CVisionDialog>
    </div>
  );
}

// Import STATUS_CONFIG from types for the detail candidates display
const STATUS_CONFIG_LOCAL: Record<string, { label: string; color: string }> = {
  applied: { label: 'New', color: 'bg-blue-100 text-blue-800' },
  new: { label: 'New', color: 'bg-blue-100 text-blue-800' },
  screening: { label: 'Screening', color: 'bg-purple-100 text-purple-800' },
  shortlisted: { label: 'Shortlisted', color: 'bg-indigo-100 text-indigo-800' },
  interview: { label: 'Interview', color: 'bg-yellow-100 text-yellow-800' },
  offer: { label: 'Offer Sent', color: 'bg-orange-100 text-orange-800' },
  hired: { label: 'Hired', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
};
