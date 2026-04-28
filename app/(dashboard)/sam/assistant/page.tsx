'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLang } from '@/hooks/use-lang';

export default function SamAssistantPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{tr('المساعد', 'Assistant')}</CardTitle>
          <CardDescription>
            {tr('واجهة مساعد SAM ستكون هنا. حالياً، استخدم المكتبة والمسودات.', 'SAM assistant UI will live here. For now, use Library and Drafts.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link href="/sam/library">{tr('المكتبة', 'Library')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sam/drafts">{tr('المسودات', 'Drafts')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
