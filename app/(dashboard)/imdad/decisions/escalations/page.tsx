'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import {
  ArrowUpCircle, Shield, AlertTriangle, CheckCircle, XCircle,
  Brain, Clock, DollarSign, TrendingUp, Eye, Lock, Zap,
} from 'lucide-react';

interface EscalatedDecision {
  id: string;
  decisionCode: string;
  decisionType: string;
  title: string;
  titleAr: string;
  description?: string;
  descriptionAr?: string;
  confidenceScore: number;
  riskScore: number;
  costImpact: number | null;
  escalationLevel: string;
  aiReasoning?: string;
  aiReasoningAr?: string;
  createdAt: string;
}

export default function EscalationsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [decisions, setDecisions] = useState<EscalatedDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchEscalated = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/imdad/decisions?status=PENDING_REVIEW&limit=50');
      if (res.ok) {
        const data = await res.json();
        setDecisions(data.items || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEscalated(); }, [fetchEscalated]);

  const handleAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    setActioningId(id);
    try {
      await fetch(`/api/imdad/decisions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      });
      await fetchEscalated();
    } catch { /* ignore */ }
    setActioningId(null);
  };

  const typeColors: Record<string, string> = {
    DEVICE_REPLACEMENT: 'text-red-400',
    EMERGENCY_PROCUREMENT: 'text-red-400',
    SUPPLY_REORDER: 'text-amber-400',
    COST_OPTIMIZATION: 'text-blue-400',
    VENDOR_SWITCH: 'text-orange-400',
    RISK_MITIGATION: 'text-purple-400',
    COMPLIANCE_ACTION: 'text-cyan-400',
    BUDGET_ALLOCATION: 'text-green-400',
    CAPACITY_EXPANSION: 'text-emerald-400',
    PHASED_INVESTMENT: 'text-indigo-400',
  };

  const escalationBadge = (level: string) => {
    const cls = level === 'CORPORATE' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                level === 'HOSPITAL' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                'bg-gray-500/20 text-gray-400 border-gray-500/30';
    const label = level === 'CORPORATE' ? tr('مؤسسي', 'Corporate') :
                  level === 'HOSPITAL' ? tr('مستشفى', 'Hospital') :
                  level === 'DEPARTMENT' ? tr('قسم', 'Department') : level;
    return <span className={cn('text-xs px-2 py-0.5 rounded border', cls)}>{label}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center">
        <ArrowUpCircle className="h-12 w-12 text-orange-400 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="relative">
          <ArrowUpCircle className="h-8 w-8 text-orange-400" />
          {decisions.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">
              {decisions.length}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold">{tr('القرارات المصعّدة', 'Escalated Decisions')}</h1>
          <p className="text-xs text-gray-400">
            {tr('قرارات تتطلب مراجعة بشرية بسبب مخاطر عالية أو تأثير مالي كبير',
             'Decisions requiring human review due to high risk or significant financial impact')}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-orange-400" />
            <span className="text-xs text-gray-400">{tr('قيد المراجعة', 'Pending Review')}</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">{decisions.length}</p>
        </div>
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-red-400" />
            <span className="text-xs text-gray-400">{tr('مؤسسي', 'Corporate Level')}</span>
          </div>
          <p className="text-2xl font-bold text-red-400">
            {decisions.filter(d => d.escalationLevel === 'CORPORATE').length}
          </p>
        </div>
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-gray-400">{tr('إجمالي التأثير', 'Total Impact')}</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {(decisions.reduce((s, d) => s + (d.costImpact ?? 0), 0) / 1000).toFixed(0)}K SAR
          </p>
        </div>
      </div>

      {/* Decision Cards */}
      {decisions.length === 0 ? (
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-12 text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-emerald-400 opacity-40" />
          <p className="text-lg text-gray-400">{tr('لا توجد قرارات مصعّدة', 'No escalated decisions')}</p>
          <p className="text-sm text-gray-500 mt-1">
            {tr('المحرك الذاتي يعمل بكفاءة', 'The autonomous engine is operating efficiently')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {decisions.map((d) => (
            <div key={d.id} className="bg-[#111827] border border-orange-500/20 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-[#D4A017]/20 text-[#D4A017] px-2 py-0.5 rounded">
                    {d.decisionCode}
                  </span>
                  <span className={cn('text-xs font-semibold', typeColors[d.decisionType] || 'text-gray-400')}>
                    {d.decisionType.replace(/_/g, ' ')}
                  </span>
                  {escalationBadge(d.escalationLevel)}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {new Date(d.createdAt).toLocaleString()}
                </div>
              </div>

              <h3 className="font-semibold mb-1">
                {language === 'ar' ? d.titleAr : d.title}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {language === 'ar' ? (d.descriptionAr || d.description) : d.description}
              </p>

              {/* Risk & Confidence Bars */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">{tr('مستوى الثقة', 'Confidence')}</span>
                    <span className="text-blue-400">{d.confidenceScore}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${d.confidenceScore}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">{tr('درجة المخاطر', 'Risk Score')}</span>
                    <span className="text-red-400">{d.riskScore}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${d.riskScore}%` }} />
                  </div>
                </div>
              </div>

              {d.costImpact && (
                <div className="flex items-center gap-2 text-xs text-amber-400 mb-4">
                  <DollarSign className="h-3 w-3" />
                  {tr('التأثير المالي', 'Financial Impact')}: {Number(d.costImpact).toLocaleString()} SAR
                </div>
              )}

              {/* AI Reasoning */}
              {(d.aiReasoning || d.aiReasoningAr) && (
                <div className="bg-[#0a0f1e] border border-gray-700/30 rounded-lg p-3 mb-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1 mb-1 text-gray-500">
                    <Brain className="h-3 w-3" />
                    {tr('تحليل المحرك الذكي', 'AI Engine Analysis')}
                  </div>
                  <p className="whitespace-pre-wrap">
                    {language === 'ar' ? (d.aiReasoningAr || d.aiReasoning) : d.aiReasoning}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleAction(d.id, 'APPROVED')}
                  disabled={actioningId === d.id}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600/20 border border-emerald-500 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-600/30 transition-all disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  {tr('اعتماد وتنفيذ', 'Approve & Execute')}
                </button>
                <button
                  onClick={() => handleAction(d.id, 'REJECTED')}
                  disabled={actioningId === d.id}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600/20 border border-red-500 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-600/30 transition-all disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  {tr('رفض', 'Reject')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
