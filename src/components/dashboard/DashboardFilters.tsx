import { useState, useEffect, useCallback } from 'react';
import { Calendar, MapPin, Layers, Users, Package } from 'lucide-react';
import { Select } from '@/components/ui/Input';
import { fetchSedes, fetchAreas, fetchTrabajadores } from '@/services/maestros.service';
import { fetchCatalogoEPP } from '@/services/catalogo.service';
import type { Sede, Area, TrabajadorWithRelations } from '@/types/maestros.types';
import type { CatalogoEPP } from '@/types/catalogo.types';
import type { DashboardFilters } from '@/types/dashboard-sst.types';

interface DashboardFiltersBarProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

const PERIOD_PRESETS = [
  { value: '1m', label: 'Último mes', months: 1 },
  { value: '3m', label: 'Últimos 3 meses', months: 3 },
  { value: '6m', label: 'Últimos 6 meses', months: 6 },
  { value: '12m', label: 'Últimos 12 meses', months: 12 },
  { value: 'all', label: 'Todo el histórico', months: 0 },
];

function monthsAgo(months: number): string | undefined {
  if (months === 0) return undefined;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function DashboardFiltersBar({ filters, onFiltersChange }: DashboardFiltersBarProps) {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [trabajadores, setTrabajadores] = useState<TrabajadorWithRelations[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoEPP[]>([]);
  const [periodPreset, setPeriodPreset] = useState('12m');

  const loadOptions = useCallback(async () => {
    try {
      const [sds, trabs, epps] = await Promise.all([
        fetchSedes(),
        fetchTrabajadores(),
        fetchCatalogoEPP(),
      ]);
      setSedes(sds);
      setTrabajadores(trabs);
      setCatalogo(epps);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (filters.sedeId) {
      fetchAreas(filters.sedeId).then(setAreas).catch(() => setAreas([]));
    } else {
      fetchAreas().then(setAreas).catch(() => setAreas([]));
    }
  }, [filters.sedeId]);

  const updateFilter = (key: keyof DashboardFilters, value: string | undefined) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  const handlePeriodChange = (preset: string) => {
    setPeriodPreset(preset);
    const config = PERIOD_PRESETS.find((p) => p.value === preset);
    if (!config) return;
    const desde = monthsAgo(config.months);
    onFiltersChange({ ...filters, fechaDesde: desde, fechaHasta: undefined });
  };

  const filteredTrabajadores = filters.sedeId
    ? trabajadores.filter((t) => t.sede_id === filters.sedeId)
    : trabajadores;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
            Período
          </label>
          <Select
            value={periodPreset}
            onChange={(e) => handlePeriodChange(e.target.value)}
          >
            {PERIOD_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            <MapPin className="h-3.5 w-3.5 text-neutral-400" />
            Sede
          </label>
          <Select
            value={filters.sedeId ?? ''}
            onChange={(e) => {
              onFiltersChange({ ...filters, sedeId: e.target.value || undefined, areaId: undefined });
            }}
          >
            <option value="">Todas las sedes</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            <Layers className="h-3.5 w-3.5 text-neutral-400" />
            Área
          </label>
          <Select
            value={filters.areaId ?? ''}
            onChange={(e) => updateFilter('areaId', e.target.value)}
          >
            <option value="">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            <Users className="h-3.5 w-3.5 text-neutral-400" />
            Trabajador
          </label>
          <Select
            value={filters.trabajadorId ?? ''}
            onChange={(e) => updateFilter('trabajadorId', e.target.value)}
          >
            <option value="">Todos los trabajadores</option>
            {filteredTrabajadores
              .filter((t) => t.activo)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.apellidos}, {t.nombres}
                </option>
              ))}
          </Select>
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            <Package className="h-3.5 w-3.5 text-neutral-400" />
            EPP
          </label>
          <Select
            value={filters.eppId ?? ''}
            onChange={(e) => updateFilter('eppId', e.target.value)}
          >
            <option value="">Todos los EPP</option>
            {catalogo
              .filter((e) => e.activo)
              .map((e) => (
                <option key={e.id} value={e.id}>{e.codigo} — {e.nombre}</option>
              ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
