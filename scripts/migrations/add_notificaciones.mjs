/**
 * Crea la tabla `notificaciones` para el sistema de alertas entre roles.
 * Seguro de correr múltiples veces (IF NOT EXISTS).
 * Uso: node add_notificaciones.mjs
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
  console.log('Iniciando migración: Sistema de Notificaciones...');

  await sql`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo          VARCHAR(50) NOT NULL,
      titulo        TEXT NOT NULL,
      mensaje       TEXT,
      leida         BOOLEAN DEFAULT FALSE,
      referencia_id UUID REFERENCES infraestructura(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✓ Tabla notificaciones creada');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario
      ON notificaciones(usuario_id, leida)
  `;
  console.log('✓ Índice creado');

  console.log('\n✅ Migración completada. Ejecutá la app para comenzar a recibir notificaciones.');
}

main().catch(err => {
  console.error('Error en migración:', err.message);
  process.exit(1);
});
