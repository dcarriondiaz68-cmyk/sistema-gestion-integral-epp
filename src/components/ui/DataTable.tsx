import { useState, useMemo, type ReactNode } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchKeys?: (keyof T)[];
  pageSize?: number;
  emptyMessage?: string;
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
}

type SortDirection = 'asc' | 'desc';

export function DataTable<T>({
  columns,
  data,
  searchKeys,
  pageSize = 10,
  emptyMessage = 'No hay registros para mostrar.',
  rowKey,
  actions,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search || !searchKeys) return data;
    const q = search.toLowerCase().trim();
    return data.filter((row) =>
      searchKeys.some((key) => {
        const val = row[key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const allColumns = actions ? [...columns, { key: '_actions', label: 'Acciones', className: 'text-right' }] : columns;

  return (
    <div className="space-y-4">
      {searchKeys && searchKeys.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar..."
            className="input-base pl-10"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {allColumns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left font-medium text-neutral-600 ${col.className ?? ''}`}
                >
                  {col.key !== '_actions' && col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      {col.label}
                      {sortKey === col.key && (
                        sortDir === 'asc'
                          ? <ChevronUp className="h-3 w-3" />
                          : <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={allColumns.length} className="px-4 py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Inbox className="h-8 w-8 text-neutral-300" />
                    <p className="mt-2 text-sm text-neutral-400">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr key={rowKey(row)} className="transition-colors hover:bg-neutral-50">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-neutral-700 ${col.className ?? ''}`}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Mostrando {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sorted.length)} de {sorted.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="rounded-lg border border-neutral-300 p-1.5 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-neutral-600">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="rounded-lg border border-neutral-300 p-1.5 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
