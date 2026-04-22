'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  GitBranch, Plus, Trash2, ChevronDown, ChevronUp,
  Loader2, Check, Zap, ArrowRight,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface RoutingCondition {
  field: string;
  operator: string;
  value: string;
}

interface RoutingAction {
  type: string;
  target: string;
  message?: string;
}

interface RoutingRule {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  conditions: RoutingCondition[];
  actions: RoutingAction[];
  priority: number;
  isActive: boolean;
  isDefault: boolean;
}

const OP_LABELS: Record<string, string> = {
  equals: '=',
  not_equals: '\u2260',
  contains: '\u220B',
  starts_with: 'starts',
  in: 'in',
  gt: '>',
  lt: '<',
  gte: '\u2265',
  lte: '\u2264',
};

const ACTION_COLORS: Record<string, string> = {
  route_to_department: 'bg-blue-100 text-blue-700',
  route_to_location: 'bg-purple-100 text-purple-700',
  notify_role: 'bg-orange-100 text-orange-700',
  set_priority: 'bg-red-100 text-red-700',
  add_note: 'bg-muted text-foreground',
};

export default function RoutingRulesPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data, mutate } = useSWR('/api/workflow/routing?seed=true', fetcher);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '', nameAr: '', description: '', priority: 50,
    conditions: [{ field: '', operator: 'equals', value: '' }] as RoutingCondition[],
    actions: [{ type: 'route_to_department', target: '', message: '' }] as RoutingAction[],
  });

  const rules: RoutingRule[] = data?.rules || [];

  const handleDelete = async (id: string) => {
    await fetch(`/api/workflow/routing?id=${id}`, { credentials: 'include', method: 'DELETE' });
    mutate();
  };

  const handleToggle = async (rule: RoutingRule) => {
    await fetch('/api/workflow/routing', {
      credentials: 'include',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
    });
    mutate();
  };

  const handleCreate = async () => {
    if (!newRule.name || !newRule.nameAr) return;
    setSaving(true);
    await fetch('/api/workflow/routing', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRule),
    });
    setSaving(false);
    setShowCreate(false);
    setNewRule({
      name: '', nameAr: '', description: '', priority: 50,
      conditions: [{ field: '', operator: 'equals', value: '' }],
      actions: [{ type: 'route_to_department', target: '', message: '' }],
    });
    mutate();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tr('قواعد التوجيه', 'Routing Rules')}</h1>
              <p className="text-sm text-muted-foreground">{tr('قواعد التوجيه التلقائي', 'Auto-Routing Rules')}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            {tr('قاعدة جديدة', 'New Rule')}
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">{tr('إنشاء قاعدة توجيه', 'Create Routing Rule')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input
                type="text" placeholder={tr('الاسم (إنجليزي)', 'Name (English)')} value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
              <input
                type="text" placeholder={tr('الاسم (عربي)', 'Name (Arabic)')} dir="rtl" value={newRule.nameAr}
                onChange={(e) => setNewRule({ ...newRule, nameAr: e.target.value })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
              <input
                type="text" placeholder={tr('الوصف', 'Description')} value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
              <input
                type="number" placeholder={tr('الأولوية (0-100)', 'Priority (0-100)')} value={newRule.priority}
                onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value, 10) })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
            </div>

            {/* Conditions */}
            <h3 className="text-sm font-bold mb-2">{tr('الشروط', 'Conditions')}</h3>
            {newRule.conditions.map((c, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text" placeholder={tr('الحقل (مثال: kind)', 'Field (e.g. kind)')} value={c.field}
                  onChange={(e) => {
                    const conds = [...newRule.conditions];
                    conds[i] = { ...c, field: e.target.value };
                    setNewRule({ ...newRule, conditions: conds });
                  }}
                  className="px-3 py-2 border border-border rounded-xl text-sm flex-1"
                />
                <select
                  value={c.operator}
                  onChange={(e) => {
                    const conds = [...newRule.conditions];
                    conds[i] = { ...c, operator: e.target.value };
                    setNewRule({ ...newRule, conditions: conds });
                  }}
                  className="px-3 py-2 border border-border rounded-xl text-sm"
                >
                  {Object.keys(OP_LABELS).map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
                <input
                  type="text" placeholder={tr('القيمة', 'Value')} value={c.value}
                  onChange={(e) => {
                    const conds = [...newRule.conditions];
                    conds[i] = { ...c, value: e.target.value };
                    setNewRule({ ...newRule, conditions: conds });
                  }}
                  className="px-3 py-2 border border-border rounded-xl text-sm flex-1"
                />
              </div>
            ))}

            {/* Actions */}
            <h3 className="text-sm font-bold mb-2 mt-4">{tr('الإجراءات', 'Actions')}</h3>
            {newRule.actions.map((a, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select
                  value={a.type}
                  onChange={(e) => {
                    const acts = [...newRule.actions];
                    acts[i] = { ...a, type: e.target.value };
                    setNewRule({ ...newRule, actions: acts });
                  }}
                  className="px-3 py-2 border border-border rounded-xl text-sm"
                >
                  <option value="route_to_department">{tr('توجيه إلى قسم', 'Route to Department')}</option>
                  <option value="route_to_location">{tr('توجيه إلى موقع', 'Route to Location')}</option>
                  <option value="notify_role">{tr('إشعار دور', 'Notify Role')}</option>
                  <option value="set_priority">{tr('تعيين الأولوية', 'Set Priority')}</option>
                  <option value="add_note">{tr('إضافة ملاحظة', 'Add Note')}</option>
                </select>
                <input
                  type="text" placeholder={tr('الهدف', 'Target')} value={a.target}
                  onChange={(e) => {
                    const acts = [...newRule.actions];
                    acts[i] = { ...a, target: e.target.value };
                    setNewRule({ ...newRule, actions: acts });
                  }}
                  className="px-3 py-2 border border-border rounded-xl text-sm flex-1"
                />
              </div>
            ))}

            <button
              onClick={handleCreate} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 mt-4"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {tr('إنشاء القاعدة', 'Create Rule')}
            </button>
          </div>
        )}

        {/* Rules List */}
        <div className="space-y-3">
          {rules
            .sort((a, b) => b.priority - a.priority)
            .map((rule) => {
              const isExpanded = expandedId === rule.id;
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
                      <div className={`p-2 rounded-lg ${rule.isActive ? 'bg-purple-100 text-purple-600' : 'bg-muted text-muted-foreground'}`}>
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{tr(rule.nameAr, rule.name)}</h3>
                        <p className="text-[11px] text-muted-foreground">
                          {rule.conditions.length} {tr('شرط', 'condition')}{rule.conditions.length !== 1 ? (language === 'ar' ? '' : 's') : ''} &middot; {rule.actions.length} {tr('إجراء', 'action')}{rule.actions.length !== 1 ? (language === 'ar' ? 'ات' : 's') : ''} &middot; {tr('الأولوية', 'Priority')} {rule.priority}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rule.isDefault && (
                        <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">{tr('افتراضي', 'Default')}</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggle(rule); }}
                        className={`text-[10px] px-2 py-0.5 rounded-full ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}
                      >
                        {rule.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}
                      </button>
                      {!rule.isDefault && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(rule.id); }}
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border p-4 bg-muted/10">
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mb-3">{rule.description}</p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Conditions */}
                        <div>
                          <h4 className="text-xs font-bold mb-2 text-muted-foreground uppercase">{tr('الشروط', 'Conditions')}</h4>
                          <div className="space-y-1">
                            {rule.conditions.map((c, idx) => (
                              <div key={idx} className="flex items-center gap-1 text-xs p-2 bg-background rounded-lg">
                                <span className="font-mono text-blue-600">{c.field}</span>
                                <span className="text-muted-foreground">{OP_LABELS[c.operator] || c.operator}</span>
                                <span className="font-bold">{String(c.value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div>
                          <h4 className="text-xs font-bold mb-2 text-muted-foreground uppercase">{tr('الإجراءات', 'Actions')}</h4>
                          <div className="space-y-1">
                            {rule.actions.map((a, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-background rounded-lg">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${ACTION_COLORS[a.type] || 'bg-muted'}`}>
                                  {a.type.replace(/_/g, ' ')}
                                </span>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                <span className="font-bold">{a.target}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {rules.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            {tr('جاري تحميل قواعد التوجيه...', 'Loading routing rules...')}
          </div>
        )}
      </div>
    </div>
  );
}
