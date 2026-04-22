'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionInput,
  CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Users, PlusCircle, UserPlus, Crown } from 'lucide-react';

export default function TeamsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', nameAr: '', purpose: '', leaderName: '' });
  const [addMember, setAddMember] = useState<{ teamId: string; employeeId: string; name: string } | null>(null);

  const { data: teamsRaw, isLoading: loading, refetch: refetchTeams } = useQuery({
    queryKey: cvisionKeys.teams.list({ action: 'list' }),
    queryFn: () => cvisionFetch('/api/cvision/teams', { params: { action: 'list' } }),
  });
  const teams: any[] = teamsRaw?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => cvisionMutate('/api/cvision/teams', 'POST', { action: 'create', ...body }),
    onSuccess: () => { toast.success(tr('تم إنشاء الفريق', 'Team created')); setShowCreate(false); refetchTeams(); },
    onError: (err: any) => toast.error(err?.data?.error || tr('فشل', 'Failed')),
  });
  const handleCreate = () => {
    if (!form.name) { toast.error(tr('الاسم مطلوب', 'Name required')); return; }
    createMutation.mutate(form);
  };

  const addMemberMutation = useMutation({
    mutationFn: (body: any) => cvisionMutate('/api/cvision/teams', 'POST', { action: 'add-member', ...body }),
    onSuccess: () => { toast.success(tr('تمت إضافة العضو', 'Member added')); setAddMember(null); refetchTeams(); },
    onError: (err: any) => toast.error(err?.data?.error || tr('فشل', 'Failed')),
  });
  const handleAddMember = () => {
    if (!addMember || !addMember.employeeId) { toast.error(tr('الموظف مطلوب', 'Employee required')); return; }
    addMemberMutation.mutate({ teamId: addMember.teamId, employeeId: addMember.employeeId, name: addMember.name });
  };

  if (loading) return <div style={{ padding: 24 }}><CVisionSkeletonCard C={C} height={260} /></div>;

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('الفرق', 'Teams')}
        titleEn="Teams"
        icon={Users}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant={showCreate ? 'outline' : 'primary'} icon={<PlusCircle size={14} />} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? tr('إلغاء', 'Cancel') : tr('فريق جديد', 'New Team')}
          </CVisionButton>
        }
      />

      {showCreate && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إنشاء فريق', 'Create Team')}</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <CVisionInput C={C} placeholder={tr('اسم الفريق (إنجليزي)', 'Team Name')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('اسم الفريق (عربي)', 'Team Name (Arabic)')} dir="rtl" value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
              </div>
              <CVisionInput C={C} placeholder={tr('الغرض', 'Purpose')} value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
              <CVisionInput C={C} placeholder={tr('اسم القائد', 'Leader Name')} value={form.leaderName} onChange={e => setForm({ ...form, leaderName: e.target.value })} />
              <CVisionButton C={C} isDark={isDark} onClick={handleCreate}>{tr('إنشاء', 'Create')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {addMember && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إضافة عضو', 'Add Member')}</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionInput C={C} placeholder={tr('رقم الموظف', 'Employee ID')} value={addMember.employeeId} onChange={e => setAddMember({ ...addMember, employeeId: e.target.value })} />
              <CVisionInput C={C} placeholder={tr('الاسم', 'Name')} value={addMember.name} onChange={e => setAddMember({ ...addMember, name: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <CVisionButton C={C} isDark={isDark} onClick={handleAddMember}>{tr('إضافة', 'Add')}</CVisionButton>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setAddMember(null)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {teams.map(t => (
          <CVisionCard C={C} key={t.teamId}>
            <CVisionCardBody>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Users size={16} color={C.blue} />
                <span style={{ fontWeight: 500, color: C.text }}>{t.name}</span>
              </div>
              {t.nameAr && <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }} dir="rtl">{t.nameAr}</p>}
              {t.purpose && <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>{t.purpose}</p>}
              {t.leaderName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginBottom: 8 }}>
                  <Crown size={12} color={C.gold} />
                  <span style={{ color: C.textSecondary }}>{t.leaderName}</span>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {(t.members || []).map((m: any) => (
                  <CVisionBadge key={m.employeeId} C={C} variant="muted" style={{ fontSize: 9 }}>
                    {m.name || m.employeeId}
                  </CVisionBadge>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CVisionBadge C={C} variant="info" style={{ fontSize: 10 }}>
                  {(t.members || []).length} {tr('أعضاء', 'members')}
                </CVisionBadge>
                <div style={{ marginLeft: 'auto' }}>
                  <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={<UserPlus size={12} />}
                    onClick={() => setAddMember({ teamId: t.teamId, employeeId: '', name: '' })}>
                    {tr('إضافة', 'Add')}
                  </CVisionButton>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
    </CVisionPageLayout>
  );
}
