/**
 * Agrega columnas de contacto a la tabla `personal`:
 *   telefono TEXT, email TEXT, activo BOOLEAN DEFAULT TRUE
 * Seguro de correr múltiples veces (IF NOT EXISTS via ALTER … ADD COLUMN IF NOT EXISTS).
 * Uso: node add_personal_contacto.mjs
 */
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
if (!dbUrlMatch) { console.error('DATABASE_URL no encontrada en .env.local'); process.exit(1); }

const sql = neon(dbUrlMatch[1]);

async function main() {
  console.log('Iniciando migración: datos de contacto en personal...');

  await sql`ALTER TABLE personal ADD COLUMN IF NOT EXISTS telefono TEXT`;
  console.log('✓ Columna telefono agregada');

  await sql`ALTER TABLE personal ADD COLUMN IF NOT EXISTS email TEXT`;
  console.log('✓ Columna email agregada');

  await sql`ALTER TABLE personal ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE`;
  console.log('✓ Columna activo agregada');

  // Marcar todos los existentes como activos
  await sql`UPDATE personal SET activo = TRUE WHERE activo IS NULL`;
  console.log('✓ Registros existentes marcados como activos');

  console.log('\n✅ Migración completada. Corré npm run dev y abrí la tab Cuadrillas en el Dashboard.');
}

main().catch(err => {
  console.error('Error en migración:', err.message);
  process.exit(1);
});
