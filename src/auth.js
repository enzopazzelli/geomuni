import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const users = await sql`SELECT * FROM usuarios WHERE email = ${credentials.email}`;
          const user = users[0];

          if (!user || !user.password) return null;

          // Verificar cuenta activa
          if (user.activo === false) return null;

          const isMatch = await bcrypt.compare(credentials.password, user.password);
          if (!isMatch) return null;

          return {
            id:     user.id,
            name:   user.nombre,
            email:  user.email,
            rol:    user.rol,
            activo: user.activo,
          };
        } catch (error) {
          return null;
        }
      },
    }),
  ],
});
