import { useState, useEffect, useRef } from 'react';
import { Settings, Info, Shield, Database, Smartphone, Code, ImageIcon, Upload, Trash2, Loader2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { APP_CONFIG } from '@/config/app.config';
import { ROLE_LIST } from '@/constants/roles.constants';
import { useAuth } from '@/hooks/useAuth';
import { fetchLogoUrl, uploadLogo, removeLogo } from '@/services/app-config.service';

export function SettingsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'ADMINISTRADOR';

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchLogoUrl()
      .then(setLogoUrl)
      .catch(() => setLogoUrl(null));
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoLoading(true);
    setLogoError(null);
    try {
      const url = await uploadLogo(file);
      setLogoUrl(url);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Error al subir el logo.');
    } finally {
      setLogoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogoRemove = async () => {
    setLogoLoading(true);
    setLogoError(null);
    try {
      await removeLogo();
      setLogoUrl(null);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Error al eliminar el logo.');
    } finally {
      setLogoLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Configuración</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Información general del sistema y configuración de la aplicación.
        </p>
      </div>

      {/* Logo de la empresa */}
      <Card>
        <CardHeader
          title="Logo de la empresa"
          description="Logo que aparece en el Registro SST / RM050 y en la exportación a PDF"
          icon={<ImageIcon className="h-5 w-5" />}
          action={isAdmin ? undefined : <Badge variant="neutral">Solo administrador</Badge>}
        />
        <div className="mt-4">
          {logoError && (
            <div className="mb-4">
              <Alert variant="error" onClose={() => setLogoError(null)}>{logoError}</Alert>
            </div>
          )}
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo de la empresa" className="max-h-20 max-w-20 object-contain" />
              ) : (
                <ImageIcon className="h-8 w-8 text-neutral-300" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-neutral-600">
                {logoUrl
                  ? 'El logo está configurado y aparecerá en el Registro SST / RM050.'
                  : 'No hay logo configurado. El Registro SST mostrará un espacio reservado.'}
              </p>
              {isAdmin && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={logoLoading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {logoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {logoUrl ? 'Reemplazar logo' : 'Subir logo'}
                  </Button>
                  {logoUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={logoLoading}
                      onClick={handleLogoRemove}
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* App info */}
      <Card>
        <CardHeader
          title="Información de la aplicación"
          description="Datos generales del sistema"
          icon={<Info className="h-5 w-5" />}
        />
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Nombre</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-700">{APP_CONFIG.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Versión</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-700">{APP_CONFIG.version}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Fase</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-700">{APP_CONFIG.phase}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Entorno</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-700 capitalize">
              {import.meta.env.MODE === 'production' ? 'Producción' : 'Desarrollo'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Idioma</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-700">Español (Perú)</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Zona horaria</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-700">{APP_CONFIG.timezone}</dd>
          </div>
        </dl>
      </Card>

      {/* Roles */}
      <Card>
        <CardHeader
          title="Roles del sistema"
          description="Roles disponibles y su descripción"
          icon={<Shield className="h-5 w-5" />}
        />
        <div className="mt-4 space-y-3">
          {ROLE_LIST.map((role) => (
            <div
              key={role.id}
              className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Shield className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-700">{role.label}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{role.description}</p>
              </div>
              <Badge variant="neutral">{role.id}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* PWA info */}
      <Card>
        <CardHeader
          title="Aplicación progresiva (PWA)"
          description="Instalación y funcionamiento offline"
          icon={<Smartphone className="h-5 w-5" />}
        />
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-neutral-400" />
              <span className="text-sm text-neutral-600">Instalable en dispositivos</span>
            </div>
            <Badge variant="success">Disponible</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-neutral-400" />
              <span className="text-sm text-neutral-600">Funcionamiento offline</span>
            </div>
            <Badge variant="info">Preparado · Fase 10</Badge>
          </div>
        </div>
      </Card>

      {/* Technical info */}
      <Card>
        <CardHeader
          title="Información técnica"
          description="Tecnologías y arquitectura"
          icon={<Code className="h-5 w-5" />}
        />
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Frontend</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-700">React + TypeScript + Vite</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Estilos</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-700">Tailwind CSS</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Backend</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-700">Supabase (PostgreSQL)</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Autenticación</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-700">Supabase Auth</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
