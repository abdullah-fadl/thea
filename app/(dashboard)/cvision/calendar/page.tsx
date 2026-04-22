'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionSelect, CVisionPageHeader, CVisionPageLayout,
  CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, PlusCircle, Calendar as CalendarIcon } from 'lucide-react';

const TYPE_COLOR: Record<string, string> = {
  HOLIDAY: '#22c55e', COMPANY_EVENT: '#3b82f6', TRAINING: '#a855f7',
  BIRTHDAY: '#ec4899', ANNIVERSARY: '#f59e0b', REMINDER: '#eab308', OTHER: '#6b7280',
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const DAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_AR = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];

export default function CalendarPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', titleAr: '', type: 'COMPANY_EVENT', date: '', endDate: '', description: '' });

  const { data: eventsRaw, isLoading: loading, refetch: refetchEvents } = useQuery({
    queryKey: cvisionKeys.calendar.list({ action: 'month', year, month }),
    queryFn: () => cvisionFetch('/api/cvision/calendar', { params: { action: 'month', year, month } }),
  });
  const events: any[] = eventsRaw?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: any) => cvisionMutate('/api/cvision/calendar', 'POST', { action: 'create', ...body, allDay: true }),
    onSuccess: () => { toast.success(tr('تم إنشاء الحدث', 'Event created')); setShowCreate(false); refetchEvents(); },
    onError: (err: any) => toast.error(err?.data?.error || tr('فشل', 'Failed')),
  });
  const handleCreate = () => {
    if (!form.title || !form.date) { toast.error(tr('العنوان والتاريخ مطلوبان', 'Title and date required')); return; }
    createMutation.mutate(form);
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getEventsForDay = (day: number) => {
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => {
      const eStart = e.date; const eEnd = e.endDate || e.date;
      return dayStr >= eStart && dayStr <= eEnd;
    });
  };

  if (loading) return (
    <CVisionPageLayout style={{ padding: 24 }}>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={260} />
    </CVisionPageLayout>
  );

  const dayHeaders = isRTL ? DAYS_AR : DAYS_EN;
  const monthLabel = isRTL ? MONTHS_AR[month - 1] : MONTHS[month - 1];

  return (
    <CVisionPageLayout style={{ padding: 24 }}>
      <CVisionPageHeader
        C={C}
        title={tr('تقويم الشركة', 'Company Calendar')}
        titleEn="Company Calendar"
        icon={CalendarIcon}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} icon={<PlusCircle size={14} />} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? tr('إلغاء', 'Cancel') : tr('إضافة حدث', 'Add Event')}
          </CVisionButton>
        }
      />

      {showCreate && (
        <CVisionCard C={C} style={{ marginBottom: 16 }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('حدث جديد', 'New Event')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <CVisionInput C={C} placeholder={tr('العنوان', 'Title')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('العنوان بالعربي', 'Title (AR)')} dir="rtl" value={form.titleAr} onChange={e => setForm({ ...form, titleAr: e.target.value })} />
              </div>
              <CVisionSelect C={C} label={tr('النوع', 'Type')} value={form.type} onChange={v => setForm({ ...form, type: v })} options={['HOLIDAY','COMPANY_EVENT','TRAINING','BIRTHDAY','ANNIVERSARY','REMINDER','OTHER'].map(t => ({ value: t, label: t }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <CVisionInput C={C} label={tr('تاريخ البدء', 'Start Date')} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                <CVisionInput C={C} label={tr('تاريخ النهاية', 'End Date')} type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <CVisionInput C={C} placeholder={tr('الوصف', 'Description')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <CVisionButton C={C} isDark={isDark} onClick={handleCreate}>{tr('إنشاء', 'Create')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
        <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft size={16} /></CVisionButton>
        <span style={{ fontSize: 16, fontWeight: 600, color: C.text, minWidth: 200, textAlign: 'center' }}>{monthLabel} {year}</span>
        <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={nextMonth}><ChevronRight size={16} /></CVisionButton>
      </div>

      {/* Calendar grid */}
      <CVisionCard C={C} hover={false}>
        <CVisionCardBody style={{ padding: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 4 }}>
            {dayHeaders.map(d => (
              <div key={d} style={{ padding: 4, fontSize: 11, fontWeight: 500, color: C.textMuted }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: C.border }}>
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`e-${i}`} style={{ background: C.bg, padding: 4, minHeight: 80 }} />
            ))}
            {days.map(day => {
              const dayEvents = getEventsForDay(day);
              const isToday = day === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear();
              return (
                <div key={day} style={{
                  background: C.bg, padding: 4, minHeight: 80,
                  outline: isToday ? `2px solid ${C.blue}` : 'none',
                  outlineOffset: -2,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: isToday ? C.blue : C.text, marginBottom: 2 }}>{day}</div>
                  {dayEvents.map((e: any) => (
                    <div key={e.eventId} style={{
                      fontSize: 9, lineHeight: 1.3, padding: '2px 4px', borderRadius: 4, marginBottom: 2,
                      color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      backgroundColor: e.color || TYPE_COLOR[e.type] || '#3b82f6',
                    }}>{e.title}</div>
                  ))}
                </div>
              );
            })}
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Events list */}
      {events.length > 0 && (
        <CVisionCard C={C} style={{ marginTop: 16 }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('أحداث هذا الشهر', 'Events this month')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {events.map(e => (
                <div key={e.eventId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: TYPE_COLOR[e.type] || C.textMuted, flexShrink: 0 }} />
                  <span style={{ fontWeight: 500, color: C.text }}>{e.title}</span>
                  {e.titleAr && <span style={{ fontSize: 11, color: C.textMuted }}>({e.titleAr})</span>}
                  <CVisionBadge C={C} variant="muted">{e.type}</CVisionBadge>
                  <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 'auto' }}>
                    {e.date}{e.endDate && e.endDate !== e.date ? ` — ${e.endDate}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </CVisionPageLayout>
  );
}
