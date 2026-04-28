'use client';
import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { cvisionMutate } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardBody, CVisionButton, CVisionPageLayout, CVisionPageHeader, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { MessageCircle, Send, Loader2 } from 'lucide-react';

interface Message { role: 'user' | 'assistant'; content: string; quickActions?: { label: string; action: string }[]; }

export default function ChatPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: tr(
      '\u0623\u0647\u0644\u0627\u064b \u0648\u0633\u0647\u0644\u0627\u064b! \u{1F44B}\n\u0623\u0646\u0627 \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u0644\u0646\u0638\u0627\u0645 CVision HR.\n\u0643\u064A\u0641 \u0623\u0642\u062F\u0631 \u0623\u0633\u0627\u0639\u062F\u0643 \u0627\u0644\u064A\u0648\u0645\u061F',
      'Welcome! I am the CVision HR smart assistant.\nHow can I help you today?'
    ),
    quickActions: [
      { label: tr('\u{1F4CB} \u0631\u0635\u064A\u062F \u0625\u062C\u0627\u0632\u0627\u062A\u064A', '\u{1F4CB} My Leave Balance'), action: tr('\u0631\u0635\u064A\u062F \u0625\u062C\u0627\u0632\u0627\u062A\u064A', 'My leave balance') },
      { label: tr('\u{1F4C4} \u0637\u0644\u0628 \u062E\u0637\u0627\u0628', '\u{1F4C4} Request Letter'), action: tr('\u0623\u0628\u064A \u062E\u0637\u0627\u0628', 'I need a letter') },
      { label: tr('\u{1F4B0} \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0631\u0627\u062A\u0628', '\u{1F4B0} Salary Info'), action: tr('\u0631\u0627\u062A\u0628\u064A', 'My salary') },
      { label: tr('\u{1F4C5} \u0625\u062C\u0627\u0632\u0627\u062A \u0631\u0633\u0645\u064A\u0629', '\u{1F4C5} Official Holidays'), action: tr('\u0625\u062C\u0627\u0632\u0627\u062A \u0631\u0633\u0645\u064A\u0629', 'Official holidays') },
      { label: tr('\u2753 \u0645\u0633\u0627\u0639\u062F\u0629', '\u2753 Help'), action: tr('\u0645\u0633\u0627\u0639\u062F\u0629', 'Help') },
    ],
  }]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const chatMutation = useMutation({
    mutationFn: (text: string) => cvisionMutate<{ ok: boolean; data: { sessionId?: string; response: string; quickActions?: { label: string; action: string }[] } }>('/api/cvision/chatbot', 'POST', { action: 'chat', message: text, sessionId }),
    onSuccess: (d) => {
      if (d.ok) {
        if (d.data.sessionId) setSessionId(d.data.sessionId);
        setMessages(prev => [...prev, { role: 'assistant', content: d.data.response, quickActions: d.data.quickActions }]);
      }
    },
    onError: () => {
      setMessages(prev => [...prev, { role: 'assistant', content: tr('\u0639\u0630\u0631\u0627\u064b\u060C \u062D\u062F\u062B \u062E\u0637\u0623.', 'Sorry, an error occurred.') }]);
    },
  });

  const loading = chatMutation.isPending;

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    chatMutation.mutate(text);
  };

  return (
    <CVisionPageLayout style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>
      <CVisionPageHeader
        C={C}
        title={tr('\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A', 'Smart Assistant')}
        titleEn="Smart Assistant"
        icon={MessageCircle}
        iconColor={C.purple}
        isRTL={isRTL}
      />

      <CVisionCard C={C} hover={false} style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
        {/* Messages area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                borderRadius: 14,
                padding: '10px 16px',
                fontSize: 13,
                background: m.role === 'user'
                  ? `linear-gradient(135deg, ${C.gold}, ${C.purple})`
                  : C.bgSubtle,
                color: m.role === 'user' ? '#fff' : C.text,
                border: m.role === 'user' ? 'none' : `1px solid ${C.border}`,
              }}>
                <div style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>{m.content}</div>
                {m.quickActions && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {m.quickActions.map((qa, j) => (
                      <button
                        key={j}
                        onClick={() => send(qa.action)}
                        style={{
                          fontSize: 11,
                          background: C.bgCard,
                          border: `1px solid ${C.border}`,
                          borderRadius: 20,
                          padding: '5px 12px',
                          cursor: 'pointer',
                          color: C.text,
                          transition: 'all 0.2s',
                          fontFamily: 'inherit',
                        }}
                      >
                        {qa.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ background: C.bgSubtle, borderRadius: 14, padding: '10px 16px', border: `1px solid ${C.border}` }}>
                <Loader2 size={16} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            style={{
              flex: 1,
              fontSize: 13,
              background: 'transparent',
              outline: 'none',
              padding: '8px 12px',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              color: C.text,
              fontFamily: 'inherit',
            }}
            placeholder={tr('\u0627\u0643\u062A\u0628 \u0631\u0633\u0627\u0644\u062A\u0643 \u0647\u0646\u0627...', 'Type your message here...')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            dir="auto"
          />
          <CVisionButton C={C} isDark={isDark} size="icon" onClick={() => send(input)} disabled={!input.trim() || loading}>
            <Send size={14} />
          </CVisionButton>
        </div>
      </CVisionCard>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </CVisionPageLayout>
  );
}
