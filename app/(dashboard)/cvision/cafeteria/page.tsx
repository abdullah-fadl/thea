'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard, CVisionSkeletonStyles,
  CVisionTabs, CVisionTabContent, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import type { CVisionTabItem } from '@/components/cvision/ui/CVisionTabs';
import type { CVisionPalette } from '@/lib/cvision/theme';
import { toast } from 'sonner';
import { UtensilsCrossed, CalendarDays, ShoppingCart, BarChart3, Coffee, Salad, Moon, Apple } from 'lucide-react';

const api = (action: string, params?: Record<string, string>, signal?: AbortSignal) => {
  const sp = new URLSearchParams({ action, ...params });
  return fetch(`/api/cvision/meals?${sp}`, { credentials: 'include', signal }).then(r => r.json());
};
const post = (body: any) => fetch('/api/cvision/meals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }).then(r => r.json());

const mealIcons: Record<string, any> = { BREAKFAST: Coffee, LUNCH: Salad, DINNER: Moon, SNACK: Apple };

const mealBadgeVariant = (type: string): 'warning' | 'info' | 'purple' | 'success' => {
  if (type === 'BREAKFAST') return 'warning';
  if (type === 'LUNCH') return 'info';
  if (type === 'DINNER') return 'purple';
  return 'success';
};

/* ---- Today's Menu ---- */

function MenuTodayTab({ C, isDark, tr, isRTL }: { C: CVisionPalette; isDark: boolean; tr: (ar: string, en: string) => string; isRTL: boolean }) {
  const [bookDialog, setBookDialog] = useState<any>(null);

  const { data: menuRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.cafeteria.list({ action: 'menu-today' }),
    queryFn: () => cvisionFetch('/api/cvision/meals', { params: { action: 'menu-today' } }),
  });
  const menu = menuRaw?.menu ?? null;

  if (loading) return <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={100} /><CVisionSkeletonCard C={C} height={100} /><CVisionSkeletonCard C={C} height={100} /></>;
  if (!menu) return <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, fontSize: 13 }}>{tr('لا توجد قائمة لهذا اليوم', 'No menu available for today')}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: C.textMuted }}>{tr('التاريخ', 'Date')}: {menu.date}</div>
      {(menu.meals || []).map((meal: any) => {
        const Icon = mealIcons[meal.type] || Coffee;
        return (
          <CVisionCard key={meal.type} C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={16} color={C.text} />
                <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{meal.type}</span>
                <CVisionBadge C={C} variant={mealBadgeVariant(meal.type)}>{meal.availableFrom} — {meal.availableUntil}</CVisionBadge>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {(meal.items || []).map((item: any, idx: number) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
                    border: `1px solid ${C.border}`, fontSize: 13, cursor: 'default',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: C.text }}>{item.name}</div>
                      {item.nameAr && <div style={{ fontSize: 11, color: C.textMuted }}>{item.nameAr}</div>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11, color: C.textMuted }}>
                        <span>{item.category}</span>
                        {item.calories && <span>{item.calories} cal</span>}
                        {item.vegetarian && <CVisionBadge C={C} variant="success">Veg</CVisionBadge>}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: item.price === 0 ? C.green : C.orange }}>
                      {item.price === 0 ? tr('مجاني', 'Free') : `${item.price} SAR`}
                    </span>
                  </div>
                ))}
              </div>
              <CVisionButton C={C} isDark={isDark} size="sm" icon={<ShoppingCart size={14} />} style={{ marginTop: 12 }}
                onClick={() => setBookDialog(meal)}>
                {tr('حجز', 'Book')} {meal.type}
              </CVisionButton>
            </CVisionCardBody>
          </CVisionCard>
        );
      })}

      <CVisionDialog C={C} open={!!bookDialog} onClose={() => setBookDialog(null)} title={`${tr('حجز', 'Book')} ${bookDialog?.type || ''}`} isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
          <div style={{ color: C.textSecondary }}>{tr('اختر العناصر لحجزك', 'Select items for your booking')}:</div>
          {(bookDialog?.items || []).map((item: any, idx: number) => (
            <label key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${C.border}`, cursor: 'pointer',
            }}>
              <input type="checkbox" defaultChecked style={{ accentColor: C.gold }} />
              <span style={{ flex: 1, color: C.text }}>{item.name}</span>
              <span style={{ fontSize: 12, color: C.textMuted }}>{item.price === 0 ? tr('مجاني', 'Free') : `${item.price} SAR`}</span>
            </label>
          ))}
        </div>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} onClick={async () => {
            await post({
              action: 'book-meal', employeeId: 'EMP-001', employeeName: 'Current User',
              date: menu?.date, mealType: bookDialog?.type,
              items: bookDialog?.items?.map((i: any) => i.name) || [],
            });
            toast.success(tr('تم حجز الوجبة بنجاح', 'Meal booked successfully'));
            setBookDialog(null);
          }}>{tr('تأكيد الحجز', 'Confirm Booking')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

/* ---- Weekly Menu ---- */

function MenuWeekTab({ C, tr }: { C: CVisionPalette; tr: (ar: string, en: string) => string }) {
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { const ac = new AbortController(); api('menu-week', undefined, ac.signal).then(j => { setMenu(j.menu || []); setLoading(false); }).catch(() => {}); return () => ac.abort(); }, []);

  if (loading) return <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={80} /></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {menu.map((day: any) => (
        <CVisionCard key={day.date} C={C}>
          <CVisionCardHeader C={C}><span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{day.date}</span></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {(day.meals || []).map((meal: any) => (
                <div key={meal.type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <CVisionBadge C={C} variant={mealBadgeVariant(meal.type)}>{meal.type}</CVisionBadge>
                  <span style={{ color: C.textMuted }}>{meal.items?.length || 0} {tr('عناصر', 'items')}</span>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      ))}
    </div>
  );
}

/* ---- My Bookings ---- */

function MyBookingsTab({ C, isDark, tr }: { C: CVisionPalette; isDark: boolean; tr: (ar: string, en: string) => string }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const j = await api('my-bookings', { employeeId: 'EMP-001' }, signal);
    setBookings(j.bookings || []);
    setLoading(false);
  }, []);

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  if (loading) return <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={120} /></>;

  const statusVariant = (s: string): 'info' | 'success' | 'muted' | 'danger' => {
    if (s === 'BOOKED') return 'info';
    if (s === 'SERVED') return 'success';
    if (s === 'NO_SHOW') return 'danger';
    return 'muted';
  };

  return (
    <CVisionCard C={C}>
      <CVisionCardHeader C={C}><span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('حجوزاتي', 'My Bookings')}</span></CVisionCardHeader>
      <CVisionCardBody>
        {bookings.length === 0 ? <div style={{ fontSize: 13, color: C.textMuted }}>{tr('لا توجد حجوزات بعد', 'No bookings yet')}</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted, textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px 8px 0' }}>{tr('التاريخ', 'Date')}</th>
                  <th style={{ padding: '8px 12px 8px 0' }}>{tr('الوجبة', 'Meal')}</th>
                  <th style={{ padding: '8px 12px 8px 0' }}>{tr('العناصر', 'Items')}</th>
                  <th style={{ padding: '8px 12px 8px 0', textAlign: 'right' }}>{tr('التكلفة', 'Cost')}</th>
                  <th style={{ padding: '8px 12px 8px 0' }}>{tr('الحالة', 'Status')}</th>
                  <th style={{ padding: '8px 0' }} />
                </tr>
              </thead>
              <tbody>
                {bookings.map((b: any, i: number) => (
                  <tr key={i} style={{ borderBottom: i < bookings.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <td style={{ padding: '8px 12px 8px 0', color: C.text }}>{b.date}</td>
                    <td style={{ padding: '8px 12px 8px 0' }}><CVisionBadge C={C} variant={mealBadgeVariant(b.mealType)}>{b.mealType}</CVisionBadge></td>
                    <td style={{ padding: '8px 12px 8px 0', fontSize: 12, color: C.textSecondary }}>{b.items?.join(', ')}</td>
                    <td style={{ padding: '8px 12px 8px 0', textAlign: 'right', color: C.text }}>{b.totalCost === 0 ? tr('مجاني', 'Free') : `${b.totalCost} SAR`}</td>
                    <td style={{ padding: '8px 12px 8px 0' }}><CVisionBadge C={C} variant={statusVariant(b.status)}>{b.status}</CVisionBadge></td>
                    <td style={{ padding: '8px 0' }}>
                      {b.status === 'BOOKED' && (
                        <CVisionButton C={C} isDark={isDark} variant="danger" size="sm" onClick={async () => {
                          await post({ action: 'cancel-booking', bookingId: b._id });
                          toast.success(tr('تم إلغاء الحجز', 'Booking cancelled'));
                          load();
                        }}>{tr('إلغاء', 'Cancel')}</CVisionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CVisionCardBody>
    </CVisionCard>
  );
}

/* ---- Reports ---- */

function ReportsTab({ C, tr }: { C: CVisionPalette; tr: (ar: string, en: string) => string }) {
  const [counts, setCounts] = useState<any[]>([]);
  const [cost, setCost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([api('booking-count', undefined, ac.signal), api('cost-report', undefined, ac.signal)]).then(([bc, cr]) => {
      setCounts(bc.counts || []);
      setCost(cr.report);
      setLoading(false);
    }).catch(() => {});
    return () => ac.abort();
  }, []);

  if (loading) return <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={120} /></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {counts.map((c: any) => (
          <CVisionCard key={c._id} C={C} hover={false}>
            <CVisionCardBody style={{ padding: 16 }}>
              <CVisionBadge C={C} variant={mealBadgeVariant(c._id)}>{c._id}</CVisionBadge>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginTop: 8 }}>{c.count}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('حجوزات اليوم', 'bookings today')}</div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
      {cost && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('تقرير التكاليف', 'Cost Report')} — {cost.month}</span></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, fontSize: 13 }}>
              <div>
                <span style={{ color: C.textMuted }}>{tr('إجمالي الحجوزات', 'Total Bookings')}</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{cost.totalBookings}</div>
              </div>
              <div>
                <span style={{ color: C.textMuted }}>{tr('وجبات مجانية', 'Free Meals')}</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{cost.costBreakdown?.FREE || 0} SAR</div>
              </div>
              <div>
                <span style={{ color: C.textMuted }}>{tr('خصم الراتب', 'Salary Deductions')}</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{cost.costBreakdown?.SALARY_DEDUCTION || 0} SAR</div>
              </div>
              <div>
                <span style={{ color: C.textMuted }}>{tr('إجمالي التكلفة', 'Total Cost')}</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{cost.totalCost} SAR</div>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </div>
  );
}

/* ---- Main Page ---- */

export default function CafeteriaPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const tabs: CVisionTabItem[] = [
    { key: 'today', label: tr('قائمة اليوم', "Today's Menu"), icon: UtensilsCrossed },
    { key: 'week', label: tr('القائمة الأسبوعية', 'Weekly Menu'), icon: CalendarDays },
    { key: 'bookings', label: tr('حجوزاتي', 'My Bookings'), icon: ShoppingCart },
    { key: 'reports', label: tr('التقارير', 'Reports'), icon: BarChart3 },
  ];

  return (
    <CVisionPageLayout style={{ padding: 24 }}>
      <CVisionPageHeader
        C={C}
        title={tr('المقصف وإدارة الوجبات', 'Cafeteria & Meal Management')}
        titleEn="Cafeteria & Meal Management"
        icon={UtensilsCrossed}
        isRTL={isRTL}
      />
      <CVisionTabs C={C} tabs={tabs} defaultTab="today">
        <CVisionTabContent tabKey="today"><MenuTodayTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} /></CVisionTabContent>
        <CVisionTabContent tabKey="week"><MenuWeekTab C={C} tr={tr} /></CVisionTabContent>
        <CVisionTabContent tabKey="bookings"><MyBookingsTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
        <CVisionTabContent tabKey="reports"><ReportsTab C={C} tr={tr} /></CVisionTabContent>
      </CVisionTabs>
    </CVisionPageLayout>
  );
}
