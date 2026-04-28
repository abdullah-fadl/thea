'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const NOTE_TYPES = [
  { value: 'GENERAL', ar: 'عام', en: 'General' },
  { value: 'PROGRESS', ar: 'متابعة', en: 'Progress' },
  { value: 'DISCHARGE', ar: 'خروج', en: 'Discharge' },
  { value: 'CRISIS', ar: 'أزمة', en: 'Crisis' },
];

export default function SocialWorkDetail() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || '');

  const { data, mutate, isLoading } = useSWR(
    id ? `/api/social-work/${id}` : null,
    fetcher
  );

  const assessment = data?.assessment || null;
  const notes: any[] = Array.isArray(data?.notes) ? data.notes : [];

  const [activeTab, setActiveTab] = useState<'assessment' | 'notes'>('assessment');
  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('GENERAL');

  const startEdit = () => {
    setEditForm({
      referralReason: assessment?.referralReason || '',
      livingArrangement: assessment?.livingArrangement || '',
      supportSystem: assessment?.supportSystem || '',
      barriers: assessment?.barriers || '',
      plan: assessment?.plan || '',
      dischargeBarriers: assessment?.dischargeBarriers || '',
      followUpPlan: assessment?.followUpPlan || '',
      status: assessment?.status || 'ACTIVE',
    });
    setEditMode(true);
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/social-work/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditMode(false);
        await mutate();
      }
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!noteContent.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/social-work/${id}/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent, noteType }),
      });
      if (res.ok) {
        setNoteContent('');
        await mutate();
      }
    } finally {
      setBusy(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'CLOSED') return 'bg-muted text-foreground';
    if (status === 'FOLLOW_UP') return 'bg-purple-100 text-purple-700';
    return 'bg-green-100 text-green-700';
  };

  if (isLoading) {
    return (
      <div className="p-10 text-center text-muted-foreground text-sm">
        {tr('جاري التحميل...', 'Loading...')}
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="p-10 text-center text-muted-foreground text-sm">
        {tr('التقييم غير موجود', 'Assessment not found')}
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2 -ms-2">
            {isRTL ? '→' : '←'} {tr('رجوع', 'Back')}
          </Button>
          <h1 className="text-xl font-extrabold">{tr('تفاصيل التقييم الاجتماعي', 'Social Work Assessment')}</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{assessment.patientMasterId}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColor(assessment.status || 'ACTIVE')}`}>
          {assessment.status === 'CLOSED'
            ? tr('مغلق', 'Closed')
            : assessment.status === 'FOLLOW_UP'
            ? tr('متابعة', 'Follow-up')
            : tr('نشط', 'Active')}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['assessment', 'notes'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'assessment' ? tr('التقييم', 'Assessment') : tr('الملاحظات', 'Notes')}
          </button>
        ))}
      </div>

      {/* Assessment Tab */}
      {activeTab === 'assessment' && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
          {!editMode ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {[
                  { label: tr('سبب الإحالة', 'Referral Reason'), value: assessment.referralReason },
                  { label: tr('وضع السكن', 'Living Arrangement'), value: assessment.livingArrangement },
                  { label: tr('نظام الدعم', 'Support System'), value: assessment.supportSystem },
                  { label: tr('العوائق', 'Barriers'), value: assessment.barriers },
                  { label: tr('الخطة', 'Plan'), value: assessment.plan },
                  { label: tr('عوائق الخروج', 'Discharge Barriers'), value: assessment.dischargeBarriers },
                  { label: tr('خطة المتابعة', 'Follow-up Plan'), value: assessment.followUpPlan },
                ].map((field) => (
                  <div key={field.label} className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">{field.label}</p>
                    <p className={field.value ? 'text-foreground' : 'text-muted-foreground italic'}>
                      {field.value || tr('غير محدد', 'Not specified')}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={startEdit}>
                  {tr('تعديل', 'Edit')}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>{tr('سبب الإحالة', 'Referral Reason')} *</Label>
                <Textarea
                  value={editForm.referralReason}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, referralReason: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>{tr('وضع السكن', 'Living Arrangement')}</Label>
                  <Input
                    value={editForm.livingArrangement}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, livingArrangement: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{tr('نظام الدعم', 'Support System')}</Label>
                  <Input
                    value={editForm.supportSystem}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, supportSystem: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{tr('العوائق', 'Barriers')}</Label>
                <Textarea
                  value={editForm.barriers}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, barriers: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('الخطة', 'Plan')}</Label>
                <Textarea
                  value={editForm.plan}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, plan: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('عوائق الخروج', 'Discharge Barriers')}</Label>
                <Textarea
                  value={editForm.dischargeBarriers}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, dischargeBarriers: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('خطة المتابعة', 'Follow-up Plan')}</Label>
                <Textarea
                  value={editForm.followUpPlan}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, followUpPlan: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('الحالة', 'Status')}</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm((f: any) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">{tr('نشط', 'Active')}</SelectItem>
                    <SelectItem value="FOLLOW_UP">{tr('متابعة', 'Follow-up')}</SelectItem>
                    <SelectItem value="CLOSED">{tr('مغلق', 'Closed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditMode(false)} disabled={busy}>
                  {tr('إلغاء', 'Cancel')}
                </Button>
                <Button onClick={saveEdit} disabled={busy}>
                  {busy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التغييرات', 'Save Changes')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* Add Note */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-sm">{tr('إضافة ملاحظة', 'Add Note')}</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder={tr('محتوى الملاحظة...', 'Note content...')}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{tr('النوع', 'Type')}</Label>
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTE_TYPES.map((nt) => (
                      <SelectItem key={nt.value} value={nt.value}>
                        {tr(nt.ar, nt.en)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={addNote} disabled={busy || !noteContent.trim()} size="sm">
                {busy ? tr('جاري الإضافة...', 'Adding...') : tr('إضافة', 'Add Note')}
              </Button>
            </div>
          </div>

          {/* Notes List */}
          <div className="space-y-3">
            {notes.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground text-sm">
                {tr('لا توجد ملاحظات بعد', 'No notes yet')}
              </div>
            ) : (
              notes.map((note: any) => {
                const nt = NOTE_TYPES.find((t) => t.value === note.noteType);
                return (
                  <div key={note.id} className="bg-card border border-border rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        note.noteType === 'CRISIS'
                          ? 'bg-red-100 text-red-700'
                          : note.noteType === 'DISCHARGE'
                          ? 'bg-amber-100 text-amber-700'
                          : note.noteType === 'PROGRESS'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-muted text-foreground'
                      }`}>
                        {nt ? tr(nt.ar, nt.en) : note.noteType}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
