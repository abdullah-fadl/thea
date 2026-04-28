'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface SpeechRecognitionPanelProps {
  /** Called when the transcript is finalized and should be inserted into the report */
  onInsertText?: (text: string) => void;
  /** Study/report ID for context */
  studyId?: string;
  /** Whether the panel starts open */
  defaultOpen?: boolean;
}

const VOICE_COMMANDS: Record<string, { ar: string; en: string; description_ar: string; description_en: string }> = {
  'NEW_PARAGRAPH': { ar: 'فقرة جديدة', en: 'new paragraph', description_ar: 'إضافة فقرة جديدة', description_en: 'Insert a new paragraph' },
  'NEW_LINE': { ar: 'سطر جديد', en: 'new line', description_ar: 'إضافة سطر جديد', description_en: 'Insert a new line' },
  'PERIOD': { ar: 'نقطة', en: 'period', description_ar: 'إضافة نقطة', description_en: 'Insert a period' },
  'COMMA': { ar: 'فاصلة', en: 'comma', description_ar: 'إضافة فاصلة', description_en: 'Insert a comma' },
  'DELETE_LAST': { ar: 'احذف الأخير', en: 'delete last', description_ar: 'حذف آخر كلمة', description_en: 'Delete last word' },
  'CLEAR_ALL': { ar: 'امسح الكل', en: 'clear all', description_ar: 'مسح كل النص', description_en: 'Clear all text' },
  'INSERT_TEXT': { ar: 'أدخل النص', en: 'insert text', description_ar: 'إدراج النص في التقرير', description_en: 'Insert text into report' },
};

export default function SpeechRecognitionPanel({
  onInsertText,
  studyId,
  defaultOpen = false,
}: SpeechRecognitionPanelProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [duration, setDuration] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize Web Speech API
  const initSpeechRecognition = useCallback(() => {
    const w = window as unknown as Record<string, unknown>;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: tr('المتصفح لا يدعم التعرف على الصوت', 'Browser does not support speech recognition'), variant: 'destructive' });
      return null;
    }

    const recognition = new (SpeechRecognition as any)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'ar' ? 'ar-SA' : 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        // Process voice commands
        const processed = processVoiceCommands(final);
        if (processed !== null) {
          setTranscript(prev => prev + processed);
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        toast({ title: tr('خطأ في التعرف على الصوت', 'Speech recognition error'), variant: 'destructive' });
      }
    };

    recognition.onend = () => {
      // Auto-restart if still recording
      if (isRecording && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // Already started
        }
      }
    };

    return recognition;
  }, [language, isRecording, toast, tr]);

  // Process voice commands
  const processVoiceCommands = useCallback((text: string): string | null => {
    const lowerText = text.toLowerCase().trim();

    if (lowerText === 'new paragraph' || lowerText === 'فقرة جديدة') {
      return '\n\n';
    }
    if (lowerText === 'new line' || lowerText === 'سطر جديد') {
      return '\n';
    }
    if (lowerText === 'period' || lowerText === 'نقطة') {
      return '. ';
    }
    if (lowerText === 'comma' || lowerText === 'فاصلة') {
      return ', ';
    }
    if (lowerText === 'delete last' || lowerText === 'احذف الأخير') {
      setTranscript(prev => {
        const words = prev.trim().split(/\s+/);
        words.pop();
        return words.join(' ') + ' ';
      });
      return null;
    }
    if (lowerText === 'clear all' || lowerText === 'امسح الكل') {
      setTranscript('');
      return null;
    }
    if (lowerText === 'insert text' || lowerText === 'أدخل النص') {
      if (onInsertText) {
        onInsertText(transcript);
        toast({ title: tr('تم إدراج النص', 'Text inserted') });
      }
      return null;
    }

    return text + ' ';
  }, [transcript, onInsertText, toast, tr]);

  // Start recording
  const startRecording = useCallback(async () => {
    const recognition = initSpeechRecognition();
    if (!recognition) return;

    // Create session on server
    try {
      const res = await fetch('/api/radiology/speech/sessions', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyId: studyId || undefined,
          language: language === 'ar' ? 'ar-SA' : 'en-US',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionId(data.session.id);
      }
    } catch {
      // Continue without server session
    }

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setDuration(0);

    timerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  }, [initSpeechRecognition, studyId, language]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setInterimText('');

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Update server session
    if (sessionId && transcript) {
      try {
        await fetch(`/api/radiology/speech/sessions/${sessionId}/transcript`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript, mode: 'replace' }),
        });
        await fetch(`/api/radiology/speech/sessions/${sessionId}`, {
          credentials: 'include',
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'PAUSED' }),
        });
      } catch {
        // Silent
      }
    }
  }, [sessionId, transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Insert text into report
  const handleInsert = useCallback(() => {
    if (onInsertText && transcript.trim()) {
      onInsertText(transcript.trim());
      toast({ title: tr('تم إدراج النص في التقرير', 'Text inserted into report') });
    }
  }, [onInsertText, transcript, toast, tr]);

  // Floating mic button when panel is closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        title={tr('فتح لوحة التعرف على الصوت', 'Open speech recognition panel')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[600px] shadow-2xl rounded-xl overflow-hidden" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Card className="border-2">
        {/* Header */}
        <CardHeader className="pb-2 bg-muted/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
              {tr('التعرف على الصوت', 'Speech Recognition')}
            </CardTitle>
            <div className="flex items-center gap-1">
              {isRecording && (
                <Badge className="bg-red-100 text-red-800 animate-pulse text-xs">
                  {formatDuration(duration)}
                </Badge>
              )}
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowCommands(!showCommands)}>
                <span className="text-xs">?</span>
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { if (isRecording) stopRecording(); setIsOpen(false); }}>
                <span className="text-lg leading-none">&times;</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 space-y-3">
          {/* Voice Commands Reference */}
          {showCommands && (
            <div className="bg-muted/50 rounded-lg p-2 text-xs space-y-1">
              <div className="font-medium mb-1">{tr('الأوامر الصوتية', 'Voice Commands')}:</div>
              {Object.entries(VOICE_COMMANDS).map(([key, cmd]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">{language === 'ar' ? cmd.description_ar : cmd.description_en}</span>
                  <Badge variant="outline" className="text-xs">{language === 'ar' ? cmd.ar : cmd.en}</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Transcript Area */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{tr('النص المسجل', 'Transcript')}</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 text-xs"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? tr('معاينة', 'Preview') : tr('تعديل', 'Edit')}
              </Button>
            </div>
            {editMode ? (
              <Textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                className="min-h-[120px] text-sm"
                placeholder={tr('النص سيظهر هنا...', 'Transcript will appear here...')}
              />
            ) : (
              <div className="min-h-[120px] max-h-[200px] overflow-y-auto border rounded-md p-2 text-sm bg-background">
                {transcript ? (
                  <p className="whitespace-pre-wrap">
                    {transcript}
                    {interimText && (
                      <span className="text-muted-foreground italic">{interimText}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-muted-foreground italic">
                    {isRecording
                      ? tr('جاري الاستماع...', 'Listening...')
                      : tr('اضغط على زر الميكروفون للبدء', 'Press the mic button to start')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <Button
                  size="sm"
                  onClick={startRecording}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                  {tr('بدء', 'Start')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={stopRecording}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="mr-1">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  {tr('إيقاف', 'Stop')}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setTranscript(''); setInterimText(''); }}
                disabled={!transcript && !interimText}
              >
                {tr('مسح', 'Clear')}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {onInsertText && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleInsert}
                  disabled={!transcript.trim()}
                >
                  {tr('إدراج', 'Insert')}
                </Button>
              )}
            </div>
          </div>

          {/* Word count */}
          {transcript && (
            <div className="text-xs text-muted-foreground text-center">
              {transcript.trim().split(/\s+/).filter(Boolean).length} {tr('كلمة', 'words')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-medium ${className || ''}`}>{children}</label>;
}
