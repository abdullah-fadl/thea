'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';

import {
  CreditCard, DollarSign, Plus, Search, Lock, Unlock, XCircle,
  RefreshCw, Upload, Wallet, ArrowUpRight, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

const API = '/api/cvision/paycards';

function fmtSAR(n: number, lang: string = 'en') {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: any, lang: string = 'en') {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  BLOCKED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-gray-100 text-gray-500',
};
const SOURCE_COLORS: Record<string, string> = {
  PAYROLL: 'bg-blue-100 text-blue-700',
  MANUAL: 'bg-yellow-100 text-yellow-700',
  ADVANCE: 'bg-purple-100 text-purple-700',
};

// =====================================================================
// ALL CARDS TAB
// =====================================================================
function AllCardsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const PROVIDER_LABELS: Record<string, string> = {
    PAYIT: 'PayIT', STCPAY: 'STC Pay', MADA: tr('مدى', 'Mada'), CUSTOM: tr('مخصص', 'Custom'),
  };
  const STATUS_LABELS: Record<string, string> = {
    ACTIVE: tr('نشط', 'Active'),
    BLOCKED: tr('محظور', 'Blocked'),
    EXPIRED: tr('منتهي', 'Expired'),
    CANCELLED: tr('ملغي', 'Cancelled'),
  };

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  // Dialogs
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ employeeId: '', employeeName: '', provider: '' });
  const [issueSubmitting, setIssueSubmitting] = useState(false);

  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: string; card: any }>({ open: false, action: '', card: null });
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [loadFundsDialog, setLoadFundsDialog] = useState<{ open: boolean; card: any }>({ open: false, card: null });
  const [loadAmount, setLoadAmount] = useState('');
  const [loadSource, setLoadSource] = useState('');
  const [loadReference, setLoadReference] = useState('');
  const [loadSubmitting, setLoadSubmitting] = useState(false);

  const cardFilters: Record<string, any> = { action: 'list' };
  if (statusFilter) cardFilters.status = statusFilter;
  if (providerFilter) cardFilters.provider = providerFilter;

  const { data: cardsRaw, isLoading: cardsLoading, refetch: refetchCards } = useQuery({
    queryKey: cvisionKeys.paycards.list(cardFilters),
    queryFn: () => cvisionFetch(API, { params: cardFilters }),
  });
  useEffect(() => { setLoading(cardsLoading); }, [cardsLoading]);
  useEffect(() => { if (cardsRaw?.data) { setCards(cardsRaw.data.items || []); setTotal(cardsRaw.data.total || 0); } }, [cardsRaw]);

  const { data: statsData, isLoading: statsQueryLoading, refetch: refetchStats } = useQuery({
    queryKey: cvisionKeys.paycards.list({ action: 'stats' }),
    queryFn: () => cvisionFetch(API, { params: { action: 'stats' } }),
  });
  useEffect(() => { setStatsLoading(statsQueryLoading); }, [statsQueryLoading]);
  useEffect(() => { if (statsData) setStats(statsData); }, [statsData]);

  const loadCards = useCallback(() => refetchCards(), [refetchCards]);
  const loadStats = useCallback(() => refetchStats(), [refetchStats]);

  const handleIssue = async () => {
    if (!issueForm.employeeId || !issueForm.employeeName || !issueForm.provider) {
      toast.error(tr('جميع الحقول مطلوبة', 'All fields are required'));
      return;
    }
    setIssueSubmitting(true);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'issue', ...issueForm }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(tr('تم إصدار البطاقة بنجاح', 'Card issued successfully'));
        setIssueOpen(false);
        setIssueForm({ employeeId: '', employeeName: '', provider: '' });
        loadCards();
        loadStats();
      } else {
        toast.error(d.error || tr('فشل إصدار البطاقة', 'Failed to issue card'));
      }
    } catch { toast.error(tr('خطأ في إصدار البطاقة', 'Error issuing card')); } finally { setIssueSubmitting(false); }
  };

  const handleCardAction = async () => {
    if (!actionDialog.card) return;
    setActionSubmitting(true);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionDialog.action, cardId: actionDialog.card.cardId || actionDialog.card._id }),
      });
      const d = await r.json();
      if (d.success) {
        const actionMessages: Record<string, string> = {
          block: tr('تم حظر البطاقة بنجاح', 'Card block successful'),
          unblock: tr('تم إلغاء حظر البطاقة بنجاح', 'Card unblock successful'),
          cancel: tr('تم إلغاء البطاقة بنجاح', 'Card cancel successful'),
          replace: tr('تم استبدال البطاقة بنجاح', 'Card replace successful'),
        };
        toast.success(actionMessages[actionDialog.action] || tr('تمت العملية بنجاح', 'Action successful'));
        setActionDialog({ open: false, action: '', card: null });
        loadCards();
        loadStats();
      } else {
        const failMessages: Record<string, string> = {
          block: tr('فشل حظر البطاقة', 'Failed to block card'),
          unblock: tr('فشل إلغاء حظر البطاقة', 'Failed to unblock card'),
          cancel: tr('فشل إلغاء البطاقة', 'Failed to cancel card'),
          replace: tr('فشل استبدال البطاقة', 'Failed to replace card'),
        };
        toast.error(d.error || failMessages[actionDialog.action] || tr('فشل تنفيذ الإجراء', 'Failed to perform action'));
      }
    } catch { toast.error(tr('خطأ في تنفيذ الإجراء', 'Error performing action')); } finally { setActionSubmitting(false); }
  };

  const handleQuickLoad = async () => {
    if (!loadFundsDialog.card || !loadAmount || !loadSource) {
      toast.error(tr('المبلغ والمصدر مطلوبان', 'Amount and source are required'));
      return;
    }
    setLoadSubmitting(true);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'load-funds',
          cardId: loadFundsDialog.card.cardId || loadFundsDialog.card._id,
          amount: parseFloat(loadAmount),
          source: loadSource,
          reference: loadReference,
        }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(tr('تم تحميل الرصيد بنجاح', 'Funds loaded successfully'));
        setLoadFundsDialog({ open: false, card: null });
        setLoadAmount('');
        setLoadSource('');
        setLoadReference('');
        loadCards();
        loadStats();
      } else {
        toast.error(d.error || tr('فشل تحميل الرصيد', 'Failed to load funds'));
      }
    } catch { toast.error(tr('خطأ في تحميل الرصيد', 'Error loading funds')); } finally { setLoadSubmitting(false); }
  };

  const openAction = (action: string, card: any) => {
    setActionDialog({ open: true, action, card });
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case 'block': return tr('حظر البطاقة', 'Block Card');
      case 'unblock': return tr('إلغاء الحظر', 'Unblock Card');
      case 'cancel': return tr('إلغاء البطاقة', 'Cancel Card');
      case 'replace': return tr('استبدال البطاقة', 'Replace Card');
      default: return action;
    }
  };

  const actionDescription = (action: string, card: any) => {
    const name = card?.employeeName || tr('هذا الموظف', 'this employee');
    switch (action) {
      case 'block': return tr(
        `هل أنت متأكد من حظر بطاقة ${name}؟ سيتم تعطيل البطاقة مؤقتًا.`,
        `Are you sure you want to block the card for ${name}? The card will be temporarily disabled.`
      );
      case 'unblock': return tr(
        `هل أنت متأكد من إلغاء حظر بطاقة ${name}؟ سيتم إعادة تفعيل البطاقة.`,
        `Are you sure you want to unblock the card for ${name}? The card will be reactivated.`
      );
      case 'cancel': return tr(
        `هل أنت متأكد من إلغاء بطاقة ${name}؟ لا يمكن التراجع عن هذا الإجراء.`,
        `Are you sure you want to cancel the card for ${name}? This action cannot be undone.`
      );
      case 'replace': return tr(
        `هل أنت متأكد من استبدال بطاقة ${name}؟ سيتم إصدار بطاقة جديدة وإلغاء الحالية.`,
        `Are you sure you want to replace the card for ${name}? A new card will be issued and the current one will be deactivated.`
      );
      default: return tr('هل أنت متأكد من تنفيذ هذا الإجراء؟', 'Are you sure you want to perform this action?');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stats Cards */}
      {statsLoading ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {[...Array(6)].map((_, i) => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 96 }}  />)}
        </div>
      ) : stats ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <CreditCard style={{ height: 32, width: 32, color: C.blue }} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.totalCards ?? 0}</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي البطاقات', 'Total Cards')}</div>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <CreditCard style={{ height: 32, width: 32, color: C.green }} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{stats.activeCards ?? 0}</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>{tr('البطاقات النشطة', 'Active Cards')}</div>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ShieldAlert style={{ height: 32, width: 32, color: C.red }} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{stats.blockedCards ?? 0}</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>{tr('البطاقات المحظورة', 'Blocked Cards')}</div>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Wallet style={{ height: 32, width: 32, color: C.purple }} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtSAR(stats.totalBalance ?? 0, language)}</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي الرصيد', 'Total Balance')}</div>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ArrowUpRight style={{ height: 32, width: 32 }} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtSAR(stats.totalLoaded ?? 0, language)}</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي التحميل', 'Total Loaded')}</div>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <DollarSign style={{ height: 32, width: 32, color: C.orange }} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtSAR(stats.avgBalance ?? 0, language)}</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>{tr('متوسط الرصيد', 'Avg Balance')}</div>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </div>
      ) : null}

      {/* Filters + Issue Button */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CVisionSelect
                C={C}
                value={statusFilter || undefined}
                placeholder={tr('جميع الحالات', 'All Statuses')}
                options={[
                  { value: 'ALL', label: tr('جميع الحالات', 'All Statuses') },
                  { value: 'ACTIVE', label: tr('نشط', 'Active') },
                  { value: 'BLOCKED', label: tr('محظور', 'Blocked') },
                  { value: 'EXPIRED', label: tr('منتهي', 'Expired') },
                  { value: 'CANCELLED', label: tr('ملغي', 'Cancelled') },
                ]}
                style={{ width: 160 }}
              />
          <CVisionSelect
                C={C}
                value={providerFilter || undefined}
                placeholder={tr('جميع المزوّدين', 'All Providers')}
                options={[
                  { value: 'ALL', label: tr('جميع المزوّدين', 'All Providers') },
                  ...Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                ({ value: k, label: v })
              )),
                ]}
                style={{ width: 160 }}
              />
          <CVisionBadge C={C} variant="outline">{total} {tr('بطاقة', total !== 1 ? 'cards' : 'card')}</CVisionBadge>
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={() => { setIssueForm({ employeeId: '', employeeName: '', provider: '' }); setIssueOpen(true); }}>
          <Plus style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('إصدار بطاقة جديدة', 'Issue New Card')}
        </CVisionButton>
      </div>

      {/* Cards Table */}
      {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  /> : (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 16 }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('اسم الموظف', 'Employee Name')}</CVisionTh>
                  <CVisionTh C={C}>{tr('رقم الموظف', 'Employee ID')}</CVisionTh>
                  <CVisionTh C={C}>{tr('المزوّد', 'Provider')}</CVisionTh>
                  <CVisionTh C={C}>{tr('رقم البطاقة', 'Card Number')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  <CVisionTh C={C} style={{ textAlign: isRTL ? 'left' : 'right' }}>{tr('الرصيد (ر.س)', 'Balance (SAR)')}</CVisionTh>
                  <CVisionTh C={C}>{tr('تاريخ آخر تحميل', 'Last Load Date')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الإجراءات', 'Actions')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {cards.map((card, idx) => (
                  <CVisionTr C={C} key={card.cardId || card._id || idx}>
                    <CVisionTd style={{ fontWeight: 500 }}>{card.employeeName}</CVisionTd>
                    <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{card.employeeId}</CVisionTd>
                    <CVisionTd>
                      <CVisionBadge C={C} variant="outline">{PROVIDER_LABELS[card.provider] || card.provider}</CVisionBadge>
                    </CVisionTd>
                    <CVisionTd style={{ fontFamily: 'monospace', fontSize: 13 }}>{card.cardNumberMasked || card.cardNumber || '\u2014'}</CVisionTd>
                    <CVisionTd>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[card.status] || 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABELS[card.status] || card.status}
                      </span>
                    </CVisionTd>
                    <CVisionTd align="right" style={{ textAlign: isRTL ? 'left' : 'right', fontWeight: 500 }}>{fmtSAR(card.balance ?? 0, language)}</CVisionTd>
                    <CVisionTd style={{ fontSize: 13 }}>{fmtDate(card.lastLoadDate, language)}</CVisionTd>
                    <CVisionTd>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" title={tr('تحميل رصيد', 'Load Funds')} onClick={() => {
                          setLoadFundsDialog({ open: true, card });
                          setLoadAmount('');
                          setLoadSource('');
                          setLoadReference('');
                        }}>
                          <DollarSign style={{ height: 14, width: 14 }} />
                        </CVisionButton>
                        {card.status === 'ACTIVE' && (
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" title={tr('حظر', 'Block')} onClick={() => openAction('block', card)}>
                            <Lock style={{ height: 14, width: 14 }} />
                          </CVisionButton>
                        )}
                        {card.status === 'BLOCKED' && (
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" title={tr('إلغاء الحظر', 'Unblock')} onClick={() => openAction('unblock', card)}>
                            <Unlock style={{ height: 14, width: 14 }} />
                          </CVisionButton>
                        )}
                        {card.status !== 'CANCELLED' && (
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" title={tr('إلغاء', 'Cancel')} onClick={() => openAction('cancel', card)}>
                            <XCircle style={{ height: 14, width: 14 }} />
                          </CVisionButton>
                        )}
                        {card.status !== 'CANCELLED' && (
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" title={tr('استبدال', 'Replace')} onClick={() => openAction('replace', card)}>
                            <RefreshCw style={{ height: 14, width: 14 }} />
                          </CVisionButton>
                        )}
                      </div>
                    </CVisionTd>
                  </CVisionTr>
                ))}
                {cards.length === 0 && (
                  <CVisionTr C={C}>
                    <CVisionTd align="center" colSpan={8} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>{tr('لم يتم العثور على بطاقات.', 'No cards found.')}</CVisionTd>
                  </CVisionTr>
                )}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Issue New Card Dialog */}
      <CVisionDialog C={C} open={issueOpen} onClose={() => setIssueOpen(false)} title={tr("إصدار بطاقة رواتب", "Issue Paycard")} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('إصدار بطاقة دفع مسبقة جديدة لموظف.', 'Issue a new prepaid paycard to an employee.')}</p>          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C}>{tr('رقم الموظف', 'Employee ID')}</CVisionLabel>
              <CVisionInput C={C}
                value={issueForm.employeeId}
                onChange={e => setIssueForm(p => ({ ...p, employeeId: e.target.value }))}
                placeholder={tr('أدخل رقم الموظف', 'Enter employee ID')}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C}>{tr('اسم الموظف', 'Employee Name')}</CVisionLabel>
              <CVisionInput C={C}
                value={issueForm.employeeName}
                onChange={e => setIssueForm(p => ({ ...p, employeeName: e.target.value }))}
                placeholder={tr('أدخل اسم الموظف', 'Enter employee name')}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C}>{tr('المزوّد', 'Provider')}</CVisionLabel>
              <CVisionSelect
                C={C}
                value={issueForm.provider || undefined}
                placeholder={tr('اختر المزوّد', 'Select provider')}
                options={[
                  { value: 'PAYIT', label: 'PayIT' },
                  { value: 'STCPAY', label: 'STC Pay' },
                  { value: 'MADA', label: tr('مدى', 'Mada') },
                  { value: 'CUSTOM', label: tr('مخصص', 'Custom') },
                ]}
              />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setIssueOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleIssue} disabled={issueSubmitting || !issueForm.employeeId || !issueForm.employeeName || !issueForm.provider}>
              {issueSubmitting && <RefreshCw style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} />}
              <Plus style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('إصدار بطاقة', 'Issue Card')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* Card Action Confirmation Dialog */}
      <CVisionDialog C={C} open={actionDialog.open} onClose={() => setActionDialog({ open: false, action: "", card: null })} title={tr("تأكيد الإجراء", "Confirm Action")} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{actionDescription(actionDialog.action, actionDialog.card)}</p>          <div style={{ overflowY: 'auto' }}>
            {actionDialog.card && (
              <div style={{ padding: 12, borderRadius: 12, background: C.bgSubtle, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><span style={{ color: C.textMuted }}>{tr('الموظف:', 'Employee:')}</span> {actionDialog.card.employeeName}</div>
                <div><span style={{ color: C.textMuted }}>{tr('البطاقة:', 'Card:')}</span> {actionDialog.card.cardNumberMasked || actionDialog.card.cardNumber || '\u2014'}</div>
                <div><span style={{ color: C.textMuted }}>{tr('المزوّد:', 'Provider:')}</span> {PROVIDER_LABELS[actionDialog.card.provider] || actionDialog.card.provider}</div>
                <div><span style={{ color: C.textMuted }}>{tr('الرصيد:', 'Balance:')}</span> {fmtSAR(actionDialog.card.balance ?? 0, language)}</div>
              </div>
            )}
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setActionDialog({ open: false, action: '', card: null })}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark}
              variant={actionDialog.action === 'cancel' || actionDialog.action === 'block' ? 'destructive' : 'default'}
              onClick={handleCardAction}
              disabled={actionSubmitting}
            >
              {actionSubmitting && <RefreshCw style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} />}
              {actionLabel(actionDialog.action)}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* Quick Load Funds Dialog */}
      <CVisionDialog C={C} open={loadFundsDialog.open} onClose={() => setLoadFundsDialog({ open: false, card: null })} title={tr("تحميل رصيد", "Load Funds")} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {tr(
                `تحميل رصيد على بطاقة ${loadFundsDialog.card?.employeeName || 'الموظف'}.`,
                `Load funds onto the card for ${loadFundsDialog.card?.employeeName || 'employee'}.`
              )}
            </p>          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loadFundsDialog.card && (
              <div style={{ padding: 12, borderRadius: 12, background: C.bgSubtle, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><span style={{ color: C.textMuted }}>{tr('الموظف:', 'Employee:')}</span> {loadFundsDialog.card.employeeName}</div>
                <div><span style={{ color: C.textMuted }}>{tr('البطاقة:', 'Card:')}</span> {loadFundsDialog.card.cardNumberMasked || loadFundsDialog.card.cardNumber || '\u2014'}</div>
                <div><span style={{ color: C.textMuted }}>{tr('الرصيد الحالي:', 'Current Balance:')}</span> {fmtSAR(loadFundsDialog.card.balance ?? 0, language)}</div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C}>{tr('المبلغ (ر.س)', 'Amount (SAR)')}</CVisionLabel>
              <CVisionInput C={C} type="number" value={loadAmount} onChange={e => setLoadAmount(e.target.value)} placeholder="0" min="1" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C}>{tr('المصدر', 'Source')}</CVisionLabel>
              <CVisionSelect
                C={C}
                value={loadSource || undefined}
                placeholder={tr('اختر المصدر', 'Select source')}
                options={[
                  { value: 'PAYROLL', label: tr('الرواتب', 'Payroll') },
                  { value: 'MANUAL', label: tr('يدوي', 'Manual') },
                  { value: 'ADVANCE', label: tr('سلفة', 'Advance') },
                ]}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C}>{tr('المرجع', 'Reference')}</CVisionLabel>
              <CVisionInput C={C} value={loadReference} onChange={e => setLoadReference(e.target.value)} placeholder={tr('رقم المرجع (اختياري)', 'Reference number (optional)')} />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setLoadFundsDialog({ open: false, card: null })}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleQuickLoad} disabled={loadSubmitting || !loadAmount || !loadSource}>
              {loadSubmitting && <RefreshCw style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} />}
              <DollarSign style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('تحميل رصيد', 'Load Funds')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// =====================================================================
// LOAD FUNDS TAB
// =====================================================================
function LoadFundsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [cardId, setCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [reference, setReference] = useState('');
  const [payrollMonth, setPayrollMonth] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCardId, setHistoryCardId] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const SOURCE_LABELS: Record<string, string> = {
    PAYROLL: tr('الرواتب', 'Payroll'),
    MANUAL: tr('يدوي', 'Manual'),
    ADVANCE: tr('سلفة', 'Advance'),
  };

  const loadHistory = useCallback(async (cId: string) => {
    if (!cId) { setHistory([]); return; }
    setHistoryLoading(true);
    try {
      const r = await fetch(`${API}?action=load-history&cardId=${encodeURIComponent(cId)}`, { credentials: 'include' });
      const d = await r.json();
      if (d.data) {
        setHistory(d.data.items || []);
      }
    } catch { /* ignore */ } finally { setHistoryLoading(false); }
  }, []);

  const handleSubmit = async () => {
    if (!cardId || !amount || !source) {
      toast.error(tr('رقم البطاقة والمبلغ والمصدر مطلوبة', 'Card ID, amount, and source are required'));
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'load-funds',
          cardId,
          amount: parseFloat(amount),
          source,
          reference,
          payrollMonth: payrollMonth || undefined,
        }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(tr('تم تحميل الرصيد بنجاح', 'Funds loaded successfully'));
        setAmount('');
        setReference('');
        setPayrollMonth('');
        // Refresh history if same card
        if (historyCardId === cardId) loadHistory(cardId);
      } else {
        toast.error(d.error || tr('فشل تحميل الرصيد', 'Failed to load funds'));
      }
    } catch { toast.error(tr('خطأ في تحميل الرصيد', 'Error loading funds')); } finally { setSubmitting(false); }
  };

  const handleSearchHistory = () => {
    setHistoryCardId(searchInput);
    loadHistory(searchInput);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Load Funds Form */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign style={{ height: 20, width: 20, color: C.green }} /> {tr('تحميل رصيد', 'Load Funds')}
          </div>
        </CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C}>{tr('رقم البطاقة / رقم الموظف', 'Card ID / Employee ID')}</CVisionLabel>
              <CVisionInput C={C} value={cardId} onChange={e => setCardId(e.target.value)} placeholder={tr('أدخل رقم البطاقة أو رقم الموظف', 'Enter card ID or employee ID')} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C}>{tr('المبلغ (ر.س)', 'Amount (SAR)')}</CVisionLabel>
              <CVisionInput C={C} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min="1" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C}>{tr('المصدر', 'Source')}</CVisionLabel>
              <CVisionSelect
                C={C}
                value={source || undefined}
                placeholder={tr('اختر المصدر', 'Select source')}
                options={[
                  { value: 'PAYROLL', label: tr('الرواتب', 'Payroll') },
                  { value: 'MANUAL', label: tr('يدوي', 'Manual') },
                  { value: 'ADVANCE', label: tr('سلفة', 'Advance') },
                ]}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C}>{tr('المرجع', 'Reference')}</CVisionLabel>
              <CVisionInput C={C} value={reference} onChange={e => setReference(e.target.value)} placeholder={tr('رقم المرجع', 'Reference number')} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CVisionLabel C={C}>{tr('شهر الرواتب (اختياري)', 'Payroll Month (optional)')}</CVisionLabel>
              <CVisionInput C={C} value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} placeholder={tr('مثال: 2026-02', 'e.g. 2026-02')} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <CVisionButton C={C} isDark={isDark} onClick={handleSubmit} disabled={submitting || !cardId || !amount || !source}>
              {submitting && <RefreshCw style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} />}
              <DollarSign style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('تحميل رصيد', 'Load Funds')}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Load History */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet style={{ height: 20, width: 20, color: C.blue }} /> {tr('سجل التحميل', 'Load History')}
          </div>
        </CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 384 }}>
              <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
              <CVisionInput C={C}
                style={{ paddingLeft: 32 }}
                placeholder={tr('أدخل رقم البطاقة لعرض السجل...', 'Enter card ID to view history...')}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearchHistory(); }}
              />
            </div>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={handleSearchHistory} disabled={!searchInput}>
              <Search style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('بحث', 'Search')}
            </CVisionButton>
          </div>

          {historyLoading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 128, width: '100%' }}  /> : historyCardId ? (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('التاريخ', 'Date')}</CVisionTh>
                  <CVisionTh C={C} style={{ textAlign: isRTL ? 'left' : 'right' }}>{tr('المبلغ (ر.س)', 'Amount (SAR)')}</CVisionTh>
                  <CVisionTh C={C}>{tr('المصدر', 'Source')}</CVisionTh>
                  <CVisionTh C={C}>{tr('المرجع', 'Reference')}</CVisionTh>
                  <CVisionTh C={C}>{tr('شهر الرواتب', 'Payroll Month')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {history.map((item, idx) => (
                  <CVisionTr C={C} key={item._id || idx}>
                    <CVisionTd style={{ fontSize: 13 }}>{fmtDate(item.date || item.createdAt, language)}</CVisionTd>
                    <CVisionTd align="right" style={{ textAlign: isRTL ? 'left' : 'right', fontWeight: 500 }}>{fmtSAR(item.amount ?? 0, language)}</CVisionTd>
                    <CVisionTd>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLORS[item.source] || 'bg-gray-100 text-gray-500'}`}>
                        {SOURCE_LABELS[item.source] || item.source}
                      </span>
                    </CVisionTd>
                    <CVisionTd style={{ fontSize: 13 }}>{item.reference || '\u2014'}</CVisionTd>
                    <CVisionTd style={{ fontSize: 13, fontFamily: 'monospace' }}>{item.payrollMonth || '\u2014'}</CVisionTd>
                  </CVisionTr>
                ))}
                {history.length === 0 && (
                  <CVisionTr C={C}>
                    <CVisionTd align="center" colSpan={5} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>{tr('لم يتم العثور على سجل تحميل لهذه البطاقة.', 'No load history found for this card.')}</CVisionTd>
                  </CVisionTr>
                )}
              </CVisionTableBody>
            </CVisionTable>
          ) : (
            <p style={{ color: C.textMuted, textAlign: 'center', paddingTop: 32, paddingBottom: 32, fontSize: 13 }}>{tr('أدخل رقم البطاقة أعلاه لعرض سجل التحميل.', 'Enter a card ID above to view load history.')}</p>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// =====================================================================
// BULK LOAD TAB
// =====================================================================
function BulkLoadTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [payrollMonth, setPayrollMonth] = useState('');
  const [rows, setRows] = useState<{ employeeId: string; amount: string }[]>([{ employeeId: '', amount: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ loaded: number; failed: number } | null>(null);

  const addRow = () => {
    setRows(prev => [...prev, { employeeId: '', amount: '' }]);
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: 'employeeId' | 'amount', value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleBulkLoad = async () => {
    const validRows = rows.filter(r => r.employeeId && r.amount);
    if (validRows.length === 0) {
      toast.error(tr('أضف صفًا واحدًا على الأقل يحتوي على رقم الموظف والمبلغ', 'Add at least one valid row with employee ID and amount'));
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const loads = validRows.map(r => ({ employeeId: r.employeeId, amount: parseFloat(r.amount) }));
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-load',
          loads,
          payrollMonth: payrollMonth || undefined,
        }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(tr(
          `تم التحميل الجماعي: ${d.loaded ?? 0} نجح، ${d.failed ?? 0} فشل`,
          `Bulk load completed: ${d.loaded ?? 0} loaded, ${d.failed ?? 0} failed`
        ));
        setResult({ loaded: d.loaded ?? 0, failed: d.failed ?? 0 });
      } else {
        toast.error(d.error || tr('فشل التحميل الجماعي', 'Bulk load failed'));
      }
    } catch { toast.error(tr('خطأ في معالجة التحميل الجماعي', 'Error processing bulk load')); } finally { setSubmitting(false); }
  };

  const clearForm = () => {
    setRows([{ employeeId: '', amount: '' }]);
    setPayrollMonth('');
    setResult(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload style={{ height: 20, width: 20 }} /> {tr('تحميل رصيد جماعي', 'Bulk Load Funds')}
          </div>
        </CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 384 }}>
            <CVisionLabel C={C}>{tr('شهر الرواتب', 'Payroll Month')}</CVisionLabel>
            <CVisionInput C={C} value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} placeholder={tr('مثال: 2026-02', 'e.g. 2026-02')} />
          </div>

          {/* Rows Table */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C} style={{ width: 48 }}>#</CVisionTh>
                  <CVisionTh C={C}>{tr('رقم الموظف', 'Employee ID')}</CVisionTh>
                  <CVisionTh C={C}>{tr('المبلغ (ر.س)', 'Amount (SAR)')}</CVisionTh>
                  <CVisionTh C={C} style={{ width: 64 }}></CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {rows.map((row, idx) => (
                  <CVisionTr C={C} key={idx}>
                    <CVisionTd style={{ color: C.textMuted, fontSize: 13 }}>{idx + 1}</CVisionTd>
                    <CVisionTd>
                      <CVisionInput C={C}
                        value={row.employeeId}
                        onChange={e => updateRow(idx, 'employeeId', e.target.value)}
                        placeholder={tr('رقم الموظف', 'Employee ID')}
                        style={{ height: 32 }}
                      />
                    </CVisionTd>
                    <CVisionTd>
                      <CVisionInput C={C}
                        type="number"
                        value={row.amount}
                        onChange={e => updateRow(idx, 'amount', e.target.value)}
                        placeholder="0"
                        min="1"
                        style={{ height: 32 }}
                      />
                    </CVisionTd>
                    <CVisionTd>
                      {rows.length > 1 && (
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => removeRow(idx)}>
                          <XCircle style={{ height: 16, width: 16, color: C.red }} />
                        </CVisionButton>
                      )}
                    </CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={addRow}>
              <Plus style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('إضافة صف', 'Add Row')}
            </CVisionButton>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={clearForm}>{tr('مسح', 'Clear')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={handleBulkLoad} disabled={submitting || rows.filter(r => r.employeeId && r.amount).length === 0}>
                {submitting && <RefreshCw style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} />}
                <Upload style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('معالجة التحميل الجماعي', 'Process Bulk Load')}
              </CVisionButton>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={`p-4 rounded-lg border ${result.failed > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{result.loaded}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{tr('نجح', 'Loaded')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{result.failed}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{tr('فشل', 'Failed')}</div>
                </div>
                <div style={{ fontSize: 13, color: C.textMuted, marginLeft: 16 }}>
                  {result.failed === 0
                    ? tr('تمت معالجة جميع عمليات التحميل بنجاح.', 'All loads processed successfully.')
                    : tr(
                        `فشلت ${result.failed} عملية تحميل. تحقق من أرقام الموظفين وحاول مرة أخرى.`,
                        `${result.failed} load(s) failed. Check employee IDs and try again.`
                      )
                  }
                </div>
              </div>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// =====================================================================
// CARD ACTIONS TAB
// =====================================================================
function CardActionsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const PROVIDER_LABELS: Record<string, string> = {
    PAYIT: 'PayIT', STCPAY: 'STC Pay', MADA: tr('مدى', 'Mada'), CUSTOM: tr('مخصص', 'Custom'),
  };
  const STATUS_LABELS: Record<string, string> = {
    ACTIVE: tr('نشط', 'Active'),
    BLOCKED: tr('محظور', 'Blocked'),
    EXPIRED: tr('منتهي', 'Expired'),
    CANCELLED: tr('ملغي', 'Cancelled'),
  };

  const [searchId, setSearchId] = useState('');
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Confirmation dialogs
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState('');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const searchCard = async () => {
    if (!searchId) return;
    setLoading(true);
    setCard(null);
    setNotFound(false);
    try {
      const r = await fetch(`${API}?action=employee-card&employeeId=${encodeURIComponent(searchId)}`, { credentials: 'include' });
      const d = await r.json();
      if (d.data) {
        setCard(d.data);
      } else {
        setNotFound(true);
      }
    } catch {
      toast.error(tr('خطأ في البحث عن البطاقة', 'Error searching for card'));
    } finally { setLoading(false); }
  };

  const openConfirm = (action: string) => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleAction = async () => {
    if (!card || !confirmAction) return;
    setConfirmSubmitting(true);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirmAction, cardId: card.cardId || card._id }),
      });
      const d = await r.json();
      if (d.success) {
        const actionMessages: Record<string, string> = {
          block: tr('تم حظر البطاقة بنجاح', 'Card block successful'),
          unblock: tr('تم إلغاء حظر البطاقة بنجاح', 'Card unblock successful'),
          cancel: tr('تم إلغاء البطاقة بنجاح', 'Card cancel successful'),
          replace: tr('تم استبدال البطاقة بنجاح', 'Card replace successful'),
        };
        toast.success(actionMessages[confirmAction] || tr('تمت العملية بنجاح', 'Action successful'));
        setConfirmOpen(false);
        setConfirmAction('');
        // Refresh card data
        searchCard();
      } else {
        const failMessages: Record<string, string> = {
          block: tr('فشل حظر البطاقة', 'Failed to block card'),
          unblock: tr('فشل إلغاء حظر البطاقة', 'Failed to unblock card'),
          cancel: tr('فشل إلغاء البطاقة', 'Failed to cancel card'),
          replace: tr('فشل استبدال البطاقة', 'Failed to replace card'),
        };
        toast.error(d.error || failMessages[confirmAction] || tr('فشل تنفيذ الإجراء', 'Failed to perform action'));
      }
    } catch { toast.error(tr('خطأ في تنفيذ الإجراء', 'Error performing action')); } finally { setConfirmSubmitting(false); }
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case 'block': return tr('حظر البطاقة', 'Block Card');
      case 'unblock': return tr('إلغاء الحظر', 'Unblock Card');
      case 'cancel': return tr('إلغاء البطاقة', 'Cancel Card');
      case 'replace': return tr('استبدال البطاقة', 'Replace Card');
      default: return action;
    }
  };

  const actionDescription = (action: string) => {
    const name = card?.employeeName || tr('هذا الموظف', 'this employee');
    switch (action) {
      case 'block': return tr(
        `هل أنت متأكد من حظر بطاقة ${name}؟ سيتم تعطيل البطاقة مؤقتًا.`,
        `Are you sure you want to block the card for ${name}? The card will be temporarily disabled.`
      );
      case 'unblock': return tr(
        `هل أنت متأكد من إلغاء حظر بطاقة ${name}؟ سيتم إعادة تفعيل البطاقة.`,
        `Are you sure you want to unblock the card for ${name}? The card will be reactivated.`
      );
      case 'cancel': return tr(
        `هل أنت متأكد من إلغاء بطاقة ${name}؟ لا يمكن التراجع عن هذا الإجراء.`,
        `Are you sure you want to cancel the card for ${name}? This action cannot be undone.`
      );
      case 'replace': return tr(
        `هل أنت متأكد من استبدال بطاقة ${name}؟ سيتم إصدار بطاقة جديدة وإلغاء الحالية.`,
        `Are you sure you want to replace the card for ${name}? A new card will be issued and the current one deactivated.`
      );
      default: return tr('هل أنت متأكد من تنفيذ هذا الإجراء؟', 'Are you sure you want to perform this action?');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Search */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search style={{ height: 20, width: 20, color: C.blue }} /> {tr('البحث عن بطاقة برقم الموظف', 'Find Card by Employee ID')}
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 448 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
              <CVisionInput C={C}
                style={{ paddingLeft: 32 }}
                placeholder={tr('أدخل رقم الموظف...', 'Enter employee ID...')}
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchCard(); }}
              />
            </div>
            <CVisionButton C={C} isDark={isDark} onClick={searchCard} disabled={!searchId || loading}>
              {loading && <RefreshCw style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} />}
              <Search style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('بحث', 'Search')}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Card Details */}
      {loading && <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  />}

      {notFound && !loading && (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', color: C.textMuted }}>
            {tr(`لم يتم العثور على بطاقة لرقم الموظف: ${searchId}`, `No card found for employee ID: ${searchId}`)}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {card && !loading && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard style={{ height: 20, width: 20 }} /> {tr('تفاصيل البطاقة', 'Card Details')}
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('الموظف', 'Employee')}</div>
                <div style={{ fontWeight: 500 }}>{card.employeeName}</div>
                <div style={{ fontSize: 12, color: C.textMuted, fontFamily: 'monospace' }}>{card.employeeId}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('المزوّد', 'Provider')}</div>
                <div style={{ fontWeight: 500 }}>
                  <CVisionBadge C={C} variant="outline">{PROVIDER_LABELS[card.provider] || card.provider}</CVisionBadge>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('رقم البطاقة', 'Card Number')}</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 500 }}>{card.cardNumberMasked || card.cardNumber || '\u2014'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('الحالة', 'Status')}</div>
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[card.status] || 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABELS[card.status] || card.status}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('الرصيد', 'Balance')}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtSAR(card.balance ?? 0, language)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('تاريخ الإصدار', 'Issued Date')}</div>
                <div style={{ fontWeight: 500 }}>{fmtDate(card.issuedDate || card.createdAt, language)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('تاريخ الانتهاء', 'Expiry Date')}</div>
                <div style={{ fontWeight: 500 }}>{fmtDate(card.expiryDate, language)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('تاريخ آخر تحميل', 'Last Load Date')}</div>
                <div style={{ fontWeight: 500 }}>{fmtDate(card.lastLoadDate, language)}</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              {card.status === 'ACTIVE' && (
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => openConfirm('block')}>
                  <Lock style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('حظر', 'Block')}
                </CVisionButton>
              )}
              {card.status === 'BLOCKED' && (
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => openConfirm('unblock')}>
                  <Unlock style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('إلغاء الحظر', 'Unblock')}
                </CVisionButton>
              )}
              {card.status !== 'CANCELLED' && (
                <CVisionButton C={C} isDark={isDark} variant="danger" onClick={() => openConfirm('cancel')}>
                  <XCircle style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('إلغاء', 'Cancel')}
                </CVisionButton>
              )}
              {card.status !== 'CANCELLED' && (
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => openConfirm('replace')}>
                  <RefreshCw style={{ height: 16, width: 16, marginInlineEnd: 8 }} /> {tr('استبدال', 'Replace')}
                </CVisionButton>
              )}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Confirmation Dialog */}
      <CVisionDialog C={C} open={confirmOpen} onClose={() => { setConfirmOpen(false); setConfirmAction(""); }} title={tr("تأكيد", "Confirm")} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{actionDescription(confirmAction)}</p>          <div style={{ overflowY: 'auto' }}>
            {card && (
              <div style={{ padding: 12, borderRadius: 12, background: C.bgSubtle, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><span style={{ color: C.textMuted }}>{tr('الموظف:', 'Employee:')}</span> {card.employeeName} ({card.employeeId})</div>
                <div><span style={{ color: C.textMuted }}>{tr('البطاقة:', 'Card:')}</span> {card.cardNumberMasked || card.cardNumber || '\u2014'}</div>
                <div><span style={{ color: C.textMuted }}>{tr('المزوّد:', 'Provider:')}</span> {PROVIDER_LABELS[card.provider] || card.provider}</div>
                <div><span style={{ color: C.textMuted }}>{tr('الحالة الحالية:', 'Current Status:')}</span> {STATUS_LABELS[card.status] || card.status}</div>
                <div><span style={{ color: C.textMuted }}>{tr('الرصيد:', 'Balance:')}</span> {fmtSAR(card.balance ?? 0, language)}</div>
              </div>
            )}
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setConfirmOpen(false); setConfirmAction(''); }}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark}
              variant={confirmAction === 'cancel' || confirmAction === 'block' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={confirmSubmitting}
            >
              {confirmSubmitting && <RefreshCw style={{ height: 16, width: 16, marginInlineEnd: 8, animation: 'spin 1s linear infinite' }} />}
              {actionLabel(confirmAction)}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// =====================================================================
// MAIN PAGE
// =====================================================================
export default function PaycardsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }} dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
          <CreditCard style={{ height: 32, width: 32, color: C.blue }} /> {tr('إدارة بطاقات الدفع', 'Paycard Management')}
        </h1>
        <p style={{ color: C.textMuted }}>{tr('إدارة بطاقات الدفع المسبقة للموظفين وتحميل الرصيد وتنفيذ إجراءات البطاقات', 'Manage employee prepaid cards, load funds, and perform card actions')}</p>
      </div>

      <CVisionTabs
        C={C}
        defaultTab="all-cards"
        tabs={[
          { id: 'all-cards', label: tr('جميع البطاقات', 'All Cards'), icon: <CreditCard style={{ height: 14, width: 14 }} /> },
          { id: 'load-funds', label: tr('تحميل رصيد', 'Load Funds'), icon: <DollarSign style={{ height: 14, width: 14 }} /> },
          { id: 'bulk-load', label: tr('تحميل جماعي', 'Bulk Load'), icon: <Upload style={{ height: 14, width: 14 }} /> },
          { id: 'card-actions', label: tr('إجراءات البطاقة', 'Card Actions'), icon: <ShieldAlert style={{ height: 14, width: 14 }} /> },
        ]}
      >
        <CVisionTabContent tabId="all-cards"><AllCardsTab /></CVisionTabContent>
        <CVisionTabContent tabId="load-funds"><LoadFundsTab /></CVisionTabContent>
        <CVisionTabContent tabId="bulk-load"><BulkLoadTab /></CVisionTabContent>
        <CVisionTabContent tabId="card-actions"><CardActionsTab /></CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}
