import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { APP_CONFIG } from '@/config/app.config';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await signIn(email.trim(), password);

    if (authError) {
      setError(authError);
      setLoading(false);
      return;
    }

    navigate(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-100 lg:flex-row">
      {/* Brand panel */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-primary-900 p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-800 to-primary-950" />
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary-700/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-secondary-600/20 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <p className="text-lg font-semibold">{APP_CONFIG.name}</p>
            <p className="text-sm text-primary-200">Seguridad y Salud en el Trabajo</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="max-w-md text-3xl font-bold leading-tight">
            Gestión integral de Equipos de Protección Personal
          </h1>
          <p className="max-w-md text-primary-200">
            Sistema profesional para la administración, entrega y trazabilidad de EPP.
            Preparado para funcionamiento offline y dispositivos móviles.
          </p>
          <div className="flex flex-wrap gap-3">
            {['Trazabilidad completa', 'Offline-First', 'Multi-dispositivo', 'RM N.° 050-2013-TR'].map((feat) => (
              <span
                key={feat}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-sm text-primary-300">
          {APP_CONFIG.phase} · v{APP_CONFIG.version}
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-neutral-900">{APP_CONFIG.shortName}</p>
              <p className="text-xs text-neutral-500">Seguridad y Salud en el Trabajo</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-neutral-900">Iniciar sesión</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Ingresa tus credenciales para acceder al sistema.
            </p>
          </div>

          {error && (
            <div className="mb-6">
              <Alert variant="error">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              </Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Correo electrónico"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              required
              autoComplete="email"
              autoFocus
              icon={<Mail className="h-4 w-4" />}
            />

            <div className="relative">
              <Input
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                icon={<Lock className="h-4 w-4" />}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-neutral-400 transition-colors hover:text-neutral-600"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button type="submit" size="lg" fullWidth loading={loading}>
              Iniciar sesión
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-neutral-400">
            {APP_CONFIG.name} · {APP_CONFIG.phase}
          </p>
        </div>
      </div>
    </div>
  );
}
