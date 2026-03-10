import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
const sql = neon(dbUrlMatch[1]);

async function setupAuth() {
  try {
    console.log("Actualizando tabla de usuarios y roles...");
    
    await sql`DROP TABLE IF EXISTS usuarios CASCADE;`;
    
    await sql`
      CREATE TABLE usuarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        rol TEXT CHECK (rol IN ('administrador', 'editor', 'consultor')) DEFAULT 'consultor',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `;

    // Crear usuario admin inicial
    const hashedPass = await bcrypt.hash('admin123', 10);
    
    await sql`
      INSERT INTO usuarios (nombre, email, password, rol)
      VALUES ('Admin GeoMuni', 'admin@geomuni.gov.ar', ${hashedPass}, 'administrador')
      ON CONFLICT (email) DO NOTHING;
    `;

    console.log("✅ Base de datos preparada para Autenticación.");
    console.log("👤 Usuario inicial: admin@geomuni.gov.ar / admin123");
  } catch (e) {
    console.error("❌ Error en setup de Auth:", e.message);
  }
}

setupAuth();
