import { type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

type AlertVariant = 'success' | 'warning' | 'error' | 'info';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
}

const config = {
  success: {
    container: 'bg-success-50 border-success-200 text-success-800',
    icon: <CheckCircle2 className="h-5 w-5 text-success-600" />,
  },
  warning: {
    container: 'bg-warning-50 border-warning-200 text-warning-800',
    icon: <AlertTriangle className="h-5 w-5 text-warning-600" />,
  },
  error: {
    container: 'bg-error-50 border-error-200 text-error-800',
    icon: <XCircle className="h-5 w-5 text-error-600" />,
  },
  info: {
    container: 'bg-primary-50 border-primary-200 text-primary-800',
    icon: <Info className="h-5 w-5 text-primary-600" />,
  },
};

export function Alert({ variant, title, children, onClose }: AlertProps) {
  const { container, icon } = config[variant];
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${container}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5 text-sm' : 'text-sm'}>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded p-0.5 transition-colors hover:bg-black/5"
          aria-label="Cerrar"
        >
          <AlertCircle className="h-4 w-4 opacity-50" />
        </button>
      )}
    </div>
  );
}
