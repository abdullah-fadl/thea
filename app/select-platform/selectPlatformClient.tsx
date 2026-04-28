'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';

type ActivePlatform = 'sam' | 'health' | 'imdad';

async function choose(platform: ActivePlatform): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/shell/active-platform', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ platform }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.error || 'Failed to select platform' };
  }
  return { ok: true };
}

export function SelectPlatformClient() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [loading, setLoading] = useState<ActivePlatform | null>(null);
  const [error, setError] = useState<string>('');

  const onClick = async (platform: ActivePlatform) => {
    setError('');
    setLoading(platform);
    const result = await choose(platform);
    if (!result.ok) {
      setError(result.error || 'Failed to select platform');
      setLoading(null);
      return;
    }
    window.location.assign(platform === 'sam' ? '/sam' : platform === 'imdad' ? '/imdad' : '/health');
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <button
        type="button"
        onClick={() => onClick('sam')}
        disabled={loading !== null}
        className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-left hover:bg-neutral-800 disabled:opacity-60"
      >
        <div className="text-lg font-semibold">SAM</div>
        <div className="mt-2 text-sm text-neutral-300">{tr('محرك السياسات، المكتبة، النزاهة.', 'Policy engine, library, integrity.')}</div>
        <div className="mt-4 text-sm text-neutral-400">
          {loading === 'sam' ? tr('جاري الاختيار…', 'Selecting…') : tr('المتابعة إلى SAM ←', 'Continue to SAM →')}
        </div>
      </button>

      <button
        type="button"
        onClick={() => onClick('health')}
        disabled={loading !== null}
        className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-left hover:bg-neutral-800 disabled:opacity-60"
      >
        <div className="text-lg font-semibold">Thea Health</div>
        <div className="mt-2 text-sm text-neutral-300">{tr('سير عمل الطوارئ / العيادات / المنومين.', 'ER / OPD / IPD workflows.')}</div>
        <div className="mt-4 text-sm text-neutral-400">
          {loading === 'health' ? tr('جاري الاختيار…', 'Selecting…') : tr('المتابعة إلى Health ←', 'Continue to Health →')}
        </div>
      </button>

      <button
        type="button"
        onClick={() => onClick('imdad')}
        disabled={loading !== null}
        className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-left hover:bg-neutral-800 disabled:opacity-60"
      >
        <div className="text-lg font-semibold">Imdad</div>
        <div className="mt-2 text-sm text-neutral-300">{tr('سلسلة الإمداد، المشتريات، المخزون.', 'Supply chain, procurement, inventory.')}</div>
        <div className="mt-4 text-sm text-neutral-400">
          {loading === 'imdad' ? tr('جاري الاختيار…', 'Selecting…') : tr('المتابعة إلى إمداد ←', 'Continue to Imdad →')}
        </div>
      </button>

      {error ? (
        <div className="md:col-span-2 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}

