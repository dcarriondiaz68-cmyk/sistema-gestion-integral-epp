import { useState, useCallback, useEffect, useMemo } from 'react';
import { Database } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateDisplay';
import { fetchKardex } from '@/services/inventario.service';
import { fetchWithCache } from '@/lib/data-cache';
import { fetchSedes } from '@/services/maestros.service';
import { fetchCatalogoEPP } from '@/services/catalogo.service';
import { formatDateTime } from '@/lib/format';
import type { KardexWithRelations, TipoMovimiento } from '@/types/inventario.types';
import type { Sede } from '@/types/maestros.types';
import type { CatalogoEPP } from '@/types/catalogo.types';

const TIPO_VARIANTS: Record<TipoMovimiento, 'success' | 'error' | 'neutral'> = {
  INGRESO: 'success',
  SALIDA: 'error',
  AJUSTE: 'neutral',
};

const TIPO_LABELS: Record<TipoMovimiento, string> = {
  INGRESO: 'Ingreso',
  SALIDA: 'Salida',
  AJUSTE: 'Ajuste',
};

export function KardexPage() {
  const [data, setData] = useState<KardexWithRelations[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoEPP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sedeFilter, setSedeFilter] = useState<string>('all');
  const [eppFilter, setEppFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kardex, sds, epps] = await Promise.all([
        fetchWithCache('kardex', () => fetchKardex()),
        fetchWithCache('sedes', () => fetchSedes()),
        fetchWithCache('catalogo_epp', () => fetchCatalogoEPP()),
      ]);
      setData(kardex);
      setSedes(sds as Sede[]);
      setCatalogo(epps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el kardex.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (sedeFilter !== 'all') {
        const sede = sedes.find((s) => s.id === sedeFilter);
        if (sede && d.sede_nombre !== sede.nombre) return false;
      }
      if (eppFilter !== 'all') {
        const epp = catalogo.find((e) => e.id === eppFilter);
        if (epp && d.epp_codigo !== epp.codigo) return false;
      }
      if (tipoFilter !== 'all' && d.tipo_movimiento !== tipoFilter) return false;
      return true;
    });
  }, [data, sedeFilter, eppFilter, tipoFilter, sedes, catalogo]);

  const columns: Column<KardexWithRelations>[] = [
    {
      key: 'created_at',
      label: 'Fecha',
      sortable: true,
      sortValue: (r) => r.created_at,
      render: (r) => <span className="text-neutral-700">{formatDateTime(r.created_at)}</span>,
    },
    {
      key: 'epp_nombre',
      label: 'EPP',
      sortable: true,
      sortValue: (r) => r.epp_nombre,
      render: (r) => (
        <div>
          <p className="font-medium text-neutral-900">{r.epp_nombre}</p>
          <p className="text-xs text-neutral-400">{r.epp_codigo}</p>
        </div>
      ),
    },
    {
      key: 'sede_nombre',
      label: 'Sede',
      sortable: true,
      sortValue: (r) => r.sede_nombre,
      render: (r) => <span className="text-neutral-700">{r.sede_nombre}</span>,
    },
    {
      key: 'tipo_movimiento',
      label: 'Tipo',
      sortable: true,
      sortValue: (r) => r.tipo_movimiento,
      render: (r) => (
        <Badge variant={TIPO_VARIANTS[r.tipo_movimiento]}>
          {TIPO_LABELS[r.tipo_movimiento]}
        </Badge>
      ),
    },
    {
      key: 'cantidad',
      label: 'Cantidad',
      sortable: true,
      sortValue: (r) => r.cantidad,
      render: (r) => (
        <span className={r.cantidad > 0 ? 'font-medium text-success-600' : 'font-medium text-error-600'}>
          {r.cantidad > 0 ? `+${r.cantidad}` : r.cantidad}
        </span>
      ),
    },
    {
      key: 'saldo_resultante',
      label: 'Saldo',
      sortable: true,
      sortValue: (r) => r.saldo_resultante,
      render: (r) => <span className="font-semibold text-neutral-900">{r.saldo_resultante}</span>,
    },
    {
      key: 'usuario_nombre',
      label: 'Usuario',
      sortable: true,
      sortValue: (r) => r.usuario_nombre,
      render: (r) => <span className="text-neutral-700">{r.usuario_nombre}</span>,
    },
    {
      key: 'motivo',
      label: 'Motivo',
      sortable: false,
      render: (r) => (
        <span className="text-sm text-neutral-500">{r.motivo ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Kardex</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Historial de movimientos de inventario</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-xs">
          <Select label="Filtrar por sede" value={sedeFilter} onChange={(e) => setSedeFilter(e.target.value)}>
            <option value="all">Todas las sedes</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:max-w-xs">
          <Select label="Filtrar por EPP" value={eppFilter} onChange={(e) => setEppFilter(e.target.value)}>
            <option value="all">Todos los EPP</option>
            {catalogo.map((e) => (
              <option key={e.id} value={e.id}>{e.codigo} — {e.nombre}</option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:max-w-xs">
          <Select label="Filtrar por tipo" value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
            <option value="all">Todos los tipos</option>
            <option value="INGRESO">Ingreso</option>
            <option value="SALIDA">Salida</option>
            <option value="AJUSTE">Ajuste</option>
          </Select>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Error">{error}</Alert>
      )}

      {loading ? (
        <LoadingState message="Cargando kardex..." />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin movimientos"
            description="No hay movimientos de kardex registrados."
          />
        </Card>
      ) : (
        <Card padding="sm">
          <DataTable
            columns={columns}
            data={filtered}
            searchKeys={['epp_nombre', 'epp_codigo', 'sede_nombre', 'usuario_nombre', 'motivo']}
            rowKey={(r) => r.id}
            pageSize={15}
          />
        </Card>
      )}
    </div>
  );
}
