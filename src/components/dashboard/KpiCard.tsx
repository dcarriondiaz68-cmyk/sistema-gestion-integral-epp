import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const variantConfig: Record<NonNullable<KpiCardProps['variant']>, { bg: string; text: string }> = {
  default: { bg: 'bg-primary-50 text-primary-600', text: 'text-neutral-900' },
  success: { bg: 'bg-success-50 text-success-600', text: 'text-success-700' },
  warning: { bg: 'bg-warning-50 text-warning-600', text: 'text-warning-700' },
  error: { bg: 'bg-error-50 text-error-600', text: 'text-error-700' },
  info: { bg: 'bg-primary-50 text-primary-600', text: 'text-primary-700' },
};

export function KpiCard({ title, value, icon, description, variant = 'default' }: KpiCardProps) {
  const config = variantConfig[variant];

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-500">{title}</p>
          <p className={`mt-2 text-2xl font-bold ${config.text}`}>{value}</p>
          {description && (
            <p className="mt-1 text-xs text-neutral-400">{description}</p>
          )}
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

interface KpiCardWithTrendProps extends KpiCardProps {
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
}

export function KpiCardWithTrend({ title, value, icon, description, variant = 'default', trend, trendLabel }: KpiCardWithTrendProps) {
  const config = variantConfig[variant];

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-500">{title}</p>
          <p className={`mt-2 text-2xl font-bold ${config.text}`}>{value}</p>
          {description && (
            <p className="mt-1 text-xs text-neutral-400">{description}</p>
          )}
          {trend && trendLabel && (
            <div className="mt-2 flex items-center gap-1">
              {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-success-600" />}
              {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-error-600" />}
              {trend === 'flat' && <Minus className="h-3.5 w-3.5 text-neutral-400" />}
              <span className="text-xs font-medium text-neutral-500">{trendLabel}</span>
            </div>
          )}
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
