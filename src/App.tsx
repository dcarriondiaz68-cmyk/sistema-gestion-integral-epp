import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { AuthzProvider } from '@/components/providers/AuthzProvider';
import { ProtectedRoute, PermissionRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { EmpresasPage } from '@/pages/EmpresasPage';
import { SedesPage } from '@/pages/SedesPage';
import { AreasPage } from '@/pages/AreasPage';
import { PuestosPage } from '@/pages/PuestosPage';
import { TrabajadoresPage } from '@/pages/TrabajadoresPage';
import { CatalogoEPPPage } from '@/pages/CatalogoEPPPage';
import { SolicitudesPage } from '@/pages/SolicitudesPage';
import { InventarioPage } from '@/pages/InventarioPage';
import { KardexPage } from '@/pages/KardexPage';
import { EntregasPage } from '@/pages/EntregasPage';
import { HistorialEPPPage } from '@/pages/HistorialEPPPage';
import { RenovacionesPage } from '@/pages/RenovacionesPage';
import { CostosPage } from '@/pages/CostosPage';
import { DashboardSSTPage } from '@/pages/DashboardSSTPage';
import { ReportesPage } from '@/pages/ReportesPage';
import { AuditoriaPage } from '@/pages/AuditoriaPage';
import { SyncPage } from '@/pages/SyncPage';
import { UsersPage } from '@/pages/UsersPage';
import { SyncProvider } from '@/components/providers/SyncProvider';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/ui/StateDisplay';
import type { ReactNode } from 'react';

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingState message="Cargando..." />;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AuthzProvider>
        <SyncProvider>
          <AppLayout />
        </SyncProvider>
      </AuthzProvider>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/usuarios" element={<PermissionRoute permission="users.manage"><UsersPage /></PermissionRoute>} />
        <Route path="/empresas" element={<PermissionRoute permission="empresas.view"><EmpresasPage /></PermissionRoute>} />
        <Route path="/sedes" element={<PermissionRoute permission="sedes.view"><SedesPage /></PermissionRoute>} />
        <Route path="/areas" element={<PermissionRoute permission="areas.view"><AreasPage /></PermissionRoute>} />
        <Route path="/puestos" element={<PermissionRoute permission="puestos.view"><PuestosPage /></PermissionRoute>} />
        <Route path="/trabajadores" element={<PermissionRoute permission="trabajadores.view"><TrabajadoresPage /></PermissionRoute>} />
        <Route path="/catalogo-epp" element={<PermissionRoute permission="catalogo_epp.view"><CatalogoEPPPage /></PermissionRoute>} />
        <Route path="/solicitudes" element={<PermissionRoute permission="solicitudes.view"><SolicitudesPage /></PermissionRoute>} />
        <Route path="/inventario" element={<PermissionRoute permission="inventario.view"><InventarioPage /></PermissionRoute>} />
        <Route path="/kardex" element={<PermissionRoute permission="kardex.view"><KardexPage /></PermissionRoute>} />
        <Route path="/entregas" element={<PermissionRoute permission="entregas.view"><EntregasPage /></PermissionRoute>} />
        <Route path="/historial" element={<PermissionRoute permission="historial.view"><HistorialEPPPage /></PermissionRoute>} />
        <Route path="/renovaciones" element={<PermissionRoute permission="renovaciones.view"><RenovacionesPage /></PermissionRoute>} />
        <Route path="/costos" element={<PermissionRoute permission="costos.view"><CostosPage /></PermissionRoute>} />
        <Route path="/dashboard-sst" element={<PermissionRoute permission="dashboard_sst.view"><DashboardSSTPage /></PermissionRoute>} />
        <Route path="/reportes" element={<PermissionRoute permission="reportes.view"><ReportesPage /></PermissionRoute>} />
        <Route path="/auditoria" element={<PermissionRoute permission="auditoria.view"><AuditoriaPage /></PermissionRoute>} />
        <Route path="/sincronizacion" element={<SyncPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/configuracion" element={<SettingsPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
