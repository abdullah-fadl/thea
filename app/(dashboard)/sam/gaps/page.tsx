'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLang } from '@/hooks/use-lang';

export default function SamGapsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{tr('الفجوات', 'Gaps')}</CardTitle>
          <CardDescription>
            {tr('ستُعرض الفجوات هنا. حالياً، استخدم قوائم العمل الرئيسية لإنشاء المسودات المفقودة.', 'Gap views will be surfaced here. For now, use the Home work queues to create missing drafts.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link href="/sam/home">{tr('فتح قوائم العمل', 'Open work queues')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sam/drafts">{tr('المسودات', 'Drafts')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
