'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionLabel, CVisionSelect, CVisionDialog, CVisionDialogFooter, CVisionTabs, CVisionTabContent, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionEmptyState } from '@/components/cvision/ui';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Building2 } from 'lucide-react';
import Link from 'next/link';

interface Department { id: string; code: string; name: string; nameAr?: string; description?: string; isActive: boolean; }
interface Position { id: string; code: string; title: string; description?: string | null; isActive: boolean; }
interface DepartmentPosition { assignmentId: string; position: Position | null; assignedAt: string; }

export default function DepartmentDetailPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const params = useParams();
  const departmentId = params?.id as string;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  // Fetch department detail
  const { data: deptData, isLoading: deptLoading } = useQuery({
    queryKey: cvisionKeys.departments.detail(departmentId),
    queryFn: () => cvisionFetch(`/api/cvision/departments/${departmentId}`),
    enabled: !!departmentId,
  });
  const department = deptData?.department ?? null;

  // Fetch department positions
  const { data: positionsData, isLoading: posLoading, refetch: refetchPositions } = useQuery({
    queryKey: cvisionKeys.org.budgetedPositions.list({ departmentId }),
    queryFn: () => cvisionFetch(`/api/cvision/org/departments/${departmentId}/positions`),
    enabled: !!departmentId,
  });
  const positions: DepartmentPosition[] = positionsData?.positions || [];

  // Fetch all positions
  const { data: allPosData } = useQuery({
    queryKey: cvisionKeys.positions.list(),
    queryFn: () => cvisionFetch('/api/cvision/positions'),
    enabled: !!departmentId,
  });
  const allPositions: Position[] = allPosData?.data?.items || allPosData?.data || [];

  const loading = deptLoading || posLoading;

  // Assign position mutation
  const assignMutation = useMutation({
    mutationFn: (positionId: string) => cvisionMutate(`/api/cvision/org/departments/${departmentId}/positions`, 'POST', { positionId }),
    onSuccess: () => {
      toast({ title: tr('نجاح', 'Success'), description: tr('تم تعيين المنصب للقسم', 'Position assigned to department') });
      setDialogOpen(false);
      setSelectedPositionId('');
      refetchPositions();
    },
    onError: (err: any) => {
      toast({ title: tr('خطأ', 'Error'), description: err?.data?.error || tr('فشل تعيين المنصب', 'Failed to assign position'), variant: 'destructive' });
    },
  });

  function assignPosition() {
    if (!selectedPositionId) { toast({ title: tr('خطأ', 'Error'), description: tr('يرجى اختيار منصب', 'Please select a position'), variant: 'destructive' }); return; }
    assignMutation.mutate(selectedPositionId);
  }

  // Remove position mutation
  const removeMutation = useMutation({
    mutationFn: (positionId: string) => cvisionMutate(`/api/cvision/org/departments/${departmentId}/positions/${positionId}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: tr('نجاح', 'Success'), description: tr('تمت ازالة المنصب', 'Position removed from department') });
      refetchPositions();
    },
    onError: (err: any) => {
      toast({ title: tr('خطأ', 'Error'), description: err?.data?.error || tr('فشل ازالة المنصب', 'Failed to remove position'), variant: 'destructive' });
    },
  });

  function removePosition(positionId: string) {
    if (!confirm(tr('ازالة هذا المنصب من القسم؟', 'Remove this position from the department?'))) return;
    removeMutation.mutate(positionId);
  }

  const assignedPositionIds = new Set(positions.map(p => p.position?.id).filter(Boolean));
  const availablePositions = allPositions.filter(p => !assignedPositionIds.has(p.id));

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={300} />
    </CVisionPageLayout>
  );

  if (!department) return (
    <CVisionPageLayout>
      <CVisionCard C={C}>
        <CVisionCardBody style={{ padding: 24, textAlign: 'center' }}>
          <CVisionEmptyState C={C} icon={Building2} title={tr('القسم غير موجود', 'Department not found')} />
        </CVisionCardBody>
      </CVisionCard>
    </CVisionPageLayout>
  );

  const tabs = [
    { id: 'overview', label: tr('نظرة عامة', 'Overview'), icon: <Building2 size={14} /> },
    { id: 'positions', label: `${tr('المناصب', 'Positions')} (${positions.length})` },
  ];

  return (
    <CVisionPageLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/cvision/organization" style={{ textDecoration: 'none' }}>
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={ArrowLeft}>{tr('رجوع', 'Back')}</CVisionButton>
        </Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{department.name}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{department.code}</div>
        </div>
      </div>

      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />

      <CVisionTabContent id="overview" activeTab={activeTab}>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('معلومات القسم', 'Department Information')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <CVisionLabel C={C}>{tr('الرمز', 'Code')}</CVisionLabel>
              <div style={{ fontFamily: 'monospace', color: C.text }}>{department.code}</div>
            </div>
            <div>
              <CVisionLabel C={C}>{tr('الاسم', 'Name')}</CVisionLabel>
              <div style={{ fontWeight: 500, color: C.text }}>{department.name}</div>
            </div>
            {department.description && (
              <div>
                <CVisionLabel C={C}>{tr('الوصف', 'Description')}</CVisionLabel>
                <div style={{ color: C.text }}>{department.description}</div>
              </div>
            )}
            <div>
              <CVisionLabel C={C}>{tr('الحالة', 'Status')}</CVisionLabel>
              <CVisionBadge C={C} variant={department.isActive ? 'success' : 'muted'}>{department.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</CVisionBadge>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </CVisionTabContent>

      <CVisionTabContent id="positions" activeTab={activeTab}>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('المناصب المعينة', 'Assigned Positions')}</span>
            <CVisionButton C={C} isDark={isDark} variant="primary" size="sm" icon={Plus} onClick={() => setDialogOpen(true)}>
              {tr('تعيين منصب', 'Assign Position')}
            </CVisionButton>
          </CVisionCardHeader>
          <CVisionCardBody>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                <CVisionTh C={C}>{tr('الرمز', 'Code')}</CVisionTh>
                <CVisionTh C={C}>{tr('العنوان', 'Title')}</CVisionTh>
                <CVisionTh C={C}>{tr('الوصف', 'Description')}</CVisionTh>
                <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                <CVisionTh C={C}>{tr('تاريخ التعيين', 'Assigned At')}</CVisionTh>
                <CVisionTh C={C} width={80}>{tr('اجراءات', 'Actions')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {positions.length === 0 ? (
                  <CVisionTr C={C}>
                    <CVisionTd style={{ textAlign: 'center', color: C.textMuted }} colSpan={6}>
                      {tr('لا توجد مناصب معينة. عين مناصب لهذا القسم.', 'No positions assigned. Assign positions to this department.')}
                    </CVisionTd>
                  </CVisionTr>
                ) : (
                  positions.map(dp => {
                    const pos = dp.position;
                    if (!pos) return null;
                    return (
                      <CVisionTr key={dp.assignmentId} C={C}>
                        <CVisionTd><span style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{pos.code}</span></CVisionTd>
                        <CVisionTd><span style={{ fontWeight: 500, color: C.text }}>{pos.title}</span></CVisionTd>
                        <CVisionTd><span style={{ fontSize: 12, color: C.textMuted }}>{pos.description || '-'}</span></CVisionTd>
                        <CVisionTd><CVisionBadge C={C} variant={pos.isActive ? 'success' : 'muted'}>{pos.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</CVisionBadge></CVisionTd>
                        <CVisionTd><span style={{ fontSize: 12, color: C.textMuted }}>{new Date(dp.assignedAt).toLocaleDateString()}</span></CVisionTd>
                        <CVisionTd>
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => removePosition(pos.id)}>
                            <Trash2 size={16} color={C.red} />
                          </CVisionButton>
                        </CVisionTd>
                      </CVisionTr>
                    );
                  })
                )}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      </CVisionTabContent>

      <CVisionDialog C={C} open={dialogOpen} onClose={() => setDialogOpen(false)} title={tr('تعيين منصب للقسم', 'Assign Position to Department')} isRTL={isRTL}>
        <CVisionSelect
          C={C}
          label={tr('المنصب', 'Position')}
          value={selectedPositionId}
          onChange={setSelectedPositionId}
          placeholder={tr('اختر منصب', 'Select position')}
          options={availablePositions.length === 0
            ? [{ value: '', label: tr('لا توجد مناصب متاحة', 'No positions available') }]
            : availablePositions.map(pos => ({ value: pos.id, label: `${pos.title} (${pos.code})` }))
          }
        />
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setDialogOpen(false)}>{tr('الغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="primary" loading={assignMutation.isPending} disabled={assignMutation.isPending || !selectedPositionId} onClick={assignPosition}>
            {tr('تعيين', 'Assign')}
          </CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
