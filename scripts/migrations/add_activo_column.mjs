/**
 * Agrega columna `activo` a la tabla usuarios (para poder suspender cuentas).
 * Seguro de correr múltiples veces.
 * Uso: node add_activo_column.mjs
 */
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
if (!dbUrlMatch) { console.error('DATABASE_URL no encontrada en .env.local'); process.exit(1); }

const sql = neon(dbUrlMatch[1]);

try {
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE`;
  await sql`UPDATE usuarios SET activo = TRUE WHERE activo IS NULL`;
  console.log('✅ Columna activo agregada correctamente a la tabla usuarios.');
} catch (e) {
  console.error('❌ Error:', e.message);
}

process.exit(0);
