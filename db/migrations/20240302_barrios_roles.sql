-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Tabla de Barrios (Polígonos de gestión)
CREATE TABLE IF NOT EXISTS barrios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    geometria GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Roles para el Personal Municipal
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL -- 'administrador', 'editor', 'consultor'
);

INSERT INTO roles (nombre) VALUES ('administrador'), ('editor'), ('consultor') ON CONFLICT DO NOTHING;

-- 3. Tabla de Usuarios (Sincronizable con Clerk/NextAuth luego)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    barrio_asignado_id UUID REFERENCES barrios(id) -- Para restringir operarios a su barrio
);

-- 4. Índice Espacial para Barrios
CREATE INDEX IF NOT EXISTS idx_barrios_geometria ON barrios USING GIST (geometria);

-- 5. Modificación en Parcelas para vincularlas a Barrios automáticamente
-- (Se puede calcular espacialmente, pero añadimos la columna para caché)
ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS barrio_id UUID REFERENCES barrios(id);
