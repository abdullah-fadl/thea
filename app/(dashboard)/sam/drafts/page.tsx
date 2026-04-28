'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLang } from '@/hooks/use-lang';

export default function SamDraftsIndexPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{tr('المسودات', 'Drafts')}</CardTitle>
          <CardDescription>
            {tr('التأليف بالمسودات أولاً. ستُضاف قائمة المسودات عند توفر نقطة نهاية القائمة.', 'Draft-first authoring. Draft listing will be added once a drafts list endpoint is available.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link href="/sam/home">{tr('الذهاب إلى قوائم العمل', 'Go to work queues')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
