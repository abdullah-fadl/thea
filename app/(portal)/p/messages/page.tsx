'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Send, User } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'patient' | 'provider';
  senderName: string;
  content: string;
  createdAt: string;
  read: boolean;
}

interface Conversation {
  id: string;
  providerId: string;
  providerName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export default function PatientMessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const { data: conversationsData } = useSWR('/api/portal/messages/conversations', fetcher);
  const { data: messagesData, mutate: mutateMessages } = useSWR(
    selectedConversation ? `/api/portal/messages/${selectedConversation}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const conversations: Conversation[] = conversationsData?.items || [];
  const messages: Message[] = messagesData?.items || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      await fetch(`/api/portal/messages/${selectedConversation}`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      });

      setNewMessage('');
      mutateMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-card rounded-xl border border-slate-200 overflow-hidden">
      <div className="w-80 border-l border-slate-200 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">{tr('الرسائل', 'Messages')}</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-slate-500">{tr('لا توجد محادثات', 'No conversations')}</div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`w-full p-4 text-right border-b hover:bg-slate-50 ${
                  selectedConversation === conv.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{conv.providerName}</span>
                      {conv.unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="text-sm text-slate-500 truncate">{conv.lastMessage}</p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b bg-slate-50">
              <h3 className="font-medium">
                {conversations.find((c) => c.id === selectedConversation)?.providerName}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === 'patient' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      msg.senderType === 'patient' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <div
                      className={`text-xs mt-1 ${
                        msg.senderType === 'patient' ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={tr('اكتب رسالتك...', 'Type a message...')}
                  className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50"
                  title={tr('إرسال', 'Send')}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">{tr('اختر محادثة للبدء', 'Select a conversation to start')}</div>
        )}
      </div>
    </div>
  );
}
