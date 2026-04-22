'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Plus,
  Trash2,
  Pencil,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type SourceType = 'orthanc' | 'dcm4chee' | 'google_health' | 'custom';
type AuthType = 'none' | 'basic' | 'bearer' | 'apikey';

interface DicomSourceView {
  id: string;
  name: string;
  type: SourceType;
  baseUrl: string;
  authType: AuthType;
  isDefault: boolean;
}

interface FormState {
  name: string;
  type: SourceType;
  baseUrl: string;
  authType: AuthType;
  username: string;
  password: string;
  token: string;
  apiKey: string;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'orthanc',
  baseUrl: '',
  authType: 'basic',
  username: '',
  password: '',
  token: '',
  apiKey: '',
  isDefault: false,
};

export default function DicomSources() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data, mutate, isLoading } = useSWR('/api/dicomweb/config', fetcher);
  const sources: DicomSourceView[] = data?.sources || [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; ms: number; error?: string }>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DicomSourceView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSaveError('');
    setShowForm(true);
  };

  const openEdit = (s: DicomSourceView) => {
    setForm({
      name: s.name,
      type: s.type,
      baseUrl: s.baseUrl,
      authType: s.authType,
      username: '',
      password: '',
      token: '',
      apiKey: '',
      isDefault: s.isDefault,
    });
    setEditingId(s.id);
    setSaveError('');
    setShowForm(true);
  };

  const buildCredentials = () => {
    switch (form.authType) {
      case 'basic':
        return form.username || form.password ? { username: form.username, password: form.password } : undefined;
      case 'bearer':
        return form.token ? { token: form.token } : undefined;
      case 'apikey':
        return form.apiKey ? { apiKey: form.apiKey } : undefined;
      default:
        return undefined;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const payload: any = {
        action: editingId ? 'update' : 'create',
        name: form.name,
        type: form.type,
        baseUrl: form.baseUrl,
        authType: form.authType,
        credentials: buildCredentials(),
        isDefault: form.isDefault,
      };
      if (editingId) payload.sourceId = editingId;

      const res = await fetch('/api/dicomweb/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      mutate();
      setShowForm(false);
      setEditingId(null);
    } catch {
      setSaveError(tr('فشل حفظ مصدر DICOM', 'Failed to save DICOM source'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/dicomweb/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'delete', sourceId: deleteTarget.id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      mutate();
      setDeleteTarget(null);
    } catch {
      setDeleteError(tr('فشل الحذف', 'Failed to delete'));
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async (sourceId: string) => {
    setTesting(sourceId);
    try {
      const res = await fetch('/api/dicomweb/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'test', sourceId }),
      });
      const json = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [sourceId]: { ok: json.test?.ok, ms: json.test?.responseTimeMs, error: json.test?.error },
      }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [sourceId]: { ok: false, ms: 0, error: tr('خطأ في الشبكة', 'Network error') },
      }));
    } finally {
      setTesting(null);
    }
  };

  const handleTestForm = async () => {
    setTesting('form');
    try {
      const res = await fetch('/api/dicomweb/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'test',
          baseUrl: form.baseUrl,
          type: form.type,
          authType: form.authType,
          credentials: buildCredentials(),
        }),
      });
      const json = await res.json();
      setTestResults((prev) => ({
        ...prev,
        form: { ok: json.test?.ok, ms: json.test?.responseTimeMs, error: json.test?.error },
      }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        form: { ok: false, ms: 0, error: tr('خطأ في الشبكة', 'Network error') },
      }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-base text-foreground">{tr('مصادر DICOM', 'DICOM Sources')}</h2>
            <p className="text-sm text-muted-foreground">{tr('إدارة اتصالات PACS للتصوير الإشعاعي', 'Manage PACS connections for radiology imaging')}</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {tr('إضافة مصدر', 'Add Source')}
          </button>
        </div>

        {/* Source List */}
        <div className="divide-y divide-border/50">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              {tr('جاري التحميل...', 'Loading...')}
            </div>
          ) : sources.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Server className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>{tr('لا توجد مصادر DICOM مهيأة.', 'No DICOM sources configured.')}</p>
              <p className="text-sm">{tr('أضف خادم PACS لربط صور الأشعة.', 'Add a PACS server to connect radiology images.')}</p>
            </div>
          ) : (
            sources.map((s) => {
              const test = testResults[s.id];
              return (
                <div key={s.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{s.name}</span>
                      {s.isDefault && (
                        <span className="flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                          <Star className="w-2.5 h-2.5" />
                          {tr('افتراضي', 'Default')}
                        </span>
                      )}
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium uppercase">
                        {s.type}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{s.baseUrl}</div>
                    <div className="text-xs text-muted-foreground">{tr('المصادقة', 'Auth')}: {s.authType}</div>
                  </div>

                  {/* Test result indicator */}
                  {test && (
                    <div className="flex items-center gap-1 text-xs">
                      {test.ok ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-green-600">{test.ms}ms</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-red-600 max-w-[120px] truncate" title={test.error}>
                            {test.error || tr('فشل', 'Failed')}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTest(s.id)}
                      disabled={testing === s.id}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl disabled:opacity-50"
                      title={tr('اختبار الاتصال', 'Test Connection')}
                    >
                      {testing === s.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl"
                      title={tr('تعديل', 'Edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setDeleteTarget(s); setDeleteError(''); }}
                      className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl"
                      title={tr('حذف', 'Delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm mx-4 p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-foreground">{tr('حذف مصدر DICOM', 'Delete DICOM Source')}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              {tr('هل تريد حذف هذا المصدر؟', 'Delete this DICOM source?')}
            </p>
            <p className="text-sm font-bold text-foreground mb-2">{deleteTarget.name}</p>
            <p className="text-xs text-muted-foreground mb-4">{deleteTarget.baseUrl}</p>
            {deleteError && (
              <div className="p-2 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{deleteError}</div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? tr('جاري الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">
                {editingId ? tr('تعديل مصدر DICOM', 'Edit DICOM Source') : tr('إضافة مصدر DICOM', 'Add DICOM Source')}
              </h3>
            </div>

            <div className="p-5 space-y-4">
              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{saveError}</div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{tr('الاسم', 'Name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={tr('مثال: PACS الرئيسي', 'e.g., Main PACS')}
                  className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{tr('النوع', 'Type')}</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SourceType }))}
                  className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
                >
                  <option value="orthanc">Orthanc</option>
                  <option value="dcm4chee">DCM4CHEE</option>
                  <option value="google_health">Google Health API</option>
                  <option value="custom">{tr('DICOMWeb مخصص', 'Custom DICOMWeb')}</option>
                </select>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{tr('رابط DICOMWeb الأساسي', 'DICOMWeb Base URL')}</label>
                <input
                  type="url"
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  placeholder="http://orthanc:8042/dicom-web"
                  className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus font-mono text-sm"
                />
              </div>

              {/* Auth Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{tr('المصادقة', 'Authentication')}</label>
                <select
                  value={form.authType}
                  onChange={(e) => setForm((f) => ({ ...f, authType: e.target.value as AuthType }))}
                  className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
                >
                  <option value="none">{tr('بدون', 'None')}</option>
                  <option value="basic">{tr('مصادقة أساسية', 'Basic Auth')}</option>
                  <option value="bearer">{tr('رمز Bearer', 'Bearer Token')}</option>
                  <option value="apikey">{tr('مفتاح API', 'API Key')}</option>
                </select>
              </div>

              {/* Credentials — conditional */}
              {form.authType === 'basic' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">{tr('اسم المستخدم', 'Username')}</label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      placeholder="thea"
                      className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">{tr('كلمة المرور', 'Password')}</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="********"
                      className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
                    />
                  </div>
                </div>
              )}
              {form.authType === 'bearer' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{tr('الرمز', 'Token')}</label>
                  <input
                    type="password"
                    value={form.token}
                    onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
                    placeholder={tr('رمز Bearer...', 'Bearer token...')}
                    className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
                  />
                </div>
              )}
              {form.authType === 'apikey' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{tr('مفتاح API', 'API Key')}</label>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    placeholder={tr('مفتاح API...', 'API key...')}
                    className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
                  />
                </div>
              )}

              {/* Default toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{tr('تعيين كمصدر افتراضي', 'Set as default source')}</span>
              </label>

              {/* Test result for form */}
              {testResults.form && (
                <div className={`p-3 rounded-xl text-sm ${testResults.form.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {testResults.form.ok
                    ? tr(`الاتصال ناجح (${testResults.form.ms}ms)`, `Connection successful (${testResults.form.ms}ms)`)
                    : tr(`فشل الاتصال: ${testResults.form.error}`, `Connection failed: ${testResults.form.error}`)}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <button
                onClick={handleTestForm}
                disabled={!form.baseUrl || testing === 'form'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-xl disabled:opacity-50"
              >
                {testing === 'form' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {tr('اختبار الاتصال', 'Test Connection')}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setSaveError('');
                    setTestResults((prev) => { const { form: _, ...rest } = prev; return rest; });
                  }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {tr('إلغاء', 'Cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name || !form.baseUrl}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? tr('جاري الحفظ...', 'Saving...') : editingId ? tr('تحديث', 'Update') : tr('إنشاء', 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
