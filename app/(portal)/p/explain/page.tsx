'use client';

import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { Send, Bot, User, Loader2, Sparkles, MessageCircle } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface ChatMessage {
  id: string;
  role: 'patient' | 'thea';
  content: string;
  contentAr?: string;
  timestamp: string;
}

export default function TheaExplainPage() {
  const { language: lang, setLanguage: setLangGlobal } = useLang();
  const tr = (ar: string, en: string) => lang === 'ar' ? ar : en;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: historyData } = useSWR('/api/portal/explain/history', fetcher);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: `local_${Date.now()}`,
      role: 'patient',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      if (!sessionId) {
        // Start new session
        const res = await fetch('/api/portal/explain', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'chat_start', message: userMessage }),
        });
        const session = await res.json();
        setSessionId(session.id);
        if (session.messages) {
          setMessages(session.messages);
        }
      } else {
        // Continue session
        const res = await fetch('/api/portal/explain', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'chat_message', sessionId, message: userMessage }),
        });
        const session = await res.json();
        if (session.messages) {
          setMessages(session.messages);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'thea',
          content: 'Sorry, something went wrong. Please try again.',
          contentAr: '\u0639\u0630\u0631\u0627\u064B\u060C \u062D\u062F\u062B \u062E\u0637\u0623. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.',
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    setLoading(false);
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {lang === 'ar' ? '\u062B\u064A\u0627 \u0627\u0634\u0631\u062D\u0644\u064A' : 'Thea Explain'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {lang === 'ar' ? '\u0627\u0633\u0623\u0644\u0646\u064A \u0639\u0646 \u0646\u062A\u0627\u0626\u062C\u0643 \u0627\u0644\u0637\u0628\u064A\u0629' : 'Ask me about your medical results'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setLangGlobal(lang === 'ar' ? 'en' : 'ar')}
            className="px-3 py-1.5 bg-muted rounded-lg text-xs"
          >
            {lang === 'ar' ? 'EN' : '\u0639\u0631'}
          </button>
          <button
            onClick={startNewChat}
            className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-medium"
          >
            {lang === 'ar' ? '\u0645\u062D\u0627\u062F\u062B\u0629 \u062C\u062F\u064A\u062F\u0629' : 'New Chat'}
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800">
        {lang === 'ar'
          ? '\u26A0\uFE0F \u0647\u0630\u0627 \u0627\u0644\u0634\u0631\u062D \u0644\u0644\u062A\u0648\u0636\u064A\u062D \u0641\u0642\u0637 \u0648\u0644\u0627 \u064A\u063A\u0646\u064A \u0639\u0646 \u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0627\u0644\u0637\u0628\u064A\u0628.'
          : '\u26A0\uFE0F This is for informational purposes only and does not replace medical advice.'}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-violet-300 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-muted-foreground mb-2">
              {lang === 'ar' ? '\u0645\u0631\u062D\u0628\u0627\u064B! \u0623\u0646\u0627 \u062B\u064A\u0627' : 'Hello! I\'m Thea'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {lang === 'ar'
                ? '\u0627\u0633\u0623\u0644\u0646\u064A \u0639\u0646 \u0623\u064A \u0646\u062A\u064A\u062C\u0629 \u0637\u0628\u064A\u0629 \u062A\u0631\u064A\u062F \u0641\u0647\u0645\u0647\u0627'
                : 'Ask me about any medical result you want to understand'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {(lang === 'ar'
                ? ['\u0645\u0627\u0630\u0627 \u064A\u0639\u0646\u064A CBC?', '\u0627\u0634\u0631\u062D\u0644\u064A HbA1c', '\u0645\u0627 \u0647\u0648 \u0627\u0644\u0643\u0648\u0644\u064A\u0633\u062A\u0631\u0648\u0644?']
                : ['What does CBC mean?', 'Explain HbA1c', 'What is cholesterol?']
              ).map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="px-3 py-2 bg-violet-50 text-violet-700 rounded-xl text-xs hover:bg-violet-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'patient' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'thea' && (
              <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-violet-600" />
              </div>
            )}
            <div
              className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                msg.role === 'patient'
                  ? 'bg-violet-600 text-white rounded-br-sm'
                  : 'bg-muted rounded-bl-sm'
              }`}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              {msg.role === 'thea' && lang === 'ar' && msg.contentAr
                ? msg.contentAr
                : msg.content}
            </div>
            {msg.role === 'patient' && (
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-violet-600" />
            </div>
            <div className="p-3 bg-muted rounded-2xl rounded-bl-sm">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={lang === 'ar' ? '\u0627\u0643\u062A\u0628 \u0633\u0624\u0627\u0644\u0643 \u0647\u0646\u0627...' : 'Type your question here...'}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          className="flex-1 px-4 py-3 border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="p-3 bg-violet-600 text-white rounded-2xl hover:bg-violet-700 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Previous Sessions */}
      {historyData?.sessions?.length > 0 && messages.length === 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold text-muted-foreground mb-2">
            {lang === 'ar' ? '\u0645\u062D\u0627\u062F\u062B\u0627\u062A \u0633\u0627\u0628\u0642\u0629' : 'Previous Chats'}
          </h3>
          <div className="space-y-1">
            {historyData.sessions.slice(0, 5).map((s: { id: string; messages: ChatMessage[]; updatedAt: string }) => (
              <button
                key={s.id}
                onClick={() => {
                  setSessionId(s.id);
                  setMessages(s.messages || []);
                }}
                className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded-lg text-xs text-left"
              >
                <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="truncate flex-1">
                  {s.messages?.[0]?.content?.substring(0, 60) || 'Chat'}
                </span>
                <span className="text-muted-foreground">
                  {new Date(s.updatedAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
