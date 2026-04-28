'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import {
  AlertTriangle, ShieldAlert, ShieldCheck, Info,
  Check, X, ChevronDown, ChevronUp, TrendingUp,
  Users, Calendar, DollarSign, Heart, Gauge,
} from 'lucide-react';

// ── Types ──

interface Recommendation {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  actionAr: string;
  actionEn: string;
  departmentName?: string;
  doctorName?: string;
  metricValue: number;
  threshold: number;
  confidence: number;
  createdAt: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string, reason: string) => void;
}

// ── Config ──

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
    icon: ShieldAlert,
    labelAr: 'حرج',
    labelEn: 'Critical',
  },
  high: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-800',
    badge: 'bg-orange-100 text-orange-700',
    icon: AlertTriangle,
    labelAr: 'مرتفع',
    labelEn: 'High',
  },
  medium: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
    icon: Info,
    labelAr: 'متوسط',
    labelEn: 'Moderate',
  },
  low: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: ShieldCheck,
    labelAr: 'منخفض',
    labelEn: 'Low',
  },
};

const TYPE_ICONS: Record<string, any> = {
  add_doctor: Users,
  close_clinic: Calendar,
  schedule_optimize: Calendar,
  noshow_prevention: AlertTriangle,
  revenue_opportunity: DollarSign,
  burnout_risk: Heart,
  capacity_warning: Gauge,
};

// ── Component ──

export default function RecommendationCard({ recommendation, onAcknowledge, onDismiss }: RecommendationCardProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [expanded, setExpanded] = useState(false);
  const [showDismissInput, setShowDismissInput] = useState(false);
  const [dismissReason, setDismissReason] = useState('');

  const rec = recommendation;
  const config = SEVERITY_CONFIG[rec.severity] || SEVERITY_CONFIG.medium;
  const SeverityIcon = config.icon;
  const TypeIcon = TYPE_ICONS[rec.type] || TrendingUp;

  const isAcknowledged = rec.acknowledged;

  const handleDismiss = () => {
    if (!dismissReason.trim()) return;
    onDismiss(rec.id, dismissReason);
    setShowDismissInput(false);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return tr('الآن', 'Just now');
    if (hours < 24) return tr(`منذ ${hours} ساعة`, `${hours}h ago`);
    const days = Math.floor(hours / 24);
    return tr(`منذ ${days} يوم`, `${days}d ago`);
  };

  return (
    <div className={`border-2 ${config.border} ${config.bg} rounded-xl overflow-hidden transition-all ${isAcknowledged ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div
        className="p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-2">
          <SeverityIcon className={`w-4 h-4 mt-0.5 ${config.text} shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold ${config.text}`}>
                {language === 'ar' ? rec.titleAr : rec.titleEn}
              </span>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${config.badge}`}>
                {tr(config.labelAr, config.labelEn)}
              </span>
              {isAcknowledged && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                  {tr('تم الإقرار', 'Acknowledged')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <TypeIcon className="w-3 h-3" />
                {rec.type.replace(/_/g, ' ')}
              </span>
              {rec.departmentName && <span>{rec.departmentName}</span>}
              {rec.doctorName && <span>{rec.doctorName}</span>}
              <span>{timeAgo(rec.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Confidence badge */}
            <span className="text-[9px] font-mono text-slate-400">
              {rec.confidence}%
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-dashed border-slate-200/60">
          {/* Description */}
          <div className={`text-xs ${config.text} mt-2 opacity-80`}>
            {language === 'ar' ? rec.descriptionAr : rec.descriptionEn}
          </div>

          {/* Metric bar */}
          <div className="mt-2 bg-white/60 rounded-lg p-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-500">{tr('القيمة الحالية', 'Current Value')}</span>
              <span className="font-bold text-slate-700">{rec.metricValue}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1 relative">
              <div
                className={`h-full rounded-full ${rec.severity === 'critical' ? 'bg-red-500' : rec.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min((rec.metricValue / Math.max(rec.threshold * 1.5, rec.metricValue * 1.2)) * 100, 100)}%` }}
              />
              {/* Threshold marker */}
              <div
                className="absolute top-0 w-0.5 h-3 bg-slate-600 -mt-0.5"
                style={{ left: `${Math.min((rec.threshold / Math.max(rec.threshold * 1.5, rec.metricValue * 1.2)) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
              <span>0</span>
              <span>{tr('الحد', 'Threshold')}: {rec.threshold}</span>
            </div>
          </div>

          {/* Action */}
          <div className="mt-2 bg-white/60 rounded-lg p-2">
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
              {tr('الإجراء المقترح', 'Suggested Action')}
            </div>
            <div className="text-xs text-slate-700">
              {language === 'ar' ? rec.actionAr : rec.actionEn}
            </div>
          </div>

          {/* Action buttons */}
          {!isAcknowledged && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onAcknowledge(rec.id); }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
              >
                <Check className="w-3 h-3" />
                {tr('إقرار', 'Acknowledge')}
              </button>
              {!showDismissInput ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDismissInput(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X className="w-3 h-3" />
                  {tr('تجاهل', 'Dismiss')}
                </button>
              ) : (
                <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    value={dismissReason}
                    onChange={(e) => setDismissReason(e.target.value)}
                    placeholder={tr('سبب التجاهل...', 'Reason for dismissing...')}
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-card"
                    autoFocus
                  />
                  <button
                    onClick={handleDismiss}
                    disabled={!dismissReason.trim()}
                    className="px-2 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    {tr('تأكيد', 'Confirm')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
