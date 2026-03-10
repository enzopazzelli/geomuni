import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
const sql = neon(dbUrlMatch[1]);

const { count } = (await sql`SELECT COUNT(*) as count FROM parcelas`)[0];
console.log(`Parcelas encontradas: ${count}`);

if (Number(count) === 0) {
  console.log('No hay parcelas que eliminar.');
} else {
  await sql`DELETE FROM parcelas`;
  console.log(`✓ ${count} parcelas eliminadas correctamente.`);
}

process.exit(0);
