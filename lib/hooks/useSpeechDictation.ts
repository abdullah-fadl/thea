'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeechDictation() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);
  const isRunningRef = useRef(false);
  const onResultRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported');
      return;
    }
    const recognition = new (SpeechRecognition as any)();
    recognition.lang = 'ar-SA';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      isRunningRef.current = true;
      setListening(true);
    };
    recognition.onend = () => {
      isRunningRef.current = false;
      setListening(false);
    };
    recognition.onerror = (event: any) => {
      setError(event?.error || 'Speech recognition error');
      // Some browsers fire error without onend.
      isRunningRef.current = false;
      setListening(false);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      // ONLY send final results — prevents duplication from interim results
      if (finalTranscript) {
        const cb = onResultRef.current;
        if (cb) cb(finalTranscript);
      }
    };

    return () => {
      try {
        recognition.stop?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      isRunningRef.current = false;
    };
  }, []);

  const start = useCallback((onResult: (text: string) => void) => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError('Speech recognition not supported');
      return;
    }
    setError('');
    // Always allow switching the callback while already listening.
    onResultRef.current = onResult;
    if (isRunningRef.current) {
      // Already started; do not call recognition.start() again.
      return;
    }
    try {
      recognition.start();
    } catch (e: any) {
      // Guard against: InvalidStateError: recognition has already started.
      const msg = String(e?.message || e || '');
      if (msg.toLowerCase().includes('already started') || String(e?.name || '') === 'InvalidStateError') {
        isRunningRef.current = true;
        setListening(true);
        return;
      }
      setError(msg || 'Speech recognition error');
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // ignore
    }
  }, []);

  return { start, stop, listening, error };
}
