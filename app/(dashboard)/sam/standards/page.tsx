'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { SamTopNav } from '@/components/sam/SamTopNav';

type Standard = {
  id: string;
  code: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  framework: string;
  chapter?: string;
  section?: string;
  assessment?: {
    id: string;
    status: string;
    score?: number;
    notes?: string;
  } | null;
};

type ChapterSummary = {
  chapter: string;
  total: number;
  assessed: number;
  compliant: number;
  readinessPercent: number;
};

export default function StandardsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [tab, setTab] = useState('cbahi');
  const [cbahiStandards, setCbahiStandards] = useState<Standard[]>([]);
  const [jciStandards, setJciStandards] = useState<Standard[]>([]);
  const [cbahiChapters, setCbahiChapters] = useState<ChapterSummary[]>([]);
  const [jciChapters, setJciChapters] = useState<ChapterSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadCbahi = useCallback(async () => {
    try {
      const res = await fetch('/api/sam/standards/cbahi', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCbahiStandards(data.standards || []);
        setCbahiChapters(data.chapterSummary || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadJci = useCallback(async () => {
    try {
      const res = await fetch('/api/sam/standards/jci', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setJciStandards(data.standards || []);
        setJciChapters(data.chapterSummary || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadCbahi(), loadJci()]).finally(() => setIsLoading(false));
  }, [loadCbahi, loadJci]);

  const assessmentColor = (s?: string) => {
    if (s === 'COMPLIANT') return 'default';
    if (s === 'PARTIALLY_COMPLIANT') return 'secondary';
    if (s === 'NON_COMPLIANT') return 'destructive';
    return 'outline';
  };

  const filterStandards = (standards: Standard[]) => {
    if (!search) return standards;
    const q = search.toLowerCase();
    return standards.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        (s.titleAr && s.titleAr.includes(search))
    );
  };

  const renderStandardsList = (standards: Standard[], chapters: ChapterSummary[]) => {
    const filtered = filterStandards(standards);

    return (
      <div className="space-y-4">
        {/* Chapter readiness overview */}
        {chapters.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tr('ملخص الفصول', 'Chapter Summary')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {chapters.map((ch) => (
                  <div key={ch.chapter} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{ch.chapter}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {ch.compliant}/{ch.total} {tr('ممتثل', 'compliant')}
                      </span>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${ch.readinessPercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-10 text-right">{ch.readinessPercent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Standards list */}
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            {tr('لا توجد معايير', 'No standards found')}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold">{s.code}</span>
                      <span className="text-sm">{language === 'ar' && s.titleAr ? s.titleAr : s.title}</span>
                    </div>
                    {s.chapter && <span className="text-xs text-muted-foreground">{s.chapter}</span>}
                  </div>
                  <Badge variant={assessmentColor(s.assessment?.status)}>
                    {s.assessment?.status?.replace(/_/g, ' ') || tr('غير مُقيَّم', 'Not Assessed')}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <SamTopNav />
      <div>
        <h1 className="text-2xl font-semibold">{tr('إدارة المعايير', 'Standards Management')}</h1>
        <p className="text-sm text-muted-foreground">
          {tr('معايير CBAHI وJCI وتقييم الامتثال وإدارة الأدلة', 'CBAHI and JCI standards, compliance assessment, and evidence management')}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder={tr('بحث عن معيار...', 'Search standards...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="cbahi">
            CBAHI
            <Badge variant="outline" className="ml-2">{cbahiStandards.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="jci">
            JCI
            <Badge variant="outline" className="ml-2">{jciStandards.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cbahi" className="mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
          ) : (
            renderStandardsList(cbahiStandards, cbahiChapters)
          )}
        </TabsContent>

        <TabsContent value="jci" className="mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
          ) : (
            renderStandardsList(jciStandards, jciChapters)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
