import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const hashedPass = await bcrypt.hash('admin123', 10);
    
    await sql`DELETE FROM usuarios WHERE email = 'admin@geomuni.gov.ar'`;
    
    await sql`
      INSERT INTO usuarios (nombre, email, password, rol)
      VALUES ('Administrador General', 'admin@geomuni.gov.ar', ${hashedPass}, 'administrador')
    `;

    return NextResponse.json({ success: true, message: "Cuenta admin reseteada con éxito" });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
