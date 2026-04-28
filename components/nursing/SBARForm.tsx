'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle,
  Zap, Clock, Phone, FileText, Send, RotateCcw,
} from 'lucide-react';
import {
  type SBARData, DEFAULT_SBAR, autoPopulateSBAR, calculateSBARCompleteness,
  SBAR_URGENCY_OPTIONS, SBAR_METHOD_OPTIONS, SBAR_RECIPIENT_ROLES,
  type AutoPopulateContext,
} from '@/lib/clinical/sbarTemplate';
import { useLang } from '@/hooks/use-lang';

interface SBARFormProps {
  initialData?: SBARData | null;
  autoPopulateCtx?: AutoPopulateContext;
  onChange?: (data: SBARData) => void;
  disabled?: boolean;
}

export function SBARForm({ initialData, autoPopulateCtx, onChange, disabled = false }: SBARFormProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [sbar, setSbar] = useState<SBARData>(() => initialData || { ...DEFAULT_SBAR });
  const [expandedSection, setExpandedSection] = useState<string | null>('situation');
  const [showMeta, setShowMeta] = useState(false);

  useEffect(() => {
    if (initialData) setSbar(initialData);
  }, [initialData]);

  useEffect(() => {
    if (onChange) onChange(sbar);
  }, [sbar]);

  const completeness = useMemo(() => calculateSBARCompleteness(sbar), [sbar]);

  const handleAutoPopulate = () => {
    if (!autoPopulateCtx || disabled) return;
    const auto = autoPopulateSBAR(autoPopulateCtx);
    setSbar(prev => ({
      ...prev,
      situation: { ...prev.situation, ...auto.situation },
      background: { ...prev.background, ...auto.background },
      assessment: { ...prev.assessment, ...auto.assessment },
    }));
  };

  const updateField = (section: keyof SBARData, field: string, value: any) => {
    if (disabled) return;
    setSbar(prev => ({
      ...prev,
      [section]: { ...(prev[section] as Record<string, any>), [field]: value },
    }));
  };

  const sections = [
    {
      key: 'situation',
      label: tr('الموقف (S)', 'Situation (S)'),
      subtitle: tr('ماذا يحدث الآن؟', 'What is happening now?'),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      fields: [
        { key: 'reason', label: tr('سبب التواصل', 'Reason for communication'), placeholder: tr('مثال: تدهور في العلامات الحيوية', 'e.g., Deterioration in vital signs'), multiline: false },
        { key: 'currentStatus', label: tr('الحالة الحالية', 'Current status'), placeholder: tr('مثال: المريض واعي لكن يشكي من ضيق تنفس', 'e.g., Patient conscious but complaining of dyspnea'), multiline: true },
        { key: 'onsetTime', label: tr('وقت البداية', 'Onset time'), placeholder: tr('مثال: منذ 30 دقيقة', 'e.g., 30 minutes ago'), multiline: false },
      ],
    },
    {
      key: 'background',
      label: tr('الخلفية (B)', 'Background (B)'),
      subtitle: tr('ما هي الخلفية السريرية؟', 'What is the clinical background?'),
      icon: FileText,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      fields: [
        { key: 'admissionReason', label: tr('سبب الزيارة / الإدخال', 'Reason for visit / admission'), placeholder: '', multiline: false },
        { key: 'relevantHistory', label: tr('التاريخ المرضي ذو الصلة', 'Relevant medical history'), placeholder: '', multiline: true },
        { key: 'allergies', label: tr('الحساسية', 'Allergies'), placeholder: tr('مثال: NKDA أو بنسلين', 'e.g., NKDA or Penicillin'), multiline: false },
        { key: 'currentMedications', label: tr('الأدوية الحالية', 'Current medications'), placeholder: '', multiline: true },
        { key: 'recentChanges', label: tr('تغييرات حديثة', 'Recent changes'), placeholder: tr('أي تغييرات في الحالة أو العلاج', 'Any changes in condition or treatment'), multiline: true },
      ],
    },
    {
      key: 'assessment',
      label: tr('التقييم (A)', 'Assessment (A)'),
      subtitle: tr('ما رأيك في المشكلة؟', 'What do you think the problem is?'),
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      fields: [
        { key: 'currentVitals', label: tr('العلامات الحيوية الحالية', 'Current vitals'), placeholder: '', multiline: false },
        { key: 'relevantScores', label: tr('المقاييس السريرية', 'Clinical scores'), placeholder: 'NEWS2, GCS, Fall Risk', multiline: false },
        { key: 'clinicalImpression', label: tr('الانطباع السريري', 'Clinical impression'), placeholder: tr('مثال: أعتقد أن المريض يعاني من...', 'e.g., I think the patient is experiencing...'), multiline: true },
        { key: 'changesFromBaseline', label: tr('التغير عن الحالة الأساسية', 'Changes from baseline'), placeholder: '', multiline: true },
      ],
    },
    {
      key: 'recommendation',
      label: tr('التوصية (R)', 'Recommendation (R)'),
      subtitle: tr('ماذا تطلب / توصي؟', 'What do you request / recommend?'),
      icon: Send,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      fields: [
        { key: 'requestedAction', label: tr('الإجراء المطلوب', 'Requested action'), placeholder: tr('مثال: أرجو الحضور لتقييم المريض', 'e.g., Please come to assess the patient'), multiline: true },
        { key: 'timeframe', label: tr('الإطار الزمني', 'Timeframe'), placeholder: tr('مثال: خلال 15 دقيقة', 'e.g., Within 15 minutes'), multiline: false },
        { key: 'additionalTests', label: tr('فحوصات / تحاليل إضافية', 'Additional tests / labs'), placeholder: '', multiline: false },
        { key: 'nursingPlan', label: tr('خطة التمريض المؤقتة', 'Interim nursing plan'), placeholder: tr('ماذا ستفعل أثناء الانتظار؟', 'What will you do while waiting?'), multiline: true },
      ],
    },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {tr('تواصل SBAR', 'SBAR Communication')}
        </label>
        {autoPopulateCtx && !disabled && (
          <button
            onClick={handleAutoPopulate}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <RotateCcw size={11} />
            {tr('تعبئة تلقائية', 'Auto-populate')}
          </button>
        )}
      </div>

      {/* Completeness bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${completeness.percent === 100 ? 'bg-emerald-500' : completeness.percent >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
            style={{ width: `${completeness.percent}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">{completeness.completed}/4</span>
      </div>

      {/* Urgency */}
      <div className="flex items-center gap-1.5">
        {SBAR_URGENCY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateField('meta', 'urgency', opt.value)}
            disabled={disabled}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              sbar.meta.urgency === opt.value
                ? `${opt.colorClass} border-current/30 shadow-sm`
                : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted'
            }`}
          >
            {language === 'ar' ? opt.labelAr : opt.labelEn}
          </button>
        ))}
      </div>

      {/* SBAR Sections */}
      {sections.map((section) => {
        const isExpanded = expandedSection === section.key;
        const isComplete = completeness.sections[section.key as keyof typeof completeness.sections];
        const Icon = section.icon;

        return (
          <div key={section.key} className={`rounded-xl border overflow-hidden ${isComplete ? section.borderColor : 'border-border'}`}>
            <button
              onClick={() => setExpandedSection(isExpanded ? null : section.key)}
              className={`w-full flex items-center justify-between px-3 py-2.5 ${isComplete ? section.bgColor : 'bg-muted/20'}`}
            >
              <div className="flex items-center gap-2">
                {isComplete ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <Icon size={16} className={section.color} />
                )}
                <span className={`text-sm font-semibold ${isComplete ? section.color : 'text-foreground'}`}>
                  {section.label}
                </span>
                <span className="text-[10px] text-muted-foreground">{section.subtitle}</span>
              </div>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {isExpanded && (
              <div className="p-3 space-y-3 bg-white/60 dark:bg-black/10">
                {section.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-[11px] font-medium text-foreground mb-1">{field.label}</label>
                    {field.multiline ? (
                      <textarea
                        value={(sbar[section.key as keyof SBARData] as Record<string, string>)?.[field.key] || ''}
                        onChange={(e) => updateField(section.key as keyof SBARData, field.key, e.target.value)}
                        disabled={disabled}
                        placeholder={field.placeholder}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-muted/20 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                      />
                    ) : (
                      <input
                        value={(sbar[section.key as keyof SBARData] as Record<string, string>)?.[field.key] || ''}
                        onChange={(e) => updateField(section.key as keyof SBARData, field.key, e.target.value)}
                        disabled={disabled}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-muted/20 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Communication Meta */}
      <button
        onClick={() => setShowMeta(!showMeta)}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Phone size={12} />
        {tr('تفاصيل التواصل', 'Communication details')}
        {showMeta ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {showMeta && (
        <div className="p-3 rounded-xl border border-border space-y-3 bg-muted/10">
          {/* Recipient role */}
          <div>
            <label className="block text-[11px] font-medium text-foreground mb-1">{tr('الجهة المستلمة', 'Recipient role')}</label>
            <div className="flex flex-wrap gap-1.5">
              {SBAR_RECIPIENT_ROLES.map((role) => (
                <button
                  key={role.value}
                  onClick={() => updateField('meta', 'recipientRole', role.value)}
                  disabled={disabled}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all border ${
                    sbar.meta.recipientRole === role.value
                      ? 'bg-primary/10 border-primary/30 text-foreground font-medium'
                      : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {language === 'ar' ? role.labelAr : role.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient name */}
          <div>
            <label className="block text-[11px] font-medium text-foreground mb-1">{tr('اسم المستلم', 'Recipient name')}</label>
            <input
              value={sbar.meta.recipientName}
              onChange={(e) => updateField('meta', 'recipientName', e.target.value)}
              disabled={disabled}
              placeholder={tr('اسم الطبيب / الممرض', 'Doctor / Nurse name')}
              className="w-full px-3 py-2 rounded-lg border border-border bg-muted/20 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
            />
          </div>

          {/* Method */}
          <div>
            <label className="block text-[11px] font-medium text-foreground mb-1">{tr('طريقة التواصل', 'Communication method')}</label>
            <div className="flex gap-1.5">
              {SBAR_METHOD_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => updateField('meta', 'method', m.value)}
                  disabled={disabled}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    sbar.meta.method === m.value
                      ? 'bg-primary/10 border-primary/30 text-foreground'
                      : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {language === 'ar' ? m.labelAr : m.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Read-back confirmation */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sbar.meta.readBackConfirmed}
              onChange={(e) => updateField('meta', 'readBackConfirmed', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs text-foreground">
              {tr('تم التأكيد بالإعادة (Read-back)', 'Read-back confirmed')}
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
