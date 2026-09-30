import {
  LayoutDashboard,
  CloudUpload,
  User,
  Settings,
  ShieldCheck,
  Users,
  UserCog,
  Boxes,
  ClipboardList,
  FileSignature,
  History,
  RefreshCw,
  DollarSign,
  BarChart3,
  FileText,
  ScrollText,
  Database,
  Building2,
  MapPin,
  Layers,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/constants/permissions.constants';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission: Permission;
  enabled: boolean;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard.view',
    enabled: true,
  },
  {
    label: 'Usuarios',
    to: '/usuarios',
    icon: UserCog,
    permission: 'users.manage',
    enabled: true,
  },
  {
    label: 'Empresa',
    to: '/empresas',
    icon: Building2,
    permission: 'empresas.view',
    enabled: true,
  },
  {
    label: 'Sedes',
    to: '/sedes',
    icon: MapPin,
    permission: 'sedes.view',
    enabled: true,
  },
  {
    label: 'Áreas',
    to: '/areas',
    icon: Layers,
    permission: 'areas.view',
    enabled: true,
  },
  {
    label: 'Puestos',
    to: '/puestos',
    icon: Briefcase,
    permission: 'puestos.view',
    enabled: true,
  },
  {
    label: 'Trabajadores',
    to: '/trabajadores',
    icon: Users,
    permission: 'trabajadores.view',
    enabled: true,
  },
  {
    label: 'Catálogo EPP',
    to: '/catalogo-epp',
    icon: Boxes,
    permission: 'catalogo_epp.view',
    enabled: true,
  },
  {
    label: 'Inventario',
    to: '/inventario',
    icon: ShieldCheck,
    permission: 'inventario.view',
    enabled: true,
  },
  {
    label: 'Kardex',
    to: '/kardex',
    icon: Database,
    permission: 'kardex.view',
    enabled: true,
  },
  {
    label: 'Solicitudes',
    to: '/solicitudes',
    icon: ClipboardList,
    permission: 'solicitudes.view',
    enabled: true,
  },
  {
    label: 'Entregas',
    to: '/entregas',
    icon: FileSignature,
    permission: 'entregas.view',
    enabled: true,
  },
  {
    label: 'Historial EPP',
    to: '/historial',
    icon: History,
    permission: 'historial.view',
    enabled: true,
  },
  {
    label: 'Renovaciones',
    to: '/renovaciones',
    icon: RefreshCw,
    permission: 'renovaciones.view',
    enabled: true,
  },
  {
    label: 'Costos',
    to: '/costos',
    icon: DollarSign,
    permission: 'costos.view',
    enabled: true,
  },
  {
    label: 'Dashboard SST',
    to: '/dashboard-sst',
    icon: BarChart3,
    permission: 'dashboard_sst.view',
    enabled: true,
  },
  {
    label: 'Reportes',
    to: '/reportes',
    icon: FileText,
    permission: 'reportes.view',
    enabled: true,
  },
  {
    label: 'Auditoría',
    to: '/auditoria',
    icon: ScrollText,
    permission: 'auditoria.view',
    enabled: true,
  },
  {
    label: 'Sincronización',
    to: '/sincronizacion',
    icon: CloudUpload,
    permission: 'profile.view',
    enabled: true,
  },
];

export const ACCOUNT_NAV_ITEMS: NavItem[] = [
  {
    label: 'Mi Perfil',
    to: '/perfil',
    icon: User,
    permission: 'profile.view',
    enabled: true,
  },
  {
    label: 'Configuración',
    to: '/configuracion',
    icon: Settings,
    permission: 'settings.view',
    enabled: true,
  },
];
