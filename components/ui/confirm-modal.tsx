'use client';

import * as React from 'react';
import { useState, useCallback, useRef, createContext, useContext } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useLang } from '@/hooks/use-lang';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModalType = 'confirm' | 'alert' | 'prompt';

interface ModalState {
  open: boolean;
  type: ModalType;
  message: string;
  defaultValue?: string;
}

interface ConfirmModalContextValue {
  confirm: (message: string) => Promise<boolean>;
  alert: (message: string) => Promise<void>;
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ConfirmModalContext = createContext<ConfirmModalContextValue | null>(null);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConfirm(): ConfirmModalContextValue {
  const ctx = useContext(ConfirmModalContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a <ConfirmModalProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ConfirmModalProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [state, setState] = useState<ModalState>({
    open: false,
    type: 'confirm',
    message: '',
  });

  const [promptValue, setPromptValue] = useState('');

  // We store the resolve callback in a ref so the modal buttons can settle
  // the promise without needing it in React state.
  const resolveRef = useRef<((value: any) => void) | null>(null);

  // ---- helpers ----

  const open = useCallback(
    (type: ModalType, message: string, defaultValue?: string) =>
      new Promise<any>((resolve) => {
        resolveRef.current = resolve;
        setPromptValue(defaultValue ?? '');
        setState({ open: true, type, message, defaultValue });
      }),
    [],
  );

  const close = useCallback((value: any) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  // ---- public API ----

  const confirm = useCallback(
    (message: string): Promise<boolean> => open('confirm', message),
    [open],
  );

  const alert = useCallback(
    (message: string): Promise<void> => open('alert', message),
    [open],
  );

  const prompt = useCallback(
    (message: string, defaultValue?: string): Promise<string | null> =>
      open('prompt', message, defaultValue),
    [open],
  );

  // ---- button labels ----

  const confirmLabel = tr('تأكيد', 'Confirm');
  const cancelLabel = tr('إلغاء', 'Cancel');
  const okLabel = tr('حسناً', 'OK');

  // ---- handlers ----

  const handleConfirm = () => {
    if (state.type === 'confirm') {
      close(true);
    } else if (state.type === 'alert') {
      close(undefined);
    } else {
      // prompt
      close(promptValue);
    }
  };

  const handleCancel = () => {
    if (state.type === 'confirm') {
      close(false);
    } else if (state.type === 'alert') {
      close(undefined);
    } else {
      // prompt
      close(null);
    }
  };

  // For alert dialogs we must keep the dialog controlled. Radix AlertDialog
  // does not allow dismiss via overlay click by default, which is what we want.

  return (
    <ConfirmModalContext.Provider value={{ confirm, alert, prompt }}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {state.type === 'confirm'
                ? tr('تأكيد', 'Confirm')
                : state.type === 'alert'
                ? tr('تنبيه', 'Notice')
                : tr('إدخال', 'Input')}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap">
              {state.message}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {state.type === 'prompt' && (
            <div className="px-1">
              <Input
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                autoFocus
              />
            </div>
          )}

          <AlertDialogFooter>
            {state.type !== 'alert' && (
              <AlertDialogCancel onClick={handleCancel}>
                {cancelLabel}
              </AlertDialogCancel>
            )}
            <AlertDialogAction onClick={handleConfirm}>
              {state.type === 'alert' ? okLabel : confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmModalContext.Provider>
  );
}
