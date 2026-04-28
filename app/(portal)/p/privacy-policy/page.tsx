'use client';

import { Shield, Database, FileText, Users, Clock, Lock, Mail, RefreshCw, Scale, Eye } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

export default function PrivacyPolicyPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">{tr('سياسة الخصوصية', 'Privacy Policy')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tr(
            'وفقاً لنظام حماية البيانات الشخصية (PDPL) في المملكة العربية السعودية',
            'In accordance with the Saudi Personal Data Protection Law (PDPL)'
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {tr('آخر تحديث: ٢٧ مارس ٢٠٢٦', 'Last Updated: March 27, 2026')}
        </p>
      </div>

      {/* 1. Data Controller */}
      <Section
        icon={Shield}
        title={tr('١. المسؤول عن البيانات', '1. Data Controller')}
        iconColor="bg-blue-100 text-blue-600"
      >
        <p className="text-sm text-muted-foreground leading-relaxed">
          {tr(
            'شركة ثيا هيلث ("ثيا"، "نحن"، "لنا") هي المسؤولة عن معالجة بياناتك الشخصية بصفتها مقدم خدمات الرعاية الصحية الإلكترونية. نلتزم بحماية خصوصيتك وفقاً لنظام حماية البيانات الشخصية في المملكة العربية السعودية.',
            'Thea Health ("Thea", "we", "us") is the data controller responsible for processing your personal data as an electronic healthcare services provider. We are committed to protecting your privacy in accordance with the Saudi Personal Data Protection Law (PDPL).'
          )}
        </p>
      </Section>

      {/* 2. Data We Collect */}
      <Section
        icon={Database}
        title={tr('٢. البيانات التي نجمعها', '2. Data We Collect')}
        iconColor="bg-purple-100 text-purple-600"
      >
        <p className="text-sm text-muted-foreground mb-3">
          {tr(
            'نجمع ونعالج الأنواع التالية من البيانات الشخصية لتقديم خدمات الرعاية الصحية:',
            'We collect and process the following categories of personal data to provide healthcare services:'
          )}
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <DataItem label={tr('البيانات الديموغرافية', 'Demographics')} desc={tr('الاسم، تاريخ الميلاد، الجنس، الجنسية، رقم الهوية', 'Name, date of birth, gender, nationality, ID number')} />
          <DataItem label={tr('معلومات الاتصال', 'Contact Information')} desc={tr('رقم الهاتف، البريد الإلكتروني، العنوان', 'Phone number, email address, physical address')} />
          <DataItem label={tr('السجلات الطبية', 'Medical Records')} desc={tr('التاريخ المرضي، التشخيصات، ملاحظات الزيارات، الفحوصات السريرية', 'Medical history, diagnoses, visit notes, clinical examinations')} />
          <DataItem label={tr('نتائج المختبر', 'Laboratory Results')} desc={tr('التحاليل المخبرية ونتائج الفحوصات', 'Lab tests and diagnostic results')} />
          <DataItem label={tr('الوصفات الطبية', 'Prescriptions')} desc={tr('الأدوية الموصوفة والجرعات والتعليمات', 'Prescribed medications, dosages, and instructions')} />
          <DataItem label={tr('المؤشرات الحيوية', 'Vital Signs')} desc={tr('ضغط الدم، معدل النبض، الحرارة، الوزن، الطول', 'Blood pressure, heart rate, temperature, weight, height')} />
          <DataItem label={tr('بيانات الفوترة والتأمين', 'Billing & Insurance')} desc={tr('معلومات التأمين، سجلات الفوترة، تفاصيل الدفع', 'Insurance information, billing records, payment details')} />
        </ul>
      </Section>

      {/* 3. Purpose of Processing */}
      <Section
        icon={FileText}
        title={tr('٣. أغراض المعالجة', '3. Purpose of Processing')}
        iconColor="bg-green-100 text-green-600"
      >
        <p className="text-sm text-muted-foreground mb-3">
          {tr('نعالج بياناتك الشخصية للأغراض التالية:', 'We process your personal data for the following purposes:')}
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <BulletItem text={tr('تقديم خدمات الرعاية الصحية والعلاج الطبي', 'Providing healthcare services and medical treatment')} />
          <BulletItem text={tr('تنسيق الرعاية بين الأطباء والأقسام المعالجة', 'Coordinating care between treating physicians and departments')} />
          <BulletItem text={tr('إصدار الفواتير ومعالجة مطالبات التأمين', 'Billing and processing insurance claims')} />
          <BulletItem text={tr('تحسين جودة الخدمات الصحية المقدمة', 'Improving the quality of healthcare services')} />
          <BulletItem text={tr('الامتثال للمتطلبات القانونية والتنظيمية', 'Complying with legal and regulatory requirements')} />
          <BulletItem text={tr('إرسال التذكيرات والإشعارات المتعلقة بمواعيدك وعلاجك', 'Sending reminders and notifications related to your appointments and treatment')} />
        </ul>
      </Section>

      {/* 4. Legal Basis */}
      <Section
        icon={Scale}
        title={tr('٤. الأساس القانوني للمعالجة', '4. Legal Basis for Processing')}
        iconColor="bg-amber-100 text-amber-600"
      >
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {tr(
            'نعالج بياناتك الشخصية استناداً إلى المادة السادسة من نظام حماية البيانات الشخصية، وتحديداً:',
            'We process your personal data based on Article 6 of the PDPL, specifically:'
          )}
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <BulletItem text={tr(
            'موافقتك الصريحة: نحصل على موافقتك قبل جمع ومعالجة بياناتك الشخصية',
            'Your explicit consent: We obtain your consent before collecting and processing your personal data'
          )} />
          <BulletItem text={tr(
            'المصلحة المشروعة: معالجة البيانات الضرورية لتقديم الرعاية الصحية وحماية صحتك',
            'Legitimate interest: Processing necessary for providing healthcare and protecting your health'
          )} />
          <BulletItem text={tr(
            'الالتزام القانوني: الامتثال لأنظمة وزارة الصحة والجهات التنظيمية',
            'Legal obligation: Compliance with Ministry of Health regulations and regulatory authorities'
          )} />
        </ul>
      </Section>

      {/* 5. Data Sharing */}
      <Section
        icon={Users}
        title={tr('٥. مشاركة البيانات', '5. Data Sharing')}
        iconColor="bg-cyan-100 text-cyan-600"
      >
        <p className="text-sm text-muted-foreground mb-3">
          {tr(
            'قد نشارك بياناتك الشخصية مع الأطراف التالية فقط عند الضرورة:',
            'We may share your personal data with the following parties only when necessary:'
          )}
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <BulletItem text={tr('الأطباء والكوادر الطبية المعالجة لحالتك', 'Treating physicians and medical staff involved in your care')} />
          <BulletItem text={tr('المختبرات ومراكز التشخيص لإجراء الفحوصات المطلوبة', 'Laboratories and diagnostic centers for required tests')} />
          <BulletItem text={tr('الصيدليات لصرف الأدوية الموصوفة', 'Pharmacies for dispensing prescribed medications')} />
          <BulletItem text={tr('شركات التأمين لمعالجة المطالبات المالية', 'Insurance companies for processing financial claims')} />
          <BulletItem text={tr('الجهات الحكومية عند الطلب وفقاً للأنظمة المعمول بها', 'Government authorities when required by applicable regulations')} />
        </ul>
        <p className="text-sm text-muted-foreground mt-3 font-medium">
          {tr(
            'لا نبيع أو نشارك بياناتك الشخصية مع أطراف ثالثة لأغراض تسويقية.',
            'We do not sell or share your personal data with third parties for marketing purposes.'
          )}
        </p>
      </Section>

      {/* 6. Data Retention */}
      <Section
        icon={Clock}
        title={tr('٦. الاحتفاظ بالبيانات', '6. Data Retention')}
        iconColor="bg-orange-100 text-orange-600"
      >
        <p className="text-sm text-muted-foreground mb-3">
          {tr(
            'نحتفظ ببياناتك الشخصية وفقاً للمتطلبات التنظيمية التالية:',
            'We retain your personal data in accordance with the following regulatory requirements:'
          )}
        </p>
        <div className="space-y-2">
          <RetentionRow
            label={tr('السجلات الطبية', 'Medical Records')}
            period={tr('١٠ سنوات', '10 years')}
            note={tr('متطلبات وزارة الصحة السعودية', 'Saudi MOH requirement')}
          />
          <RetentionRow
            label={tr('سجلات الفوترة', 'Billing Records')}
            period={tr('٧ سنوات', '7 years')}
            note={tr('متطلبات مالية وتنظيمية', 'Financial and regulatory requirements')}
          />
          <RetentionRow
            label={tr('سجلات التدقيق', 'Audit Logs')}
            period={tr('٧ سنوات', '7 years')}
            note={tr('متطلبات الأمان والامتثال', 'Security and compliance requirements')}
          />
        </div>
      </Section>

      {/* 7. Your Rights Under PDPL */}
      <Section
        icon={Eye}
        title={tr('٧. حقوقك بموجب نظام حماية البيانات الشخصية', '7. Your Rights Under PDPL')}
        iconColor="bg-indigo-100 text-indigo-600"
      >
        <p className="text-sm text-muted-foreground mb-3">
          {tr(
            'يكفل لك نظام حماية البيانات الشخصية الحقوق التالية:',
            'The PDPL guarantees you the following rights:'
          )}
        </p>
        <div className="space-y-3">
          <RightItem
            title={tr('حق الوصول إلى البيانات (طلب الوصول)', 'Right to Access Your Data')}
            desc={tr(
              'يحق لك طلب الاطلاع على بياناتك الشخصية المحفوظة لدينا والحصول على نسخة منها.',
              'You have the right to request access to your personal data held by us and obtain a copy of it.'
            )}
          />
          <RightItem
            title={tr('حق تصحيح البيانات (تصحيح البيانات)', 'Right to Correct Inaccurate Data')}
            desc={tr(
              'يحق لك طلب تصحيح أي بيانات شخصية غير دقيقة أو غير مكتملة.',
              'You have the right to request correction of any inaccurate or incomplete personal data.'
            )}
          />
          <RightItem
            title={tr('حق حذف البيانات (حذف البيانات)', 'Right to Delete Data')}
            desc={tr(
              'يحق لك طلب حذف بياناتك الشخصية، مع مراعاة الاستثناءات الطبية والقانونية التي تلزمنا بالاحتفاظ بالسجلات الطبية.',
              'You have the right to request deletion of your personal data, subject to medical and legal exceptions that require us to retain medical records.'
            )}
          />
          <RightItem
            title={tr('حق سحب الموافقة (سحب الموافقة)', 'Right to Withdraw Consent')}
            desc={tr(
              'يحق لك سحب موافقتك على معالجة بياناتك في أي وقت، دون أن يؤثر ذلك على مشروعية المعالجة السابقة.',
              'You have the right to withdraw your consent to data processing at any time, without affecting the lawfulness of prior processing.'
            )}
          />
          <RightItem
            title={tr('حق نقل البيانات (نقل البيانات)', 'Right to Data Portability')}
            desc={tr(
              'يحق لك طلب نقل بياناتك الشخصية إلى مقدم خدمة آخر بصيغة إلكترونية منظمة.',
              'You have the right to request transfer of your personal data to another service provider in a structured electronic format.'
            )}
          />
          <RightItem
            title={tr('حق الاعتراض على المعالجة (الاعتراض على المعالجة)', 'Right to Object to Processing')}
            desc={tr(
              'يحق لك الاعتراض على معالجة بياناتك الشخصية في حالات معينة وفقاً لأحكام النظام.',
              'You have the right to object to the processing of your personal data in certain circumstances as provided by the law.'
            )}
          />
        </div>
      </Section>

      {/* 8. Data Security */}
      <Section
        icon={Lock}
        title={tr('٨. أمن البيانات', '8. Data Security')}
        iconColor="bg-red-100 text-red-600"
      >
        <p className="text-sm text-muted-foreground mb-3">
          {tr(
            'نتخذ التدابير التقنية والتنظيمية المناسبة لحماية بياناتك الشخصية، بما في ذلك:',
            'We implement appropriate technical and organizational measures to protect your personal data, including:'
          )}
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <BulletItem text={tr('تشفير البيانات أثناء النقل والتخزين (TLS/AES-256)', 'Encryption of data in transit and at rest (TLS/AES-256)')} />
          <BulletItem text={tr('ضوابط صارمة للوصول قائمة على الأدوار والصلاحيات', 'Strict role-based access controls and permissions')} />
          <BulletItem text={tr('تسجيل ومراقبة جميع عمليات الوصول إلى البيانات', 'Logging and monitoring of all data access operations')} />
          <BulletItem text={tr('تقييمات دورية للمخاطر الأمنية واختبارات الاختراق', 'Regular security risk assessments and penetration testing')} />
          <BulletItem text={tr('تدريب الموظفين على أمن المعلومات وحماية البيانات', 'Employee training on information security and data protection')} />
        </ul>
      </Section>

      {/* 9. Contact Information */}
      <Section
        icon={Mail}
        title={tr('٩. معلومات الاتصال', '9. Contact Information')}
        iconColor="bg-teal-100 text-teal-600"
      >
        <p className="text-sm text-muted-foreground mb-3">
          {tr(
            'للاستفسار عن سياسة الخصوصية أو لممارسة حقوقك بموجب نظام حماية البيانات الشخصية، يرجى التواصل مع مسؤول حماية البيانات:',
            'For inquiries about this privacy policy or to exercise your rights under the PDPL, please contact our Data Protection Officer:'
          )}
        </p>
        <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
          <p className="font-medium text-foreground">{tr('مسؤول حماية البيانات', 'Data Protection Officer')}</p>
          <p className="text-muted-foreground">{tr('شركة ثيا هيلث', 'Thea Health')}</p>
          <p className="text-muted-foreground">{tr('البريد الإلكتروني', 'Email')}: privacy@thea.com.sa</p>
          <p className="text-muted-foreground">{tr('الهاتف', 'Phone')}: +966 11 000 0000</p>
        </div>
      </Section>

      {/* 10. Policy Updates */}
      <Section
        icon={RefreshCw}
        title={tr('١٠. تحديثات السياسة', '10. Policy Updates')}
        iconColor="bg-slate-100 text-slate-600"
      >
        <p className="text-sm text-muted-foreground leading-relaxed">
          {tr(
            'قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر لتعكس التغييرات في ممارساتنا أو المتطلبات التنظيمية. سنقوم بإخطارك بأي تغييرات جوهرية عبر البريد الإلكتروني أو من خلال إشعار بارز في البوابة الإلكترونية. ننصحك بمراجعة هذه السياسة بشكل دوري.',
            'We may update this privacy policy from time to time to reflect changes in our practices or regulatory requirements. We will notify you of any material changes via email or through a prominent notice on the portal. We encourage you to review this policy periodically.'
          )}
        </p>
      </Section>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function Section({
  icon: Icon,
  title,
  iconColor,
  children,
}: {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function DataItem({ label, desc }: { label: string; desc: string }) {
  return (
    <li className="flex flex-col">
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-xs">{desc}</span>
    </li>
  );
}

function BulletItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
      <span>{text}</span>
    </li>
  );
}

function RetentionRow({ label, period, note }: { label: string; period: string; note: string }) {
  return (
    <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <span className="text-sm font-bold text-foreground">{period}</span>
    </div>
  );
}

function RightItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-muted/50 rounded-xl px-4 py-3">
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
