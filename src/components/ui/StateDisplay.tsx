import { type ReactNode } from 'react';
import { Loader2, Inbox, AlertTriangle, Lock, WifiOff, ShieldAlert, FileQuestion } from 'lucide-react';

export function LoadingState({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
      <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      <p className="mt-4 text-sm">{message}</p>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        {icon ?? <Inbox className="h-8 w-8" />}
      </div>
      <h3 className="mt-4 text-base font-semibold text-neutral-700">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Ocurrió un error',
  description = 'No se pudo completar la operación. Inténtalo nuevamente.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-50 text-error-500">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-neutral-700">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-6 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function NoPermissionsState({
  title = 'No tienes permisos para acceder a esta sección',
  description = 'Si crees que esto es un error, contacta al administrador del sistema.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-50 text-warning-500">
        <Lock className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-neutral-700">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>
    </div>
  );
}

export function SessionExpiredState({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-8 text-center shadow-soft">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning-50 text-warning-500">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-neutral-900">Tu sesión ha expirado</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Por seguridad, tu sesión se cerró automáticamente. Inicia sesión nuevamente para continuar.
        </p>
        <button
          onClick={onLogin}
          className="mt-6 w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          Iniciar sesión
        </button>
      </div>
    </div>
  );
}

export function OfflineState({ description }: { description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <WifiOff className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-neutral-700">Sin conexión a internet</h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">
        {description ?? 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.'}
      </p>
    </div>
  );
}

export function NotFoundState({
  title = 'Página no encontrada',
  description = 'La página que buscas no existe o fue movida.',
  onHome,
}: {
  title?: string;
  description?: string;
  onHome?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-neutral-700">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>
      {onHome && (
        <button
          onClick={onHome}
          className="mt-6 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          Ir al inicio
        </button>
      )}
    </div>
  );
}
