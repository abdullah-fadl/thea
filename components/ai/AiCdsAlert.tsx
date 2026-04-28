'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Info,
  XCircle,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import AiDisclaimer from './AiDisclaimer';
import { useLang } from '@/hooks/use-lang';

interface CDSAlertData {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: { ar: string; en: string };
  description: { ar: string; en: string };
  suggestedAction: { ar: string; en: string };
  evidence?: string;
  overridable: boolean;
}

interface AiCdsAlertProps {
  alert: CDSAlertData;
  onDismiss?: (alertId: string) => void;
  onOverride?: (alertId: string, reason: string) => void;
}

/**
 * Clinical Decision Support alert notification card.
 */
export default function AiCdsAlert({
  alert,
  onDismiss,
  onOverride,
}: AiCdsAlertProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const lang = language;

  const [expanded, setExpanded] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverride, setShowOverride] = useState(false);

  const severityConfig = {
    info: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-800',
      icon: <Info className="w-4 h-4 text-blue-600" />,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-800',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
    },
    critical: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: <XCircle className="w-4 h-4 text-red-600" />,
    },
  };

  const config = severityConfig[alert.severity];

  return (
    <div className={`rounded-xl border p-3 ${config.bg}`}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className={`text-sm font-bold ${config.text}`}>
              {alert.title[lang]}
            </h4>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-0.5 hover:bg-black/5 rounded"
              >
                {expanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              {onDismiss && (
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="p-0.5 hover:bg-black/5 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className={`text-xs mt-0.5 ${config.text} opacity-80`}>
            {alert.description[lang]}
          </p>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-current/10 space-y-2">
          <div>
            <span className="text-[10px] font-bold uppercase opacity-60">
              {tr('الإجراء المقترح', 'Suggested Action')}
            </span>
            <p className={`text-xs ${config.text}`}>
              {alert.suggestedAction[lang]}
            </p>
          </div>

          {alert.evidence && (
            <div>
              <span className="text-[10px] font-bold uppercase opacity-60">
                {tr('الدليل', 'Evidence')}
              </span>
              <p className="text-xs opacity-70">{alert.evidence}</p>
            </div>
          )}

          {/* Override */}
          {alert.overridable && onOverride && (
            <div className="pt-2">
              {!showOverride ? (
                <button
                  onClick={() => setShowOverride(true)}
                  className="text-[10px] underline opacity-60 hover:opacity-100"
                >
                  {tr('تجاوز هذا التنبيه', 'Override this alert')}
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder={tr('سبب التجاوز...', 'Override reason...')}
                    className="flex-1 px-2 py-1 text-xs border border-current/20 rounded bg-white/50"
                  />
                  <button
                    onClick={() => {
                      if (overrideReason.trim()) {
                        onOverride(alert.id, overrideReason);
                      }
                    }}
                    disabled={!overrideReason.trim()}
                    className="px-2 py-1 text-[10px] font-bold bg-white/50 border border-current/20 rounded disabled:opacity-30"
                  >
                    {tr('تأكيد', 'Confirm')}
                  </button>
                </div>
              )}
            </div>
          )}

          <AiDisclaimer variant="inline" />
        </div>
      )}
    </div>
  );
}
