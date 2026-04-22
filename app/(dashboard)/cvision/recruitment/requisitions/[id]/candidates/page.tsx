'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, User, Mail, Phone, Plus } from 'lucide-react';
import Link from 'next/link';
import { DebugBanner } from '@/components/cvision/DebugBanner';

interface Candidate {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  status: string;
  source: string;
  createdAt: string;
}

interface CandidatesResponse {
  success: boolean;
  data: Candidate[];
  total: number;
}

export default function RequisitionCandidatesPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const requisitionId = params.id as string;
  const [createOpen, setCreateOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState({
    fullName: '',
    email: '',
    phone: '',
    source: 'PORTAL' as 'PORTAL' | 'REFERRAL' | 'AGENCY' | 'OTHER',
  });
  const { toast } = useToast();

  const { data: candidates = [], isLoading: loading } = useQuery({
    queryKey: cvisionKeys.recruitment.candidates.list({ requisitionId }),
    queryFn: async () => {
      const data = await cvisionFetch<CandidatesResponse>(`/api/cvision/recruitment/candidates`, { params: { requisitionId } });
      if (data.success) return (data.data as any)?.items || data.data || [];
      throw new Error('Failed to load candidates');
    },
    enabled: !!requisitionId,
  });

  const createCandidateMutation = useMutation({
    mutationFn: async () => {
      if (!newCandidate.fullName) throw new Error('Full name is required');
      return cvisionMutate<any>(`/api/cvision/recruitment/requisitions/${requisitionId}/candidates`, 'POST', newCandidate);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Candidate created' });
      setCreateOpen(false);
      setNewCandidate({ fullName: '', email: '', phone: '', source: 'PORTAL' });
      queryClient.invalidateQueries({ queryKey: cvisionKeys.recruitment.candidates.all });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create candidate', variant: 'destructive' });
    },
  });

  function handleCreateCandidate() { createCandidateMutation.mutate(); }
  const creating = createCandidateMutation.isPending;

  function getStatusBadgeVariant(status: string) {
    switch (status) {
      case 'applied':
        return 'default';
      case 'shortlisted':
        return 'secondary';
      case 'interview':
        return 'outline';
      case 'hired':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ height: 32, width: 32, animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <DebugBanner />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft style={{ height: 16, width: 16, marginRight: 8 }} />
            Back
          </CVisionButton>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>Candidates</h1>
            <p style={{ color: C.textMuted }}>Requisition: {requisitionId}</p>
          </div>
        </div>
        <CVisionDialog C={C} open={createOpen} onClose={() => setCreateOpen(false)} title="Create Program" isDark={isDark}>            <CVisionButton C={C} isDark={isDark}>
              <Plus style={{ height: 16, width: 16, marginRight: 8 }} />
              New Candidate
            </CVisionButton>                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C} htmlFor="fullName">Full Name *</CVisionLabel>
                <CVisionInput C={C}
                  id="fullName"
                  value={newCandidate.fullName}
                  onChange={(e) =>
                    setNewCandidate({ ...newCandidate, fullName: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C} htmlFor="email">Email</CVisionLabel>
                <CVisionInput C={C}
                  id="email"
                  type="email"
                  value={newCandidate.email}
                  onChange={(e) =>
                    setNewCandidate({ ...newCandidate, email: e.target.value })
                  }
                  placeholder="john.doe@example.com"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C} htmlFor="phone">Phone</CVisionLabel>
                <CVisionInput C={C}
                  id="phone"
                  value={newCandidate.phone}
                  onChange={(e) =>
                    setNewCandidate({ ...newCandidate, phone: e.target.value })
                  }
                  placeholder="+1234567890"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C} htmlFor="source">Source</CVisionLabel>
                <CVisionSelect
                C={C}
                value={newCandidate.source}
                onChange={(value: any) =>
                    setNewCandidate({ ...newCandidate, source: value })}
                options={[{ value: 'PORTAL', label: 'Portal' }, { value: 'REFERRAL', label: 'Referral' }, { value: 'AGENCY', label: 'Agency' }, { value: 'OTHER', label: 'Other' }]}
              />
              </div>
              <CVisionButton C={C} isDark={isDark} onClick={handleCreateCandidate} disabled={creating} style={{ width: '100%' }}>
                {creating && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                Create Candidate
              </CVisionButton>
            </div>
        </CVisionDialog>
      </div>

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Candidates ({candidates.length})</div>
        </CVisionCardHeader>
        <CVisionCardBody>
          {candidates.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: C.textMuted }}>
              No candidates found for this requisition.
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
                    <CVisionTd>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User style={{ height: 16, width: 16, color: C.textMuted }} />
                        <span style={{ fontWeight: 500 }}>{candidate.fullName}</span>
                      </div>
                    </CVisionTd>
                    <CVisionTd>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {candidate.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                            <Mail style={{ height: 12, width: 12 }} />
                            {candidate.email}
                          </div>
                        )}
                        {candidate.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                            <Phone style={{ height: 12, width: 12 }} />
                            {candidate.phone}
                          </div>
                        )}
                      </div>
                    </CVisionTd>
                    <CVisionTd>
                      <CVisionBadge C={C} variant={getStatusBadgeVariant(candidate.status)}>
                        {candidate.status}
                      </CVisionBadge>
                    </CVisionTd>
                    <CVisionTd>{candidate.source}</CVisionTd>
                    <CVisionTd>
                      {new Date(candidate.createdAt).toLocaleDateString()}
                    </CVisionTd>
                    <CVisionTd>
                      <Link href={`/cvision/recruitment/candidates/${candidate.id}`}>
                        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ width: '100%' }}>
                          <User style={{ height: 16, width: 16, marginRight: 4 }} />
                          View & Upload CV
                        </CVisionButton>
                      </Link>
                    </CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}
