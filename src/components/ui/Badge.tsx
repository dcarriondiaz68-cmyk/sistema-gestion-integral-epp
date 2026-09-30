import { type ReactNode } from 'react';

type Variant = 'neutral' | 'info' | 'success' | 'warning' | 'error';

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  info: 'bg-primary-50 text-primary-700 border-primary-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  error: 'bg-error-50 text-error-700 border-error-200',
};

export function Badge({ variant = 'neutral', children, icon, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
