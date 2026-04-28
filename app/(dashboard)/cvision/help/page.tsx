'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionCard, CVisionCardBody, CVisionInput , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useMemo, useRef } from 'react';

import {
  Search, ChevronRight, ChevronLeft, ThumbsUp, ThumbsDown, HelpCircle, X,
} from 'lucide-react';

import { ARTICLES } from './_data/articles';
import { CATEGORIES } from './_data/categories';
import type { HelpArticle } from './_data/articles';
import ArticleContent from './_components/ArticleContent';

export default function HelpCenterPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl+/ or Cmd+/
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Hash-based deep linking
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const article = ARTICLES.find(a => a.id === hash);
      if (article) {
        setSelectedArticle(article);
        setSelectedCategory(article.category);
      }
    }
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return ARTICLES;
    const q = search.toLowerCase();
    return ARTICLES.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q)) ||
      a.content.toLowerCase().includes(q)
    );
  }, [search]);

  const articlesByCategory = useMemo(() => {
    const map = new Map<string, HelpArticle[]>();
    for (const a of filtered) {
      const list = map.get(a.category) || [];
      list.push(a);
      map.set(a.category, list);
    }
    return map;
  }, [filtered]);

  function openArticle(a: HelpArticle) {
    setSelectedArticle(a);
    window.history.replaceState(null, '', `#${a.id}`);
  }

  function backToList() {
    setSelectedArticle(null);
    window.history.replaceState(null, '', window.location.pathname);
  }

  function backToCategories() {
    setSelectedCategory(null);
    setSelectedArticle(null);
    window.history.replaceState(null, '', window.location.pathname);
  }

  // ─── Article Detail View ──────────────────────────────────────────────

  if (selectedArticle) {
    const relatedCategory = ARTICLES.filter(a => a.category === selectedArticle.category && a.id !== selectedArticle.id);
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }} dir={isRTL ? 'rtl' : 'ltr'}>
        <button onClick={backToList} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: C.blue }}>
          <ChevronLeft size={14} /> {tr('العودة إلى', 'Back to')} {selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.title : tr('مركز المساعدة', 'Help Center')}
        </button>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{selectedArticle.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: C.textMuted }}>
            <CVisionBadge C={C} variant="outline">{CATEGORIES.find(c => c.id === selectedArticle.category)?.title}</CVisionBadge>
            <span>{tr('آخر تحديث', 'Last updated')}: {selectedArticle.lastUpdated}</span>
          </div>
        </div>

        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <ArticleContent content={selectedArticle.content} />
          </CVisionCardBody>
        </CVisionCard>

        {/* Feedback */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: C.textMuted, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          <span>{tr('هل كان هذا مفيداً؟', 'Was this helpful?')}</span>
          <button
            onClick={() => setFeedback(prev => ({ ...prev, [selectedArticle.id]: 'up' }))}
            className={`p-1.5 rounded hover:bg-green-50 transition ${feedback[selectedArticle.id] === 'up' ? 'bg-green-100 text-green-700' : ''}`}
          >
            <ThumbsUp size={16} />
          </button>
          <button
            onClick={() => setFeedback(prev => ({ ...prev, [selectedArticle.id]: 'down' }))}
            className={`p-1.5 rounded hover:bg-red-50 transition ${feedback[selectedArticle.id] === 'down' ? 'bg-red-100 text-red-700' : ''}`}
          >
            <ThumbsDown size={16} />
          </button>
          {feedback[selectedArticle.id] && <span style={{ fontSize: 12 }}>{tr('شكراً لملاحظاتك!', 'Thanks for your feedback!')}</span>}
        </div>

        {/* Related articles */}
        {relatedCategory.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{tr('مقالات ذات صلة', 'Related Articles')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {relatedCategory.slice(0, 5).map(a => (
                <button key={a.id} onClick={() => openArticle(a)}
                  style={{ display: 'block', fontSize: 13, color: C.blue }}>
                  → {a.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Category Detail View ─────────────────────────────────────────────

  if (selectedCategory) {
    const cat = CATEGORIES.find(c => c.id === selectedCategory)!;
    const catArticles = articlesByCategory.get(selectedCategory) || [];
    const Icon = cat.icon;

    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }} dir={isRTL ? 'rtl' : 'ltr'}>
        <button onClick={backToCategories} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: C.blue }}>
          <ChevronLeft size={14} /> {tr('العودة إلى مركز المساعدة', 'Back to Help Center')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className={`p-2 rounded-lg ${cat.color}`}><Icon size={24} /></div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>{cat.title}</h1>
          </div>
        </div>

        {catArticles.length === 0 && (
          <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا توجد مقالات تطابق بحثك في هذا التصنيف.', 'No articles match your search in this category.')}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {catArticles.map((a, idx) => (
            <button key={a.id} onClick={() => openArticle(a)}
              style={{ width: '100%', textAlign: isRTL ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12, borderRadius: 12, border: `1px solid ${C.border}`, padding: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, width: 24, textAlign: 'center' }}>{idx + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</p>
                <p style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.content.slice(0, 80)}…</p>
              </div>
              <ChevronRight size={14} style={{ color: C.textMuted }} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Main Category Grid ───────────────────────────────────────────────

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }} dir={isRTL ? 'rtl' : 'ltr'}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <HelpCircle size={24} /> {tr('مركز المساعدة', 'Help Center')}
        </h1>
        <p style={{ fontSize: 13, color: C.textMuted }}>{tr('كل ما تحتاج معرفته عن CVision HR', 'Everything you need to know about CVision HR')}</p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 576 }}>
        <Search size={16} style={{ position: 'absolute', color: C.textMuted }} />
        <CVisionInput C={C}
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tr('ابحث في مقالات المساعدة... (Ctrl+/)', 'Search help articles… (Ctrl+/)')}
          style={{ paddingLeft: 36, paddingRight: 36, height: 40 }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', color: C.textMuted }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Search results */}
      {search.trim() && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            {filtered.length} {tr('نتيجة', 'result')}{filtered.length !== 1 ? (isRTL ? '' : 's') : ''} {tr('لـ', 'for')} &quot;{search}&quot;
          </p>
          {filtered.length === 0 && (
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center', color: C.textMuted }}>
              {tr('لم يتم العثور على مقالات. جرب كلمات مختلفة.', 'No articles found. Try different keywords.')}
            </CVisionCardBody></CVisionCard>
          )}
          {filtered.map(a => {
            const cat = CATEGORIES.find(c => c.id === a.category);
            return (
              <button key={a.id} onClick={() => { setSelectedCategory(a.category); openArticle(a); }}
                style={{ width: '100%', textAlign: isRTL ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12, borderRadius: 12, border: `1px solid ${C.border}`, padding: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</p>
                    <CVisionBadge C={C} variant="outline" className="text-[10px]">{cat?.title}</CVisionBadge>
                  </div>
                  <p style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.content.slice(0, 100)}…</p>
                </div>
                <ChevronRight size={14} style={{ color: C.textMuted }} />
              </button>
            );
          })}
        </div>
      )}

      {/* Category grid */}
      {!search.trim() && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
          {CATEGORIES.map(cat => {
            const count = articlesByCategory.get(cat.id)?.length || 0;
            const Icon = cat.icon;
            return (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                style={{ textAlign: isRTL ? 'right' : 'left', borderRadius: 16, border: `1px solid ${C.border}`, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div className={`p-2 rounded-lg ${cat.color} transition group-hover:scale-110`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{cat.title}</p>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: C.textMuted }}>
                  {count} {tr('مقال', 'article')}{count !== 1 ? (isRTL ? '' : 's') : ''}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Keyboard hint */}
      {!search.trim() && (
        <p style={{ textAlign: 'center', fontSize: 12, color: C.textMuted, paddingTop: 16 }}>
          {tr('اضغط', 'Press')} <kbd style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, background: C.bgSubtle, borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}>Ctrl+/</kbd> {tr('من أي مكان لفتح بحث مركز المساعدة', 'from anywhere to open the Help Center search')}
        </p>
      )}
    </div>
  );
}
