'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useLang } from '@/hooks/use-lang';

type Draft = {
  id: string;
  title: string;
  documentType: string;
  latestContent: string;
  latestVersion: number;
  requiredType?: string;
  operationId?: string | null;
  departmentId?: string | null;
  status?: string;
  publishedTheaEngineId?: string | null;
  createdAt?: string;
};

export default function SamDraftViewPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const draftId = params?.draftId as string | undefined;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editorText, setEditorText] = useState('');
  const [versionMessage, setVersionMessage] = useState('');
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (!draftId) return;
    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/sam/drafts/${encodeURIComponent(draftId)}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to load draft');
        }
        const data = await response.json();
        setDraft(data.draft);
        setEditorText(data.draft?.latestContent || '');
      } catch (error: any) {
        toast({
          title: tr('فشل تحميل المسودة', 'Failed to load draft'),
          description: error.message || tr('خطأ غير معروف', 'Unknown error'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [draftId, toast]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draft?.latestContent || '');
      toast({ title: tr('تم النسخ', 'Copied'), description: tr('تم نسخ المسودة إلى الحافظة.', 'Draft copied to clipboard.') });
    } catch {
      toast({ title: tr('فشل النسخ', 'Copy failed'), description: tr('لم يتم نسخ المسودة.', 'Could not copy draft.'), variant: 'destructive' });
    }
  }

  async function handleSaveVersion() {
    if (!draftId) return;
    if (!editorText.trim()) {
      toast({ title: tr('لا شيء للحفظ', 'Nothing to save'), description: tr('محتوى المسودة فارغ.', 'Draft content is empty.'), variant: 'destructive' });
      return;
    }
    setIsSavingVersion(true);
    try {
      const response = await fetch(`/api/sam/drafts/${encodeURIComponent(draftId)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: editorText,
          message: versionMessage.trim() ? versionMessage.trim() : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save version');
      }
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr(`تم إنشاء الإصدار v${payload.version}.`, `Created version v${payload.version}.`) });
      setVersionMessage('');
      const refreshed = await fetch(`/api/sam/drafts/${encodeURIComponent(draftId)}`, { credentials: 'include' });
      const data = await refreshed.json().catch(() => ({}));
      if (refreshed.ok) {
        setDraft(data.draft);
      }
    } catch (error: any) {
      toast({ title: tr('فشل الحفظ', 'Save failed'), description: error.message || tr('خطأ غير معروف', 'Unknown error'), variant: 'destructive' });
    } finally {
      setIsSavingVersion(false);
    }
  }

  async function handlePublish() {
    if (!draftId) return;
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/sam/drafts/${encodeURIComponent(draftId)}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Publish failed');
      }
      toast({ title: tr('تم النشر', 'Published'), description: tr('تم نشر المسودة في المكتبة.', 'Draft published to Library.') });
      router.push('/sam/library');
    } catch (error: any) {
      toast({ title: tr('فشل النشر', 'Publish failed'), description: error.message || tr('خطأ غير معروف', 'Unknown error'), variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{tr('جاري تحميل المسودة...', 'Loading draft...')}</div>;
  }

  if (!draft) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">{tr('المسودة غير موجودة.', 'Draft not found.')}</div>
        <Button variant="outline" onClick={() => router.push('/sam/home')}>
          {tr('العودة إلى قوائم العمل', 'Back to queues')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{draft.title}</CardTitle>
          <CardDescription>
            {draft.requiredType ? tr(`مسودة ${draft.requiredType}`, `${draft.requiredType} draft`) : tr('مسودة', 'Draft')} · v{draft.latestVersion}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={handleCopy}>{tr('نسخ المسودة', 'Copy draft')}</Button>
          <Button onClick={handleSaveVersion} disabled={isSavingVersion}>
            {isSavingVersion ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ إصدار جديد', 'Save new version')}
          </Button>
          <Button variant="secondary" onClick={handlePublish} disabled={isPublishing || draft.status === 'published'}>
            {draft.status === 'published' ? tr('تم النشر', 'Published') : isPublishing ? tr('جاري النشر...', 'Publishing...') : tr('نشر في المكتبة', 'Publish to Library')}
          </Button>
          <Button variant="outline" onClick={() => router.push('/sam/home')}>
            {tr('العودة إلى قوائم العمل', 'Back to queues')}
          </Button>
          <Button variant="outline" onClick={() => router.push('/sam/library')}>
            {tr('الذهاب إلى المكتبة', 'Go to Library')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tr('محرر المسودة', 'Draft editor')}</CardTitle>
          <CardDescription>{tr('التعديلات تُنشئ إصدار جديد (مُراجَع).', 'Edits create a new version (audited).')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Input
              value={versionMessage}
              onChange={(e) => setVersionMessage(e.target.value)}
              placeholder={tr('ملاحظة الإصدار (اختياري): ما الذي تغير؟', 'Version note (optional): what changed?')}
            />
            <Textarea
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              className="min-h-[420px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
