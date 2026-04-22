'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLang } from '@/hooks/use-lang';

export default function SamIssuesPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{tr('المشكلات', 'Issues')}</CardTitle>
          <CardDescription>
            {tr('ستُربط عرض المشكلات بعمليات/نتائج التكامل. حالياً، استخدم التعارضات وإجراءات المكتبة.', 'Issues view will be wired to integrity runs/findings. For now, use Conflicts and the Library run actions.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link href="/sam/library">{tr('فتح المكتبة', 'Open library')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sam/conflicts">{tr('فتح التعارضات', 'Open conflicts')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
