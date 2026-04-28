'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Bell, Clock, MessageSquare, Mail, Smartphone, Send, RefreshCw, BarChart3 } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

interface Settings {
  id: string;
  enabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  portalEnabled: boolean;
  before24h: boolean;
  before2h: boolean;
  customHoursBefore: number | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  smsTemplateAr: string | null;
  smsTemplateEn: string | null;
  emailTemplateAr: string | null;
  emailTemplateEn: string | null;
}

interface Stats {
  total: number;
  sent: number;
  confirmed: number;
  cancelled: number;
  noResponse: number;
  confirmRate: number;
  cancelRate: number;
}

export default function ReminderSettingsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [genResult, setGenResult] = useState<{ created: number; skipped: number } | null>(null);
  const [processResult, setProcessResult] = useState<{ sent: number; failed: number } | null>(null);

  const { data: settings, mutate: mutateSettings } = useSWR<Settings>('/api/reminders/settings', fetcher);
  const { data: stats } = useSWR<Stats>('/api/reminders/stats', fetcher);

  const updateSetting = async (updates: Partial<Settings>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/reminders/settings', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, ...updates }),
      });
      if (res.ok) {
        mutateSettings();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch('/api/reminders/generate', { credentials: 'include', method: 'POST' });
      const data = await res.json();
      setGenResult(data);
    } finally {
      setGenerating(false);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch('/api/reminders/process', { credentials: 'include', method: 'POST' });
      const data = await res.json();
      setProcessResult(data);
    } finally {
      setProcessing(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tr('تذكيرات المواعيد', 'Appointment Reminders')}</h1>
            <p className="text-sm text-muted-foreground">{tr('إعدادات التذكيرات التلقائية', 'Automated reminder settings')}</p>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm font-medium">{tr('مفعّل', 'Enabled')}</span>
          <button
            onClick={() => updateSetting({ enabled: !settings.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.enabled ? 'bg-blue-600' : 'bg-muted'
            }`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-card transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </label>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label={tr('إجمالي التذكيرات', 'Total Reminders')}
            value={stats.total}
            icon={<Bell className="w-4 h-4" />}
            color="blue"
          />
          <StatCard
            label={tr('مرسلة', 'Sent')}
            value={stats.sent}
            icon={<Send className="w-4 h-4" />}
            color="green"
          />
          <StatCard
            label={tr('نسبة التأكيد', 'Confirm Rate')}
            value={`${stats.confirmRate}%`}
            icon={<BarChart3 className="w-4 h-4" />}
            color="emerald"
          />
          <StatCard
            label={tr('نسبة الإلغاء', 'Cancel Rate')}
            value={`${stats.cancelRate}%`}
            icon={<BarChart3 className="w-4 h-4" />}
            color="red"
          />
        </div>
      )}

      {/* Channels */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {tr('قنوات الإرسال', 'Notification Channels')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ChannelToggle
            label={tr('البوابة / التطبيق', 'Portal / App')}
            icon={<Smartphone className="w-4 h-4" />}
            enabled={settings.portalEnabled}
            onToggle={() => updateSetting({ portalEnabled: !settings.portalEnabled })}
            saving={saving}
          />
          <ChannelToggle
            label={tr('إشعارات دفع', 'Push Notifications')}
            icon={<Bell className="w-4 h-4" />}
            enabled={settings.pushEnabled}
            onToggle={() => updateSetting({ pushEnabled: !settings.pushEnabled })}
            saving={saving}
          />
          <ChannelToggle
            label={tr('رسائل SMS', 'SMS')}
            icon={<MessageSquare className="w-4 h-4" />}
            enabled={settings.smsEnabled}
            onToggle={() => updateSetting({ smsEnabled: !settings.smsEnabled })}
            saving={saving}
          />
          <ChannelToggle
            label={tr('بريد إلكتروني', 'Email')}
            icon={<Mail className="w-4 h-4" />}
            enabled={settings.emailEnabled}
            onToggle={() => updateSetting({ emailEnabled: !settings.emailEnabled })}
            saving={saving}
          />
          <ChannelToggle
            label="WhatsApp"
            icon={<MessageSquare className="w-4 h-4" />}
            enabled={settings.whatsappEnabled}
            onToggle={() => updateSetting({ whatsappEnabled: !settings.whatsappEnabled })}
            saving={saving}
          />
        </div>
      </div>

      {/* Timing */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {tr('توقيت التذكير', 'Reminder Timing')}
        </h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.before24h}
              onChange={() => updateSetting({ before24h: !settings.before24h })}
              className="rounded border-border"
            />
            <span>{tr('قبل ٢٤ ساعة', 'Before 24 hours')}</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.before2h}
              onChange={() => updateSetting({ before2h: !settings.before2h })}
              className="rounded border-border"
            />
            <span>{tr('قبل ساعتين', 'Before 2 hours')}</span>
          </label>
          <div className="flex items-center gap-3 p-3">
            <span className="text-sm">{tr('ساعات الهدوء', 'Quiet Hours')}:</span>
            <input
              type="time"
              value={settings.quietHoursStart ?? '22:00'}
              onChange={(e) => updateSetting({ quietHoursStart: e.target.value })}
              className="rounded border border-border px-2 py-1 text-sm bg-transparent"
            />
            <span>→</span>
            <input
              type="time"
              value={settings.quietHoursEnd ?? '07:00'}
              onChange={(e) => updateSetting({ quietHoursEnd: e.target.value })}
              className="rounded border border-border px-2 py-1 text-sm bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* Manual Actions */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">{tr('إجراءات يدوية', 'Manual Actions')}</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            {tr('إنشاء تذكيرات الغد', 'Generate Tomorrow\'s Reminders')}
          </button>
          <button
            onClick={handleProcess}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
          >
            {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {tr('إرسال التذكيرات المجدولة', 'Process Scheduled Reminders')}
          </button>
        </div>
        {genResult && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
            {tr(`تم إنشاء ${genResult.created} تذكير، تم تخطي ${genResult.skipped}`,
               `Created ${genResult.created} reminders, skipped ${genResult.skipped}`)}
          </div>
        )}
        {processResult && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm">
            {tr(`تم إرسال ${processResult.sent}، فشل ${processResult.failed}`,
               `Sent ${processResult.sent}, failed ${processResult.failed}`)}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  };

  return (
    <div className={`rounded-xl p-4 ${colors[color] ?? colors.blue}`}>
      <div className="flex items-center gap-2 text-xs opacity-75 mb-1">{icon} {label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function ChannelToggle({ label, icon, enabled, onToggle, saving }: {
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: () => void;
  saving: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={saving}
      className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
        enabled
          ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
          : 'border-border hover:border-border'
      }`}
    >
      <div className={`p-2 rounded-full ${enabled ? 'bg-blue-100 dark:bg-blue-800' : 'bg-muted'}`}>
        {icon}
      </div>
      <span className="font-medium text-sm">{label}</span>
      <div className={`ms-auto w-3 h-3 rounded-full ${enabled ? 'bg-blue-500' : 'bg-muted'}`} />
    </button>
  );
}
