'use client';

import { useState } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionTextarea, CVisionPageHeader, CVisionPageLayout, CVisionMiniStat, CVisionStatsRow, CVisionSkeletonCard, CVisionSelect, CVisionTabs, CVisionTabContent, CVisionDialog, CVisionDialogFooter, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd } from '@/components/cvision/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { toast } from 'sonner';
import {
  Trophy, Heart, MessageCircle, Star, Send, Gift, Users, Medal,
  TrendingUp, BarChart3, Plus, Search, ThumbsUp, Crown, Sparkles,
  RefreshCcw, Check, X, Award, ShoppingBag, History, Settings,
} from 'lucide-react';

const API = '/api/cvision/recognition';
function fmtDate(d: any) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' }); }
function timeAgo(d: any) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(d);
}

const TYPE_ICONS: Record<string, any> = {
  KUDOS: ThumbsUp, EMPLOYEE_OF_MONTH: Crown, EMPLOYEE_OF_QUARTER: Crown,
  EMPLOYEE_OF_YEAR: Crown, SPOT_AWARD: Sparkles, MILESTONE: Medal,
  INNOVATION: Star, CUSTOMER_SERVICE: Heart, TEAMWORK: Users, CUSTOM: Award,
};
const TYPE_LABELS: Record<string, string> = {
  KUDOS: 'Kudos', EMPLOYEE_OF_MONTH: 'Employee of the Month', EMPLOYEE_OF_QUARTER: 'Employee of the Quarter',
  EMPLOYEE_OF_YEAR: 'Employee of the Year', SPOT_AWARD: 'Spot Award', MILESTONE: 'Milestone',
  INNOVATION: 'Innovation', CUSTOMER_SERVICE: 'Customer Service', TEAMWORK: 'Teamwork', CUSTOM: 'Custom',
};
const TYPE_LABELS_AR: Record<string, string> = {
  KUDOS: 'تقدير', EMPLOYEE_OF_MONTH: 'موظف الشهر', EMPLOYEE_OF_QUARTER: 'موظف الربع',
  EMPLOYEE_OF_YEAR: 'موظف العام', SPOT_AWARD: 'جائزة فورية', MILESTONE: 'إنجاز',
  INNOVATION: 'ابتكار', CUSTOMER_SERVICE: 'خدمة العملاء', TEAMWORK: 'عمل جماعي', CUSTOM: 'مخصص',
};
const CAT_LABELS: Record<string, string> = {
  PERFORMANCE: 'Performance', INNOVATION: 'Innovation', TEAMWORK: 'Teamwork', LEADERSHIP: 'Leadership',
  CUSTOMER_FOCUS: 'Customer Focus', VALUES: 'Values', SAFETY: 'Safety', ATTENDANCE: 'Attendance',
};

interface ThemeProps { C: any; isDark: boolean; tr: (ar: string, en: string) => string; isRTL: boolean; }

// ===============================================================
// RECOGNITION WALL (Social Feed)
// ===============================================================
function WallTab({ C, isDark, tr, isRTL }: ThemeProps) {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});

  const { data: feedRaw, isLoading: loading, refetch: load } = useQuery({
    queryKey: cvisionKeys.recognition.list({ action: 'feed', limit: '30', type: typeFilter }),
    queryFn: () => cvisionFetch<any>(API, { params: { action: 'feed', limit: '30', ...(typeFilter ? { type: typeFilter } : {}) } }),
  });
  const feed = feedRaw?.recognitions || [];

  const likeMutation = useMutation({
    mutationFn: (recognitionId: string) => cvisionMutate(API, 'POST', { action: 'like', recognitionId }),
    onSuccess: () => load(),
  });

  const handleLike = async (recognitionId: string) => { likeMutation.mutate(recognitionId); };

  const commentMutation = useMutation({
    mutationFn: ({ recognitionId, text }: { recognitionId: string; text: string }) => cvisionMutate(API, 'POST', { action: 'comment', recognitionId, text }),
    onSuccess: (_, { recognitionId }) => { setCommentText(p => ({ ...p, [recognitionId]: '' })); load(); },
  });

  const handleComment = async (recognitionId: string) => {
    const text = commentText[recognitionId]?.trim();
    if (!text) return;
    commentMutation.mutate({ recognitionId, text });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 200 }}>
          <CVisionSelect C={C} value={typeFilter || 'ALL'} onChange={v => setTypeFilter(v === 'ALL' ? '' : v)} options={[{ value: 'ALL', label: tr('جميع الأنواع', 'All Types') }, ...Object.entries(TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))]} />
        </div>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<RefreshCcw size={14} />} onClick={() => load()}>{tr('تحديث', 'Refresh')}</CVisionButton>
      </div>

      {loading ? <CVisionSkeletonCard C={C} height={140} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, margin: '0 auto', width: '100%' }}>
          {feed.map(rec => {
            const Icon = TYPE_ICONS[rec.type] || Award;
            const visibleComments = showComments[rec.recognitionId] ? rec.comments : (rec.comments || []).slice(-2);
            return (
              <CVisionCard key={rec.recognitionId} C={C}>
                <CVisionCardBody style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${C.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={20} color={C.gold} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{rec.giverName}</span>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{tr('كرّم', 'recognized')}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{rec.recipientName}</span>
                        <CVisionBadge C={C} variant="muted">{isRTL ? (TYPE_LABELS_AR[rec.type] || rec.type) : (TYPE_LABELS[rec.type] || rec.type)}</CVisionBadge>
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {rec.recipientDepartment} · {timeAgo(rec.createdAt)} · +{rec.pointsAwarded} {tr('نقاط', 'pts')}
                      </div>
                      <p style={{ fontSize: 13, marginTop: 8, color: C.textSecondary, whiteSpace: 'pre-wrap' }}>{rec.message}</p>
                      {rec.award && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: `${C.gold}10`, borderRadius: 8, padding: '6px 10px', border: `1px solid ${C.border}` }}>
                          <Gift size={14} color={C.gold} />
                          <span style={{ fontWeight: 500, color: C.text }}>{rec.award.description}</span>
                          {rec.award.value > 0 && <span style={{ color: C.textMuted }}>({rec.award.value} SAR)</span>}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                        <button onClick={() => handleLike(rec.recognitionId)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.textMuted, cursor: 'pointer', background: 'none', border: 'none' }}>
                          <ThumbsUp size={14} /> {(rec.likes || []).length}
                        </button>
                        <button onClick={() => setShowComments(p => ({ ...p, [rec.recognitionId]: !p[rec.recognitionId] }))} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.textMuted, cursor: 'pointer', background: 'none', border: 'none' }}>
                          <MessageCircle size={14} /> {(rec.comments || []).length}
                        </button>
                      </div>
                      {(rec.comments || []).length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(rec.comments || []).length > 2 && !showComments[rec.recognitionId] && (
                            <button onClick={() => setShowComments(p => ({ ...p, [rec.recognitionId]: true }))} style={{ fontSize: 11, color: C.blue, cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left' }}>
                              {tr(`عرض جميع التعليقات (${rec.comments.length})`, `View all ${rec.comments.length} comments`)}
                            </button>
                          )}
                          {visibleComments.map((c: any, i: number) => (
                            <div key={i} style={{ fontSize: 12, background: C.bgCard, borderRadius: 8, padding: '6px 10px' }}>
                              <span style={{ fontWeight: 500, color: C.text }}>{c.employeeName}</span>
                              <span style={{ color: C.textMuted }}> · {timeAgo(c.createdAt)}</span>
                              <p style={{ marginTop: 2, color: C.textSecondary }}>{c.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CVisionInput C={C} placeholder={tr('اكتب تعليقاً...', 'Write a comment...')} value={commentText[rec.recognitionId] || ''} onChange={e => setCommentText(p => ({ ...p, [rec.recognitionId]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleComment(rec.recognitionId); }} style={{ fontSize: 12 }} />
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => handleComment(rec.recognitionId)} disabled={!(commentText[rec.recognitionId] || '').trim()}>
                          <Send size={14} />
                        </CVisionButton>
                      </div>
                    </div>
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
          {feed.length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, padding: '48px 0' }}>{tr('لا توجد تقديرات بعد. كن أول من يمنح التقدير!', 'No recognitions yet. Be the first to give kudos!')}</div>}
        </div>
      )}
    </div>
  );
}

// ===============================================================
// GIVE RECOGNITION TAB
// ===============================================================
function GiveTab({ C, isDark, tr, isRTL }: ThemeProps) {
  const { data: empsRaw } = useQuery({
    queryKey: cvisionKeys.employees.list({ limit: 200 }),
    queryFn: () => cvisionFetch('/api/cvision/employees?limit=200'),
  });
  const employees = empsRaw?.data || empsRaw?.employees || [];

  const [recipientId, setRecipientId] = useState('');
  const [type, setType] = useState<string>('KUDOS');
  const [category, setCategory] = useState('TEAMWORK');
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [awardType, setAwardType] = useState('');
  const [awardValue, setAwardValue] = useState('');
  const [awardDesc, setAwardDesc] = useState('');

  const submitMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate(API, 'POST', payload),
    onSuccess: (d: any) => {
      if (d.success) {
        toast.success(tr('تم إرسال التقدير!', d.recognitionId ? `Recognition sent! (${d.recognitionId})` : 'Recognition sent!'));
        setRecipientId(''); setMessage(''); setType('KUDOS'); setAwardType(''); setAwardValue(''); setAwardDesc('');
      } else toast.error(d.error || tr('فشل', 'Failed'));
    },
    onError: () => toast.error(tr('خطأ في الإرسال', 'Error submitting recognition')),
  });
  const submitting = submitMutation.isPending;

  const submit = () => {
    if (!recipientId || !message) { toast.error(tr('اختر المستلم واكتب رسالة', 'Select a recipient and write a message')); return; }
    const isKudos = type === 'KUDOS';
    const actionName = isKudos ? 'give-kudos' : ['EMPLOYEE_OF_MONTH', 'EMPLOYEE_OF_QUARTER', 'EMPLOYEE_OF_YEAR'].includes(type) ? 'nominate' : 'award';
    const payload: any = { action: actionName, recipientId, message, category, isPublic };
    if (!isKudos) payload.type = type;
    if (awardType) payload.award = { type: awardType, value: awardValue ? Number(awardValue) : 0, description: awardDesc || `${TYPE_LABELS[type]} Award` };
    submitMutation.mutate(payload);
  };

  const quickMessages = [
    'Thank you for your excellent work on this project!',
    'Your positive attitude makes a real difference to the team.',
    'Great job going above and beyond to help a colleague.',
    'Your innovative thinking solved a complex problem.',
    'Thank you for stepping up during a challenging time.',
  ];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color={C.gold} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('منح تقدير', 'Give Recognition')}</span>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CVisionSelect C={C} label={tr('المستلم *', 'Recipient *')} value={recipientId || undefined} onChange={setRecipientId} options={employees.map(e => ({ value: e.employeeId || e._id, label: e.fullName || e.name }))} />
              <CVisionSelect C={C} label={tr('النوع', 'Type')} value={type} onChange={setType} options={Object.entries(TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
            </div>
            <CVisionSelect C={C} label={tr('الفئة', 'Category')} value={category} onChange={setCategory} options={Object.entries(CAT_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
            <div>
              <CVisionTextarea C={C} label={tr('الرسالة *', 'Message *')} value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder={tr('اكتب رسالة التقدير...', 'Write your recognition message...')} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {quickMessages.map((m, i) => (
                  <button key={i} onClick={() => setMessage(m)} style={{ fontSize: 11, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '3px 10px', cursor: 'pointer', color: C.textMuted }}>{m.slice(0, 40)}...</button>
                ))}
              </div>
            </div>

            {type !== 'KUDOS' && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>{tr('تفاصيل الجائزة (اختياري)', 'Award Details (optional)')}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <CVisionSelect C={C} label={tr('نوع الجائزة', 'Award Type')} value={awardType || undefined} onChange={setAwardType} options={[{ value: 'CERTIFICATE', label: tr('شهادة', 'Certificate') }, { value: 'GIFT_CARD', label: tr('بطاقة هدية', 'Gift Card') }, { value: 'BONUS', label: tr('مكافأة', 'Bonus') }, { value: 'EXTRA_LEAVE', label: tr('إجازة إضافية', 'Extra Leave') }, { value: 'TROPHY', label: tr('كأس', 'Trophy') }]} />
                  {awardType && ['GIFT_CARD', 'BONUS'].includes(awardType) && (
                    <CVisionInput C={C} label={tr('القيمة (ريال)', 'Value (SAR)')} type="number" value={awardValue} onChange={e => setAwardValue(e.target.value)} />
                  )}
                  {awardType && <CVisionInput C={C} label={tr('الوصف', 'Description')} value={awardDesc} onChange={e => setAwardDesc(e.target.value)} />}
                </div>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSecondary, cursor: 'pointer' }}>
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} style={{ accentColor: C.gold }} />
              {tr('عرض على جدار التقدير', 'Show on recognition wall')}
            </label>

            <CVisionButton C={C} isDark={isDark} variant="primary" onClick={submit} disabled={submitting || !recipientId || !message} style={{ width: '100%' }}>
              {submitting && <RefreshCcw size={14} style={{ marginRight: 6 }} />}
              <Send size={14} style={{ marginRight: 6 }} />
              {type === 'KUDOS' ? tr('إرسال التقدير', 'Send Kudos') : ['EMPLOYEE_OF_MONTH', 'EMPLOYEE_OF_QUARTER', 'EMPLOYEE_OF_YEAR'].includes(type) ? tr('تقديم الترشيح', 'Submit Nomination') : tr('منح الجائزة', 'Give Award')}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// ===============================================================
// LEADERBOARD TAB
// ===============================================================
function LeaderboardTab({ C, isDark, tr, isRTL }: ThemeProps) {
  const { data: lbRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.recognition.list({ action: 'leaderboard', limit: '20' }),
    queryFn: () => cvisionFetch<any>(API, { params: { action: 'leaderboard', limit: '20' } }),
  });
  const leaderboard = lbRaw?.leaderboard || [];

  if (loading) return <CVisionSkeletonCard C={C} height={200} />;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {leaderboard.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {[1, 0, 2].map(idx => {
            const p = leaderboard[idx];
            if (!p) return null;
            const isFirst = idx === 0;
            return (
              <CVisionCard key={p.employeeId} C={C} style={isFirst ? { border: `1px solid ${C.gold}40`, marginTop: -16 } : undefined}>
                <CVisionCardBody style={{ padding: '24px 16px', textAlign: 'center' }}>
                  <div style={{ margin: '0 auto', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, background: isFirst ? `${C.gold}30` : C.bgCard, color: isFirst ? C.gold : C.textMuted }}>
                    {p.rank === 1 ? <Crown size={32} color={C.gold} /> : p.rank}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 12, color: C.text }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{p.department}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8, color: isFirst ? C.gold : C.blue }}>{p.totalEarned} {tr('نقاط', 'pts')}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{tr('الرصيد:', 'Balance:')} {p.currentBalance}</div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
        </div>
      )}

      <CVisionCard C={C}>
        <CVisionCardBody style={{ padding: 0 }}>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C} style={{ width: 48 }}>#</CVisionTh>
              <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
              <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('النقاط المكتسبة', 'Points Earned')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('الرصيد', 'Balance')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {leaderboard.map(p => (
                <CVisionTr key={p.employeeId} C={C}>
                  <CVisionTd style={{ fontWeight: 700, color: C.text }}>
                    {p.rank <= 3 ? <Medal size={18} color={p.rank === 1 ? C.gold : p.rank === 2 ? C.textMuted : C.orange} /> : p.rank}
                  </CVisionTd>
                  <CVisionTd style={{ fontWeight: 500, color: C.text }}>{p.name}</CVisionTd>
                  <CVisionTd style={{ color: C.textMuted }}>{p.department}</CVisionTd>
                  <CVisionTd align="right" style={{ fontWeight: 600, color: C.text }}>{p.totalEarned}</CVisionTd>
                  <CVisionTd align="right" style={{ color: C.textSecondary }}>{p.currentBalance}</CVisionTd>
                </CVisionTr>
              ))}
              {leaderboard.length === 0 && (
                <CVisionTr C={C}><CVisionTd colSpan={5} style={{ textAlign: 'center', color: C.textMuted, padding: 32 }}>{tr('لا توجد بيانات بعد', 'No data yet')}</CVisionTd></CVisionTr>
              )}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// ===============================================================
// MY POINTS TAB
// ===============================================================
function MyPointsTab({ C, isDark, tr, isRTL }: ThemeProps) {
  const queryClient = useQueryClient();
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<any>(null);

  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => cvisionFetch('/api/auth/me'),
  });
  const empId = meData?.user?.employeeId || meData?.employeeId || 'EMP-001';

  const { data: balanceRaw, isLoading: loadingBalance } = useQuery({
    queryKey: cvisionKeys.recognition.pointsBalance(empId),
    queryFn: () => cvisionFetch(`${API}?action=points-balance&employeeId=${empId}`),
    enabled: !!empId,
  });
  const balance = balanceRaw?.balance || null;

  const { data: catalogRaw, isLoading: loadingCatalog } = useQuery({
    queryKey: cvisionKeys.recognition.redemptionCatalog(),
    queryFn: () => cvisionFetch(`${API}?action=redemption-catalog`),
  });
  const catalog = catalogRaw?.catalog || [];

  const loading = loadingBalance || loadingCatalog;

  const redeemMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate(API, 'POST', payload),
    onSuccess: (d: any) => {
      if (d.success) {
        toast.success(tr('تم الاسترداد', `Redeemed: ${d.redeemed}`));
        setRedeemOpen(false);
        queryClient.invalidateQueries({ queryKey: cvisionKeys.recognition.pointsBalance(empId) });
      } else toast.error(d.error || tr('فشل', 'Failed'));
    },
    onError: () => toast.error(tr('خطأ', 'Error')),
  });

  const handleRedeem = () => {
    if (!selectedReward || !empId) return;
    redeemMutation.mutate({ action: 'redeem-points', employeeId: empId, rewardId: selectedReward.id });
  };

  if (loading) return <CVisionSkeletonCard C={C} height={200} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('النقاط المتاحة', 'Available Points')} value={balance?.currentBalance || 0} icon={Trophy} color={C.gold} colorDim={C.goldDim} />
        <CVisionMiniStat C={C} label={tr('إجمالي المكتسب', 'Total Earned')} value={balance?.totalEarned || 0} icon={TrendingUp} color={C.green} colorDim={C.greenDim} />
        <CVisionMiniStat C={C} label={tr('إجمالي المسترد', 'Total Redeemed')} value={balance?.totalRedeemed || 0} icon={ShoppingBag} color={C.blue} colorDim={C.blueDim} />
      </CVisionStatsRow>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Gift size={16} color={C.gold} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('كتالوج المكافآت', 'Rewards Catalog')}</span>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {catalog.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{item.category}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CVisionBadge C={C} variant="muted">{item.points} {tr('نقاط', 'pts')}</CVisionBadge>
                    <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" disabled={(balance?.currentBalance || 0) < item.points} onClick={() => { setSelectedReward(item); setRedeemOpen(true); }}>{tr('استرداد', 'Redeem')}</CVisionButton>
                  </div>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={16} color={C.textMuted} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('سجل النقاط', 'Points History')}</span>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
              {(balance?.history || []).map((h: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{h.description}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(h.date)}</div>
                  </div>
                  <CVisionBadge C={C} variant={h.type === 'EARNED' ? 'success' : 'danger'}>
                    {h.type === 'EARNED' ? '+' : '-'}{h.points}
                  </CVisionBadge>
                </div>
              ))}
              {(!balance?.history || balance.history.length === 0) && <div style={{ textAlign: 'center', color: C.textMuted, padding: 16, fontSize: 13 }}>{tr('لا يوجد سجل بعد', 'No history yet')}</div>}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      <CVisionDialog C={C} open={redeemOpen} onClose={() => setRedeemOpen(false)} title={tr('استرداد المكافأة', 'Redeem Reward')} titleAr="استرداد المكافأة" isRTL={isRTL}>
        {selectedReward && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ textAlign: 'center', padding: 16, border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{selectedReward.name}</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>{selectedReward.category}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.gold, marginTop: 8 }}>{selectedReward.points} {tr('نقاط', 'points')}</div>
            </div>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              {tr('الرصيد الحالي:', 'Current balance:')} <strong style={{ color: C.text }}>{balance?.currentBalance || 0}</strong> → {tr('بعد:', 'After:')} <strong style={{ color: C.text }}>{(balance?.currentBalance || 0) - selectedReward.points}</strong>
            </div>
          </div>
        )}
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setRedeemOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleRedeem}>{tr('تأكيد الاسترداد', 'Confirm Redemption')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ===============================================================
// AWARDS TAB
// ===============================================================
function AwardsTab({ C, isDark, tr, isRTL }: ThemeProps) {
  const { data: feedRaw, isLoading: loading, refetch: load } = useQuery({
    queryKey: cvisionKeys.recognition.list({ action: 'feed-awards', limit: '50' }),
    queryFn: () => cvisionFetch<any>(API, { params: { action: 'feed', limit: '50' } }),
  });
  const allAwards = feedRaw?.recognitions || [];
  const pending = allAwards.filter((r: any) => r.status === 'PENDING_APPROVAL');
  const recent = allAwards.filter((r: any) => r.type !== 'KUDOS' && r.status === 'ACTIVE').slice(0, 20);

  const approveMutation = useMutation({
    mutationFn: (recognitionId: string) => cvisionMutate(API, 'POST', { action: 'approve-award', recognitionId }),
    onSuccess: (d: any) => {
      if (d.success) { toast.success(tr('تمت الموافقة على الجائزة!', 'Award approved!')); load(); } else toast.error(d.error || tr('فشل', 'Failed'));
    },
    onError: () => toast.error(tr('خطأ', 'Error')),
  });

  const handleApprove = async (recognitionId: string) => { approveMutation.mutate(recognitionId); };

  const rejectMutation = useMutation({
    mutationFn: (recognitionId: string) => cvisionMutate(API, 'POST', { action: 'reject-award', recognitionId, reason: 'Budget constraints' }),
    onSuccess: (d: any) => {
      if (d.success) { toast.success(tr('تم رفض الجائزة', 'Award rejected')); load(); } else toast.error(d.error || tr('فشل', 'Failed'));
    },
    onError: () => toast.error(tr('خطأ', 'Error')),
  });

  const handleReject = async (recognitionId: string) => { rejectMutation.mutate(recognitionId);
  };

  if (loading) return <CVisionSkeletonCard C={C} height={200} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('في انتظار الموافقة', 'Pending Approvals')} ({pending.length})</span>
        </CVisionCardHeader>
        <CVisionCardBody>
          {pending.length === 0 ? <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 16 }}>{tr('لا توجد جوائز معلقة', 'No pending awards')}</p> : (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                <CVisionTh C={C}>{tr('المرشح', 'Nominee')}</CVisionTh>
                <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
                <CVisionTh C={C}>{tr('المرشح من', 'Nominated By')}</CVisionTh>
                <CVisionTh C={C}>{tr('النقاط', 'Points')}</CVisionTh>
                <CVisionTh C={C}>{tr('التاريخ', 'Date')}</CVisionTh>
                <CVisionTh C={C}></CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {pending.map(r => (
                  <CVisionTr key={r.recognitionId} C={C}>
                    <CVisionTd>
                      <div style={{ fontWeight: 500, color: C.text }}>{r.recipientName}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{r.recipientDepartment}</div>
                    </CVisionTd>
                    <CVisionTd><CVisionBadge C={C} variant="muted">{TYPE_LABELS[r.type] || r.type}</CVisionBadge></CVisionTd>
                    <CVisionTd style={{ fontSize: 13, color: C.textSecondary }}>{r.giverName}</CVisionTd>
                    <CVisionTd style={{ fontWeight: 600, color: C.text }}>{r.pointsAwarded}</CVisionTd>
                    <CVisionTd style={{ fontSize: 13, color: C.textSecondary }}>{fmtDate(r.createdAt)}</CVisionTd>
                    <CVisionTd>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<Check size={12} />} onClick={() => handleApprove(r.recognitionId)}>{tr('موافقة', 'Approve')}</CVisionButton>
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => handleReject(r.recognitionId)}><X size={12} /></CVisionButton>
                      </div>
                    </CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          )}
        </CVisionCardBody>
      </CVisionCard>

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('الجوائز الأخيرة', 'Recent Awards')}</span>
        </CVisionCardHeader>
        <CVisionCardBody>
          {recent.length === 0 ? <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 16 }}>{tr('لا توجد جوائز حديثة', 'No recent awards')}</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recent.map(r => {
                const Icon = TYPE_ICONS[r.type] || Award;
                return (
                  <div key={r.recognitionId} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${C.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={C.gold} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{r.recipientName}</span>
                        <CVisionBadge C={C} variant="muted">{TYPE_LABELS[r.type]}</CVisionBadge>
                        <CVisionBadge C={C} variant="info">+{r.pointsAwarded} {tr('نقاط', 'pts')}</CVisionBadge>
                      </div>
                      <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message}</p>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{tr('من', 'by')} {r.giverName} · {timeAgo(r.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// ===============================================================
// ANALYTICS TAB
// ===============================================================
function AnalyticsTab({ C, isDark, tr, isRTL }: ThemeProps) {
  const { data: analyticsRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.recognition.analytics(),
    queryFn: () => cvisionFetch(`${API}?action=analytics`),
  });
  const analytics = analyticsRaw?.analytics || null;

  if (loading) return <CVisionSkeletonCard C={C} height={200} />;
  if (!analytics) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('إجمالي التقديرات', 'Total Recognitions')} value={analytics.totalRecognitions} icon={Award} color={C.blue} colorDim={C.blueDim} />
        <CVisionMiniStat C={C} label={tr('هذا الشهر', 'This Month')} value={analytics.thisMonthRecognitions} icon={TrendingUp} color={C.green} colorDim={C.greenDim} />
        <CVisionMiniStat C={C} label={tr('النقاط المكتسبة', 'Points Earned')} value={analytics.totalPointsEarned} icon={Star} color={C.gold} colorDim={C.goldDim} />
        <CVisionMiniStat C={C} label={tr('النقاط المستردة', 'Points Redeemed')} value={analytics.totalPointsRedeemed} icon={ShoppingBag} color={C.blue} colorDim={C.blueDim} />
        <CVisionMiniStat C={C} label={tr('الرصيد النشط', 'Active Balance')} value={analytics.totalPointsBalance} icon={Trophy} color={C.purple} colorDim={C.purpleDim} />
      </CVisionStatsRow>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('حسب النوع', 'By Type')}</span></CVisionCardHeader>
          <CVisionCardBody>
            {(analytics.byType || []).map((t: any) => (
              <div key={t.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.text }}>{t.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CVisionBadge C={C} variant="info">{t.count}</CVisionBadge>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{t.points} {tr('نقاط', 'pts')}</span>
                </div>
              </div>
            ))}
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('حسب الفئة', 'By Category')}</span></CVisionCardHeader>
          <CVisionCardBody>
            {(analytics.byCategory || []).map((c: any) => (
              <div key={c.category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.text }}>{c.label}</span>
                <CVisionBadge C={C} variant="info">{c.count}</CVisionBadge>
              </div>
            ))}
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('حسب القسم', 'By Department')}</span></CVisionCardHeader>
          <CVisionCardBody>
            {(analytics.byDepartment || []).map((d: any) => (
              <div key={d.department} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.text }}>{d.department}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CVisionBadge C={C} variant="info">{d.count}</CVisionBadge>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{d.points} {tr('نقاط', 'pts')}</span>
                </div>
              </div>
            ))}
          </CVisionCardBody>
        </CVisionCard>
      </div>
    </div>
  );
}

// ===============================================================
// MAIN PAGE
// ===============================================================
export default function RecognitionPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [activeTab, setActiveTab] = useState('wall');

  const props: ThemeProps = { C, isDark, tr, isRTL };

  const tabs = [
    { id: 'wall', label: 'Wall', labelAr: 'الجدار', icon: <Heart size={14} /> },
    { id: 'give', label: 'Give', labelAr: 'تقدير', icon: <Send size={14} /> },
    { id: 'leaderboard', label: 'Leaderboard', labelAr: 'المتصدرين', icon: <Crown size={14} /> },
    { id: 'points', label: 'My Points', labelAr: 'نقاطي', icon: <Star size={14} /> },
    { id: 'awards', label: 'Awards', labelAr: 'الجوائز', icon: <Award size={14} /> },
    { id: 'analytics', label: 'Analytics', labelAr: 'التحليلات', icon: <BarChart3 size={14} /> },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('المكافآت والتقدير', 'Rewards & Recognition')} titleEn="Rewards & Recognition" icon={Trophy} isRTL={isRTL} />
      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />
      <CVisionTabContent id="wall" activeTab={activeTab}><WallTab {...props} /></CVisionTabContent>
      <CVisionTabContent id="give" activeTab={activeTab}><GiveTab {...props} /></CVisionTabContent>
      <CVisionTabContent id="leaderboard" activeTab={activeTab}><LeaderboardTab {...props} /></CVisionTabContent>
      <CVisionTabContent id="points" activeTab={activeTab}><MyPointsTab {...props} /></CVisionTabContent>
      <CVisionTabContent id="awards" activeTab={activeTab}><AwardsTab {...props} /></CVisionTabContent>
      <CVisionTabContent id="analytics" activeTab={activeTab}><AnalyticsTab {...props} /></CVisionTabContent>
    </CVisionPageLayout>
  );
}
