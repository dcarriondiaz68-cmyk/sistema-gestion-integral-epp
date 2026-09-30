export const APP_CONFIG = {
  name: 'Gestión Integral de EPP',
  shortName: 'Gestión EPP',
  description:
    'Sistema de Gestión Integral de Equipos de Protección Personal para Seguridad y Salud en el Trabajo',
  version: '1.0.0',
  phase: 'Fase 6 — Gestión de Usuarios',
  locale: 'es-PE',
  timezone: 'America/Lima',
} as const;

export const ENV = import.meta.env.MODE as 'development' | 'production' | 'test';
