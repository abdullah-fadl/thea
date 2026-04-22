'use client';

import { useLang } from '@/hooks/use-lang';
import ProductHero from '@/components/website/sections/ProductHero';
import FeaturesGrid from '@/components/website/sections/FeaturesGrid';
import CTASection from '@/components/website/sections/CTASection';
import {
  Heart,
  Stethoscope,
  FlaskConical,
  CalendarCheck,
  FileHeart,
  Pill,
  ClipboardList,
  Scan,
  UserRound,
  Activity,
  Hospital,
  ShieldCheck,
} from 'lucide-react';

const features = [
  {
    icon: FileHeart,
    title: 'Patient Records',
    titleAr: 'سجلات المرضى',
    description:
      'Comprehensive digital patient records with medical history, diagnoses, and treatment plans.',
    descriptionAr:
      'سجلات رقمية شاملة للمرضى مع التاريخ الطبي والتشخيصات وخطط العلاج.',
  },
  {
    icon: FlaskConical,
    title: 'Lab Integration',
    titleAr: 'تكامل المختبرات',
    description:
      'Seamless lab order management, result tracking, and automated reporting.',
    descriptionAr:
      'إدارة سلسة لطلبات المختبر، تتبع النتائج، والتقارير التلقائية.',
  },
  {
    icon: CalendarCheck,
    title: 'Appointment Scheduling',
    titleAr: 'جدولة المواعيد',
    description:
      'Smart scheduling with automated reminders, waitlist management, and online booking.',
    descriptionAr:
      'جدولة ذكية مع تذكيرات تلقائية، إدارة قوائم الانتظار، والحجز الإلكتروني.',
  },
  {
    icon: Pill,
    title: 'Pharmacy Management',
    titleAr: 'إدارة الصيدلية',
    description:
      'E-prescriptions, drug interaction alerts, and inventory management.',
    descriptionAr:
      'وصفات إلكترونية، تنبيهات تفاعلات الأدوية، وإدارة المخزون.',
  },
  {
    icon: Stethoscope,
    title: 'Clinical Decision Support',
    titleAr: 'دعم القرار السريري',
    description:
      'AI-assisted diagnosis suggestions, treatment protocols, and clinical guidelines.',
    descriptionAr:
      'اقتراحات تشخيص بالذكاء الاصطناعي، بروتوكولات العلاج، والإرشادات السريرية.',
  },
  {
    icon: ClipboardList,
    title: 'Medical Billing',
    titleAr: 'الفوترة الطبية',
    description:
      'Insurance claim management, ICD-10 coding, and revenue cycle management.',
    descriptionAr:
      'إدارة مطالبات التأمين، ترميز ICD-10، وإدارة دورة الإيرادات.',
  },
  {
    icon: Scan,
    title: 'Radiology Integration',
    titleAr: 'تكامل الأشعة',
    description:
      'PACS integration, DICOM viewer, and radiology report management.',
    descriptionAr:
      'تكامل PACS، عارض DICOM، وإدارة تقارير الأشعة.',
  },
  {
    icon: UserRound,
    title: 'Patient Portal',
    titleAr: 'بوابة المريض',
    description:
      'Patient self-service for appointments, results, prescriptions, and telemedicine.',
    descriptionAr:
      'خدمة ذاتية للمريض للمواعيد والنتائج والوصفات والطب عن بُعد.',
  },
  {
    icon: Activity,
    title: 'Vital Signs Monitoring',
    titleAr: 'مراقبة العلامات الحيوية',
    description:
      'Real-time patient monitoring, alerts, and trend analysis dashboards.',
    descriptionAr:
      'مراقبة فورية للمرضى، تنبيهات، ولوحات تحليل الاتجاهات.',
  },
  {
    icon: Hospital,
    title: 'Ward Management',
    titleAr: 'إدارة الأجنحة',
    description:
      'Bed management, admission/discharge workflows, and occupancy tracking.',
    descriptionAr:
      'إدارة الأسرّة، سير عمل الدخول/الخروج، وتتبع الإشغال.',
  },
  {
    icon: Heart,
    title: 'Telemedicine',
    titleAr: 'الطب عن بُعد',
    description:
      'Video consultations, secure messaging, and remote patient monitoring.',
    descriptionAr:
      'استشارات فيديو، رسائل آمنة، ومراقبة المرضى عن بُعد.',
  },
  {
    icon: ShieldCheck,
    title: 'NHIC Compliance',
    titleAr: 'امتثال NHIC',
    description:
      'Full compliance with Saudi NHIC standards, CBAHI requirements, and data sovereignty.',
    descriptionAr:
      'امتثال كامل لمعايير NHIC السعودية، متطلبات CBAHI، وسيادة البيانات.',
  },
];

export default function TheaEHRContent() {
  return (
    <>
      <ProductHero
        title="Thea EHR"
        titleAr="Thea EHR"
        subtitle="Comprehensive Electronic Health Records platform with AI-assisted clinical decision support, lab integration, and full Saudi NHIC compliance."
        subtitleAr="منصة سجلات صحية إلكترونية شاملة مع دعم القرار السريري بالذكاء الاصطناعي، تكامل المختبرات، والامتثال الكامل لـ NHIC السعودية."
        badge="Healthcare Platform"
        badgeAr="منصة الرعاية الصحية"
        gradient="teal"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <FeaturesGrid features={features} />
      </div>
      <CTASection />
    </>
  );
}
