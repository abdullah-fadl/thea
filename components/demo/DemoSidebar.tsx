'use client';

import { useLang } from '@/hooks/use-lang';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  LayoutDashboard, Users, UserCircle, ClipboardList, FlaskConical, FileText,
  Siren, Bed, Pill, ScanLine, Calendar, Heart, Scissors, Smile, Baby,
  ShieldCheck, UserPlus, BookOpen,
  ArrowLeft, ArrowRight,
} from 'lucide-react';

const steps = [
  { key: 'dashboard', Icon: LayoutDashboard, ar: 'لوحة المعلومات', en: 'Dashboard' },
  { key: 'registration', Icon: UserPlus, ar: 'التسجيل', en: 'Registration' },
  { key: 'opd', Icon: Users, ar: 'العيادات الخارجية', en: 'OPD Queue' },
  { key: 'patient', Icon: UserCircle, ar: 'ملف المريض', en: 'Patient Record' },
  { key: 'er', Icon: Siren, ar: 'الطوارئ', en: 'Emergency' },
  { key: 'ipd', Icon: Bed, ar: 'التنويم', en: 'Inpatient' },
  { key: 'orders', Icon: ClipboardList, ar: 'الطلبات', en: 'Orders' },
  { key: 'lab', Icon: FlaskConical, ar: 'المختبر', en: 'Lab Results' },
  { key: 'radiology', Icon: ScanLine, ar: 'الأشعة', en: 'Radiology' },
  { key: 'pharmacy', Icon: Pill, ar: 'الصيدلية', en: 'Pharmacy' },
  { key: 'nursing', Icon: Heart, ar: 'التمريض', en: 'Nursing' },
  { key: 'or', Icon: Scissors, ar: 'غرف العمليات', en: 'Operating Rooms' },
  { key: 'scheduling', Icon: Calendar, ar: 'المواعيد', en: 'Scheduling' },
  { key: 'dental', Icon: Smile, ar: 'طب الأسنان', en: 'Dental' },
  { key: 'obgyn', Icon: Baby, ar: 'النساء والولادة', en: 'OB/GYN' },
  { key: 'billing', Icon: FileText, ar: 'الفوترة', en: 'Billing' },
  { key: 'quality', Icon: ShieldCheck, ar: 'الجودة', en: 'Quality' },
  { key: 'sam', Icon: BookOpen, ar: 'السياسات', en: 'Policies (SAM)' },
];

interface DemoSidebarProps {
  activeStep: string;
  onStepChange: (step: string) => void;
}

export default function DemoSidebar({ activeStep, onStepChange }: DemoSidebarProps) {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div
      className="w-[220px] flex-shrink-0 flex flex-col h-full"
      style={{ background: '#0B1220' }}
    >
      {/* Brand */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: '#1D4ED8' }}>
            T
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Thea Health</div>
            <div className="text-[10px] text-slate-500">{tr('وضع التجربة', 'Demo Mode')}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {steps.map((step) => {
          const isActive = activeStep === step.key;
          return (
            <button
              key={step.key}
              onClick={() => onStepChange(step.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                isActive
                  ? 'bg-white/8 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/4'
              }`}
            >
              <step.Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{tr(step.ar, step.en)}</span>
              {isActive && (
                <motion.div
                  layoutId="demo-active-dot"
                  className="w-1.5 h-1.5 rounded-full ms-auto flex-shrink-0"
                  style={{ background: '#1D4ED8' }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Exit */}
      <div className="p-3 border-t border-white/10">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
          {tr('الخروج من التجربة', 'Exit Demo')}
        </Link>
      </div>
    </div>
  );
}

export { steps as DEMO_STEPS };
