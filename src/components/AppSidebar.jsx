'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { getReportesPendientesCount } from '@/app/actions/geoActions';
import NotificationBell from './NotificationBell';

const NAV = [
  { href: '/mapa',          icon: '🗺️',  label: 'Mapa',            roles: ['administrador','editor','consultor','tecnico'] },
  { href: '/dashboard',     icon: '📊',  label: 'Dashboard',       roles: ['administrador','editor','consultor'] },
  { href: '/estadisticas',  icon: '📈',  label: 'Estadísticas',    roles: ['administrador','editor','consultor'] },
  { href: '/mis-reportes',  icon: '📋',  label: 'Mis Reportes',    roles: ['tecnico'] },
  { href: '/admin',         icon: '⚙️',  label: 'Admin',           roles: ['administrador'] },
];

const ROL_BADGE = {
  administrador: 'bg-red-100 text-red-700',
  editor:        'bg-blue-100 text-blue-700',
  consultor:     'bg-slate-100 text-slate-600',
  tecnico:       'bg-emerald-100 text-emerald-700',
};

export default function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const rol = session?.user?.rol || 'consultor';

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (rol !== 'tecnico') return;
    const refresh = () => getReportesPendientesCount().then(setPendingCount);
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('reportes-updated', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('reportes-updated', refresh);
    };
  }, [rol, pathname]);

  const links = NAV.filter(n => n.roles.includes(rol));

  return (
    <>
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 min-h-screen bg-slate-900 flex-col shrink-0">

        {/* Usuario + Notificaciones */}
        <div className="px-4 py-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-black shrink-0 shadow-lg shadow-blue-900/40">
              {session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate leading-tight">{session?.user?.name || 'Usuario'}</p>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${ROL_BADGE[rol] || ROL_BADGE.consultor}`}>
                {rol}
              </span>
            </div>
            <NotificationBell />
          </div>
        </div>

        {/* Logo */}
        <div className="px-5 py-3 border-b border-slate-800">
          <p className="text-sm font-black tracking-tighter text-white uppercase">GeoMuni</p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Sistema Municipal GIS</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {links.map(({ href, icon, label }) => {
            const active = pathname.startsWith(href);
            const isMisReportes = href === '/mis-reportes';
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  active
                    ? 'bg-white text-slate-900'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}>
                <span className="text-base leading-none">{icon}</span>
                <span className="flex-1">{label}</span>
                {isMisReportes && pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer — Perfil + Logout */}
        <div className="px-4 py-3 border-t border-slate-800 space-y-1">
          <Link href="/perfil"
            className={`block w-full text-[10px] font-black uppercase py-1.5 rounded-lg transition-all text-center ${
              pathname === '/perfil'
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}>
            👤 Mi perfil
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-[10px] font-black uppercase text-slate-500 hover:text-red-400 hover:bg-slate-800 py-1.5 rounded-lg transition-all text-center">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── MOBILE BOTTOM NAV ──────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 flex items-stretch h-16">
        {links.map(({ href, icon, label }) => {
          const active = pathname.startsWith(href);
          const isMisReportes = href === '/mis-reportes';
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                active ? 'text-white bg-white/10' : 'text-slate-500 hover:text-slate-300'
              }`}>
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[9px] font-black uppercase tracking-tight">{label}</span>
              {isMisReportes && pendingCount > 0 && (
                <span className="absolute top-2 right-[calc(50%-18px)] bg-red-500 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
        {/* Notificaciones en mobile */}
        <div className="flex-1 flex flex-col items-center justify-center gap-0.5 relative text-slate-500">
          <NotificationBell upward />
          <span className="text-[9px] font-black uppercase tracking-tight">Alertas</span>
        </div>
        {/* Perfil en mobile */}
        <Link href="/perfil"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${pathname === '/perfil' ? 'text-white bg-white/10' : 'text-slate-500 hover:text-slate-300'}`}>
          <span className="text-xl leading-none">👤</span>
          <span className="text-[9px] font-black uppercase tracking-tight">Perfil</span>
        </Link>
        {/* Cerrar sesión en mobile */}
        <button
          onClick={() => signOut({ callbackUrl: '/inicio' })}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-red-500 hover:text-red-400 transition-colors"
        >
          <span className="text-xl leading-none">🚪</span>
          <span className="text-[9px] font-black uppercase tracking-tight">Salir</span>
        </button>
      </nav>
    </>
  );
}
