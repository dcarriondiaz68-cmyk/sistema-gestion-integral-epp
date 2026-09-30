import { useState, type FormEvent } from 'react';
import { User, Mail, Phone, Shield, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { ROLE_LABELS } from '@/constants/roles.constants';
import { getInitials, formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (updateError) {
      setError('No se pudieron guardar los cambios. Inténtalo nuevamente.');
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 4000);
  };

  if (!profile) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Mi Perfil</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Administra tu información personal y datos de cuenta.
        </p>
      </div>

      {/* Profile header card */}
      <Card>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700">
            {getInitials(profile.full_name)}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-semibold text-neutral-900">
              {profile.full_name ?? profile.email}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">{profile.email}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              {profile.role && (
                <Badge variant="info" icon={<Shield className="h-3 w-3" />}>
                  {ROLE_LABELS[profile.role]}
                </Badge>
              )}
              <Badge variant={profile.active ? 'success' : 'neutral'}>
                {profile.active ? 'Cuenta activa' : 'Cuenta inactiva'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit form */}
      <Card>
        <CardHeader
          title="Información personal"
          description="Actualiza tus datos de contacto"
          icon={<User className="h-5 w-5" />}
        />

        {success && (
          <div className="mt-4">
            <Alert variant="success">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Los cambios se guardaron correctamente.</span>
              </div>
            </Alert>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <Input
            label="Nombre completo"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Tu nombre completo"
            icon={<User className="h-4 w-4" />}
          />
          <Input
            label="Correo electrónico"
            type="email"
            value={profile.email}
            disabled
            hint="El correo electrónico no puede modificarse"
            icon={<Mail className="h-4 w-4" />}
          />
          <Input
            label="Teléfono"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="999 999 999"
            icon={<Phone className="h-4 w-4" />}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" />
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader
          title="Información de cuenta"
          description="Datos técnicos de tu usuario"
        />
        <dl className="mt-4 space-y-3">
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Rol asignado</dt>
            <dd className="font-medium text-neutral-700">
              {profile.role ? ROLE_LABELS[profile.role] : '—'}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Fecha de registro</dt>
            <dd className="font-medium text-neutral-700">{formatDateTime(profile.created_at)}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-neutral-500">Última actualización</dt>
            <dd className="font-medium text-neutral-700">{formatDateTime(profile.updated_at)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
