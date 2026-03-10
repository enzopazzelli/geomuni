/**
 * add_performance_indexes.mjs
 * Agrega índices de rendimiento a una base de datos existente.
 * Seguro de correr múltiples veces (IF NOT EXISTS).
 *
 * Uso: node scripts/migrations/add_performance_indexes.mjs
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=[\"']?(.+?)[\"']?\s/);
if (!dbUrlMatch) {
  console.error('❌ DATABASE_URL no encontrada en .env.local');
  process.exit(1);
}

const sql = neon(dbUrlMatch[1].trim());

async function run() {
  console.log('🚀 GeoMuni — Migrando índices de rendimiento\n');

  await sql`CREATE INDEX IF NOT EXISTS idx_usuarios_rol          ON usuarios(rol);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_usuarios_activo       ON usuarios(activo);`;
  console.log('✓ Índices en usuarios');

  await sql`CREATE INDEX IF NOT EXISTS idx_infraestructura_estado ON infraestructura(estado);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_infraestructura_tipo   ON infraestructura(tipo);`;
  console.log('✓ Índices en infraestructura');

  await sql`CREATE INDEX IF NOT EXISTS idx_historial_obras_infra  ON historial_obras(infraestructura_id);`;
  console.log('✓ Índice en historial_obras');

  console.log('\n✅ Índices aplicados correctamente.\n');
}

run().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
