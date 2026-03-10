/**
 * Aplica la migración 20260308_parcelas_robustecimiento a la base de datos.
 * Es seguro correr múltiples veces (usa ADD COLUMN IF NOT EXISTS).
 * Uso: node apply_migration.mjs
 */
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
if (!dbUrlMatch) { console.error('DATABASE_URL no encontrada en .env.local'); process.exit(1); }

const sql = neon(dbUrlMatch[1]);

console.log('Aplicando migración de enrobustecimiento de parcelas...');

try {
  // Módulo A: Servicios
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS agua_corriente    BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS energia_electrica BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS cloacas           BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS gas_natural       BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS pavimento         TEXT`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS alumbrado_publico BOOLEAN DEFAULT FALSE`;
  console.log('  ✓ Módulo A: Servicios e Infraestructura');

  // Módulo B: Edificación
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS superficie_cubierta    NUMERIC(15,2) DEFAULT 0`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS cantidad_plantas       INTEGER DEFAULT 0`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS antiguedad             INTEGER`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS categoria_edificatoria TEXT`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS estado_conservacion    TEXT`;
  console.log('  ✓ Módulo B: Edificación y Mejoras');

  // Módulo C: Legal
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS numero_plano          TEXT`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS expediente_municipal  TEXT`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS zonificacion          TEXT`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS restricciones         TEXT`;
  console.log('  ✓ Módulo C: Legal y Catastral');

  // Módulo D: Suelo Fiscal
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS es_fiscal       BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS estado_ocupacion TEXT`;
  await sql`ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS destino_previsto TEXT`;
  console.log('  ✓ Módulo D: Gestión de Suelo Fiscal');

  console.log('\n✅ Migración aplicada correctamente. Podés correr "npm run dev" y las parcelas deberían visualizarse.');
} catch (e) {
  console.error('❌ Error al aplicar la migración:', e.message);
}

process.exit(0);
