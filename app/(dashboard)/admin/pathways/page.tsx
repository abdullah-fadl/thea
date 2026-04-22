'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Route, Plus, ChevronDown, ChevronUp, Loader2, Check,
  Clock, AlertCircle, CheckCircle2, Circle,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface PathwayTask {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  category: string;
  timeframeMinutes: number;
  isCritical: boolean;
  order: number;
}

interface Pathway {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  category: string;
  tasks: PathwayTask[];
  isActive: boolean;
  isDefault: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  assessment: 'bg-blue-100 text-blue-700',
  lab: 'bg-purple-100 text-purple-700',
  medication: 'bg-green-100 text-green-700',
  procedure: 'bg-orange-100 text-orange-700',
  monitoring: 'bg-cyan-100 text-cyan-700',
  imaging: 'bg-indigo-100 text-indigo-700',
  nursing: 'bg-pink-100 text-pink-700',
  consultation: 'bg-yellow-100 text-yellow-700',
};

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function PathwaysPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data, mutate } = useSWR('/api/workflow/pathways?seed=true', fetcher);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPathway, setNewPathway] = useState({
    name: '', nameAr: '', description: '', category: 'Emergency',
  });

  const pathways: Pathway[] = data?.pathways || [];
  const categories = [...new Set(pathways.map((p) => p.category))];

  const handleToggle = async (pathway: Pathway) => {
    await fetch(`/api/workflow/pathways/${pathway.id}`, {
      credentials: 'include',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !pathway.isActive }),
    });
    mutate();
  };

  const handleCreate = async () => {
    if (!newPathway.name || !newPathway.nameAr) return;
    setSaving(true);
    await fetch('/api/workflow/pathways', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newPathway, tasks: [] }),
    });
    setSaving(false);
    setShowCreate(false);
    setNewPathway({ name: '', nameAr: '', description: '', category: 'Emergency' });
    mutate();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
              <Route className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tr('المسارات السريرية', 'Clinical Pathways')}</h1>
              <p className="text-sm text-muted-foreground">{tr('قوالب المسارات السريرية', 'Clinical Pathway Templates')}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            {tr('مسار جديد', 'New Pathway')}
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">{tr('إنشاء قالب مسار', 'Create Pathway Template')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input
                type="text" placeholder={tr('الاسم (إنجليزي)', 'Name (English)')} value={newPathway.name}
                onChange={(e) => setNewPathway({ ...newPathway, name: e.target.value })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
              <input
                type="text" placeholder={tr('الاسم (عربي)', 'Name (Arabic)')} dir="rtl" value={newPathway.nameAr}
                onChange={(e) => setNewPathway({ ...newPathway, nameAr: e.target.value })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
              <input
                type="text" placeholder={tr('الفئة', 'Category')} value={newPathway.category}
                onChange={(e) => setNewPathway({ ...newPathway, category: e.target.value })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
              <input
                type="text" placeholder={tr('الوصف', 'Description')} value={newPathway.description}
                onChange={(e) => setNewPathway({ ...newPathway, description: e.target.value })}
                className="px-3 py-2 border border-border rounded-xl text-sm"
              />
            </div>
            <button
              onClick={handleCreate} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {tr('إنشاء', 'Create')}
            </button>
          </div>
        )}

        {/* Pathways by Category */}
        {categories.map((cat) => (
          <div key={cat} className="mb-6">
            <h2 className="text-lg font-bold mb-3 text-muted-foreground">{cat}</h2>
            <div className="space-y-3">
              {pathways
                .filter((p) => p.category === cat)
                .map((pathway) => {
                  const isExpanded = expandedId === pathway.id;
                  const totalTime = pathway.tasks.reduce((sum, t) => sum + t.timeframeMinutes, 0);
                  const criticalCount = pathway.tasks.filter((t) => t.isCritical).length;
                  return (
                    <div
                      key={pathway.id}
                      className={`bg-card rounded-2xl border overflow-hidden ${pathway.isActive ? 'border-border' : 'border-border opacity-60'}`}
                    >
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                        onClick={() => setExpandedId(isExpanded ? null : pathway.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${pathway.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                            <Route className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm">{tr(pathway.nameAr, pathway.name)}</h3>
                            <p className="text-[11px] text-muted-foreground">
                              {pathway.tasks.length} {tr('مهمة', 'tasks')} &middot; {formatTime(totalTime)} {tr('إجمالي', 'total')} &middot; {criticalCount} {tr('حرجة', 'critical')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {pathway.isDefault && (
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">{tr('افتراضي', 'Default')}</span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggle(pathway); }}
                            className={`text-[10px] px-2 py-0.5 rounded-full ${pathway.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}
                          >
                            {pathway.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}
                          </button>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border p-4 bg-muted/10">
                          {pathway.description && (
                            <p className="text-xs text-muted-foreground mb-3">{pathway.description}</p>
                          )}

                          {/* Timeline View */}
                          <div className="relative">
                            {pathway.tasks
                              .sort((a, b) => a.order - b.order)
                              .map((task, idx) => (
                                <div key={task.id} className="flex gap-3 mb-3 last:mb-0">
                                  {/* Timeline connector */}
                                  <div className="flex flex-col items-center">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${task.isCritical ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                      {task.isCritical ? (
                                        <AlertCircle className="w-3.5 h-3.5" />
                                      ) : (
                                        <Circle className="w-3.5 h-3.5" />
                                      )}
                                    </div>
                                    {idx < pathway.tasks.length - 1 && (
                                      <div className="w-px h-full bg-border min-h-[20px]" />
                                    )}
                                  </div>

                                  {/* Task Card */}
                                  <div className="flex-1 p-3 bg-background rounded-lg">
                                    <div className="flex items-center justify-between mb-1">
                                      <h4 className="text-sm font-medium">{tr(task.nameAr, task.name)}</h4>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[task.category] || 'bg-muted'}`}>
                                          {task.category}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                          <Clock className="w-3 h-3" /> {formatTime(task.timeframeMinutes)}
                                        </span>
                                        {task.isCritical && (
                                          <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded">{tr('حرج', 'Critical')}</span>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">{task.description}</p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}

        {pathways.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            {tr('جاري تحميل المسارات...', 'Loading pathways...')}
          </div>
        )}
      </div>
    </div>
  );
}
