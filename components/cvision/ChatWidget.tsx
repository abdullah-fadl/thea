'use client';
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';

interface Message { role: 'user' | 'assistant'; content: string; quickActions?: { label: string; action: string }[]; }

export default function ChatWidget() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: tr('أهلاً! 👋 أنا المساعد الذكي. كيف أقدر أساعدك؟', 'Hello! 👋 I\'m the smart assistant. How can I help you?'),
    quickActions: [
      { label: tr('📋 رصيد إجازاتي', '📋 Leave Balance'), action: tr('رصيد إجازاتي', 'My leave balance') },
      { label: tr('📄 طلب خطاب', '📄 Request Letter'), action: tr('أبي خطاب', 'I need a letter') },
      { label: tr('❓ مساعدة', '❓ Help'), action: tr('مساعدة', 'Help') },
    ],
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const r = await fetch('/api/cvision/chatbot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'chat', message: text, sessionId }), credentials: 'include' });
      const d = await r.json();
      if (d.ok) {
        if (d.data.sessionId) setSessionId(d.data.sessionId);
        setMessages(prev => [...prev, { role: 'assistant', content: d.data.response, quickActions: d.data.quickActions }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: tr('عذراً، حدث خطأ. حاول مرة أخرى.', 'Sorry, an error occurred. Try again.') }]);
    }
    setLoading(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 24,
          zIndex: 50,
          height: 48,
          width: 48,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.gold}, ${C.purple})`,
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
      >
        <MessageCircle size={20} />
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        zIndex: 50,
        width: 340,
        maxHeight: 500,
        background: C.bgCard,
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        border: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: `linear-gradient(135deg, ${C.gold}, ${C.purple})`, color: '#fff' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{tr('المساعد الذكي', 'Smart Assistant')}</span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 300, maxHeight: 380 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: 13,
              background: m.role === 'user' ? C.gold : C.bgSubtle,
              color: m.role === 'user' ? '#fff' : C.text,
            }}>
              <div style={{ whiteSpace: 'pre-line' }}>{m.content}</div>
              {m.quickActions && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {m.quickActions.map((qa, j) => (
                    <button key={j} onClick={() => sendMessage(qa.action)} style={{
                      fontSize: 11,
                      background: C.bgCard,
                      border: `1px solid ${C.border}`,
                      borderRadius: 16,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      color: C.text,
                      transition: 'background 0.2s',
                    }}>
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
            <div style={{ background: C.bgSubtle, borderRadius: 12, padding: '8px 12px' }}>
              <Loader2 size={16} color={C.gold} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, padding: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          style={{
            flex: 1,
            fontSize: 13,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '6px 8px',
            color: C.text,
          }}
          placeholder={tr('اكتب رسالتك...', 'Type your message...')}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          dir="auto"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: input.trim() && !loading ? C.gold : C.bgSubtle,
            border: 'none',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: input.trim() && !loading ? 1 : 0.5,
          }}
        >
          <Send size={14} color={input.trim() && !loading ? '#fff' : C.textMuted} />
        </button>
      </div>
    </div>
  );
}
