import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
const sql = neon(dbUrlMatch[1]);

async function repairAdmin() {
  try {
    console.log("Reparando cuenta de administrador...");
    
    // 1. Eliminar para asegurar limpieza
    await sql`DELETE FROM usuarios WHERE email = 'admin@geomuni.gov.ar';`;
    
    // 2. Generar nuevo hash exacto
    const hashedPass = await bcrypt.hash('admin123', 10);
    
    // 3. Insertar
    await sql`
      INSERT INTO usuarios (nombre, email, password, rol)
      VALUES ('Administrador General', 'admin@geomuni.gov.ar', ${hashedPass}, 'administrador');
    `;

    console.log("✅ Cuenta reparada.");
    console.log("Email: admin@geomuni.gov.ar");
    console.log("Pass: admin123");
  } catch (e) {
    console.error("❌ Error en reparación:", e.message);
  }
}

repairAdmin();
