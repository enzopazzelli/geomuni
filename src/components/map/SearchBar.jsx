'use client';

import { useState } from 'react';
import { searchParcelaByPadron } from '@/app/actions/geoActions';
import { OpenLocationCode } from 'open-location-code';

const olc = new OpenLocationCode();

/**
 * Buscador de parcelas e infraestructura para GeoMuni
 * @param {Object} props
 * @param {Function} props.onSearchResult Callback al encontrar un resultado
 * @returns {JSX.Element}
 */
export default function SearchBar({ onSearchResult }) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setIsSearching(true);
    
    // 1. ¿Es un Plus Code? (Contiene '+')
    if (q.includes('+')) {
      try {
        let fullCode = q;
        
        // Si es un código corto (menos de 10 caracteres antes del + o longitud total corta)
        if (olc.isShort(q)) {
          // Usamos el centro de Añatuya como referencia para recuperar el código completo
          fullCode = olc.recoverNearest(q, -28.4606, -62.8347);
        }

        if (olc.isFull(fullCode)) {
          const decoded = olc.decode(fullCode);
          onSearchResult({
            lat: decoded.latitudeCenter,
            lng: decoded.longitudeCenter,
            type: 'PlusCode',
            nro_padron: fullCode,
            id: 'pc-' + fullCode,
            estado_fiscal: 'Plus Code',
            superficie_m2: 0,
            propietario: 'Ubicación Geográfica'
          });
          setQuery('');
          setIsSearching(false);
          return;
        }
      } catch (err) { 
        console.error("Error Plus Code:", err);
        alert("El Plus Code no es válido para esta región.");
        setIsSearching(false);
        return;
      }
    }

    // 2. Si no es Plus Code, buscar por Padrón en DB
    const result = await searchParcelaByPadron(q);
    setIsSearching(false);

    if (result) {
      onSearchResult(result);
      setQuery(''); // Limpiar tras éxito
    } else {
      alert('No se encontró el padrón o el Plus Code no es válido.');
    }
  };

  return (
    <div className="absolute top-4 left-4 z-20 w-80">
      <form 
        onSubmit={handleSearch}
        className="flex items-center bg-white/95 backdrop-blur shadow-xl rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all"
      >
        <div className="pl-4 text-slate-400">
          {isSearching ? (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar Padrón o Plus Code..."
          className="w-full px-3 py-3 text-sm font-medium text-slate-700 bg-transparent outline-none placeholder:text-slate-400"
        />
        <button 
          type="submit"
          className="bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100 border-l border-slate-100 transition-colors"
        >
          IR
        </button>
      </form>
    </div>
  );
}
