export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn  = !!auth?.user;
      const isPublic    = nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/reportar') || nextUrl.pathname.startsWith('/inicio');
      const isAdmin     = nextUrl.pathname.startsWith('/admin');
      const isDashboard = nextUrl.pathname.startsWith('/dashboard');

      if (!isLoggedIn && !isPublic) return Response.redirect(new URL('/inicio', nextUrl));

      // Solo administradores acceden a /admin
      if (isLoggedIn && isAdmin && auth.user.rol !== 'administrador') {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }

      // Técnicos no acceden al dashboard general → redirigir a sus reportes
      if (isLoggedIn && isDashboard && auth.user.rol === 'tecnico') {
        return Response.redirect(new URL('/mis-reportes', nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub    = user.id;   // ID del usuario → session.user.id
        token.rol    = user.rol;
        token.activo = user.activo;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id     = token.sub;  // exponer id en el cliente/server actions
        session.user.rol    = token.rol;
        session.user.activo = token.activo;
      }
      return session;
    }
  },
  providers: [],
};
