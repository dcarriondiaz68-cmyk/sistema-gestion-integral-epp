import { type ReactNode, useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Power } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/Modal';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';

interface CrudPageShellProps<T> {
  title: string;
  description: string;
  icon: ReactNode;
  data: T[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAdd: () => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  onToggleActivo: (row: T) => void;
  renderTable: () => ReactNode;
  addLabel: string;
  canManage: boolean;
  emptyActionLabel?: string;
  children?: ReactNode;
}

export function CrudPageShell<T>({
  title,
  description,
  icon,
  data,
  loading,
  error,
  onRetry,
  onAdd,
  renderTable,
  canManage,
  addLabel,
  children,
}: CrudPageShellProps<T>) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
            <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
          </div>
        </div>
        {canManage && (
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4" />
            {addLabel}
          </Button>
        )}
      </div>

      {children}

      {error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}

      {loading ? (
        <LoadingState message="Cargando..." />
      ) : error ? (
        <ErrorState onRetry={onRetry} />
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin registros"
            description="Aún no hay registros. Crea el primero para comenzar."
            action={
              canManage ? (
                <Button onClick={onAdd}>
                  <Plus className="h-4 w-4" />
                  {addLabel}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        renderTable()
      )}
    </div>
  );
}

interface RowActionButtonsProps<T> {
  row: T;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  onToggleActivo: (row: T) => void;
  activo: boolean;
  canManage: boolean;
}

export function RowActionButtons<T>({
  row,
  onEdit,
  onDelete,
  onToggleActivo,
  activo,
  canManage,
}: RowActionButtonsProps<T>) {
  if (!canManage) return null;
  return (
    <>
      <button
        onClick={() => onEdit(row)}
        className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600"
        title="Editar"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={() => onToggleActivo(row)}
        className={`rounded-md p-1.5 transition-colors hover:bg-neutral-100 ${
          activo ? 'text-neutral-500 hover:text-warning-600' : 'text-neutral-500 hover:text-success-600'
        }`}
        title={activo ? 'Desactivar' : 'Activar'}
      >
        <Power className="h-4 w-4" />
      </button>
      <button
        onClick={() => onDelete(row)}
        className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-error-600"
        title="Eliminar"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </>
  );
}

interface DeleteConfirmState<T> {
  row: T | null;
  type: 'delete' | 'toggle';
}

export function useDeleteConfirm<T extends { activo: boolean }>(
  onConfirmDelete: (row: T) => Promise<void>,
  onConfirmToggle: (row: T) => Promise<void>
) {
  const [state, setState] = useState<DeleteConfirmState<T>>({ row: null, type: 'delete' });

  const requestDelete = useCallback((row: T) => setState({ row, type: 'delete' }), []);
  const requestToggle = useCallback((row: T) => setState({ row, type: 'toggle' }), []);
  const close = useCallback(() => setState({ row: null, type: 'delete' }), []);

  const confirm = useCallback(async () => {
    if (!state.row) return;
    if (state.type === 'delete') {
      await onConfirmDelete(state.row);
    } else {
      await onConfirmToggle(state.row);
    }
    close();
  }, [state, onConfirmDelete, onConfirmToggle, close]);

  return { state, requestDelete, requestToggle, close, confirm };
}
