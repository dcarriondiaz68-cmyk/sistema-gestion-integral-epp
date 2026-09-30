import { ShieldCheck, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConnectionIndicator } from '@/components/ui/ConnectionIndicator';
import { ROLE_LABELS, ROLES } from '@/constants/roles.constants';
import { APP_CONFIG } from '@/config/app.config';
import { ROLE_PERMISSIONS } from '@/constants/permissions.constants';

export function DashboardPage() {
  const { profile, role } = useAuth();
  const connectionStatus = useConnectionStatus();

  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const permissionsCount = role ? ROLE_PERMISSIONS[role].length : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome banner */}
      <div className="overflow-hidden rounded-xl bg-gradient-to-r from-primary-700 to-primary-900 p-6 text-white lg:p-8">
        <div className="flex items-center gap-2 text-primary-200">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-medium">{APP_CONFIG.phase}</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold lg:text-3xl">
          Bienvenido{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-2 max-w-2xl text-primary-200">
          {APP_CONFIG.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {role && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur-sm">
              Rol: {ROLE_LABELS[role]}
            </span>
          )}
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur-sm">
            v{APP_CONFIG.version}
          </span>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Estado del sistema"
            description="Conexión y disponibilidad"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <div className="mt-4">
            <ConnectionIndicator status={connectionStatus} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Tu rol"
            description="Permisos asignados"
            icon={<ShieldCheck className="h-5 w-5" />}
          />
          <div className="mt-4 space-y-2">
            <p className="text-lg font-semibold text-neutral-900">
              {role ? ROLE_LABELS[role] : '—'}
            </p>
            <p className="text-sm text-neutral-500">
              {role ? ROLES[role].description : ''}
            </p>
            <div className="pt-2">
              <Badge variant="info">{permissionsCount} permisos configurados</Badge>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Fase actual"
            description="Progreso del proyecto"
            icon={<Clock className="h-5 w-5" />}
          />
          <div className="mt-4 space-y-2">
            <p className="text-lg font-semibold text-neutral-900">Fase 12 de 12</p>
            <p className="text-sm text-neutral-500">Sistema completado y validado</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-primary-600" style={{ width: '100%' }} />
            </div>
          </div>
        </Card>
      </div>

      {/* Modules preview */}
      <Card padding="lg">
        <CardHeader
          title="Módulos del sistema"
          description="Los siguientes módulos se incorporarán progresivamente en las próximas fases"
          icon={<ArrowRight className="h-5 w-5" />}
        />
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_ROADMAP.map((mod) => (
            <div
              key={mod.name}
              className={`flex items-center gap-3 rounded-lg border p-4 transition-colors ${
                mod.phase <= 12
                  ? 'border-success-200 bg-success-50/50'
                  : 'border-neutral-200 bg-neutral-50/50'
              }`}
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                  mod.phase <= 12
                    ? 'bg-success-100 text-success-600'
                    : 'bg-neutral-200 text-neutral-400'
                }`}
              >
                {mod.phase <= 12
                  ? <CheckCircle2 className="h-5 w-5" />
                    : <Clock className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-700">{mod.name}</p>
                <p className="text-xs text-neutral-400">Fase {mod.phase}</p>
              </div>
              {mod.phase <= 12 ? (
                <Badge variant="success">Activo</Badge>
              ) : (
                <Badge variant="neutral">Próximamente</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Quick info */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Información de la cuenta"
            description="Datos de tu usuario"
          />
          <dl className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-neutral-500">Nombre</dt>
              <dd className="font-medium text-neutral-700">{profile?.full_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-neutral-500">Correo</dt>
              <dd className="font-medium text-neutral-700">{profile?.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-neutral-500">Rol</dt>
              <dd className="font-medium text-neutral-700">{role ? ROLE_LABELS[role] : '—'}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-neutral-500">Estado</dt>
              <dd>
                {profile?.active ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="neutral">Inactivo</Badge>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Acerca del sistema"
            description="Información general"
          />
          <dl className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-neutral-500">Sistema</dt>
              <dd className="font-medium text-neutral-700">{APP_CONFIG.name}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-neutral-500">Versión</dt>
              <dd className="font-medium text-neutral-700">{APP_CONFIG.version}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-neutral-500">Entorno</dt>
              <dd className="font-medium text-neutral-700 capitalize">{APP_CONFIG_ENV_LABEL}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-neutral-500">Módulos planificados</dt>
              <dd className="font-medium text-neutral-700">{MODULE_ROADMAP.length}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}

const APP_CONFIG_ENV_LABEL = import.meta.env.MODE === 'production' ? 'Producción' : 'Desarrollo';

const MODULE_ROADMAP = [
  { name: 'Autenticación y Roles', phase: 1 },
  { name: 'Maestros (Empresa, Sede, Área, Puesto)', phase: 2 },
  { name: 'Catálogo EPP y Matriz Puesto-EPP', phase: 3 },
  { name: 'Inventario y Kardex', phase: 4 },
  { name: 'Solicitudes y Aprobaciones', phase: 5 },
  { name: 'Entregas', phase: 6 },
  { name: 'Firmas + RM050 + PDF', phase: 7 },
  { name: 'Historial y Renovaciones', phase: 8 },
  { name: 'Costos y Dashboard SST', phase: 9 },
  { name: 'Reportes y Auditoría', phase: 10 },
  { name: 'Offline-First y Sincronización', phase: 11 },
  { name: 'Pruebas Integrales', phase: 12 },
];
