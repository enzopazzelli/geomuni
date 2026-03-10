'use client';

import { useState, useRef } from 'react';
import { searchParcelaByPadron } from '@/app/actions/geoActions';
import { OpenLocationCode } from 'open-location-code';

const olc = new OpenLocationCode();

export default function SearchBar({ onSearchResult }) {
  const [query, setQuery]         = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const inputRef = useRef(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setIsSearching(true);

    if (q.includes('+')) {
      try {
        let fullCode = q;
        if (olc.isShort(q)) {
          fullCode = olc.recoverNearest(q, -28.4606, -62.8347);
        }
        if (olc.isFull(fullCode)) {
          onSearchResult({
            lat: olc.decode(fullCode).latitudeCenter,
            lng: olc.decode(fullCode).longitudeCenter,
            type: 'PlusCode',
            nro_padron: fullCode,
            id: 'pc-' + fullCode,
            estado_fiscal: 'Plus Code',
            superficie_m2: 0,
            propietario: 'Ubicación Geográfica'
          });
          setQuery('');
          setMobileOpen(false);
          setIsSearching(false);
          return;
        }
      } catch (err) {
        alert('El Plus Code no es válido para esta región.');
        setIsSearching(false);
        return;
      }
    }

    const result = await searchParcelaByPadron(q);
    setIsSearching(false);

    if (result) {
      onSearchResult(result);
      setQuery('');
      setMobileOpen(false);
    } else {
      alert('No se encontró el padrón o el Plus Code no es válido.');
    }
  };

  const SearchIcon = () => (
    isSearching
      ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
  );

  return (
    <>
      {/* ── DESKTOP: barra siempre visible ─────────────────────────── */}
      <div className="hidden md:block absolute top-4 left-4 z-20 w-80">
        <form
          onSubmit={handleSearch}
          className="flex items-center bg-white/95 backdrop-blur shadow-xl rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all"
        >
          <div className="pl-4 text-slate-400">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar Padrón o Plus Code..."
            className="w-full px-3 py-3 text-sm font-medium text-slate-700 bg-transparent outline-none placeholder:text-slate-400"
          />
          <button type="submit" className="bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100 border-l border-slate-100 transition-colors">
            IR
          </button>
        </form>
      </div>

      {/* ── MOBILE: ícono colapsable ───────────────────────────────── */}
      <div className="md:hidden absolute top-4 left-4 z-20 flex flex-col gap-2">
        {/* Botón ícono */}
        <button
          onClick={() => {
            setMobileOpen(v => !v);
            if (!mobileOpen) setTimeout(() => inputRef.current?.focus(), 80);
          }}
          className={`w-10 h-10 rounded-2xl shadow-lg border flex items-center justify-center transition-all ${mobileOpen ? 'bg-slate-900 text-white border-slate-700' : 'bg-white/95 text-slate-500 border-slate-200 backdrop-blur'}`}
          title="Buscar padrón"
        >
          <SearchIcon />
        </button>

        {/* Input expandido */}
        {mobileOpen && (
          <form
            onSubmit={handleSearch}
            className="bg-white/95 backdrop-blur shadow-2xl rounded-2xl border border-slate-200 overflow-hidden"
            style={{ width: 'calc(100vw - 5rem)' }}
          >
            <div className="flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Padrón o Plus Code..."
                className="flex-1 px-3 py-2.5 text-sm font-medium text-slate-700 bg-transparent outline-none placeholder:text-slate-400"
              />
              <button type="submit" className="bg-slate-900 text-white px-3 py-2.5 text-xs font-black uppercase">
                IR
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
