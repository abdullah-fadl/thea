'use client';

import {
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  AlertCircle,
} from 'lucide-react';

interface Props {
  status: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<
  string,
  { icon: any; color: string; bgColor: string; label: string }
> = {
  PENDING_PAYMENT: {
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'بانتظار الدفع',
  },
  PAID: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'مدفوع',
  },
  INSURANCE_PENDING: {
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'بانتظار التأمين',
  },
  INSURANCE_APPROVED: {
    icon: Shield,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'التأمين موافق',
  },
  INSURANCE_REJECTED: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'التأمين مرفوض',
  },
  EXEMPTED: {
    icon: CheckCircle,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'معفى',
  },
};

export function PaymentStatusBadge({ status, showLabel = true, size = 'md' }: Props) {
  const config = statusConfig[status] || {
    icon: AlertCircle,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    label: status || 'غير معروف',
  };

  const Icon = config.icon;
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
    >
      <Icon className={iconSize[size]} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
