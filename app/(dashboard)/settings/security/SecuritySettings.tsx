'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useConfirm } from '@/components/ui/confirm-modal';
import { Lock, AlertTriangle } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function SecuritySettings() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { alert: showAlert } = useConfirm();

  const { data, mutate } = useSWR('/api/auth/me', fetcher);
  const user = data?.user || null;
  const [step, setStep] = useState<'idle' | 'setup'>('idle');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyToken, setVerifyToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableToken, setDisableToken] = useState('');

  const is2FAEnabled = !!user?.twoFactorEnabled;

  const handleSetup2FA = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/setup', { credentials: 'include', method: 'POST' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to setup 2FA');
      setQrCode(payload.qrCode);
      setSecret(payload.secret);
      setBackupCodes(payload.backupCodes || []);
      setStep('setup');
    } catch (err: any) {
      setError(err.message || tr('\u062D\u062F\u062B \u062E\u0637\u0623', 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verifyToken.length !== 6) {
      setError(tr('\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 \u0645\u0643\u0648\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645', 'Please enter a 6-digit code'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Verification failed');
      await mutate();
      setStep('idle');
      setVerifyToken('');
      await showAlert(tr('\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0627\u0644\u062B\u0646\u0627\u0626\u064A\u0629 \u0628\u0646\u062C\u0627\u062D!', '2FA has been enabled successfully!'));
    } catch (err: any) {
      setError(err.message || tr('\u062D\u062F\u062B \u062E\u0637\u0623', 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disablePassword || !disableToken) {
      setError(tr('\u0623\u062F\u062E\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0648\u0627\u0644\u0631\u0645\u0632', 'Enter password and token'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword, token: disableToken }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Disable failed');
      await mutate();
      setShowDisable(false);
      setDisablePassword('');
      setDisableToken('');
    } catch (err: any) {
      setError(err.message || tr('\u062D\u062F\u062B \u062E\u0637\u0623', 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">{tr('\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0645\u0627\u0646', 'Security Settings')}</h1>

        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">{tr('\u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0627\u0644\u062B\u0646\u0627\u0626\u064A\u0629 (2FA)', 'Two-Factor Authentication (2FA)')}</h2>
              <p className="text-muted-foreground text-sm">{tr('\u0623\u0636\u0641 \u0637\u0628\u0642\u0629 \u0623\u0645\u0627\u0646 \u0625\u0636\u0627\u0641\u064A\u0629 \u0644\u062D\u0633\u0627\u0628\u0643', 'Add an extra layer of security to your account')}</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                is2FAEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-muted-foreground'
              }`}
            >
              {is2FAEnabled ? tr('\u2713 \u0645\u0641\u0639\u0651\u0644', '\u2713 Enabled') : tr('\u063A\u064A\u0631 \u0645\u0641\u0639\u0651\u0644', 'Disabled')}
            </span>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {step === 'idle' && !is2FAEnabled && (
            <button
              onClick={handleSetup2FA}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? tr('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644...', 'Loading...') : tr('\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0627\u0644\u062B\u0646\u0627\u0626\u064A\u0629', 'Enable Two-Factor Authentication')}
            </button>
          )}

          {step === 'setup' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  {tr('\u0627\u0645\u0633\u062D \u0631\u0645\u0632 QR \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 (Google Authenticator, Authy, etc.)', 'Scan the QR code using your authenticator app (Google Authenticator, Authy, etc.)')}
                </p>
                <img src={qrCode} alt="QR Code" className="mx-auto mb-4" />
                <div className="bg-background rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">{tr('\u0623\u0648 \u0623\u062F\u062E\u0644 \u0627\u0644\u0631\u0645\u0632 \u064A\u062F\u0648\u064A\u0627\u064B:', 'Or enter the code manually:')}</p>
                  <code className="text-sm font-mono text-foreground">{secret}</code>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-bold text-amber-800 mb-2"><AlertTriangle className="h-4 w-4 inline text-amber-700" /> {tr('رموز الاسترداد', 'Recovery Codes')}</h3>
                <p className="text-amber-700 text-sm mb-3">
                  {tr('\u0627\u062D\u0641\u0638 \u0647\u0630\u0647 \u0627\u0644\u0631\u0645\u0648\u0632 \u0641\u064A \u0645\u0643\u0627\u0646 \u0622\u0645\u0646. \u064A\u0645\u0643\u0646\u0643 \u0627\u0633\u062A\u062E\u062F\u0627\u0645\u0647\u0627 \u0644\u0644\u062F\u062E\u0648\u0644 \u0625\u0630\u0627 \u0641\u0642\u062F\u062A \u0647\u0627\u062A\u0641\u0643.', 'Save these codes in a safe place. You can use them to sign in if you lose your phone.')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <code key={i} className="bg-card px-2 py-1 rounded-xl text-sm font-mono">
                      {code}
                    </code>
                  ))}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(backupCodes.join('\n'));
                    alert(tr('\u062A\u0645 \u0646\u0633\u062E \u0627\u0644\u0631\u0645\u0648\u0632!', 'Codes copied!'));
                  }}
                  className="mt-3 text-amber-700 text-sm underline"
                >
                  {tr('\u0646\u0633\u062E \u0627\u0644\u0631\u0645\u0648\u0632', 'Copy codes')}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {tr('\u0623\u062F\u062E\u0644 \u0627\u0644\u0631\u0645\u0632 \u0645\u0646 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0644\u0644\u062A\u0623\u0643\u064A\u062F', 'Enter the code from the app to confirm')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="flex-1 px-4 py-2 border border-border rounded-xl text-center text-2xl font-mono tracking-widest thea-input-focus"
                  />
                  <button
                    onClick={handleVerify}
                    disabled={loading || verifyToken.length !== 6}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {tr('\u062A\u0623\u0643\u064A\u062F', 'Confirm')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {is2FAEnabled && (
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-emerald-700" />
                <span className="text-emerald-700">{tr('\u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0627\u0644\u062B\u0646\u0627\u0626\u064A\u0629 \u0645\u0641\u0639\u0651\u0644\u0629', '2FA is enabled')}</span>
              </div>
              <button onClick={() => setShowDisable(true)} className="text-red-600 text-sm hover:underline">
                {tr('\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u0641\u0639\u064A\u0644', 'Disable')}
              </button>
            </div>
          )}
        </div>
      </div>

      {showDisable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">{tr('\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0627\u0644\u062B\u0646\u0627\u0626\u064A\u0629', 'Disable Two-Factor Authentication')}</h2>
              <p className="text-muted-foreground text-sm">{tr('\u0623\u0643\u062F \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0648\u0631\u0645\u0632 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629', 'Confirm your password and authentication code')}</p>
            </div>
            <div className="p-6 space-y-4">
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder={tr('\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631', 'Password')}
                className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
              />
              <input
                type="text"
                value={disableToken}
                onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={tr('\u0631\u0645\u0632 2FA', '2FA Code')}
                maxLength={6}
                className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
              />
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button onClick={() => setShowDisable(false)} className="px-4 py-2 text-muted-foreground hover:text-foreground">
                {tr('\u0625\u0644\u063A\u0627\u0621', 'Cancel')}
              </button>
              <button
                onClick={handleDisable}
                disabled={loading}
                className="px-6 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {tr('\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0625\u0644\u063A\u0627\u0621', 'Confirm Disable')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
