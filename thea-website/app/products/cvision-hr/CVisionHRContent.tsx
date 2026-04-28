"use client";

import { useLanguage } from "@/context/LanguageContext";
import ProductHero from "@/components/sections/ProductHero";
import FeaturesGrid from "@/components/sections/FeaturesGrid";
import CTASection from "@/components/sections/CTASection";
import {
  Users,
  Brain,
  DollarSign,
  BarChart3,
  Calendar,
  FileText,
  Shield,
  Zap,
  Clock,
  GraduationCap,
  Building2,
  UserCheck,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Recruitment",
    titleAr: "توظيف ذكي بالذكاء الاصطناعي",
    description:
      "Smart candidate matching, automated screening, and AI-powered interview scheduling.",
    descriptionAr:
      "مطابقة ذكية للمرشحين، فرز تلقائي، وجدولة مقابلات بالذكاء الاصطناعي.",
  },
  {
    icon: DollarSign,
    title: "Payroll Management",
    titleAr: "إدارة الرواتب",
    description:
      "Automated payroll processing with GOSI & Mudad integration. WPS compliant.",
    descriptionAr:
      "معالجة الرواتب تلقائياً مع تكامل التأمينات الاجتماعية ومدد. متوافق مع نظام حماية الأجور.",
  },
  {
    icon: BarChart3,
    title: "Performance Tracking",
    titleAr: "تتبع الأداء",
    description:
      "360° performance reviews, KPI tracking, and real-time analytics dashboard.",
    descriptionAr:
      "تقييم أداء 360 درجة، تتبع مؤشرات الأداء، ولوحة تحليلات فورية.",
  },
  {
    icon: Calendar,
    title: "Leave Management",
    titleAr: "إدارة الإجازات",
    description:
      "Automated leave requests, approval workflows, and balance tracking per Saudi labor law.",
    descriptionAr:
      "طلبات إجازة تلقائية، سير عمل الموافقات، وتتبع الأرصدة حسب نظام العمل السعودي.",
  },
  {
    icon: FileText,
    title: "Document Management",
    titleAr: "إدارة المستندات",
    description:
      "Digital employee files, contract management, and automated document generation.",
    descriptionAr:
      "ملفات الموظفين الرقمية، إدارة العقود، وإنشاء المستندات التلقائي.",
  },
  {
    icon: Shield,
    title: "Compliance Engine",
    titleAr: "محرك الامتثال",
    description:
      "Built-in Saudi labor law compliance, Nitaqat tracking, and regulatory reporting.",
    descriptionAr:
      "امتثال مدمج لنظام العمل السعودي، تتبع نطاقات، والتقارير التنظيمية.",
  },
  {
    icon: Zap,
    title: "Self-Service Portal",
    titleAr: "بوابة الخدمة الذاتية",
    description:
      "Employee self-service for requests, payslips, and personal info updates.",
    descriptionAr:
      "خدمة ذاتية للموظفين للطلبات، كشوف الرواتب، وتحديث المعلومات الشخصية.",
  },
  {
    icon: Clock,
    title: "Time & Attendance",
    titleAr: "الحضور والانصراف",
    description:
      "Biometric integration, GPS tracking, and automated shift scheduling.",
    descriptionAr:
      "تكامل البصمة، تتبع GPS، وجدولة المناوبات التلقائية.",
  },
  {
    icon: GraduationCap,
    title: "Training & Development",
    titleAr: "التدريب والتطوير",
    description:
      "Learning management system with course tracking and certification management.",
    descriptionAr:
      "نظام إدارة التعلم مع تتبع الدورات وإدارة الشهادات.",
  },
  {
    icon: Building2,
    title: "Organizational Chart",
    titleAr: "الهيكل التنظيمي",
    description:
      "Dynamic org chart visualization with department and reporting line management.",
    descriptionAr:
      "عرض الهيكل التنظيمي الديناميكي مع إدارة الأقسام وخطوط التقارير.",
  },
  {
    icon: UserCheck,
    title: "Onboarding",
    titleAr: "التهيئة والإعداد",
    description:
      "Automated onboarding workflows, checklist management, and new hire portals.",
    descriptionAr:
      "سير عمل التهيئة التلقائية، إدارة قوائم المهام، وبوابات الموظفين الجدد.",
  },
  {
    icon: Users,
    title: "Team Management",
    titleAr: "إدارة الفرق",
    description:
      "Team collaboration tools, project assignment, and workload distribution.",
    descriptionAr:
      "أدوات التعاون الجماعي، تعيين المشاريع، وتوزيع عبء العمل.",
  },
];

export default function CVisionHRContent() {
  const { t } = useLanguage();

  return (
    <>
      <ProductHero
        title="CVision HR"
        titleAr="CVision HR"
        subtitle="AI-powered Human Resources platform that streamlines recruitment, payroll, performance management, and ensures full Saudi labor law compliance."
        subtitleAr="منصة موارد بشرية مدعومة بالذكاء الاصطناعي تبسط التوظيف والرواتب وإدارة الأداء وتضمن الامتثال الكامل لنظام العمل السعودي."
        badge="AI-Powered HR Platform"
        badgeAr="منصة HR بالذكاء الاصطناعي"
        gradient="primary"
      />
      <FeaturesGrid features={features} />
      <CTASection />
    </>
  );
}
