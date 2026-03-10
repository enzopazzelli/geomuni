'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), { 
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cargando Mapa...</p>
      </div>
    </div>
  )
});

/**
 * Página principal de GeoMuni
 * @returns {JSX.Element}
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex h-16 items-center border-b bg-white px-4 md:px-6 gap-4 shadow-sm">
        <div className="flex items-center gap-2 md:gap-3">
          <span className="text-xl font-black text-blue-600 tracking-tighter uppercase italic">GeoMuni</span>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-black text-slate-800 uppercase tracking-tight">Añatuya</span>
            <span className="hidden sm:block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Santiago del Estero</span>
          </div>
        </div>
        <nav className="ml-auto">
          <Link href="/dashboard" className="hidden md:inline-flex bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-600 transition-all items-center gap-1.5">
            📊 Panel de Control
          </Link>
          <Link href="/dashboard" className="md:hidden bg-slate-900 text-white p-2 rounded-xl text-base hover:bg-blue-600 transition-all">
            📊
          </Link>
        </nav>
      </header>

      <section className="flex-1 overflow-hidden p-4">
        <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <LeafletMap />
        </div>
      </section>
    </main>
  );
}
