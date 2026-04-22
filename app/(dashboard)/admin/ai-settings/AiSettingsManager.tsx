'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import {
  Sparkles,
  Save,
  RefreshCw,
  TestTube2,
  Stethoscope,
  Pill,
  FileText,
  Brain,
  Check,
  X,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface AISettings {
  enabled: boolean;
  provider: 'anthropic' | 'openai';
  anthropicModel: string;
  openaiModel: string;
  features: {
    labInterpretation: boolean;
    radiologyAssist: boolean;
    clinicalDecisionSupport: boolean;
    patientSummary: boolean;
    drugInteraction: boolean;
  };
  departments: string[];
  auditEnabled: boolean;
  maxRequestsPerMinute: number;
}

interface ProviderInfo {
  available: boolean;
  model: string;
}

export default function AiSettingsManager() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data, mutate } = useSWR('/api/ai/config', fetcher);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'audit'>('settings');

  const providers: Record<string, ProviderInfo> = data?.providers || {};

  useEffect(() => {
    if (data?.settings) {
      setSettings(data.settings);
    }
  }, [data]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      mutate();
    } finally {
      setSaving(false);
    }
  };

  const updateFeature = (key: keyof AISettings['features'], value: boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      features: { ...settings.features, [key]: value },
    });
  };

  const features = [
    {
      key: 'labInterpretation' as const,
      label: tr('تفسير التحاليل', 'Lab Interpretation'),
      icon: <TestTube2 className="w-5 h-5" />,
      desc: tr('تفسير نتائج التحاليل بالذكاء الاصطناعي مع اكتشاف الأنماط', 'AI-assisted interpretation of lab results with pattern detection'),
    },
    {
      key: 'radiologyAssist' as const,
      label: tr('مساعدة الأشعة', 'Radiology Assistant'),
      icon: <Brain className="w-5 h-5" />,
      desc: tr('اقتراحات ذكية لكتابة تقارير الأشعة', 'AI suggestions for radiology report writing'),
    },
    {
      key: 'clinicalDecisionSupport' as const,
      label: tr('دعم القرار السريري', 'Clinical Decision Support'),
      icon: <Stethoscope className="w-5 h-5" />,
      desc: tr('تنبيهات وتوصيات سريرية فورية', 'Real-time clinical alerts and recommendations'),
    },
    {
      key: 'drugInteraction' as const,
      label: tr('فحص تفاعل الأدوية', 'Drug Interaction Check'),
      icon: <Pill className="w-5 h-5" />,
      desc: tr('اكتشاف تفاعلات الأدوية بالذكاء الاصطناعي', 'AI-powered medication interaction detection'),
    },
    {
      key: 'patientSummary' as const,
      label: tr('ملخص المريض', 'Patient Summary'),
      icon: <FileText className="w-5 h-5" />,
      desc: tr('ملخصات شاملة للمرضى بالذكاء الاصطناعي', 'AI-generated comprehensive patient summaries'),
    },
  ];

  if (!settings) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {tr('إعدادات الذكاء الاصطناعي', 'AI Settings')}
                </h1>
                <p className="text-sm text-muted-foreground">{tr('الإعدادات والتهيئة', 'Settings & Configuration')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => mutate()}
              className="p-2 border border-border rounded-xl hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saved ? tr('تم الحفظ', 'Saved') : tr('حفظ', 'Save')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tr('الإعدادات', 'Settings')}
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'audit'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              {tr('سجل المراجعة', 'Audit Log')}
            </div>
          </button>
        </div>

        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Master Toggle */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{tr('محرك الذكاء الاصطناعي', 'AI Engine')}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tr('تفعيل أو تعطيل جميع ميزات الذكاء الاصطناعي', 'Enable or disable all AI features globally')}
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.enabled}
                  onChange={(v) => setSettings({ ...settings, enabled: v })}
                />
              </div>
            </div>

            {/* Provider Selection */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-lg font-bold mb-4">{tr('المزود', 'AI Provider')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* OpenAI */}
                <button
                  onClick={() => setSettings({ ...settings, provider: 'openai' })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    settings.provider === 'openai'
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-border hover:border-violet-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">OpenAI</span>
                    {providers.openai?.available ? (
                      <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                        {tr('متصل', 'Connected')}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                        {tr('غير مهيأ', 'Not configured')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr('GPT-4o Mini — سريع وفعّال من حيث التكلفة', 'GPT-4o Mini — fast, cost-effective')}
                  </p>
                  <input
                    type="text"
                    value={settings.openaiModel}
                    onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 w-full px-2 py-1 text-xs border border-border rounded bg-background"
                    placeholder={tr('اسم النموذج', 'Model name')}
                  />
                </button>

                {/* Anthropic */}
                <button
                  onClick={() => setSettings({ ...settings, provider: 'anthropic' })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    settings.provider === 'anthropic'
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-border hover:border-violet-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">Anthropic (Claude)</span>
                    {providers.anthropic?.available ? (
                      <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                        {tr('متصل', 'Connected')}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                        {tr('غير مهيأ', 'Not configured')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr('Claude — تحليل سريري متقدم', 'Claude — advanced clinical reasoning')}
                  </p>
                  <input
                    type="text"
                    value={settings.anthropicModel}
                    onChange={(e) => setSettings({ ...settings, anthropicModel: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 w-full px-2 py-1 text-xs border border-border rounded bg-background"
                    placeholder={tr('اسم النموذج', 'Model name')}
                  />
                </button>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-lg font-bold mb-4">
                {tr('الميزات', 'Features')}
              </h2>
              <div className="space-y-4">
                {features.map((feat) => (
                  <div
                    key={feat.key}
                    className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-violet-100 text-violet-600 rounded-lg">
                        {feat.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold">{feat.label}</h3>
                        <p className="text-[11px] text-muted-foreground">{feat.desc}</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={settings.features[feat.key]}
                      onChange={(v) => updateFeature(feat.key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Rate Limiting */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-lg font-bold mb-4">{tr('حد الاستخدام والمراجعة', 'Rate Limiting & Audit')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">{tr('الحد الأقصى للطلبات في الدقيقة', 'Max requests per minute')}</label>
                  <input
                    type="number"
                    value={settings.maxRequestsPerMinute}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxRequestsPerMinute: parseInt(e.target.value) || 30,
                      })
                    }
                    min={1}
                    max={100}
                    className="mt-1 w-full px-3 py-2 border border-border rounded-xl text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">{tr('سجل المراجعة', 'Audit Logging')}</label>
                    <p className="text-[11px] text-muted-foreground">
                      {tr('تسجيل جميع تفاعلات الذكاء الاصطناعي للمراجعة', 'Log all AI interactions for review')}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={settings.auditEnabled}
                    onChange={(v) => setSettings({ ...settings, auditEnabled: v })}
                  />
                </div>
              </div>
            </div>

            {/* Safety Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-amber-800">{tr('ضوابط السلامة', 'Safety Guardrails')}</h3>
                  <p className="text-xs text-amber-700 mt-1">
                    {tr(
                      'تتضمن جميع ميزات الذكاء الاصطناعي تدابير سلامة إلزامية: إخلاء مسؤولية على جميع المخرجات، تقييم الثقة، إمكانية تجاوز الطبيب، وتسجيل كامل للمراجعة. الذكاء الاصطناعي لا يشخّص — بل يقدم اقتراحات لمراجعة الطبيب فقط.',
                      'All AI features include mandatory safety measures: disclaimers on all output, confidence scoring, physician override capability, and complete audit logging. AI never diagnoses — it provides suggestions for physician review only.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && <AuditLog />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-violet-600' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Audit Log Tab
// ---------------------------------------------------------------------------

function AuditLog() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data } = useSWR('/api/ai/config?stats=true', fetcher);

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h2 className="text-lg font-bold mb-4">{tr('سجل مراجعة استخدام الذكاء الاصطناعي', 'AI Usage Audit Log')}</h2>
      <p className="text-sm text-muted-foreground">
        {tr(
          'يتم تخزين سجلات مراجعة تفاعلات الذكاء الاصطناعي في مجموعة ',
          'AI interaction audit logs are stored in the '
        )}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">ai_audit_log</code>
        {tr(
          '. عرض إحصائيات الاستخدام التفصيلية وتفاعلات الذكاء الاصطناعي الفردية هنا.',
          ' collection. View detailed usage statistics and individual AI interactions here.'
        )}
      </p>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-violet-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-violet-600">&mdash;</div>
          <div className="text-[10px] text-muted-foreground">{tr('إجمالي الطلبات', 'Total Requests')}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-green-600">&mdash;</div>
          <div className="text-[10px] text-muted-foreground">{tr('ناجح', 'Successful')}</div>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-red-600">&mdash;</div>
          <div className="text-[10px] text-muted-foreground">{tr('فشل', 'Failed')}</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-blue-600">&mdash;</div>
          <div className="text-[10px] text-muted-foreground">{tr('إجمالي التوكنات', 'Total Tokens')}</div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-4">
        {tr(
          'ستظهر إحصائيات المراجعة التفصيلية بمجرد استخدام ميزات الذكاء الاصطناعي بنشاط.',
          'Detailed audit statistics will populate once AI features are actively used.'
        )}
      </p>
    </div>
  );
}
