'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

/* ── Scroll-reveal hook ── */
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

/* ── Feature cards data ── */
const FEATURES = [
  {
    icon: '🗺️',
    color: 'from-blue-500 to-cyan-500',
    glow: 'group-hover:shadow-blue-500/25',
    title: 'Mapa Catastral Interactivo',
    desc: 'Visualización de parcelas en capas PostGIS con edición de geometría en tiempo real. Cinco modos de visualización fiscal y de servicios.',
  },
  {
    icon: '🔧',
    color: 'from-orange-500 to-amber-400',
    glow: 'group-hover:shadow-orange-500/25',
    title: 'Gestión de Obras Públicas',
    desc: 'Ciclo de vida completo de reportes de infraestructura urbana: baches, luminarias, semáforos, basurales. Estados, fotos y adjudicación.',
  },
  {
    icon: '📊',
    color: 'from-emerald-500 to-teal-400',
    glow: 'group-hover:shadow-emerald-500/25',
    title: 'Dashboard y Estadísticas',
    desc: 'Panel tabular con catastro, obras, historial y cuadrillas. KPIs con exportación a PDF. Filtros, paginación y búsqueda integrada.',
  },
  {
    icon: '👥',
    color: 'from-violet-500 to-purple-500',
    glow: 'group-hover:shadow-violet-500/25',
    title: 'Control de Acceso por Roles',
    desc: 'Cuatro roles: Administrador, Editor, Técnico y Consultor. Protección server-side con Auth.js v5 y JWT. Middleware de rutas.',
  },
  {
    icon: '📱',
    color: 'from-rose-500 to-pink-500',
    glow: 'group-hover:shadow-rose-500/25',
    title: 'Reporte Ciudadano Público',
    desc: 'Formulario sin login con geolocalización y QR. Sube fotos, elige el punto en el mapa y seguí el estado con tu número de ticket.',
  },
  {
    icon: '🔔',
    color: 'from-yellow-400 to-orange-400',
    glow: 'group-hover:shadow-yellow-400/25',
    title: 'Notificaciones y Auditoría',
    desc: 'Alertas en tiempo real entre usuarios con deep-link directo al reporte. Historial de cambios completo para parcelas y obras.',
  },
];

/* ── Roles data ── */
const ROLES = [
  {
    name: 'Administrador',
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
    perms: ['Gestión completa de usuarios', 'Eliminar registros', 'Todas las funciones del sistema'],
  },
  {
    name: 'Editor',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    dot: 'bg-blue-400',
    perms: ['Crear y editar parcelas', 'Gestionar reportes', 'Adjudicar tareas a técnicos'],
  },
  {
    name: 'Técnico',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
    perms: ['Ver sus reportes adjudicados', 'Actualizar estado de obras', 'Editar geometría asignada'],
  },
  {
    name: 'Consultor',
    badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    dot: 'bg-slate-400',
    perms: ['Visualización de catastro', 'Lectura de estadísticas', 'Sin capacidad de edición'],
  },
];

/* ── Stack badges ── */
const STACK = [
  { label: 'Next.js 15', sub: 'App Router', color: 'bg-slate-800 border-slate-600' },
  { label: 'PostGIS', sub: 'Neon PostgreSQL', color: 'bg-blue-950 border-blue-700' },
  { label: 'Leaflet + Geoman', sub: 'Mapas interactivos', color: 'bg-green-950 border-green-700' },
  { label: 'Auth.js v5', sub: 'JWT + RBAC', color: 'bg-purple-950 border-purple-700' },
  { label: 'Tailwind CSS', sub: 'Dark UI', color: 'bg-cyan-950 border-cyan-700' },
  { label: 'jsPDF', sub: 'Exportación PDF', color: 'bg-orange-950 border-orange-700' },
];

/* ── Steps ── */
const STEPS = [
  { n: '01', title: 'Accedé al sitio', desc: 'Entrá desde el celular o escaneá el código QR. No hace falta registrarse.' },
  { n: '02', title: 'Ubicá el problema', desc: 'Marcá el punto en el mapa o usá tu geolocalización. Sacá una foto si podés.' },
  { n: '03', title: 'Enviá el reporte', desc: 'Describí el problema y elegí el tipo. Recibirás un número de ticket único.' },
  { n: '04', title: 'Seguí el estado', desc: 'Con tu ticket podés consultar en cualquier momento el avance de la reparación.' },
];

/* ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [qrUrl, setQrUrl] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [featRef, featVisible] = useReveal();
  const [rolesRef, rolesVisible] = useReveal();
  const [stepsRef, stepsVisible] = useReveal();
  const [stackRef, stackVisible] = useReveal();

  useEffect(() => {
    const base = window.location.origin;
    setQrUrl(
      `https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=png&data=${encodeURIComponent(base + '/reportar')}`
    );
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="bg-slate-950 text-white min-h-screen overflow-x-hidden">

      {/* ── NAVBAR ─────────────────────────────────────── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/95 backdrop-blur-md border-b border-slate-800/60 shadow-xl shadow-black/30' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow">
              <span className="text-sm font-black text-white">G</span>
            </div>
            <div className="leading-none">
              <p className="text-white font-black text-sm tracking-tight">GeoMuni</p>
              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Sistema Municipal GIS</p>
            </div>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {[['#features', 'Features'], ['#roles', 'Roles'], ['#flujo', 'Cómo funciona'], ['#stack', 'Stack']].map(([href, label]) => (
              <a key={href} href={href} className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/60 transition-all">
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/reportar" className="hidden md:block text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors">
              Reportar →
            </Link>
            <Link href="/login" className="text-[11px] font-black uppercase text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-900/40 hover:shadow-blue-700/50">
              Acceder
            </Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-slate-400 hover:text-white p-1.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950/98 px-6 py-4 flex flex-col gap-2">
            {[['#features', 'Features'], ['#roles', 'Roles'], ['#flujo', 'Cómo funciona'], ['#stack', 'Stack']].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-slate-300 hover:text-white py-2 border-b border-slate-800/50">
                {label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO ───────────────────────────────────────── */}
      <section id="hero" className="relative min-h-screen flex flex-col">
        {/* Background */}
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/bg-aniatuya.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-900/75 to-slate-950" />

        {/* Accent glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 w-72 h-72 bg-cyan-500/6 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 text-blue-300 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            Ciudad de Añatuya · Gestión Municipal
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-6 max-w-3xl">
            Infraestructura Urbana{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
              en el Mapa
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg font-medium max-w-xl mx-auto leading-relaxed mb-10">
            Sistema GIS municipal para el registro, seguimiento y control de catastro,
            obra pública e infraestructura urbana —con participación ciudadana integrada.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-14">
            <Link href="/reportar" className="group inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-wide px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-blue-900/50 hover:shadow-blue-700/60 hover:-translate-y-0.5">
              <span>Reportar un Problema</span>
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 bg-slate-800/70 hover:bg-slate-700/70 border border-slate-600/50 hover:border-slate-500 text-white font-bold text-sm px-8 py-4 rounded-2xl transition-all backdrop-blur-sm hover:-translate-y-0.5">
              Acceder al sistema
            </Link>
          </div>

          {/* QR + stat chips */}
          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* QR */}
            <div className="flex flex-col items-center gap-2">
              <div className="bg-white p-2.5 rounded-2xl shadow-2xl shadow-black/40">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Reportar" width={110} height={110} className="block rounded-lg" />
                ) : (
                  <div className="w-[110px] h-[110px] bg-slate-100 rounded-lg animate-pulse" />
                )}
              </div>
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Escaneá para reportar</p>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-24 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />

            {/* Chips */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 max-w-xs">
              {['🗺️ Mapa catastral', '🔧 Gestión de obras', '📊 Dashboard & KPIs', '👥 4 roles de acceso', '🔔 Notificaciones', '📱 Reporte ciudadano'].map(f => (
                <span key={f} className="text-[10px] font-bold text-slate-400 bg-slate-800/60 border border-slate-700/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="relative z-10 flex justify-center pb-8">
          <a href="#features" className="flex flex-col items-center gap-1.5 text-slate-600 hover:text-slate-400 transition-colors">
            <span className="text-[9px] font-bold uppercase tracking-widest">Ver más</span>
            <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </a>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div ref={featRef} className={`transition-all duration-700 ${featVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

            {/* Header */}
            <div className="text-center mb-16">
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.25em] mb-3">Funcionalidades</p>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
                Todo lo que necesita{' '}
                <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">un municipio</span>
              </h2>
              <p className="text-slate-400 text-base max-w-xl mx-auto">
                Desde el catastro hasta el reporte ciudadano, GeoMuni centraliza la gestión geográfica municipal en una sola plataforma.
              </p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className={`group relative bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${f.glow} cursor-default`}
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  {/* Gradient background on hover */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300`} />

                  <div className={`inline-flex w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} items-center justify-center text-xl mb-4 shadow-lg`}>
                    {f.icon}
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ROLES ───────────────────────────────────────── */}
      <section id="roles" className="py-24 px-6 bg-slate-900/30">
        <div className="max-w-6xl mx-auto">
          <div ref={rolesRef} className={`transition-all duration-700 ${rolesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

            <div className="text-center mb-16">
              <p className="text-violet-400 text-[10px] font-black uppercase tracking-[0.25em] mb-3">Control de Acceso</p>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
                Roles y{' '}
                <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">permisos granulares</span>
              </h2>
              <p className="text-slate-400 text-base max-w-xl mx-auto">
                Cada usuario accede solo a lo que necesita. El rol se verifica server-side en cada acción, sin excepciones.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {ROLES.map((r, i) => (
                <div
                  key={r.name}
                  className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all duration-300 hover:-translate-y-0.5"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className={`inline-flex items-center gap-1.5 border text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full mb-4 ${r.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
                    {r.name}
                  </div>
                  <ul className="space-y-2">
                    {r.perms.map(p => (
                      <li key={p} className="flex items-start gap-2 text-slate-400 text-xs">
                        <svg className="w-3.5 h-3.5 text-slate-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Auth badge */}
            <div className="mt-8 flex justify-center">
              <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-full px-5 py-2.5 text-xs text-slate-400">
                <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                Autenticación con <strong className="text-slate-300">Auth.js v5</strong> · JWT + bcryptjs · Middleware de rutas protegidas
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ────────────────────────────────── */}
      <section id="flujo" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div ref={stepsRef} className={`transition-all duration-700 ${stepsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

            <div className="text-center mb-16">
              <p className="text-rose-400 text-[10px] font-black uppercase tracking-[0.25em] mb-3">Reporte Ciudadano</p>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
                Reportá un problema{' '}
                <span className="bg-gradient-to-r from-rose-400 to-pink-300 bg-clip-text text-transparent">en 4 pasos</span>
              </h2>
              <p className="text-slate-400 text-base max-w-lg mx-auto">
                Sin registro ni contraseñas. Cualquier vecino puede reportar un problema desde su celular.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map((s, i) => (
                <div key={s.n} className="relative flex flex-col items-start gap-3">
                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden lg:block absolute top-5 left-[calc(100%-0px)] w-full h-px bg-gradient-to-r from-slate-700 to-transparent pointer-events-none" />
                  )}
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/10 border border-rose-500/30 text-rose-300 font-black text-sm">
                    {s.n}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">{s.title}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link href="/reportar" className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-sm uppercase tracking-wide px-7 py-3.5 rounded-2xl transition-all shadow-xl shadow-rose-900/40 hover:-translate-y-0.5">
                Ir al formulario de reporte
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
              {qrUrl && (
                <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-3">
                  <div className="bg-white p-1.5 rounded-lg">
                    <img src={qrUrl} alt="QR" width={60} height={60} className="block rounded" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold">Código QR</p>
                    <p className="text-slate-500 text-[10px]">Compartilo en cartelería</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── TECH STACK ──────────────────────────────────── */}
      <section id="stack" className="py-24 px-6 bg-slate-900/30">
        <div className="max-w-5xl mx-auto">
          <div ref={stackRef} className={`transition-all duration-700 ${stackVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

            <div className="text-center mb-16">
              <p className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.25em] mb-3">Stack Tecnológico</p>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
                Construido con{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-blue-300 bg-clip-text text-transparent">tecnología moderna</span>
              </h2>
              <p className="text-slate-400 text-base max-w-xl mx-auto">
                Desarrollado con herramientas de producción, principios de PostGIS-first y arquitectura escalable.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
              {STACK.map((s, i) => (
                <div
                  key={s.label}
                  className={`border ${s.color} rounded-2xl p-4 hover:scale-[1.02] transition-transform duration-200`}
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  <p className="text-white font-bold text-sm">{s.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Architecture note */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-6 text-center">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Principio arquitectural</p>
              <p className="text-slate-300 text-sm font-semibold">
                Toda la lógica espacial corre en la base de datos mediante funciones{' '}
                <code className="text-cyan-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">ST_*</code>{' '}
                de PostGIS. El cliente recibe GeoJSON listo para renderizar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/60 rounded-3xl p-12 overflow-hidden">
            {/* Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-48 h-24 bg-cyan-500/8 rounded-full blur-2xl pointer-events-none" />

            <div className="relative">
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.25em] mb-4">Proyecto Open Source</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                Querés probarlo o colaborar?
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-md mx-auto">
                GeoMuni es un proyecto de interés propio. Toda sugerencia, feedback o colaboración es bienvenida.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/login" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-wide px-7 py-3.5 rounded-2xl transition-all shadow-xl shadow-blue-900/40 hover:-translate-y-0.5">
                  Probar el sistema
                </Link>
                <a
                  href="mailto:enzopazzelli1@gmail.com"
                  className="inline-flex items-center gap-2 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-bold text-sm px-7 py-3.5 rounded-2xl transition-all hover:-translate-y-0.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                  Contacto
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="border-t border-slate-800/60 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">G</span>
            </div>
            <span className="text-slate-500 text-xs font-bold">GeoMuni — Sistema Municipal GIS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/reportar" className="text-slate-600 hover:text-slate-400 text-xs font-medium transition-colors">Reportar problema</Link>
            <Link href="/login" className="text-slate-600 hover:text-slate-400 text-xs font-medium transition-colors">Acceder</Link>
            <a href="mailto:enzopazzelli1@gmail.com" className="text-slate-600 hover:text-slate-400 text-xs font-medium transition-colors">Contacto</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
