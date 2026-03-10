import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en el entorno.');
}

/**
 * Cliente SQL de Postgres nativo para máxima estabilidad en Node.js
 */
export const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: process.env.NODE_ENV === 'production' ? 50 : 20,
  idle_timeout: 30,
  connect_timeout: 30,
});
