import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
if (!dbUrlMatch) { console.error('DATABASE_URL no encontrada en .env.local'); process.exit(1); }

const sql = neon(dbUrlMatch[1].trim());

async function run() {
  console.log('Agregando columna observaciones a infraestructura...');

  await sql`
    ALTER TABLE infraestructura
    ADD COLUMN IF NOT EXISTS observaciones TEXT;
  `;

  // Por si el CHECK constraint original sigue activo, lo reemplazamos por uno completo
  await sql`
    ALTER TABLE infraestructura
    DROP CONSTRAINT IF EXISTS infraestructura_estado_check;
  `;

  await sql`
    ALTER TABLE infraestructura
    ADD CONSTRAINT infraestructura_estado_check
    CHECK (estado IN (
      'funcional', 'dañado', 'en_reparacion',
      'pendiente', 'en_progreso', 'finalizado', 'clausurado'
    ));
  `;

  console.log('✅ Columna observaciones agregada.');
  console.log('✅ Constraint de estado actualizado (incluye pendiente, en_progreso, finalizado, clausurado).');
}

run().catch(console.error);
