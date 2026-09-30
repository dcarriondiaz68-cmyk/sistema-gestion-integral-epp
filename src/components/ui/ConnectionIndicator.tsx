import { Wifi, WifiOff, RefreshCw, AlertTriangle, XCircle } from 'lucide-react';
import type { ConnectionStatus } from '@/constants/statuses.constants';
import { CONNECTION_LABELS } from '@/constants/statuses.constants';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  compact?: boolean;
}

const config = {
  online: {
    icon: Wifi,
    color: 'text-success-600',
    bg: 'bg-success-50',
    dot: 'bg-success-500',
    spin: false,
  },
  offline: {
    icon: WifiOff,
    color: 'text-neutral-500',
    bg: 'bg-neutral-100',
    dot: 'bg-neutral-400',
    spin: false,
  },
  syncing: {
    icon: RefreshCw,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    dot: 'bg-primary-500',
    spin: true,
  },
  conflict: {
    icon: AlertTriangle,
    color: 'text-warning-600',
    bg: 'bg-warning-50',
    dot: 'bg-warning-500',
    spin: false,
  },
  error: {
    icon: XCircle,
    color: 'text-error-600',
    bg: 'bg-error-50',
    dot: 'bg-error-500',
    spin: false,
  },
};

export function ConnectionIndicator({
  status,
  compact = false,
}: ConnectionIndicatorProps) {
  const c = config[status];
  const Icon = c.icon;

  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5"
        title={CONNECTION_LABELS[status]}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${c.dot}`}
          />
        </span>

        <span className={`text-xs font-medium ${c.color}`}>
          {CONNECTION_LABELS[status]}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 ${c.bg}`}
    >
      <Icon
        className={`h-4 w-4 ${c.color} ${c.spin ? 'animate-spin' : ''}`}
      />

      <span className={`text-sm font-medium ${c.color}`}>
        {CONNECTION_LABELS[status]}
      </span>
    </div>
  );
}