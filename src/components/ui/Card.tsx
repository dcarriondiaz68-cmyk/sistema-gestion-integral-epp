import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div className={`card-base ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ title, description, icon, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
