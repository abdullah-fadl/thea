'use client';

import { useMemo } from 'react';
import { TASK_CATEGORY_CONFIG, TASK_STATUS_CONFIG, type TaskCategory, type TaskStatus } from '@/lib/clinical/carePath';
import { useLang } from '@/hooks/use-lang';

interface CarePathPrintViewProps {
  carePath: any;
  organizationName?: string;
  organizationNameAr?: string;
}

export function CarePathPrintView({
  carePath,
  organizationName = 'Thea Health',
  organizationNameAr = 'ثيا الصحية',
}: CarePathPrintViewProps) {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const snapshot = (carePath?.patientSnapshot ?? {}) as Record<string, string>;
  const tasks = carePath?.tasks ?? [];
  const shifts = carePath?.shifts ?? [];

  const groupedByShift = useMemo(() => {
    const dayShift = shifts.find((s: any) => s.shiftType === 'DAY');
    const nightShift = shifts.find((s: any) => s.shiftType === 'NIGHT');

    const dayTasks = tasks.filter((t: any) => t.shiftId === dayShift?.id);
    const nightTasks = tasks.filter((t: any) => t.shiftId === nightShift?.id);

    return { dayShift, nightShift, dayTasks, nightTasks };
  }, [tasks, shifts]);

  const groupByCategory = (tasksList: any[]) => {
    const groups: Record<string, any[]> = {};
    tasksList.forEach(t => {
      const cat = t.category || 'CUSTOM';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return groups;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const statusSymbol = (status: TaskStatus) => {
    switch (status) {
      case 'DONE': return '[v]';
      case 'MISSED': return '[x]';
      case 'HELD': return '[||]';
      case 'REFUSED': return '[--]';
      case 'CANCELLED': return '[-]';
      default: return '[ ]';
    }
  };

  const dateStr = carePath?.date
    ? new Date(carePath.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="print-care-path bg-white"
      style={{ fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', fontSize: '11px', color: '#222' }}
    >
      <style>{`
        @media print {
          .print-care-path { padding: 0 !important; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        @media screen {
          .print-care-path { max-width: 900px; margin: 0 auto; padding: 20px; }
        }
        .print-care-path table { width: 100%; border-collapse: collapse; margin: 6px 0; }
        .print-care-path th, .print-care-path td { border: 1px solid #ddd; padding: 4px 6px; text-align: center; vertical-align: middle; }
        .print-care-path th { background: #f5f5f5; font-weight: 600; font-size: 10px; }
        .print-care-path td { font-size: 10px; }
        .print-care-path .section-title { font-size: 13px; font-weight: 600; margin: 12px 0 4px; padding: 4px 8px; border-${isAr ? 'right' : 'left'}: 4px solid #0b0c0c; }
        .print-care-path .header-grid { display: grid; grid-template-columns: 2fr 1.5fr 1.5fr; gap: 8px; margin-bottom: 10px; font-size: 11px; }
        .print-care-path .field-label { font-size: 9px; color: #666; font-weight: 600; }
        .print-care-path .field-value { font-size: 11px; font-weight: 500; padding: 2px 0; border-bottom: 1px solid #eee; min-height: 18px; }
        .print-care-path .status-done { color: #16a34a; font-weight: 700; }
        .print-care-path .status-missed { color: #dc2626; font-weight: 700; }
        .print-care-path .status-held { color: #ea580c; font-weight: 700; }
        .print-care-path .signature-box { display: flex; gap: 20px; margin-top: 16px; padding-top: 12px; border-top: 2px solid #333; }
        .print-care-path .sig-field { flex: 1; }
        .print-care-path .sig-line { border-bottom: 1px solid #999; height: 30px; margin-top: 4px; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <h1 style={{ fontSize: '18px', margin: '4px 0' }}>
          {tr('سجل رعاية المريض اليومي', 'Daily Patient Care Log')}
        </h1>
        <p style={{ fontSize: '12px', color: '#666', margin: '2px 0' }}>
          {isAr ? organizationNameAr : organizationName}
        </p>
        <p style={{ fontSize: '11px', color: '#888' }}>{dateStr}</p>
      </div>

      {/* Patient info grid */}
      <div className="header-grid">
        <div>
          <div className="field-label">{tr('اسم المريض / Patient Name', 'Patient Name')}</div>
          <div className="field-value">{snapshot.fullName || '—'}</div>
        </div>
        <div>
          <div className="field-label">{tr('رقم الملف / MRN', 'MRN')}</div>
          <div className="field-value">{snapshot.mrn || '—'}</div>
        </div>
        <div>
          <div className="field-label">{tr('الغرفة/السرير / Room-Bed', 'Room-Bed')}</div>
          <div className="field-value">{snapshot.room ? `${snapshot.room}${snapshot.bed ? `-${snapshot.bed}` : ''}` : '—'}</div>
        </div>
      </div>

      <div className="header-grid">
        <div>
          <div className="field-label">{tr('القسم / Department', 'Department')}</div>
          <div className="field-value">{carePath?.departmentType || '—'}</div>
        </div>
        <div>
          <div className="field-label">{tr('التشخيص / Diagnosis', 'Diagnosis')}</div>
          <div className="field-value">{snapshot.diagnosis || '—'}</div>
        </div>
        <div>
          <div className="field-label">{tr('الحساسيات / Allergies', 'Allergies')}</div>
          <div className="field-value" style={{ color: snapshot.allergies ? '#dc2626' : undefined }}>
            {Array.isArray(snapshot.allergies) && (snapshot.allergies as unknown as string[]).length > 0
              ? (snapshot.allergies as unknown as string[]).join(', ')
              : tr('لا يوجد', 'None')}
          </div>
        </div>
      </div>

      {/* Shifts */}
      {[
        { shift: groupedByShift.dayShift, tasks: groupedByShift.dayTasks, label: tr('الوردية الصباحية (٧:٠٠ ص - ٧:٠٠ م)', 'Day Shift (7:00 AM - 7:00 PM)') },
        { shift: groupedByShift.nightShift, tasks: groupedByShift.nightTasks, label: tr('الوردية المسائية (٧:٠٠ م - ٧:٠٠ ص)', 'Night Shift (7:00 PM - 7:00 AM)') },
      ].map(({ shift, tasks: shiftTasks, label }, si) => {
        if (shiftTasks.length === 0) return null;
        const grouped = groupByCategory(shiftTasks);

        return (
          <div key={si} className={si > 0 ? 'page-break' : ''}>
            <div style={{ background: '#f8f8f8', padding: '6px 10px', margin: '12px 0 8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '12px' }}>{label}</strong>
              <span style={{ fontSize: '10px', color: '#666' }}>
                {tr('الممرض/ـة', 'Nurse')}: {shift?.nurseName || '________________'}
              </span>
            </div>

            {/* Grouped tasks table */}
            {Object.entries(grouped).map(([cat, catTasks]) => {
              const cfg = TASK_CATEGORY_CONFIG[cat as TaskCategory];
              return (
                <div key={cat}>
                  <div className="section-title">
                    {cfg?.icon} {isAr ? cfg?.labelAr : cfg?.labelEn} | {isAr ? cfg?.labelEn : cfg?.labelAr}
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>{tr('الوقت', 'Time')}</th>
                        <th>{tr('المهمة', 'Task')}</th>
                        <th style={{ width: '12%' }}>{tr('الحالة', 'Status')}</th>
                        <th style={{ width: '15%' }}>{tr('المنفذ', 'Done By')}</th>
                        <th style={{ width: '15%' }}>{tr('ملاحظات', 'Notes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catTasks.map((task: any) => (
                        <tr key={task.id}>
                          <td>{formatTime(task.scheduledTime)}</td>
                          <td style={{ textAlign: isAr ? 'right' : 'left' }}>
                            {isAr ? (task.titleAr || task.title) : task.title}
                          </td>
                          <td className={
                            task.status === 'DONE' ? 'status-done' :
                            task.status === 'MISSED' ? 'status-missed' :
                            task.status === 'HELD' ? 'status-held' : ''
                          }>
                            {statusSymbol(task.status)} {isAr ? TASK_STATUS_CONFIG[task.status as TaskStatus]?.labelAr : TASK_STATUS_CONFIG[task.status as TaskStatus]?.labelEn}
                          </td>
                          <td>{task.completedByName || ''}</td>
                          <td>{task.missedReasonText || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* Signature box */}
            <div className="signature-box">
              <div className="sig-field">
                <div className="field-label">{tr('اسم الممرض/ـة / Nurse Name', 'Nurse Name')}</div>
                <div className="sig-line" />
              </div>
              <div className="sig-field">
                <div className="field-label">{tr('توقيع التمريض / Nurse Signature', 'Nurse Signature')}</div>
                <div className="sig-line" />
              </div>
              <div className="sig-field">
                <div className="field-label">{tr('وقت الإنهاء / Completion Time', 'Completion Time')}</div>
                <div className="sig-line" />
              </div>
            </div>
          </div>
        );
      })}

      {/* Summary footer */}
      <div style={{ marginTop: '16px', padding: '8px', background: '#f8f8f8', borderRadius: '4px', fontSize: '10px', display: 'flex', gap: '20px', justifyContent: 'center' }}>
        <span>{tr('الإجمالي', 'Total')}: {tasks.length}</span>
        <span style={{ color: '#16a34a' }}>[v] {tr('تم', 'Done')}: {tasks.filter((t: any) => t.status === 'DONE').length}</span>
        <span style={{ color: '#dc2626' }}>[x] {tr('فائت', 'Missed')}: {tasks.filter((t: any) => ['MISSED', 'REFUSED'].includes(t.status)).length}</span>
        <span style={{ color: '#ea580c' }}>[||] {tr('معلّق', 'Held')}: {tasks.filter((t: any) => t.status === 'HELD').length}</span>
        <span>{tr('الإنجاز', 'Completion')}: {carePath?.completionPct ?? 0}%</span>
      </div>
    </div>
  );
}
