-- Habilitar la extensión PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla de Propietarios
CREATE TABLE propietarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    contacto TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Parcelas (Polígonos)
CREATE TABLE parcelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nro_padron TEXT UNIQUE NOT NULL,
    propietario_id UUID REFERENCES propietarios(id) ON DELETE SET NULL,
    geometria GEOMETRY(Polygon, 4326) NOT NULL,
    estado_fiscal TEXT CHECK (estado_fiscal IN ('al_dia', 'moroso', 'exento')) DEFAULT 'al_dia',
    valor_fiscal NUMERIC(15, 2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Infraestructura (Puntos)
CREATE TABLE infraestructura (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL, -- 'luminaria', 'bache', 'semaforo', 'contenedor'
    posicion GEOMETRY(Point, 4326) NOT NULL,
    estado TEXT CHECK (estado IN ('funcional', 'dañado', 'en_reparacion')) DEFAULT 'funcional',
    fotos TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Inspecciones
CREATE TABLE inspecciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    infra_id UUID REFERENCES infraestructura(id) ON DELETE CASCADE,
    fecha TIMESTAMPTZ DEFAULT now(),
    observacion TEXT,
    tecnico_id UUID -- Referencia a auth.users si usamos Supabase Auth
);

-- Índices Espaciales (GIST) para optimizar consultas geográficas
CREATE INDEX idx_parcelas_geometria ON parcelas USING GIST (geometria);
CREATE INDEX idx_infraestructura_posicion ON infraestructura USING GIST (posicion);

-- Habilitar RLS (Row Level Security)
ALTER TABLE propietarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE infraestructura ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspecciones ENABLE ROW LEVEL SECURITY;

-- Políticas Básicas (Lectura pública, edición autenticada)
-- Nota: En producción estas políticas se ajustarían según roles específicos.
CREATE POLICY "Lectura pública de parcelas" ON parcelas FOR SELECT USING (true);
CREATE POLICY "Lectura pública de infraestructura" ON infraestructura FOR SELECT USING (true);

-- Política para que solo usuarios autenticados puedan insertar/editar
CREATE POLICY "Edición restringida a empleados" ON infraestructura 
    FOR ALL USING (auth.role() = 'authenticated');
