import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, ChevronDown, User, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { ROLE_LABELS } from '@/constants/roles.constants';
import { getInitials } from '@/lib/format';
import { ConnectionIndicator } from '@/components/ui/ConnectionIndicator';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const connectionStatus = useConnectionStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur-sm lg:px-6">
      {/* Left: mobile menu button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Right: connection + user menu */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <ConnectionIndicator status={connectionStatus} compact />
        </div>
        <div className="block sm:hidden">
          <ConnectionIndicator status={connectionStatus} compact />
        </div>

        {profile && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-neutral-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                {getInitials(profile.full_name)}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-tight text-neutral-700">
                  {profile.full_name ?? profile.email}
                </p>
                <p className="text-xs leading-tight text-neutral-400">
                  {role ? ROLE_LABELS[role] : ''}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 animate-scale-in rounded-lg border border-neutral-200 bg-white py-1 shadow-soft">
                <div className="border-b border-neutral-100 px-4 py-3">
                  <p className="truncate text-sm font-medium text-neutral-700">
                    {profile.full_name ?? profile.email}
                  </p>
                  <p className="truncate text-xs text-neutral-400">{profile.email}</p>
                  {role && (
                    <span className="mt-1.5 inline-block rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-600">
                      {ROLE_LABELS[role]}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/perfil');
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-50"
                >
                  <User className="h-4 w-4 text-neutral-400" />
                  Mi perfil
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/configuracion');
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-50"
                >
                  <Settings className="h-4 w-4 text-neutral-400" />
                  Configuración
                </button>
                <div className="border-t border-neutral-100">
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-error-600 transition-colors hover:bg-error-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
