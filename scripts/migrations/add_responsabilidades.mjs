import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
if (!dbUrlMatch) { console.error('DATABASE_URL no encontrada en .env.local'); process.exit(1); }

const sql = neon(dbUrlMatch[1]);

async function main() {
  console.log('Iniciando migración: Sistema de Responsabilidades...');

  // 1. Ampliar constraint de rol en usuarios
  await sql`ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check`;
  await sql`
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
      CHECK (rol IN ('administrador', 'editor', 'consultor', 'tecnico'))
  `;
  console.log('✓ Constraint de roles actualizado (incluye tecnico)');

  // 2. Adjudicación en infraestructura
  await sql`
    ALTER TABLE infraestructura
      ADD COLUMN IF NOT EXISTS adjudicado_a UUID REFERENCES usuarios(id)
  `;
  await sql`
    ALTER TABLE infraestructura
      ADD COLUMN IF NOT EXISTS fecha_adjudicacion TIMESTAMPTZ
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_infraestructura_adjudicado
      ON infraestructura(adjudicado_a)
  `;
  console.log('✓ Columnas adjudicado_a y fecha_adjudicacion agregadas a infraestructura');

  console.log('\n✅ Migración completada exitosamente.');
  console.log('Ahora podés crear usuarios con rol "tecnico" desde el panel /admin.');
}

main().catch(err => {
  console.error('Error en migración:', err.message);
  process.exit(1);
});
