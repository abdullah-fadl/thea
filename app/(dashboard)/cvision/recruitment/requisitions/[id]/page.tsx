'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import { useToast } from '@/hooks/use-toast';
import {
  Loader2, ArrowLeft, UserPlus, CheckCircle, XCircle, Clock,
  Edit, Play, Users, Briefcase, FileText, UserCheck, Phone, Mail,
  Calendar, Building2, ChevronRight
} from 'lucide-react';
import { REQUISITION_STATUS_LABELS } from '@/lib/cvision/constants';

interface Requisition {
  id: string;
  requisitionNumber: string;
  title: string;
  departmentId: string;
  departmentName?: string;
  jobTitleId?: string | null;
  jobTitleName?: string | null;
  positionId?: string | null;
  positionCode?: string | null;
  headcountRequested?: number;
  status: string;
  applicantCount?: number;
  slots?: {
    total: number;
    vacant: number;
    filled: number;
    frozen: number;
  };
}

interface Slot {
  slotId: string;
  status: string;
  employeeId?: string | null;
  employee?: {
    id: string;
    employeeNo: string;
    fullName: string;
  } | null;
  candidateId?: string | null;
  candidate?: {
    id: string;
    fullName: string;
    status: string;
  } | null;
  createdAt: string;
  filledAt?: string | null;
}

interface Candidate {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  status: string;
  source: string;
  createdAt: string;
}

interface Position {
  id: string;
  positionCode: string;
  title?: string | null;
  availableSlots: number;
}

export default function RequisitionDetailPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const params = useParams();
  const router = useRouter();
  const requisitionId = params.id as string;

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // Assignment form
  const [editPositionOpen, setEditPositionOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    departmentId: '',
    jobTitleId: '',
    positionId: '',
  });

  // Add candidate form
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState({
    fullName: '',
    email: '',
    phone: '',
    source: 'PORTAL',
  });

  // Hire dialog
  const [hireDialogOpen, setHireDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');

  const { toast } = useToast();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: cvisionKeys.recruitment.requisitions.detail(requisitionId) });
    queryClient.invalidateQueries({ queryKey: ['cvision', 'requisition-slots', requisitionId] });
    queryClient.invalidateQueries({ queryKey: ['cvision', 'requisition-candidates', requisitionId] });
  };

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: cvisionKeys.recruitment.requisitions.detail(requisitionId),
    queryFn: () => cvisionFetch(`/api/cvision/recruitment/requisitions/${requisitionId}`),
    enabled: !!requisitionId,
  });
  const requisition: Requisition | null = reqData?.success ? { ...reqData.requisition, ...(reqData.slots ? { slots: reqData.slots } : {}) } : null;

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['cvision', 'requisition-slots', requisitionId],
    queryFn: () => cvisionFetch(`/api/cvision/recruitment/requisitions/${requisitionId}/slots`),
    enabled: !!requisitionId,
  });
  const slots: Slot[] = slotsData?.success ? (slotsData.slots || []) : [];

  const { data: candidatesData, isLoading: candidatesLoading } = useQuery({
    queryKey: ['cvision', 'requisition-candidates', requisitionId],
    queryFn: () => cvisionFetch(`/api/cvision/recruitment/candidates?requisitionId=${requisitionId}`),
    enabled: !!requisitionId,
  });
  const candidates: Candidate[] = candidatesData?.success ? (candidatesData.data?.items || candidatesData.data || []) : [];

  const loading = reqLoading || slotsLoading || candidatesLoading;

  const { data: departmentsData } = useQuery({
    queryKey: cvisionKeys.departments.list({ limit: 100 }),
    queryFn: () => cvisionFetch('/api/cvision/org/departments?limit=100'),
  });
  const departments: { id: string; name: string; code: string }[] = departmentsData?.items || departmentsData?.data?.items || departmentsData?.data || [];

  const { data: jobTitlesData } = useQuery({
    queryKey: cvisionKeys.jobTitles.list({ departmentId: assignmentForm.departmentId }),
    queryFn: () => cvisionFetch(`/api/cvision/job-titles?departmentId=${assignmentForm.departmentId}&limit=100`),
    enabled: !!assignmentForm.departmentId,
  });
  const jobTitles: { id: string; name: string }[] = jobTitlesData?.data || jobTitlesData?.items || [];

  const { data: positionsData } = useQuery({
    queryKey: cvisionKeys.org.budgetedPositions.list({ departmentId: assignmentForm.departmentId, jobTitleId: assignmentForm.jobTitleId }),
    queryFn: () => cvisionFetch(`/api/cvision/org/budgeted-positions?departmentId=${assignmentForm.departmentId}&jobTitleId=${assignmentForm.jobTitleId}`),
    enabled: !!assignmentForm.departmentId && !!assignmentForm.jobTitleId,
  });
  const positions: Position[] = positionsData?.success ? (positionsData.data || positionsData.items || []) : [];

  // Sync assignment form when requisition loads
  useEffect(() => {
    if (requisition) {
      setAssignmentForm({
        departmentId: requisition.departmentId || '',
        jobTitleId: requisition.jobTitleId || '',
        positionId: requisition.positionId || '',
      });
    }
  }, [requisition?.id]);

  // ── Mutations ────────────────────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: () => cvisionMutate(`/api/cvision/recruitment/requisitions/${requisitionId}/assign-position`, 'POST', assignmentForm),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: 'Success', description: 'Position assigned successfully' });
        invalidateAll();
        setEditPositionOpen(false);
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to assign position', variant: 'destructive' });
      }
    },
    onError: () => { toast({ title: 'Error', description: 'Failed to assign position', variant: 'destructive' }); },
  });
  const assigning = assignMutation.isPending;

  function assignPosition() {
    if (!assignmentForm.departmentId || !assignmentForm.jobTitleId || !assignmentForm.positionId) {
      toast({ title: 'Error', description: 'Please select all fields', variant: 'destructive' });
      return;
    }
    assignMutation.mutate();
  }

  const openMutation = useMutation({
    mutationFn: () => cvisionMutate(`/api/cvision/recruitment/requisitions/${requisitionId}`, 'PUT', { action: 'open', positionId: requisition?.positionId }),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: 'Success', description: 'Requisition opened successfully' });
        invalidateAll();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to open requisition', variant: 'destructive' });
      }
    },
    onError: () => { toast({ title: 'Error', description: 'Failed to open requisition', variant: 'destructive' }); },
  });
  const opening = openMutation.isPending;

  function openRequisition() {
    if (!requisition?.positionId) {
      toast({ title: 'Error', description: 'Please assign a position first', variant: 'destructive' });
      setEditPositionOpen(true);
      return;
    }
    openMutation.mutate();
  }

  const createCandidateMutation = useMutation({
    mutationFn: () => cvisionMutate(`/api/cvision/recruitment/requisitions/${requisitionId}/candidates`, 'POST', newCandidate),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: 'Success', description: 'Candidate added successfully' });
        setAddCandidateOpen(false);
        setNewCandidate({ fullName: '', email: '', phone: '', source: 'PORTAL' });
        queryClient.invalidateQueries({ queryKey: ['cvision', 'requisition-candidates', requisitionId] });
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to add candidate', variant: 'destructive' });
      }
    },
    onError: () => { toast({ title: 'Error', description: 'Failed to add candidate', variant: 'destructive' }); },
  });
  const creatingCandidate = createCandidateMutation.isPending;

  function createCandidate() {
    if (!newCandidate.fullName) {
      toast({ title: 'Error', description: 'Full name is required', variant: 'destructive' });
      return;
    }
    createCandidateMutation.mutate();
  }

  const hireMutation = useMutation({
    mutationFn: () => cvisionMutate(`/api/cvision/recruitment/requisitions/${requisitionId}/hire`, 'POST', {
      slotId: selectedSlot!.slotId,
      candidateId: selectedCandidateId,
    }),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: 'Success', description: 'Candidate hired successfully!' });
        setHireDialogOpen(false);
        setSelectedSlot(null);
        setSelectedCandidateId('');
        invalidateAll();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to hire candidate', variant: 'destructive' });
      }
    },
    onError: () => { toast({ title: 'Error', description: 'Failed to hire candidate', variant: 'destructive' }); },
  });
  const hiring = hireMutation.isPending;

  function hireCandidate() {
    if (!selectedSlot || !selectedCandidateId) {
      toast({ title: 'Error', description: 'Please select a candidate', variant: 'destructive' });
      return;
    }
    hireMutation.mutate();
  }

  function openHireDialog(slot: Slot) {
    setSelectedSlot(slot);
    setSelectedCandidateId('');
    setHireDialogOpen(true);
  }

  const availableCandidates = candidates.filter(c =>
    c.status !== 'hired' && c.status !== 'rejected'
  );

  const vacantSlots = slots.filter(s => s.status === 'VACANT');
  const filledSlots = slots.filter(s => s.status === 'FILLED');

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Loader2 style={{ height: 32, width: 32, animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!requisition) {
    return (
      <div style={{ padding: 24 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
            <p style={{ color: C.textMuted }}>Requisition not found</p>
          </CVisionCardBody>
        </CVisionCard>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => router.push('/cvision/recruitment/requisitions')}>
            <ArrowLeft style={{ height: 16, width: 16, marginRight: 8 }} />
            Back
          </CVisionButton>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700 }}>{requisition.title}</h1>
              <CVisionBadge C={C} variant={requisition.status === 'open' ? 'default' : 'secondary'}>
                {REQUISITION_STATUS_LABELS[requisition.status] || requisition.status}
              </CVisionBadge>
            </div>
            <p style={{ color: C.textMuted }}>{requisition.requisitionNumber}</p>
          </div>
        </div>

        {requisition.status === 'draft' && (
          <CVisionButton C={C} isDark={isDark} onClick={openRequisition} disabled={opening || !requisition.positionId}>
            {opening ? <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : <Play style={{ height: 16, width: 16, marginRight: 8 }} />}
            Open Requisition
          </CVisionButton>
        )}
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.blueDim, borderRadius: 12 }}>
                <Briefcase style={{ height: 20, width: 20, color: C.blue }} />
              </div>
              <div>
                <p style={{ fontSize: 13, color: C.textMuted }}>Total Slots</p>
                <p style={{ fontSize: 18, fontWeight: 700 }}>{requisition.slots?.total || 0}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.orangeDim, borderRadius: 12 }}>
                <Clock style={{ height: 20, width: 20, color: C.orange }} />
              </div>
              <div>
                <p style={{ fontSize: 13, color: C.textMuted }}>Vacant</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.orange }}>{requisition.slots?.vacant || 0}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.greenDim, borderRadius: 12 }}>
                <CheckCircle style={{ height: 20, width: 20, color: C.green }} />
              </div>
              <div>
                <p style={{ fontSize: 13, color: C.textMuted }}>Filled</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{requisition.slots?.filled || 0}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.purpleDim, borderRadius: 12 }}>
                <Users style={{ height: 20, width: 20, color: C.purple }} />
              </div>
              <div>
                <p style={{ fontSize: 13, color: C.textMuted }}>Candidates</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.purple }}>{candidates.length}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.orangeDim, borderRadius: 12 }}>
                <UserCheck style={{ height: 20, width: 20, color: C.orange }} />
              </div>
              <div>
                <p style={{ fontSize: 13, color: C.textMuted }}>Available</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.orange }}>{availableCandidates.length}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Organization Info */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Organization Assignment</div>
          {requisition.status === 'draft' && (
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setEditPositionOpen(true)}>
              <Edit style={{ height: 16, width: 16, marginRight: 8 }} />
              Edit
            </CVisionButton>
          )}
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Building2 style={{ height: 20, width: 20, color: C.textMuted }} />
              <div>
                <p style={{ fontSize: 12, color: C.textMuted }}>Department</p>
                <p style={{ fontWeight: 500 }}>
                  {departments.find(d => d.id === requisition.departmentId)?.name || requisition.departmentName || '-'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Briefcase style={{ height: 20, width: 20, color: C.textMuted }} />
              <div>
                <p style={{ fontSize: 12, color: C.textMuted }}>Job Title</p>
                <p style={{ fontWeight: 500 }}>
                  {jobTitles.find(j => j.id === requisition.jobTitleId)?.name || requisition.jobTitleName || '-'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileText style={{ height: 20, width: 20, color: C.textMuted }} />
              <div>
                <p style={{ fontSize: 12, color: C.textMuted }}>Position Code</p>
                <p style={{ fontWeight: 500 }}>
                  {positions.find(p => p.id === requisition.positionId)?.positionCode || requisition.positionCode || '-'}
                </p>
              </div>
            </div>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Main Content Tabs */}
      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'candidates', label: `Candidates (${candidates.length})` },
          { id: 'slots', label: `Slots (${slots.length})` },
        ]}
      >
        {/* Overview Tab */}
        <CVisionTabContent tabId="overview">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Hiring Workflow Guide */}
          {requisition.status === 'open' && vacantSlots.length > 0 && (
            <CVisionCard C={C} style={{ background: C.blueDim }}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.blue }}>📋 Hiring Workflow</div>
              </CVisionCardHeader>
              <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${candidates.length > 0 ? 'bg-green-500 text-white' : 'bg-gray-300'}`}>
                    1
                  </div>
                  <div>
                    <p className={`font-medium ${candidates.length > 0 ? 'text-green-700' : ''}`}>
                      Add Candidates
                    </p>
                    <p style={{ fontSize: 13, color: C.textMuted }}>
                      {candidates.length > 0 ? `✓ ${candidates.length} candidates added` : 'Add candidates to this requisition'}
                    </p>
                  </div>
                  {candidates.length === 0 && (
                    <CVisionButton C={C} isDark={isDark} size="sm" className="ml-auto" onClick={() => setAddCandidateOpen(true)}>
                      <UserPlus style={{ height: 16, width: 16, marginRight: 4 }} />
                      Add Candidate
                    </CVisionButton>
                  )}
                </div>
                <ChevronRight style={{ height: 16, width: 16, marginLeft: 16, marginRight: 16, color: C.textMuted }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${availableCandidates.length > 0 ? 'bg-green-500 text-white' : 'bg-gray-300'}`}>
                    2
                  </div>
                  <div>
                    <p className={`font-medium ${availableCandidates.length > 0 ? 'text-green-700' : ''}`}>
                      Review & Shortlist
                    </p>
                    <p style={{ fontSize: 13, color: C.textMuted }}>
                      {availableCandidates.length > 0 ? `${availableCandidates.length} candidates ready for hire` : 'Review candidates and update their status'}
                    </p>
                  </div>
                </div>
                <ChevronRight style={{ height: 16, width: 16, marginLeft: 16, marginRight: 16, color: C.textMuted }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${filledSlots.length > 0 ? 'bg-green-500 text-white' : 'bg-gray-300'}`}>
                    3
                  </div>
                  <div>
                    <p className={`font-medium ${filledSlots.length > 0 ? 'text-green-700' : ''}`}>
                      Hire to Fill Slots
                    </p>
                    <p style={{ fontSize: 13, color: C.textMuted }}>
                      {vacantSlots.length > 0
                        ? `${vacantSlots.length} vacant slot(s) - Click "Hire" to fill`
                        : 'All slots filled!'}
                    </p>
                  </div>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}

          {/* Vacant Slots - Quick Action */}
          {vacantSlots.length > 0 && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock style={{ height: 20, width: 20, color: C.orange }} />
                  Vacant Slots - Ready to Fill ({vacantSlots.length})
                </div>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {vacantSlots.map((slot) => (
                    <div key={slot.slotId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                      <div>
                        <p style={{ fontFamily: 'monospace', fontSize: 13 }}>{slot.slotId.substring(0, 12)}...</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>
                          Created: {new Date(slot.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <CVisionButton C={C} isDark={isDark}
                        onClick={() => openHireDialog(slot)}
                        disabled={availableCandidates.length === 0}
                      >
                        <UserCheck style={{ height: 16, width: 16, marginRight: 8 }} />
                        Hire Candidate
                      </CVisionButton>
                    </div>
                  ))}
                </div>
                {availableCandidates.length === 0 && (
                  <div style={{ marginTop: 16, padding: 16, background: C.orangeDim, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                    <p style={{ fontSize: 13, color: C.orange }}>
                      ⚠️ No available candidates to hire. Add candidates first.
                    </p>
                    <CVisionButton C={C} isDark={isDark} size="sm" style={{ marginTop: 8 }} onClick={() => setAddCandidateOpen(true)}>
                      <UserPlus style={{ height: 16, width: 16, marginRight: 4 }} />
                      Add Candidate
                    </CVisionButton>
                  </div>
                )}
              </CVisionCardBody>
            </CVisionCard>
          )}

          {/* Filled Slots */}
          {filledSlots.length > 0 && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle style={{ height: 20, width: 20, color: C.green }} />
                  Filled Slots ({filledSlots.length})
                </div>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filledSlots.map((slot) => (
                    <div key={slot.slotId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: `1px solid ${C.border}`, borderRadius: 12, background: C.greenDim }}>
                      <div>
                        <p style={{ fontWeight: 500 }}>{slot.employee?.fullName || slot.candidate?.fullName || 'Unknown'}</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>
                          {slot.employee?.employeeNo || slot.slotId.substring(0, 12)}
                        </p>
                      </div>
                      <CVisionBadge C={C} style={{ background: C.greenDim }}>Filled</CVisionBadge>
                    </div>
                  ))}
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}
        </div>
        </CVisionTabContent>

        {/* Candidates Tab */}
        <CVisionTabContent tabId="candidates">
          <CVisionCard C={C}>
            <CVisionCardHeader C={C} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Candidates</div>
              <CVisionButton C={C} isDark={isDark} onClick={() => setAddCandidateOpen(true)}>
                <UserPlus style={{ height: 16, width: 16, marginRight: 8 }} />
                Add Candidate
              </CVisionButton>
            </CVisionCardHeader>
            <CVisionCardBody>
              {candidates.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48 }}>
                  <Users style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 16 }} />
                  <p style={{ color: C.textMuted, marginBottom: 16 }}>No candidates yet</p>
                  <CVisionButton C={C} isDark={isDark} onClick={() => setAddCandidateOpen(true)}>
                    <UserPlus style={{ height: 16, width: 16, marginRight: 8 }} />
                    Add First Candidate
                  </CVisionButton>
                </div>
              ) : (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                      <CVisionTh C={C}>Name</CVisionTh>
                      <CVisionTh C={C}>Contact</CVisionTh>
                      <CVisionTh C={C}>Status</CVisionTh>
                      <CVisionTh C={C}>Source</CVisionTh>
                      <CVisionTh C={C}>Applied</CVisionTh>
                      <CVisionTh C={C}>Actions</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {candidates.map((candidate) => (
                      <CVisionTr C={C} key={candidate.id}>
                        <CVisionTd style={{ fontWeight: 500 }}>{candidate.fullName}</CVisionTd>
                        <CVisionTd>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                            {candidate.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Mail style={{ height: 12, width: 12 }} /> {candidate.email}
                              </div>
                            )}
                            {candidate.phone && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Phone style={{ height: 12, width: 12 }} /> {candidate.phone}
                              </div>
                            )}
                          </div>
                        </CVisionTd>
                        <CVisionTd>
                          <CVisionBadge C={C} variant={candidate.status === 'hired' ? 'default' : candidate.status === 'rejected' ? 'destructive' : 'secondary'}>
                            {candidate.status}
                          </CVisionBadge>
                        </CVisionTd>
                        <CVisionTd>{candidate.source}</CVisionTd>
                        <CVisionTd>{new Date(candidate.createdAt).toLocaleDateString()}</CVisionTd>
                        <CVisionTd>
                          <CVisionButton C={C} isDark={isDark}
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/cvision/recruitment/candidates/${candidate.id}`)}
                          >
                            View Details
                          </CVisionButton>
                        </CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              )}
            </CVisionCardBody>
          </CVisionCard>
        </CVisionTabContent>

        {/* Slots Tab */}
        <CVisionTabContent tabId="slots">
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Position Slots</div>
            </CVisionCardHeader>
            <CVisionCardBody>
              {slots.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48 }}>
                  <Briefcase style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 16 }} />
                  <p style={{ color: C.textMuted }}>
                    {requisition.status === 'draft'
                      ? 'Open the requisition to create slots'
                      : 'No slots found'}
                  </p>
                </div>
              ) : (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                      <CVisionTh C={C}>Slot ID</CVisionTh>
                      <CVisionTh C={C}>Status</CVisionTh>
                      <CVisionTh C={C}>Employee / Candidate</CVisionTh>
                      <CVisionTh C={C}>Created</CVisionTh>
                      <CVisionTh C={C}>Filled At</CVisionTh>
                      <CVisionTh C={C}>Actions</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {slots.map((slot) => (
                      <CVisionTr C={C} key={slot.slotId}>
                        <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{slot.slotId.substring(0, 12)}...</CVisionTd>
                        <CVisionTd>
                          <CVisionBadge C={C} variant={slot.status === 'FILLED' ? 'default' : slot.status === 'VACANT' ? 'secondary' : 'outline'}>
                            {slot.status}
                          </CVisionBadge>
                        </CVisionTd>
                        <CVisionTd>
                          {slot.employee ? (
                            <div>
                              <p style={{ fontWeight: 500 }}>{slot.employee.fullName}</p>
                              <p style={{ fontSize: 12, color: C.textMuted }}>{slot.employee.employeeNo}</p>
                            </div>
                          ) : slot.candidate ? (
                            <div>
                              <p style={{ fontWeight: 500 }}>{slot.candidate.fullName}</p>
                              <p style={{ fontSize: 12, color: C.textMuted }}>Candidate</p>
                            </div>
                          ) : (
                            <span style={{ color: C.textMuted }}>-</span>
                          )}
                        </CVisionTd>
                        <CVisionTd>{new Date(slot.createdAt).toLocaleDateString()}</CVisionTd>
                        <CVisionTd>
                          {slot.filledAt ? new Date(slot.filledAt).toLocaleDateString() : '-'}
                        </CVisionTd>
                        <CVisionTd>
                          {slot.status === 'VACANT' && (
                            <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => openHireDialog(slot)}>
                              <UserCheck style={{ height: 16, width: 16, marginRight: 4 }} />
                              Hire
                            </CVisionButton>
                          )}
                        </CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              )}
            </CVisionCardBody>
          </CVisionCard>
        </CVisionTabContent>
      </CVisionTabs>

      {/* Assign Position Dialog */}
      <CVisionDialog C={C} open={editPositionOpen} onClose={() => setEditPositionOpen(false)} title="Edit Position" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Select department, job title, and position for this requisition.
            </p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Department *</CVisionLabel>
              <CVisionSelect
                C={C}
                value={assignmentForm.departmentId || 'none'}
                placeholder="Select department"
                options={[
                  { value: 'none', label: 'Select...' },
                  ...departments.map((dept) => (
                    ({ value: dept.id, label: dept.name })
                  )),
                ]}
              />
            </div>

            {assignmentForm.departmentId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>Job Title *</CVisionLabel>
                <CVisionSelect
                C={C}
                value={assignmentForm.jobTitleId || 'none'}
                placeholder="Select job title"
                options={[
                  { value: 'none', label: 'Select...' },
                  ...jobTitles.map((jt) => (
                      ({ value: jt.id, label: jt.name })
                    )),
                ]}
              />
              </div>
            )}

            {assignmentForm.jobTitleId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>Position *</CVisionLabel>
                <CVisionSelect
                C={C}
                value={assignmentForm.positionId || 'none'}
                placeholder="Select position"
                options={[
                  { value: 'none', label: 'Select...' },
                  ...positions.map((pos) => (
                      ({ value: pos.id, label: `${pos.positionCode} (${pos.availableSlots} available)` })
                    )),
                ]}
              />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setEditPositionOpen(false)}>Cancel</CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={assignPosition} disabled={assigning || !assignmentForm.positionId}>
                {assigning && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                Save
              </CVisionButton>
            </div>
          </div>
      </CVisionDialog>

      {/* Add Candidate Dialog */}
      <CVisionDialog C={C} open={addCandidateOpen} onClose={() => setAddCandidateOpen(false)} title="Add Candidate" isDark={isDark}>                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Full Name *</CVisionLabel>
              <CVisionInput C={C}
                value={newCandidate.fullName}
                onChange={(e) => setNewCandidate({ ...newCandidate, fullName: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Email</CVisionLabel>
              <CVisionInput C={C}
                type="email"
                value={newCandidate.email}
                onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Phone</CVisionLabel>
              <CVisionInput C={C}
                value={newCandidate.phone}
                onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })}
                placeholder="+966..."
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Source</CVisionLabel>
              <CVisionSelect
                C={C}
                value={newCandidate.source}
                options={[
                  { value: 'PORTAL', label: 'Portal' },
                  { value: 'REFERRAL', label: 'Referral' },
                  { value: 'AGENCY', label: 'Agency' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setAddCandidateOpen(false)}>Cancel</CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={createCandidate} disabled={creatingCandidate || !newCandidate.fullName}>
                {creatingCandidate && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                Add Candidate
              </CVisionButton>
            </div>
          </div>
      </CVisionDialog>

      {/* Hire Candidate Dialog */}
      <CVisionDialog C={C} open={hireDialogOpen} onClose={() => setHireDialogOpen(false)} title="Hire Candidate" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              Select a candidate to fill this position slot.
            </p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
            {selectedSlot && (
              <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 12 }}>
                <p style={{ fontSize: 13, color: C.textMuted }}>Slot ID</p>
                <p style={{ fontFamily: 'monospace' }}>{selectedSlot.slotId}</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>Select Candidate *</CVisionLabel>
              <CVisionSelect
                C={C}
                value={selectedCandidateId || 'none'}
                onChange={setSelectedCandidateId}
                placeholder="Choose candidate to hire"
                options={[
                  { value: 'none', label: 'Select candidate...' },
                  ...availableCandidates.map((candidate) => (
                    ({ value: candidate.id, label: `${candidate.fullName} (${candidate.status})` })
                  )),
                ]}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setHireDialogOpen(false)}>Cancel</CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={hireCandidate} disabled={hiring || !selectedCandidateId || selectedCandidateId === 'none'}>
                {hiring && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                <UserCheck style={{ height: 16, width: 16, marginRight: 8 }} />
                Confirm Hire
              </CVisionButton>
            </div>
          </div>
      </CVisionDialog>
    </div>
  );
}
