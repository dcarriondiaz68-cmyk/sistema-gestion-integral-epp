import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500 shadow-sm',
  secondary:
    'bg-secondary-600 text-white hover:bg-secondary-700 focus-visible:ring-secondary-500 shadow-sm',
  outline:
    'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 focus-visible:ring-primary-500',
  ghost:
    'text-neutral-600 hover:bg-neutral-100 focus-visible:ring-neutral-400',
  danger:
    'bg-error-600 text-white hover:bg-error-700 focus-visible:ring-error-500 shadow-sm',
  success:
    'bg-success-600 text-white hover:bg-success-700 focus-visible:ring-success-500 shadow-sm',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading = false, fullWidth = false, className = '', children, disabled, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`btn-base ${variantClasses[variant]} ${sizeClasses[size]} ${
          fullWidth ? 'w-full' : ''
        } ${className}`}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
