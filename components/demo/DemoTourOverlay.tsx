'use client';

import { useLang } from '@/hooks/use-lang';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

interface TourStep {
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

const tourSteps: Record<string, TourStep> = {
  dashboard: {
    titleAr: 'لوحة المعلومات',
    titleEn: 'Dashboard',
    descAr: 'نظرة شاملة على مؤشرات الأداء الرئيسية للمنشأة مع تحديثات لحظية',
    descEn: 'A comprehensive overview of your facility KPIs with real-time updates',
  },
  registration: {
    titleAr: 'التسجيل',
    titleEn: 'Registration',
    descAr: 'تسجيل المرضى الجدد والمراجعين مع التحقق من التأمين والهوية',
    descEn: 'Register new and returning patients with insurance and ID verification',
  },
  opd: {
    titleAr: 'العيادات الخارجية',
    titleEn: 'OPD Patient Queue',
    descAr: 'تتبع حالة كل مريض من التسجيل إلى إنهاء الزيارة مع مؤشرات ملونة',
    descEn: 'Track each patient from registration to discharge with color-coded status',
  },
  patient: {
    titleAr: 'ملف المريض',
    titleEn: 'Patient Record',
    descAr: 'العلامات الحيوية والتشخيصات والحساسية في واجهة واحدة متكاملة',
    descEn: 'Vitals, diagnoses, and allergies in one unified interface',
  },
  er: {
    titleAr: 'قسم الطوارئ',
    titleEn: 'Emergency Department',
    descAr: 'إدارة الطوارئ بنظام فرز خماسي مع تتبع لحظي للأسرّة والمرضى',
    descEn: 'ER management with 5-level triage, real-time bed and patient tracking',
  },
  ipd: {
    titleAr: 'التنويم',
    titleEn: 'Inpatient Department',
    descAr: 'إدارة المرضى المنومين والأسرّة وخطط الخروج ومتوسط الإقامة',
    descEn: 'Manage admitted patients, beds, discharge plans, and length of stay',
  },
  orders: {
    titleAr: 'الطلبات الطبية',
    titleEn: 'Medical Orders',
    descAr: 'إدارة طلبات المختبر والأشعة والأدوية والاستشارات',
    descEn: 'Manage lab, radiology, medication, and consultation orders',
  },
  lab: {
    titleAr: 'المختبر',
    titleEn: 'Lab Results',
    descAr: 'عرض النتائج مع اتجاهات تاريخية ومؤشرات للقيم غير الطبيعية',
    descEn: 'View results with historical trends and abnormal value indicators',
  },
  radiology: {
    titleAr: 'الأشعة',
    titleEn: 'Radiology',
    descAr: 'قائمة الدراسات الإشعاعية مع حالة التقارير وأولويات الطلبات',
    descEn: 'Radiology worklist with report status and request priorities',
  },
  pharmacy: {
    titleAr: 'الصيدلية',
    titleEn: 'Pharmacy',
    descAr: 'صرف الأدوية ومراجعة الوصفات وإدارة المخزون وتنبيهات النقص',
    descEn: 'Dispensing, prescription review, inventory management, and low-stock alerts',
  },
  nursing: {
    titleAr: 'التمريض',
    titleEn: 'Nursing',
    descAr: 'مهام التمريض المجدولة مع أولويات ومتابعة حالة التنفيذ',
    descEn: 'Scheduled nursing tasks with priorities and execution tracking',
  },
  or: {
    titleAr: 'غرف العمليات',
    titleEn: 'Operating Rooms',
    descAr: 'جدول العمليات الجراحية مع تفاصيل الفريق والمدة والحالة',
    descEn: 'Surgical schedule with team details, duration, and status tracking',
  },
  scheduling: {
    titleAr: 'المواعيد',
    titleEn: 'Scheduling',
    descAr: 'جدول المواعيد اليومي مع تتبع الحضور ونسبة الاستخدام',
    descEn: 'Daily appointment schedule with attendance tracking and utilization',
  },
  dental: {
    titleAr: 'طب الأسنان',
    titleEn: 'Dental',
    descAr: 'إدارة مرضى الأسنان والإجراءات مع تخطيط الأسنان',
    descEn: 'Dental patient management with procedures and tooth charting',
  },
  obgyn: {
    titleAr: 'النساء والولادة',
    titleEn: 'OB/GYN',
    descAr: 'متابعة الحمل ومستوى الخطورة والولادة والعيادات النسائية',
    descEn: 'Antenatal care, risk levels, labor tracking, and gynecology clinics',
  },
  billing: {
    titleAr: 'الفوترة',
    titleEn: 'Billing',
    descAr: 'فواتير تفصيلية مع دعم ضريبة القيمة المضافة والتأمين',
    descEn: 'Detailed invoices with VAT and insurance support',
  },
  quality: {
    titleAr: 'الجودة والسلامة',
    titleEn: 'Quality & Safety',
    descAr: 'مؤشرات الجودة وإدارة البلاغات وتحليل السبب الجذري',
    descEn: 'Quality KPIs, incident management, and root cause analysis',
  },
  sam: {
    titleAr: 'إدارة السياسات',
    titleEn: 'Policy Management',
    descAr: 'إدارة السياسات والبروتوكولات الطبية مع دورة المراجعة',
    descEn: 'Medical policies and protocols with review lifecycle management',
  },
};

interface DemoTourOverlayProps {
  activeStep: string;
  onDismiss: () => void;
  visible: boolean;
}

export default function DemoTourOverlay({ activeStep, onDismiss, visible }: DemoTourOverlayProps) {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const step = tourSteps[activeStep];

  if (!step) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, ease }}
          dir={isRTL ? 'rtl' : 'ltr'}
          className="fixed bottom-6 start-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-800 border border-slate-700 shadow-2xl text-white">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-semibold">{tr(step.titleAr, step.titleEn)}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tr(step.descAr, step.descEn)}</p>
              </div>
              <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-700/50">
              <span className="text-[10px] text-slate-500">
                {tr('استخدم القائمة الجانبية للتنقل', 'Use the sidebar to navigate')}
              </span>
              <button
                onClick={onDismiss}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors"
              >
                {tr('فهمت', 'Got it')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
