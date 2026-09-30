import { useState, useEffect, useCallback } from 'react';
import { UserCog, Plus, Pencil, Power, KeyRound, Mail, Loader2, ShieldCheck, Lock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';
import { useAuth } from '@/hooks/useAuth';
import { useAuthz } from '@/hooks/useAuthz';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { ROLE_LIST, ROLE_LABELS, type UserRole } from '@/constants/roles.constants';
import {
  fetchUsers,
  createUser,
  inviteUser,
  updateUser,
  toggleUserActive,
  resetPassword,
  setTempPassword,
} from '@/services/users.service';
import { fetchWithCache } from '@/lib/data-cache';
import type { UserListItem, UserCreateInput, UserInviteInput } from '@/types/users.types';

const roleBadgeVariant: Record<UserRole, 'info' | 'success' | 'warning' | 'neutral' | 'error'> = {
  ADMINISTRADOR: 'info',
  PREVENCIONISTA: 'success',
  ALMACENERO: 'warning',
  RRHH: 'neutral',
  TRABAJADOR: 'error',
};

type CreateMode = 'direct' | 'invite';

interface FormState {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: UserRole;
}

const emptyForm: FormState = {
  email: '',
  password: '',
  full_name: '',
  phone: '',
  role: 'TRABAJADOR',
};

export function UsersPage() {
  const { user } = useAuth();
  const { hasPermission } = useAuthz();
  const { isOffline, enqueueOperation } = useSyncQueue();
  const canManage = hasPermission('users.manage');

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('direct');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<UserListItem | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', role: 'TRABAJADOR' as UserRole });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<UserListItem | null>(null);
  const [toggleSaving, setToggleSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<UserListItem | null>(null);
  const [resetSaving, setResetSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [tempPasswordError, setTempPasswordError] = useState<string | null>(null);
  const [confirmTempTarget, setConfirmTempTarget] = useState<UserListItem | null>(null);
  const [tempSaving, setTempSaving] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithCache('users', () => fetchUsers({ role: filterRole, status: filterStatus }));
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  const isSelf = (u: UserListItem | null | undefined): boolean => !!u && !!user && u.id === user.id;

  const validateCreateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.email.trim()) errs.email = 'El correo es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Correo electrónico no válido';
    if (!form.full_name.trim()) errs.full_name = 'El nombre es obligatorio';
    if (createMode === 'direct' && form.password.length < 8) errs.password = 'Mínimo 8 caracteres';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validateCreateForm()) return;
    setSaving(true);
    setActionError(null);
    setFormError(null);
    try {
      if (createMode === 'direct') {
        const input: UserCreateInput = {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
        };
        await createUser(input);
        setActionSuccess('Usuario creado correctamente');
      } else {
        const input: UserInviteInput = {
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
        };
        await inviteUser(input);
        setActionSuccess('Invitación enviada correctamente');
      }
      setCreateOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear usuario';
      setActionError(msg);
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: UserListItem) => {
    setEditTarget(u);
    setEditForm({ full_name: u.full_name ?? '', phone: u.phone ?? '', role: u.role });
    setEditErrors({});
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const errs: Record<string, string> = {};
    if (!editForm.full_name.trim()) errs.full_name = 'El nombre es obligatorio';
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setEditSaving(true);
    setActionError(null);
    try {
      const roleToUpdate = isSelf(editTarget) ? editTarget.role : editForm.role;
      const fullName = editForm.full_name.trim();
      const phone = editForm.phone.trim() || null;

      if (isOffline) {
        await enqueueOperation('admin_update_profile', 'Usuarios', {
          target_uid: editTarget.id,
          email: editTarget.email,
          full_name: fullName,
          phone,
          role: roleToUpdate,
        });
        setUsers((prev) => prev.map((u) => u.id === editTarget.id ? { ...u, full_name: fullName, phone: phone ?? '', role: roleToUpdate } : u));
        setActionSuccess('Usuario actualizado localmente. El cambio quedará pendiente de sincronización.');
        setEditTarget(null);
        return;
      }

      await updateUser(editTarget.id, {
        full_name: fullName,
        phone,
        role: roleToUpdate,
      }, editTarget.email);
      setActionSuccess('Usuario actualizado correctamente');
      setEditTarget(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al actualizar usuario');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    setToggleSaving(true);
    setActionError(null);
    try {
      await toggleUserActive(toggleTarget.id, !toggleTarget.active, toggleTarget.email);
      setActionSuccess(toggleTarget.active ? 'Usuario desactivado correctamente' : 'Usuario activado correctamente');
      setToggleTarget(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setToggleSaving(false);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetSaving(true);
    setActionError(null);
    try {
      await resetPassword(resetTarget.email);
      setActionSuccess('Email de restablecimiento enviado a ' + resetTarget.email);
      setResetTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al enviar restablecimiento');
    } finally {
      setResetSaving(false);
    }
  };

  const openConfirmTemp = () => {
    if (!resetTarget) return;
    if (tempPassword.length < 8) {
      setTempPasswordError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setTempPasswordError(null);
    setConfirmTempTarget(resetTarget);
  };

  const handleSetTempPassword = async () => {
    if (!confirmTempTarget) return;
    setTempSaving(true);
    setActionError(null);
    try {
      await setTempPassword(confirmTempTarget.id, confirmTempTarget.email, tempPassword);
      setActionSuccess(`Contraseña temporal establecida para ${confirmTempTarget.full_name ?? confirmTempTarget.email}. El usuario ya puede iniciar sesión con la nueva contraseña.`);
      setConfirmTempTarget(null);
      setResetTarget(null);
      setTempPassword('');
      setTempPasswordError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al establecer la contraseña');
      setConfirmTempTarget(null);
    } finally {
      setTempSaving(false);
    }
  };

  const columns: Column<UserListItem>[] = [
    {
      key: 'full_name',
      label: 'Nombre',
      sortable: true,
      sortValue: (r) => r.full_name ?? r.email,
      render: (r) => (
        <div className="flex items-center gap-2">
          {isSelf(r) && <ShieldCheck className="h-4 w-4 text-primary-500" />}
          <div>
            <p className="font-medium text-neutral-900">{r.full_name ?? '—'}</p>
            {isSelf(r) && <p className="text-xs text-primary-500">Tú</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Correo',
      sortable: true,
      sortValue: (r) => r.email,
    },
    {
      key: 'role',
      label: 'Rol',
      sortable: true,
      sortValue: (r) => r.role,
      render: (r) => <Badge variant={roleBadgeVariant[r.role]}>{ROLE_LABELS[r.role]}</Badge>,
    },
    {
      key: 'active',
      label: 'Estado',
      sortable: true,
      sortValue: (r) => (r.active ? 1 : 0),
      render: (r) => (
        <Badge variant={r.active ? 'success' : 'error'}>
          {r.active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'phone',
      label: 'Teléfono',
      render: (r) => r.phone ?? '—',
    },
    {
      key: 'created_at',
      label: 'Registro',
      sortable: true,
      sortValue: (r) => r.created_at,
      render: (r) => new Date(r.created_at).toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      }),
    },
  ];

  const renderActions = (r: UserListItem) => {
    if (!canManage) return null;
    return (
      <>
        <button
          onClick={() => openEdit(r)}
          className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600"
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => setResetTarget(r)}
          disabled={isSelf(r)}
          className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-30"
          title="Restablecer contraseña"
        >
          <KeyRound className="h-4 w-4" />
        </button>
        <button
          onClick={() => setToggleTarget(r)}
          disabled={isSelf(r)}
          className={`rounded-md p-1.5 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 ${
            r.active ? 'text-neutral-500 hover:text-warning-600' : 'text-neutral-500 hover:text-success-600'
          }`}
          title={r.active ? 'Desactivar' : 'Activar'}
        >
          <Power className="h-4 w-4" />
        </button>
      </>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <UserCog className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Gestión de Usuarios</h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Administra las cuentas de usuario del sistema, sus roles y estados
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => { setCreateMode('direct'); setForm(emptyForm); setFormErrors({}); setFormError(null); setCreateOpen(true); }}>
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        )}
      </div>

      {actionError && (
        <Alert variant="error" title="Error">
          {actionError}
        </Alert>
      )}
      {actionSuccess && (
        <Alert variant="success" title="Completado">
          {actionSuccess}
        </Alert>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-48">
          <Select
            label="Rol"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
          >
            <option value="all">Todos los roles</option>
            {ROLE_LIST.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-40">
          <Select
            label="Estado"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState onRetry={load} />
      ) : loading ? (
        <LoadingState message="Cargando usuarios..." />
      ) : users.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin usuarios"
            description="No hay usuarios que coincidan con los filtros seleccionados."
            action={canManage ? (
              <Button onClick={() => { setCreateMode('direct'); setForm(emptyForm); setFormErrors({}); setFormError(null); setCreateOpen(true); }}>
                <Plus className="h-4 w-4" />
                Nuevo usuario
              </Button>
            ) : undefined}
          />
        </Card>
      ) : (
        <Card padding="sm" className="overflow-hidden">
          <DataTable
            columns={columns}
            data={users}
            searchKeys={['full_name', 'email']}
            rowKey={(r) => r.id}
            actions={renderActions}
            emptyMessage="No hay usuarios que coincidan con la búsqueda."
          />
        </Card>
      )}

      {/* Modal: Crear / Invitar usuario */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo usuario"
        description="Crea una cuenta directa o envía una invitación por email"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>
              {createMode === 'direct' ? 'Crear usuario' : 'Enviar invitación'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <Alert variant="error" title="Error">{formError}</Alert>
          )}
          <div className="flex gap-2 rounded-lg bg-neutral-100 p-1">
            <button
              onClick={() => { setCreateMode('direct'); setFormErrors({}); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                createMode === 'direct' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Creación directa
            </button>
            <button
              onClick={() => { setCreateMode('invite'); setFormErrors({}); }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                createMode === 'invite' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Invitación por email
            </button>
          </div>

          {createMode === 'invite' && (
            <div className="flex items-start gap-2 rounded-lg bg-primary-50 p-3 text-sm text-primary-700">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>El usuario recibirá un email con un enlace para completar su registro y definir su contraseña.</p>
            </div>
          )}

          <Input
            label="Correo electrónico"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={formErrors.email}
            placeholder="usuario@empresa.com"
          />

          {createMode === 'direct' && (
            <Input
              label="Contraseña temporal"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={formErrors.password}
              hint="Mínimo 8 caracteres"
              placeholder="••••••••"
            />
          )}

          <Input
            label="Nombre completo"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            error={formErrors.full_name}
            placeholder="Juan Pérez García"
          />

          <Input
            label="Teléfono (opcional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="999 888 777"
          />

          <Select
            label="Rol"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
          >
            {ROLE_LIST.map((r) => (
              <option key={r.id} value={r.id}>{r.label} — {r.description}</option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* Modal: Editar usuario */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Editar usuario"
        description={editTarget?.email}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={handleEdit} loading={editSaving}>Guardar cambios</Button>
          </>
        }
      >
        {editTarget && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Correo electrónico</label>
              <input
                type="email"
                value={editTarget.email}
                disabled
                className="input-base cursor-not-allowed bg-neutral-50 text-neutral-400"
              />
              <p className="mt-1.5 text-sm text-neutral-400">El correo no puede modificarse</p>
            </div>

            <Input
              label="Nombre completo"
              value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              error={editErrors.full_name}
            />

            <Input
              label="Teléfono"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              placeholder="999 888 777"
            />

            <Select
              label="Rol"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
              disabled={isSelf(editTarget)}
              hint={isSelf(editTarget) ? 'No puedes cambiar tu propio rol' : undefined}
            >
              {ROLE_LIST.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </Select>

            <div className="flex items-center gap-3 rounded-lg bg-neutral-50 p-3">
              <Badge variant={editTarget.active ? 'success' : 'error'}>
                {editTarget.active ? 'Activo' : 'Inactivo'}
              </Badge>
              <span className="text-sm text-neutral-500">
                {isSelf(editTarget)
                  ? 'No puedes cambiar tu propio estado'
                  : 'Usa el botón de encendido/apagado en la tabla para cambiar el estado'}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmación: Activar/Desactivar */}
      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        title={toggleTarget?.active ? 'Desactivar usuario' : 'Activar usuario'}
        message={
          toggleTarget?.active
            ? `¿Seguro que deseas desactivar a "${toggleTarget.full_name ?? toggleTarget.email}"? El usuario no podrá iniciar sesión hasta que se reactive.`
            : `¿Seguro que deseas reactivar a "${toggleTarget?.full_name ?? toggleTarget?.email}"? El usuario podrá iniciar sesión nuevamente.`
        }
        confirmLabel={toggleTarget?.active ? 'Desactivar' : 'Activar'}
        variant={toggleTarget?.active ? 'danger' : 'success'}
      />

      {/* Modal: Restablecer contraseña */}
      <Modal
        open={!!resetTarget}
        onClose={() => { setResetTarget(null); setTempPassword(''); setTempPasswordError(null); }}
        title="Restablecer contraseña"
        description={resetTarget?.email}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => { setResetTarget(null); setTempPassword(''); setTempPasswordError(null); }}>Cancelar</Button>
            <Button variant="outline" onClick={handleReset} loading={resetSaving} disabled={isSelf(resetTarget)}>
              <Mail className="h-4 w-4" />
              Enviar email
            </Button>
            <Button onClick={openConfirmTemp} disabled={isSelf(resetTarget) || tempPassword.length < 8}>
              <Lock className="h-4 w-4" />
              Establecer contraseña
            </Button>
          </>
        }
      >
        {resetTarget && (
          <div className="space-y-4">
            {isSelf(resetTarget) && (
              <Alert variant="warning">
                No puedes restablecer tu propia contraseña desde aquí. Usa la opción de perfil.
              </Alert>
            )}
            <div className="flex items-start gap-2 rounded-lg bg-primary-50 p-3 text-sm text-primary-700">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                <strong>Opción 1 — Email:</strong> Se enviará un email a <strong>{resetTarget.email}</strong> con un enlace
                para que el usuario defina su propia contraseña.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                <strong>Opción 2 — Contraseña temporal:</strong> Define una contraseña temporal directamente.
                El usuario podrá iniciar sesión inmediatamente. Se recomienda que la cambie después.
              </p>
            </div>
            <Input
              label="Contraseña temporal"
              type="password"
              value={tempPassword}
              onChange={(e) => { setTempPassword(e.target.value); setTempPasswordError(null); }}
              error={tempPasswordError ?? undefined}
              hint="Mínimo 8 caracteres"
              placeholder="••••••••"
            />
          </div>
        )}
      </Modal>

      {/* Confirmación: Establecer contraseña temporal */}
      <ConfirmDialog
        open={!!confirmTempTarget}
        onClose={() => setConfirmTempTarget(null)}
        onConfirm={handleSetTempPassword}
        title="Confirmar nueva contraseña temporal"
        message={`¿Seguro que deseas establecer una nueva contraseña temporal para "${confirmTempTarget?.full_name ?? confirmTempTarget?.email}"? La contraseña anterior dejará de funcionar inmediatamente.`}
        confirmLabel="Sí, establecer contraseña"
        variant="danger"
        loading={tempSaving}
      />
    </div>
  );
}
