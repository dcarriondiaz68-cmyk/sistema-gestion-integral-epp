import { createPortal } from 'react-dom';
import type { RegistroSST } from '@/types/registro-sst.types';
import { formatDate, formatDateTime } from '@/lib/format';

interface RegistroSSTDocumentProps {
  registro: RegistroSST;
}

export function RegistroSSTDocument({ registro }: RegistroSSTDocumentProps) {
  const logoUrl = '/Logo_Tiktok.png';

  return (
    <>
      {/* On-screen document — shown in the modal (unchanged layout) */}
      <div className="rm050-document mx-auto max-w-4xl bg-white p-8 text-neutral-900">
        <DocumentHeader logoUrl={logoUrl} registro={registro} />
        <Section1Empleador registro={registro} />
        <Section2TipoEquipo registro={registro} />
        <Section3NombreEquipo registro={registro} />

        <section className="mt-5">
          <Section4Heading />
          <div className="overflow-x-auto border border-neutral-300">
            <table className="w-full border-collapse text-sm">
              <thead>
                <TrabajadoresTableHeader />
              </thead>
              <tbody>
                <WorkerTableRow registro={registro} />
              </tbody>
            </table>
          </div>
        </section>

        <Section5Responsable registro={registro} />

        <div className="mt-8 flex items-center justify-between border-t border-neutral-200 pt-3 text-[10px] text-neutral-400">
          <span>Registro generado el {formatDateTime(registro.created_at)}</span>
          <span>{registro.codigo_documento} · v{registro.version_documento}</span>
        </div>
      </div>

      {/* Print-only structure — two explicit A4 pages, hidden on screen */}
      {createPortal(
        <div className="rm050-print-root">
          {/* Page 1: header + sections 1-3 + section 4 heading/column headers */}
          <div className="rm050-print-page-1 bg-white text-neutral-900">
            <DocumentHeader logoUrl={logoUrl} registro={registro} />
            <Section1Empleador registro={registro} />
            <Section2TipoEquipo registro={registro} />
            <Section3NombreEquipo registro={registro} />
            <section className="rm050-keep-together mt-5">
              <Section4Heading />
              <div className="border border-neutral-300">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <TrabajadoresTableHeader />
                  </thead>
                  <tbody>
                    <WorkerTableRow registro={registro} />
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Page 2: section 5 and responsible signature — balanced A4 fill */}
          <div className="rm050-print-page-2 bg-white text-neutral-900">
            <PrintSection5Responsable registro={registro} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function DocumentHeader({ logoUrl, registro }: { logoUrl: string | null; registro: RegistroSST }) {
  return (
    <div className="grid grid-cols-3 items-start border-b-2 border-neutral-900 pb-4">
      <div className="flex items-start justify-start">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo de la empresa"
            className="h-28 w-28 object-contain"
          />
        ) : (
          <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">LOGO</span>
        )}
      </div>
      <div className="text-center">
        <h1 className="text-base font-bold uppercase leading-tight tracking-wide text-neutral-900 sm:text-lg">
          Registro de Equipos de Seguridad o Emergencia
        </h1>
      </div>
      <div className="text-right">
        <div className="inline-block rounded border border-neutral-300 px-3 py-1.5 text-left">
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Código:</p>
          <p className="text-sm font-bold text-neutral-900">{registro.codigo_documento}</p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500">Versión:</p>
          <p className="text-sm font-bold text-neutral-900">{registro.version_documento}</p>
        </div>
      </div>
    </div>
  );
}

function Section1Empleador({ registro }: { registro: RegistroSST }) {
  return (
    <section className="rm050-keep-together mt-5">
      <h2 className="mb-2 border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-bold uppercase text-neutral-800">
        1. Datos del Empleador
      </h2>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 px-1 sm:grid-cols-2">
        <Field label="Razón Social / Denominación Social" value={registro.empresa_razon_social} />
        <Field label="RUC" value={registro.empresa_ruc} />
        <div className="sm:col-span-2">
          <Field label="Domicilio" value={registro.empresa_domicilio} />
        </div>
        <Field label="Actividad Económica" value={registro.empresa_actividad} />
        <Field
          label="N° de Trabajadores en el Centro Laboral"
          value={registro.empresa_num_trabajadores != null ? String(registro.empresa_num_trabajadores) : null}
        />
      </div>
    </section>
  );
}

function Section2TipoEquipo({ registro }: { registro: RegistroSST }) {
  return (
    <section className="rm050-keep-together mt-5">
      <h2 className="mb-2 border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-bold uppercase text-neutral-800">
        2. Tipo de Equipo de Seguridad o Emergencia Entregado
      </h2>
      <div className="flex flex-wrap gap-4 px-1 py-2">
        <TipoEquipoRadio label="Equipo de Protección Personal" selected={registro.tipo_equipo === 'EPP'} />
        <TipoEquipoRadio label="Equipo de Emergencia" selected={registro.tipo_equipo === 'EMERGENCIA'} />
      </div>
    </section>
  );
}

function Section3NombreEquipo({ registro }: { registro: RegistroSST }) {
  return (
    <section className="rm050-keep-together mt-5">
      <h2 className="mb-2 border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-bold uppercase text-neutral-800">
        3. Nombre(s) del(los) Equipo(s) de Seguridad o Emergencia Entregado(s)
      </h2>
      <div className="min-h-[2.5rem] border border-neutral-300 px-3 py-2">
        <p className="text-sm font-medium text-neutral-900">{registro.epp_nombre}</p>
      </div>
    </section>
  );
}

function Section4Heading() {
  return (
    <h2 className="mb-2 border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-bold uppercase text-neutral-800">
      4. Lista de Datos del(los) Trabajador(es)
    </h2>
  );
}

function WorkerTableRow({ registro }: { registro: RegistroSST }) {
  return (
    <tr className="text-center">
      <td className="border-r border-neutral-300 px-2 py-3 font-medium text-neutral-500">1</td>
      <td className="border-r border-neutral-300 px-2 py-3 text-left font-medium text-neutral-900">
        {registro.trabajador_nombre}
      </td>
      <td className="border-r border-neutral-300 px-2 py-3 text-neutral-700">{registro.trabajador_dni}</td>
      <td className="border-r border-neutral-300 px-2 py-3 text-neutral-700">{registro.trabajador_area ?? '—'}</td>
      <td className="border-r border-neutral-300 px-2 py-3 text-neutral-700">{formatDate(registro.fecha_entrega)}</td>
      <td className="border-r border-neutral-300 px-2 py-3 text-neutral-700">{formatDate(registro.fecha_renovacion)}</td>
      <td className="px-2 py-3">
        {registro.firma_trabajador_data ? (
          <img
            src={registro.firma_trabajador_data}
            alt="Firma del trabajador"
            className="mx-auto h-14 w-24 object-contain"
          />
        ) : (
          <span className="block text-center text-xs text-neutral-400">Sin firma</span>
        )}
      </td>
    </tr>
  );
}

function Section5Responsable({ registro }: { registro: RegistroSST }) {
  return (
    <section className="rm050-keep-together mt-5">
      <h2 className="mb-2 border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-bold uppercase text-neutral-800">
        5. Responsable del Registro
      </h2>
      <div className="flex items-start justify-between gap-8 px-1">
        <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
          <Field label="Nombre" value={registro.responsable_nombre} />
          <Field label="Cargo" value={registro.responsable_cargo} />
          <Field label="Fecha" value={formatDate(registro.created_at)} />
        </div>
        <div className="flex-shrink-0">
          <div className="flex h-20 w-44 items-end justify-center rounded border-b-2 border-neutral-500 bg-neutral-50/30">
            {registro.firma_responsable_data ? (
              <img
                src={registro.firma_responsable_data}
                alt="Firma del responsable"
                className="h-16 w-40 object-contain"
              />
            ) : (
              <span className="pb-2 text-xs text-neutral-400">Sin firma</span>
            )}
          </div>
          <p className="mt-1 text-center text-[10px] font-medium uppercase text-neutral-500">Firma del Responsable</p>
        </div>
      </div>
    </section>
  );
}

function PrintSection5Responsable({ registro }: { registro: RegistroSST }) {
  return (
    <div className="flex h-full flex-col justify-between">
      {/* Top: continuation label */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
        <span>Continuación — Registro de Equipos de Seguridad o Emergencia</span>
        <span>{registro.codigo_documento} · v{registro.version_documento}</span>
      </div>

      {/* Middle: section 5 heading + fields + signature */}
      <div className="rm050-keep-together">
        <h2 className="mb-3 border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-bold uppercase text-neutral-800">
          5. Responsable del Registro
        </h2>
        <div className="flex items-start justify-between gap-12 px-1">
          <div className="grid flex-1 grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
            <Field label="Nombre" value={registro.responsable_nombre} />
            <Field label="Cargo" value={registro.responsable_cargo} />
            <Field label="Fecha" value={formatDate(registro.created_at)} />
          </div>
          <div className="flex-shrink-0">
            <div className="flex h-24 w-52 items-end justify-center rounded border-b-2 border-neutral-500 bg-neutral-50/30">
              {registro.firma_responsable_data ? (
                <img
                  src={registro.firma_responsable_data}
                  alt="Firma del responsable"
                  className="h-20 w-48 object-contain"
                />
              ) : (
                <span className="pb-2 text-xs text-neutral-400">Sin firma</span>
              )}
            </div>
            <p className="mt-1 text-center text-[10px] font-medium uppercase text-neutral-500">Firma del Responsable</p>
          </div>
        </div>
      </div>

      {/* Bottom: footer anchored to page bottom */}
      <div className="flex items-center justify-between border-t border-neutral-200 pt-2 text-[10px] text-neutral-400">
        <span>Registro generado el {formatDateTime(registro.created_at)}</span>
        <span>{registro.codigo_documento} · v{registro.version_documento}</span>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-neutral-900">{value ?? '—'}</p>
    </div>
  );
}

function TipoEquipoRadio({ label, selected }: { label: string; selected: boolean }) {
  return (
    <label
      className={`flex items-center gap-2 rounded border px-4 py-2 text-sm font-medium ${
        selected ? 'border-neutral-900 bg-neutral-100 text-neutral-900' : 'border-neutral-300 text-neutral-500'
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
          selected ? 'border-neutral-900' : 'border-neutral-300'
        }`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-neutral-900" />}
      </span>
      {label}
    </label>
  );
}

function TrabajadoresTableHeader() {
  return (
    <tr className="border-b border-neutral-400 bg-neutral-100 text-center text-[10px] font-bold uppercase text-neutral-700">
      <th className="w-10 border-r border-neutral-300 px-2 py-2">N°</th>
      <th className="border-r border-neutral-300 px-2 py-2 text-left">Nombres y Apellidos</th>
      <th className="border-r border-neutral-300 px-2 py-2">DNI</th>
      <th className="border-r border-neutral-300 px-2 py-2">Área</th>
      <th className="border-r border-neutral-300 px-2 py-2">Fecha de Entrega</th>
      <th className="border-r border-neutral-300 px-2 py-2">Fecha de Renovación</th>
      <th className="px-2 py-2">Firma</th>
    </tr>
  );
}
