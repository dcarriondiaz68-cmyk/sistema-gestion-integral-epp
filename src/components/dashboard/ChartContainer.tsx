import { type ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

interface ChartContainerProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartContainer({ title, description, icon, children, className = '' }: ChartContainerProps) {
  return (
    <Card padding="md" className={className}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {icon && (
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
          </div>
        </div>
      </div>
      <div className="w-full">{children}</div>
    </Card>
  );
}
