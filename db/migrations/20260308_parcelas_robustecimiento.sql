-- Migración: Enrobustecimiento del Modelo de Datos (Parcelas) - Fase 4
-- Basado en el PLAN_DE_ACCION_ROBUSTECIMIENTO.md (Punto 1)

ALTER TABLE parcelas
    -- A. Módulo de Servicios e Infraestructura
    ADD COLUMN IF NOT EXISTS agua_corriente BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS energia_electrica BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cloacas BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS gas_natural BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pavimento TEXT CHECK (pavimento IN ('Tierra', 'Ripio', 'Hormigón', 'Asfalto')) DEFAULT 'Tierra',
    ADD COLUMN IF NOT EXISTS alumbrado_publico BOOLEAN DEFAULT FALSE,

    -- B. Módulo de Edificación y Mejoras
    ADD COLUMN IF NOT EXISTS superficie_cubierta NUMERIC(15, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cantidad_plantas INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS antiguedad INTEGER,
    ADD COLUMN IF NOT EXISTS categoria_edificatoria TEXT CHECK (categoria_edificatoria IN ('Residencial Lujo', 'Media', 'Económica', 'Industrial')),
    ADD COLUMN IF NOT EXISTS estado_conservacion TEXT CHECK (estado_conservacion IN ('Excelente', 'Bueno', 'Regular', 'Malo')),

    -- C. Módulo Legal y Catastral
    ADD COLUMN IF NOT EXISTS numero_plano TEXT,
    ADD COLUMN IF NOT EXISTS expediente_municipal TEXT,
    ADD COLUMN IF NOT EXISTS zonificacion TEXT,
    ADD COLUMN IF NOT EXISTS restricciones TEXT,

    -- D. Gestión de Suelo Fiscal
    ADD COLUMN IF NOT EXISTS es_fiscal BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS estado_ocupacion TEXT CHECK (estado_ocupacion IN ('Libre', 'Concesionado', 'Usurpado', 'En Litigio')),
    ADD COLUMN IF NOT EXISTS destino_previsto TEXT CHECK (destino_previsto IN ('Parque', 'Vivienda Social', 'Reserva Natural', 'Equipamiento'));
