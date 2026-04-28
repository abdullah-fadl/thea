'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle, Plus, ChevronDown, ChevronUp,
  Loader2, Check, Bell, Clock, Shield,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface EscalationLevel {
  level: number;
  delayMinutes: number;
  notifyRole: string;
  channels: string[];
  message: string;
  messageAr: string;
}

interface EscalationRule {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  trigger: string;
  levels: EscalationLevel[];
  isActive: boolean;
  isDefault: boolean;
}

interface EscalationEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  trigger: string;
  currentLevel: number;
  sourceId: string;
  patientId?: string;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

const TRIGGER_ICONS: Record<string, typeof AlertTriangle> = {
  critical_lab_unread: AlertTriangle,
  stat_order_not_started: Clock,
  consult_not_responded: Bell,
};

const TRIGGER_COLORS: Record<string, string> = {
  critical_lab_unread: 'bg-red-100 text-red-700',
  stat_order_not_started: 'bg-orange-100 text-orange-700',
  consult_not_responded: 'bg-yellow-100 text-yellow-700',
};

export default function EscalationPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data: rulesData, mutate: mutateRules } = useSWR('/api/workflow/escalation?seed=true', fetcher);
  const { data: eventsData, mutate: mutateEvents } = useSWR('/api/workflow/escalation?active=true', fetcher);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<'rules' | 'events'>('rules');
  const [checking, setChecking] = useState(false);

  const rules: EscalationRule[] = rulesData?.rules || [];
  const events: EscalationEvent[] = eventsData?.escalations || [];

  const handleToggle = async (rule: EscalationRule) => {
    await fetch('/api/workflow/escalation', {
      credentials: 'include',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
    });
    mutateRules();
  };

  const handleRunCheck = async () => {
    setChecking(true);
    await fetch('/api/workflow/escalation', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    });
    setChecking(false);
    mutateEvents();
  };

  const handleAcknowledge = async (eventId: string) => {
    await fetch('/api/workflow/escalation', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge', eventId }),
    });
    mutateEvents();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tr('نظام التصعيد', 'Escalation Engine')}</h1>
              <p className="text-sm text-muted-foreground">{tr('إدارة قواعد وأحداث التصعيد', 'Manage escalation rules and events')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRunCheck}
              disabled={checking}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50"
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {tr('تشغيل الفحص', 'Run Check')}
            </button>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
            >
              <Plus className="w-4 h-4" />
              {tr('قاعدة جديدة', 'New Rule')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('rules')}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'rules' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}
          >
            {tr('القواعد', 'Rules')} ({rules.length})
          </button>
          <button
            onClick={() => setTab('events')}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'events' ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}
          >
            {tr('الأحداث النشطة', 'Active Events')} ({events.length})
          </button>
        </div>

        {/* Rules Tab */}
        {tab === 'rules' && (
          <div className="space-y-3">
            {rules.map((rule) => {
              const isExpanded = expandedId === rule.id;
              const TriggerIcon = TRIGGER_ICONS[rule.trigger] || AlertTriangle;
              return (
                <div
                  key={rule.id}
                  className={`bg-card rounded-2xl border overflow-hidden ${rule.isActive ? 'border-border' : 'border-border opacity-60'}`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                    onClick={() => setExpandedId(isExpanded ? null : rule.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${TRIGGER_COLORS[rule.trigger] || 'bg-muted text-muted-foreground'}`}>
                        <TriggerIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{tr(rule.nameAr, rule.name)}</h3>
                        <p className="text-[11px] text-muted-foreground">
                          {rule.levels.length} {tr('مستوى', 'level')}{rule.levels.length !== 1 ? (language === 'ar' ? 'ات' : 's') : ''} &middot; {rule.trigger.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rule.isDefault && (
                        <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{tr('افتراضي', 'Default')}</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggle(rule); }}
                        className={`text-[10px] px-2 py-0.5 rounded-full ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}
                      >
                        {rule.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border p-4 bg-muted/10">
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mb-3">{rule.description}</p>
                      )}
                      <h4 className="text-xs font-bold mb-2 text-muted-foreground uppercase">{tr('مستويات التصعيد', 'Escalation Levels')}</h4>
                      <div className="space-y-2">
                        {rule.levels.map((level, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-700 rounded-full text-sm font-bold">
                                {level.level}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{tr('إشعار', 'Notify')}: {level.notifyRole}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {tr('بعد', 'After')} {level.delayMinutes} {tr('دقيقة', 'min')} &middot; {tr('عبر', 'via')} {level.channels.join(', ')}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground max-w-[200px] truncate">{tr(level.messageAr, level.message)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {rules.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                {tr('جاري تحميل قواعد التصعيد...', 'Loading escalation rules...')}
              </div>
            )}
          </div>
        )}

        {/* Events Tab */}
        {tab === 'events' && (
          <div className="space-y-3">
            {events.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <Check className="w-6 h-6 mx-auto mb-2 text-green-500" />
                {tr('لا توجد تصعيدات نشطة', 'No active escalations')}
              </div>
            )}
            {events.map((event) => (
              <div key={event.id} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${TRIGGER_COLORS[event.trigger] || 'bg-muted'}`}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{event.ruleName}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {tr('المستوى', 'Level')} {event.currentLevel} &middot; {event.trigger.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                    {!event.acknowledgedAt && (
                      <button
                        onClick={() => handleAcknowledge(event.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700"
                      >
                        <Check className="w-3 h-3" /> {tr('إقرار', 'Acknowledge')}
                      </button>
                    )}
                    {event.acknowledgedAt && (
                      <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                        {tr('تم الإقرار', 'Acknowledged')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
