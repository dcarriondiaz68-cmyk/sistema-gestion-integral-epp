export type TipoFirma = 'TRABAJADOR' | 'RESPONSABLE';

export interface EntregaFirma {
  id: string;
  entrega_id: string;
  tipo_firma: TipoFirma;
  firma_data: string;
  firmado_por: string | null;
  nombre_firmante: string;
  fecha_firma: string;
  created_at: string;
}

export interface EntregaFirmaWithRelations extends EntregaFirma {
  firmado_nombre: string;
}
