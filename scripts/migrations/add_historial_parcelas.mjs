import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
if (!dbUrlMatch) { console.error('DATABASE_URL no encontrada en .env.local'); process.exit(1); }
const sql = neon(dbUrlMatch[1].trim());

async function run() {
  console.log('Creando tabla historial_parcelas...');

  await sql`
    CREATE TABLE IF NOT EXISTS historial_parcelas (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parcela_id      UUID NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
      tipo_cambio     TEXT NOT NULL,
      descripcion     TEXT,
      valor_anterior  TEXT,
      valor_nuevo     TEXT,
      usuario_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
      usuario_nombre  TEXT,
      fecha           TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_historial_parcelas_parcela_id
    ON historial_parcelas(parcela_id);
  `;

  console.log('✅ Tabla historial_parcelas creada correctamente.');
  console.log('   Columnas: id, parcela_id, tipo_cambio, descripcion,');
  console.log('             valor_anterior, valor_nuevo, usuario_id, usuario_nombre, fecha');
}

run().catch(console.error);
