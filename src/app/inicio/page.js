'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    const base = window.location.origin;
    setQrUrl(
      `https://api.qrserver.com/v1/create-qr-code/?size=160x160&format=png&data=${encodeURIComponent(base + '/reportar')}`
    );
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">

      {/* Fondo */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/bg-ciudad.jpg')" }}
      />
      {/* Overlay degradado */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/70 to-slate-950/90" />

      {/* Contenido */}
      <div className="relative z-10 flex flex-col min-h-screen">

        {/* Header */}
        <header className="flex items-center justify-between px-8 py-5">
          <div>
            <p className="text-white font-black text-lg tracking-tight leading-none">GeoMuni</p>
            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Sistema Municipal GIS</p>
          </div>
          <Link
            href="/login"
            className="text-[10px] font-black uppercase text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 px-4 py-2 rounded-xl transition-all"
          >
            Acceder →
          </Link>
        </header>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8">

          <div className="space-y-4 max-w-2xl">
            <p className="text-slate-400 text-xs font-black uppercase tracking-[0.25em]">Ciudad de Añatuya · Gestión Municipal</p>
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight">
              Gestor de Obra Pública<br/>
              <span className="text-blue-400">e Infraestructura Urbana</span>
            </h1>
            <p className="text-slate-300 text-sm font-medium max-w-lg mx-auto leading-relaxed">
              Sistema de información geográfica para el registro, seguimiento y control
              de la infraestructura y obra pública municipal.
            </p>
          </div>

          {/* CTA ciudadano */}
          <div className="flex flex-col sm:flex-row items-center gap-6">

            <div className="flex flex-col items-center gap-3">
              <Link
                href="/reportar"
                className="bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-wide px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-blue-900/50 hover:shadow-blue-700/50 hover:-translate-y-0.5"
              >
                Reportar un problema
              </Link>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                Sin necesidad de registrarse
              </p>
            </div>

            {/* Separador */}
            <div className="hidden sm:flex flex-col items-center gap-1 text-slate-600">
              <div className="w-px h-10 bg-slate-700" />
              <span className="text-[9px] font-black uppercase">ó</span>
              <div className="w-px h-10 bg-slate-700" />
            </div>

            {/* QR */}
            <div className="flex flex-col items-center gap-2">
              <div className="bg-white p-2.5 rounded-2xl shadow-xl">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR Reportar" width={120} height={120} className="block" />
                ) : (
                  <div className="w-[120px] h-[120px] bg-slate-100 rounded-xl animate-pulse" />
                )}
              </div>
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Escaneá para reportar</p>
            </div>
          </div>

          {/* Chips de features */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
            {[
              '🗺️ Mapa catastral',
              '🔧 Seguimiento de obras',
              '📊 Estadísticas',
              '👥 Gestión de roles',
              '📋 Adjudicación a técnicos',
            ].map(f => (
              <span key={f} className="text-[10px] font-bold text-slate-400 bg-slate-800/60 border border-slate-700/50 px-3 py-1.5 rounded-full">
                {f}
              </span>
            ))}
          </div>

        </main>

        {/* Footer */}
        <footer className="px-8 py-6 border-t border-slate-800/60">
          <div className="max-w-2xl mx-auto text-center space-y-1.5">
            <p className="text-slate-400 text-xs font-bold leading-relaxed">
              GeoMuni es un proyecto de interés propio, desarrollado por una sola persona,
              con el objetivo de dar herramientas concretas y facilitar la gestión de obras en la ciudad.
            </p>
            <p className="text-slate-600 text-[10px] font-bold">
              Toda sugerencia es bien recibida —{' '}
              <a
                href="mailto:geomuni@geomuni.gov.ar"
                className="text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                contacto
              </a>
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}
