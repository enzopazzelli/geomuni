/**
 * setup_production.mjs
 * Script unificado e idempotente para configurar el schema completo en producción (Neon PostgreSQL).
 * Reemplaza todos los scripts de migración incrementales.
 *
 * SEGURO de correr múltiples veces:
 *   - Usa CREATE TABLE IF NOT EXISTS
 *   - Usa ADD COLUMN IF NOT EXISTS
 *   - INSERT con ON CONFLICT DO NOTHING
 *   - NO hace DROP de ninguna tabla de datos
 *
 * Uso: node scripts/setup/setup_production.mjs
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?\s/);
if (!dbUrlMatch) {
  console.error('❌ DATABASE_URL no encontrada en .env.local');
  process.exit(1);
}

const sql = neon(dbUrlMatch[1].trim());

async function run() {
  console.log('🚀 GeoMuni — Setup de base de datos en producción\n');

  // 1. EXTENSIÓN
  await sql`CREATE EXTENSION IF NOT EXISTS postgis;`;
  console.log('✓ Extensión PostGIS');

  // 2. PROPIETARIOS
  await sql`
    CREATE TABLE IF NOT EXISTS propietarios (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dni        TEXT UNIQUE NOT NULL,
      nombre     TEXT NOT NULL,
      apellido   TEXT NOT NULL,
      contacto   TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  console.log('✓ Tabla propietarios');

  // 3. BARRIOS
  await sql`
    CREATE TABLE IF NOT EXISTS barrios (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre      TEXT UNIQUE NOT NULL,
      descripcion TEXT,
      geometria   GEOMETRY(Polygon, 4326) NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_barrios_geometria ON barrios USING GIST (geometria);`;
  console.log('✓ Tabla barrios');

  // 4. USUARIOS
  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre     TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      rol        TEXT DEFAULT 'consultor',
      activo     BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  // Asegurar columna activo si la tabla ya existía sin ella
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;`;
  await sql`UPDATE usuarios SET activo = TRUE WHERE activo IS NULL;`;
  // Actualizar constraint de rol para incluir los 4 roles
  await sql`ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;`;
  await sql`
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
      CHECK (rol IN ('administrador', 'editor', 'consultor', 'tecnico'));
  `;
  console.log('✓ Tabla usuarios');

  // 5. PARCELAS
  await sql`
    CREATE TABLE IF NOT EXISTS parcelas (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nro_padron     TEXT UNIQUE NOT NULL,
      propietario_id UUID REFERENCES propietarios(id) ON DELETE SET NULL,
      barrio_id      UUID REFERENCES barrios(id),
      geometria      GEOMETRY(Polygon, 4326) NOT NULL,
      estado_fiscal  TEXT DEFAULT 'al_dia',
      valor_fiscal   NUMERIC(15, 2),
      superficie     NUMERIC(15, 2),
      created_at     TIMESTAMPTZ DEFAULT now(),
      agua_corriente    BOOLEAN DEFAULT FALSE,
      energia_electrica BOOLEAN DEFAULT FALSE,
      cloacas           BOOLEAN DEFAULT FALSE,
      gas_natural       BOOLEAN DEFAULT FALSE,
      pavimento         TEXT,
      alumbrado_publico BOOLEAN DEFAULT FALSE,
      superficie_cubierta    NUMERIC(15, 2) DEFAULT 0,
      cantidad_plantas       INTEGER DEFAULT 0,
      antiguedad             INTEGER,
      categoria_edificatoria TEXT,
      estado_conservacion    TEXT,
      numero_plano           TEXT,
      expediente_municipal   TEXT,
      zonificacion           TEXT,
      restricciones          TEXT,
      es_fiscal              BOOLEAN DEFAULT FALSE,
      estado_ocupacion       TEXT,
      destino_previsto       TEXT
    );
  `;
  // Columnas que pueden faltar en DBs con schema antiguo
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS barrio_id UUID REFERENCES barrios(id);`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS superficie NUMERIC(15, 2);`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS agua_corriente    BOOLEAN DEFAULT FALSE;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS energia_electrica BOOLEAN DEFAULT FALSE;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS cloacas           BOOLEAN DEFAULT FALSE;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS gas_natural       BOOLEAN DEFAULT FALSE;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS pavimento         TEXT;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS alumbrado_publico BOOLEAN DEFAULT FALSE;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS superficie_cubierta    NUMERIC(15,2) DEFAULT 0;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS cantidad_plantas       INTEGER DEFAULT 0;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS antiguedad             INTEGER;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS categoria_edificatoria TEXT;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS estado_conservacion    TEXT;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS numero_plano           TEXT;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS expediente_municipal   TEXT;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS zonificacion           TEXT;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS restricciones          TEXT;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS es_fiscal              BOOLEAN DEFAULT FALSE;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS estado_ocupacion       TEXT;`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS destino_previsto       TEXT;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_parcelas_geometria ON parcelas USING GIST (geometria);`;
  console.log('✓ Tabla parcelas');

  // 6. PERSONAL (cuadrillas)
  await sql`
    CREATE TABLE IF NOT EXISTS personal (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre       TEXT NOT NULL,
      cuadrilla    TEXT,
      especialidad TEXT,
      telefono     TEXT,
      email        TEXT,
      activo       BOOLEAN DEFAULT TRUE
    );
  `;
  await sql`ALTER TABLE personal ADD COLUMN IF NOT EXISTS telefono TEXT;`;
  await sql`ALTER TABLE personal ADD COLUMN IF NOT EXISTS email    TEXT;`;
  await sql`ALTER TABLE personal ADD COLUMN IF NOT EXISTS activo   BOOLEAN DEFAULT TRUE;`;
  await sql`UPDATE personal SET activo = TRUE WHERE activo IS NULL;`;
  console.log('✓ Tabla personal');

  // 7. INFRAESTRUCTURA
  await sql`
    CREATE TABLE IF NOT EXISTS infraestructura (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tipo               TEXT NOT NULL,
      posicion           GEOMETRY(Point, 4326) NOT NULL,
      estado             TEXT DEFAULT 'pendiente',
      fotos              TEXT[] DEFAULT '{}',
      observaciones      TEXT,
      adjudicado_a       UUID REFERENCES usuarios(id),
      fecha_adjudicacion TIMESTAMPTZ,
      created_at         TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`ALTER TABLE infraestructura ADD COLUMN IF NOT EXISTS observaciones      TEXT;`;
  await sql`ALTER TABLE infraestructura ADD COLUMN IF NOT EXISTS adjudicado_a       UUID REFERENCES usuarios(id);`;
  await sql`ALTER TABLE infraestructura ADD COLUMN IF NOT EXISTS fecha_adjudicacion TIMESTAMPTZ;`;
  // Reemplazar constraint de estado con todos los valores actuales
  await sql`ALTER TABLE infraestructura DROP CONSTRAINT IF EXISTS infraestructura_estado_check;`;
  await sql`
    ALTER TABLE infraestructura ADD CONSTRAINT infraestructura_estado_check
      CHECK (estado IN (
        'funcional', 'dañado', 'en_reparacion',
        'pendiente', 'en_progreso', 'finalizado', 'clausurado'
      ));
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_infraestructura_posicion   ON infraestructura USING GIST (posicion);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_infraestructura_adjudicado ON infraestructura(adjudicado_a);`;
  console.log('✓ Tabla infraestructura');

  // 8. HISTORIAL_OBRAS
  await sql`
    CREATE TABLE IF NOT EXISTS historial_obras (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      infraestructura_id UUID REFERENCES infraestructura(id) ON DELETE CASCADE,
      estado_anterior    TEXT,
      estado_nuevo       TEXT,
      responsable_id     UUID,
      observaciones      TEXT,
      fecha_registro     TIMESTAMPTZ DEFAULT now()
    );
  `;
  console.log('✓ Tabla historial_obras');

  // 9. HISTORIAL_PARCELAS
  await sql`
    CREATE TABLE IF NOT EXISTS historial_parcelas (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parcela_id     UUID NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
      tipo_cambio    TEXT NOT NULL,
      descripcion    TEXT,
      valor_anterior TEXT,
      valor_nuevo    TEXT,
      usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
      usuario_nombre TEXT,
      fecha          TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_historial_parcelas_parcela_id ON historial_parcelas(parcela_id);`;
  console.log('✓ Tabla historial_parcelas');

  // 10. NOTIFICACIONES
  await sql`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo          VARCHAR(50) NOT NULL,
      titulo        TEXT NOT NULL,
      mensaje       TEXT,
      leida         BOOLEAN DEFAULT FALSE,
      referencia_id UUID REFERENCES infraestructura(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id, leida);`;
  console.log('✓ Tabla notificaciones');

  // 11. USUARIO ADMIN INICIAL
  const hashedPass = await bcrypt.hash('admin123', 10);
  await sql`
    INSERT INTO usuarios (nombre, email, password, rol, activo)
    VALUES ('Admin GeoMuni', 'admin@geomuni.gov.ar', ${hashedPass}, 'administrador', TRUE)
    ON CONFLICT (email) DO NOTHING;
  `;
  console.log('✓ Usuario admin (admin@geomuni.gov.ar / admin123)');

  console.log('\n✅ Setup completado. La base de datos está lista para producción.');
  console.log('   Cambiá la contraseña del admin desde /perfil tras el primer login.\n');
}

run().catch(err => {
  console.error('\n❌ Error durante el setup:', err.message);
  process.exit(1);
});
