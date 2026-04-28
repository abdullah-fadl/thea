'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import {
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  User,
  Calendar,
  Timer,
} from 'lucide-react';
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
} from '@/lib/cvision/constants';

interface RequestCardProps {
  request: {
    id: string;
    requestNumber: string;
    type: string;
    priority?: string;
    title: string;
    description: string;
    status: string;
    confidentiality: string;
    requesterEmployeeId: string;
    departmentId: string;
    slaDueAt?: string;
    slaBreached?: boolean;
    createdAt: string;
    currentOwnerRole: string;
  };
  employeeName?: string;
  departmentName?: string;
  onViewDetails: (id: string) => void;
}

const PRIORITY_BORDER: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-green-500',
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_review: 'bg-indigo-100 text-indigo-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  escalated: 'bg-orange-100 text-orange-800',
  closed: 'bg-gray-100 text-gray-800',
};

function getStatusIcon(status: string, C: any) {
  switch (status) {
    case 'approved':
      return <CheckCircle style={{ height: 14, width: 14, color: C.green }} />;
    case 'rejected':
      return <XCircle style={{ height: 14, width: 14, color: C.red }} />;
    case 'escalated':
      return <ArrowUpRight style={{ height: 14, width: 14, color: C.orange }} />;
    case 'in_review':
      return <Eye style={{ height: 14, width: 14 }} />;
    case 'closed':
      return <CheckCircle style={{ height: 14, width: 14 }} />;
    default:
      return <Clock style={{ height: 14, width: 14, color: C.blue }} />;
  }
}

function getSlaDisplay(slaDueAt: string | undefined, slaBreached: boolean | undefined, C: any) {
  if (!slaDueAt) return null;

  const due = new Date(slaDueAt);
  const now = new Date();
  const hoursRemaining = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (slaBreached || hoursRemaining < 0) {
    return {
      text: 'SLA Breached',
      className: 'text-red-600',
      icon: <AlertTriangle style={{ height: 14, width: 14, color: C.red }} />,
    };
  }
  if (hoursRemaining < 12) {
    return {
      text: `Due in ${Math.ceil(hoursRemaining)}h`,
      className: 'text-amber-600',
      icon: <Timer style={{ height: 14, width: 14, color: C.orange }} />,
    };
  }
  const daysRemaining = Math.ceil(hoursRemaining / 24);
  return {
    text: `Due in ${daysRemaining}d`,
    className: 'text-green-600',
    icon: <Timer style={{ height: 14, width: 14, color: C.green }} />,
  };
}

export default function RequestCard({
  request,
  employeeName,
  departmentName,
  onViewDetails,
}: RequestCardProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const priority = request.priority || 'medium';
  const borderColor = PRIORITY_BORDER[priority] || PRIORITY_BORDER.medium;
  const sla = getSlaDisplay(request.slaDueAt, request.slaBreached, C);

  return (
    <div
      className={`border-l-4 ${borderColor} bg-card rounded-r-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
      onClick={() => onViewDetails(request.id)}
    >
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header: Request number + Status + Priority */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.textMuted }}>
              {request.requestNumber}
            </span>
            <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>
              {REQUEST_TYPE_LABELS[request.type] || request.type}
            </CVisionBadge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CVisionBadge C={C} className={`text-xs ${PRIORITY_BADGE[priority] || PRIORITY_BADGE.medium}`}>
              {REQUEST_PRIORITY_LABELS[priority] || priority}
            </CVisionBadge>
            <CVisionBadge C={C} className={`text-xs flex items-center gap-1 ${STATUS_BADGE[request.status] || STATUS_BADGE.open}`}>
              {getStatusIcon(request.status, C)}
              {REQUEST_STATUS_LABELS[request.status] || request.status}
            </CVisionBadge>
          </div>
        </div>

        {/* Title + Description */}
        <div>
          <h3 style={{ fontWeight: 600, fontSize: 13 }}>{request.title}</h3>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {request.description}
          </p>
        </div>

        {/* Footer: Employee info + SLA + Date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: C.textMuted }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {employeeName && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <User style={{ height: 12, width: 12 }} />
                {employeeName}
              </span>
            )}
            {departmentName && (
              <span style={{ display: 'none' }}>{departmentName}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {sla && (
              <span className={`flex items-center gap-1 font-medium ${sla.className}`}>
                {sla.icon}
                {sla.text}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar style={{ height: 12, width: 12 }} />
              {new Date(request.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
