'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Plus, AlertCircle, CheckCircle, Clock, Edit2, X } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';

interface Problem {
  id: string;
  code: string;
  description: string;
  status: 'active' | 'resolved' | 'inactive';
  severity: 'mild' | 'moderate' | 'severe';
  onsetDate?: string;
  resolvedDate?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

interface Props {
  patientId: string;
  editable?: boolean;
}

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const statusConfig = {
  active: { labelAr: 'نشط', labelEn: 'Active', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  resolved: { labelAr: 'تم حله', labelEn: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  inactive: { labelAr: 'غير نشط', labelEn: 'Inactive', color: 'bg-muted text-foreground', icon: Clock },
};

const severityConfig = {
  mild: { labelAr: 'خفيف', labelEn: 'Mild', color: 'text-green-600' },
  moderate: { labelAr: 'متوسط', labelEn: 'Moderate', color: 'text-yellow-600' },
  severe: { labelAr: 'شديد', labelEn: 'Severe', color: 'text-red-600' },
};

export function ProblemList({ patientId, editable = true }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);

  const { data, mutate } = useSWR(`/api/patients/${patientId}/problems`, fetcher);

  const problems: Problem[] = data?.items || [];
  const activeProblems = problems.filter((p) => p.status === 'active');
  const resolvedProblems = problems.filter((p) => p.status === 'resolved');

  const handleAddProblem = async (problem: Partial<Problem>) => {
    try {
      const res = await fetch(`/api/patients/${patientId}/problems`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(problem),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || tr('فشل إضافة المشكلة', 'Failed to add problem'));
      }
      mutate();
      setShowAddForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('فشلت العملية', 'Operation failed');
      toast({ title: tr('خطأ', 'Error'), description: message, variant: 'destructive' as const });
    }
  };

  const handleUpdateProblem = async (problemId: string, updates: Partial<Problem>) => {
    try {
      const res = await fetch(`/api/patients/${patientId}/problems/${problemId}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || tr('فشل تحديث المشكلة', 'Failed to update problem'));
      }
      mutate();
      setEditingProblem(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('فشلت العملية', 'Operation failed');
      toast({ title: tr('خطأ', 'Error'), description: message, variant: 'destructive' as const });
    }
  };

  const handleResolveProblem = async (problemId: string) => {
    await handleUpdateProblem(problemId, {
      status: 'resolved',
      resolvedDate: new Date().toISOString(),
    });
  };

  const handleReactivateProblem = async (problemId: string) => {
    await handleUpdateProblem(problemId, {
      status: 'active',
      resolvedDate: undefined,
    });
  };

  return (
    <div className="bg-card rounded-xl border border-slate-200">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-slate-900">{tr('قائمة المشاكل الصحية', 'Problem List')}</h3>
        {editable && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {tr('إضافة', 'Add')}
          </button>
        )}
      </div>

      <div className="p-4">
        <h4 className="text-sm font-medium text-slate-500 mb-3">{tr('المشاكل النشطة', 'Active Problems')} ({activeProblems.length})</h4>

        {activeProblems.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">{tr('لا توجد مشاكل نشطة', 'No active problems')}</p>
        ) : (
          <div className="space-y-2">
            {activeProblems.map((problem) => (
              <ProblemItem
                key={problem.id}
                problem={problem}
                editable={editable}
                language={language}
                onResolve={() => handleResolveProblem(problem.id)}
                onEdit={() => setEditingProblem(problem)}
              />
            ))}
          </div>
        )}
      </div>

      {resolvedProblems.length > 0 && (
        <div className="p-4 border-t">
          <h4 className="text-sm font-medium text-slate-500 mb-3">
            {tr('المشاكل المحلولة', 'Resolved Problems')} ({resolvedProblems.length})
          </h4>
          <div className="space-y-2">
            {resolvedProblems.map((problem) => (
              <ProblemItem
                key={problem.id}
                problem={problem}
                editable={editable}
                language={language}
                onReactivate={() => handleReactivateProblem(problem.id)}
                onEdit={() => setEditingProblem(problem)}
              />
            ))}
          </div>
        </div>
      )}

      {showAddForm && <ProblemForm language={language} onSubmit={handleAddProblem} onClose={() => setShowAddForm(false)} />}

      {editingProblem && (
        <ProblemForm
          language={language}
          problem={editingProblem}
          onSubmit={(updates) => handleUpdateProblem(editingProblem.id, updates)}
          onClose={() => setEditingProblem(null)}
        />
      )}
    </div>
  );
}

function ProblemItem({
  problem,
  editable,
  language,
  onResolve,
  onReactivate,
  onEdit,
}: {
  problem: Problem;
  editable: boolean;
  language: 'ar' | 'en';
  onResolve?: () => void;
  onReactivate?: () => void;
  onEdit?: () => void;
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const status = statusConfig[problem.status];
  const severity = severityConfig[problem.severity];
  const StatusIcon = status.icon;
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
      <div className={`p-1.5 rounded-full ${status.color}`}>
        <StatusIcon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{problem.description}</span>
          <span className={`text-xs ${severity.color}`}>({tr(severity.labelAr, severity.labelEn)})</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span>ICD: {problem.code}</span>
          {problem.onsetDate && <span>{tr('بداية', 'Onset')}: {new Date(problem.onsetDate).toLocaleDateString(locale)}</span>}
          {problem.resolvedDate && <span>{tr('تم الحل', 'Resolved')}: {new Date(problem.resolvedDate).toLocaleDateString(locale)}</span>}
        </div>
        {problem.notes && <p className="mt-1 text-sm text-slate-600">{problem.notes}</p>}
      </div>

      {editable && (
        <div className="flex items-center gap-1">
          {problem.status === 'active' && onResolve && (
            <button onClick={onResolve} className="p-1.5 text-green-600 hover:bg-green-100 rounded" title={tr('تم الحل', 'Resolve')}>
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          {problem.status === 'resolved' && onReactivate && (
            <button
              onClick={onReactivate}
              className="p-1.5 text-amber-600 hover:bg-amber-100 rounded"
              title={tr('إعادة تفعيل', 'Reactivate')}
            >
              <AlertCircle className="w-4 h-4" />
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded" title={tr('تعديل', 'Edit')}>
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ProblemForm({
  problem,
  onSubmit,
  onClose,
  language,
}: {
  problem?: Problem;
  onSubmit: (data: Partial<Problem>) => void;
  onClose: () => void;
  language: 'ar' | 'en';
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [formData, setFormData] = useState({
    code: problem?.code || '',
    description: problem?.description || '',
    status: problem?.status || 'active',
    severity: problem?.severity || 'moderate',
    onsetDate: problem?.onsetDate?.split('T')[0] || '',
    notes: problem?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">{problem ? tr('تعديل المشكلة', 'Edit Problem') : tr('إضافة مشكلة جديدة', 'Add New Problem')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{tr('كود ICD-10', 'ICD-10 Code')}</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder={tr('مثال: E11.9', 'e.g. E11.9')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tr('الوصف', 'Description')}</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder={tr('مثال: داء السكري النوع الثاني', 'e.g. Type 2 Diabetes Mellitus')}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tr('الحالة', 'Status')}</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="active">{tr('نشط', 'Active')}</option>
                <option value="resolved">{tr('تم حله', 'Resolved')}</option>
                <option value="inactive">{tr('غير نشط', 'Inactive')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{tr('الشدة', 'Severity')}</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="mild">{tr('خفيف', 'Mild')}</option>
                <option value="moderate">{tr('متوسط', 'Moderate')}</option>
                <option value="severe">{tr('شديد', 'Severe')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tr('تاريخ البداية', 'Onset Date')}</label>
            <input
              type="date"
              value={formData.onsetDate}
              onChange={(e) => setFormData({ ...formData, onsetDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tr('ملاحظات', 'Notes')}</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">
              {tr('إلغاء', 'Cancel')}
            </button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {problem ? tr('تحديث', 'Update') : tr('إضافة', 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
