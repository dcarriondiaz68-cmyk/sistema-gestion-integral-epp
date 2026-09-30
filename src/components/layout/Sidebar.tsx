import { NavLink, useLocation } from 'react-router-dom';
import { X, ShieldCheck } from 'lucide-react';
import { NAV_ITEMS, ACCOUNT_NAV_ITEMS, type NavItem } from '@/constants/navigation.constants';
import { useAuthz } from '@/hooks/useAuthz';
import { APP_CONFIG } from '@/config/app.config';
import { ROLE_LABELS } from '@/constants/roles.constants';
import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@/lib/format';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

function NavItemLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const { hasPermission } = useAuthz();
  const accessible = hasPermission(item.permission);

  if (!accessible) return null;

  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
        } ${!item.enabled ? 'cursor-not-allowed opacity-50' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-neutral-400 group-hover:text-neutral-600'}`}
          />
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { profile, role } = useAuth();

  const handleNavClick = () => {
    onClose();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-neutral-200 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{APP_CONFIG.shortName}</p>
          <p className="truncate text-xs text-neutral-400">{APP_CONFIG.phase}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Módulos
        </p>
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItemLink
              key={item.to}
              item={item}
              onClick={handleNavClick}
            />
          ))}
        </div>

        <p className="px-3 pb-2 pt-6 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Cuenta
        </p>
        <div className="space-y-1">
          {ACCOUNT_NAV_ITEMS.map((item) => (
            <NavItemLink
              key={item.to}
              item={item}
              onClick={handleNavClick}
            />
          ))}
        </div>
      </nav>

      {/* User mini-profile */}
      {profile && (
        <div className="border-t border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {getInitials(profile.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-700">
                {profile.full_name ?? profile.email}
              </p>
              <p className="truncate text-xs text-neutral-400">
                {role ? ROLE_LABELS[role] : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-neutral-200 bg-white lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
          />
          <aside className="absolute left-0 top-0 h-full w-72 animate-slide-in-left bg-white shadow-soft">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
